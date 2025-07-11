#!/bin/bash

# configure-powerbi.sh - Configure PowerBI and Microsoft Fabric for embedded analytics

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
APP_NAME="${APP_NAME:-fabric-embedded-app}"
WORKSPACE_NAME="${WORKSPACE_NAME:-${APP_NAME}-workspace}"
FABRIC_CAPACITY_NAME="${FABRIC_CAPACITY_NAME:-}"
SERVICE_PRINCIPAL_ID="${SERVICE_PRINCIPAL_ID:-}"
TENANT_ID="${TENANT_ID:-}"
SUBSCRIPTION_ID="${SUBSCRIPTION_ID:-}"
RESOURCE_GROUP="${RESOURCE_GROUP:-}"

# PowerBI REST API URLs
POWERBI_API_BASE="https://api.powerbi.com/v1.0/myorg"
FABRIC_API_BASE="https://api.fabric.microsoft.com/v1"

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function to check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if Azure CLI is installed
    if ! command -v az &> /dev/null; then
        log_error "Azure CLI is not installed. Please install it first."
        exit 1
    fi
    
    # Check if PowerBI CLI is available
    if ! az extension list | grep -q "powerbicli"; then
        log_info "Installing PowerBI CLI extension..."
        az extension add --name powerbicli
    fi
    
    # Check if jq is installed
    if ! command -v jq &> /dev/null; then
        log_error "jq is not installed. Please install it first."
        exit 1
    fi
    
    # Check if curl is installed
    if ! command -v curl &> /dev/null; then
        log_error "curl is not installed. Please install it first."
        exit 1
    fi
    
    # Check if logged in to Azure
    if ! az account show &> /dev/null; then
        log_error "Not logged in to Azure CLI. Please run 'az login' first."
        exit 1
    fi
    
    log_success "Prerequisites check completed"
}

# Function to set default values
set_defaults() {
    log_info "Setting default values..."
    
    # Get current subscription if not provided
    if [ -z "$SUBSCRIPTION_ID" ]; then
        SUBSCRIPTION_ID=$(az account show --query id -o tsv)
        log_info "Using current subscription: $SUBSCRIPTION_ID"
    fi
    
    # Get tenant ID if not provided
    if [ -z "$TENANT_ID" ]; then
        TENANT_ID=$(az account show --query tenantId -o tsv)
        log_info "Using current tenant: $TENANT_ID"
    fi
    
    # Set resource group if not provided
    if [ -z "$RESOURCE_GROUP" ]; then
        RESOURCE_GROUP="${APP_NAME}-rg"
        log_info "Using resource group: $RESOURCE_GROUP"
    fi
    
    # Find Fabric capacity if not provided
    if [ -z "$FABRIC_CAPACITY_NAME" ]; then
        FABRIC_CAPACITY_NAME=$(az fabric capacity list --resource-group $RESOURCE_GROUP --query "[0].name" -o tsv 2>/dev/null || echo "")
        if [ -n "$FABRIC_CAPACITY_NAME" ]; then
            log_info "Found Fabric capacity: $FABRIC_CAPACITY_NAME"
        fi
    fi
    
    log_success "Default values set"
}

# Function to get access token for PowerBI API
get_powerbi_access_token() {
    log_info "Getting access token for PowerBI API..."
    
    # Get access token for PowerBI
    ACCESS_TOKEN=$(az account get-access-token --resource https://analysis.windows.net/powerbi/api --query accessToken -o tsv)
    
    if [ -z "$ACCESS_TOKEN" ]; then
        log_error "Failed to get PowerBI access token"
        exit 1
    fi
    
    log_success "PowerBI access token obtained"
}

# Function to get access token for Fabric API
get_fabric_access_token() {
    log_info "Getting access token for Fabric API..."
    
    # Get access token for Fabric
    FABRIC_ACCESS_TOKEN=$(az account get-access-token --resource https://api.fabric.microsoft.com --query accessToken -o tsv)
    
    if [ -z "$FABRIC_ACCESS_TOKEN" ]; then
        log_error "Failed to get Fabric access token"
        exit 1
    fi
    
    log_success "Fabric access token obtained"
}

# Function to list existing workspaces
list_workspaces() {
    log_info "Listing existing PowerBI workspaces..."
    
    response=$(curl -s -H "Authorization: Bearer $ACCESS_TOKEN" \
        "$POWERBI_API_BASE/groups")
    
    if [ $? -eq 0 ]; then
        echo "$response" | jq '.value[] | {id: .id, name: .name, type: .type, capacityId: .capacityId}' || log_warning "Failed to parse workspaces response"
    else
        log_warning "Failed to list workspaces"
    fi
}

# Function to create or get workspace
create_or_get_workspace() {
    log_info "Creating or getting PowerBI workspace: $WORKSPACE_NAME"
    
    # Check if workspace already exists
    existing_workspace=$(curl -s -H "Authorization: Bearer $ACCESS_TOKEN" \
        "$POWERBI_API_BASE/groups" | \
        jq -r ".value[] | select(.name == \"$WORKSPACE_NAME\") | .id")
    
    if [ -n "$existing_workspace" ] && [ "$existing_workspace" != "null" ]; then
        log_warning "Workspace $WORKSPACE_NAME already exists (ID: $existing_workspace)"
        WORKSPACE_ID=$existing_workspace
    else
        log_info "Creating new workspace: $WORKSPACE_NAME"
        
        # Create workspace
        workspace_response=$(curl -s -X POST \
            -H "Authorization: Bearer $ACCESS_TOKEN" \
            -H "Content-Type: application/json" \
            -d "{\"name\": \"$WORKSPACE_NAME\"}" \
            "$POWERBI_API_BASE/groups")
        
        WORKSPACE_ID=$(echo "$workspace_response" | jq -r '.id')
        
        if [ -n "$WORKSPACE_ID" ] && [ "$WORKSPACE_ID" != "null" ]; then
            log_success "Created workspace: $WORKSPACE_NAME (ID: $WORKSPACE_ID)"
        else
            log_error "Failed to create workspace. Response: $workspace_response"
            exit 1
        fi
    fi
    
    export WORKSPACE_ID
}

# Function to assign workspace to Fabric capacity
assign_workspace_to_capacity() {
    if [ -z "$FABRIC_CAPACITY_NAME" ]; then
        log_warning "No Fabric capacity specified. Skipping capacity assignment."
        return
    fi
    
    log_info "Assigning workspace to Fabric capacity: $FABRIC_CAPACITY_NAME"
    
    # Get capacity ID from Azure
    CAPACITY_ID=$(az fabric capacity show --name $FABRIC_CAPACITY_NAME --resource-group $RESOURCE_GROUP --query id -o tsv)
    
    if [ -z "$CAPACITY_ID" ]; then
        log_error "Failed to get Fabric capacity ID"
        return
    fi
    
    # Extract capacity GUID from full resource ID
    CAPACITY_GUID=$(echo $CAPACITY_ID | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}')
    
    log_info "Capacity GUID: $CAPACITY_GUID"
    
    # Assign workspace to capacity
    assignment_response=$(curl -s -X POST \
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"capacityId\": \"$CAPACITY_GUID\"}" \
        "$POWERBI_API_BASE/groups/$WORKSPACE_ID/AssignToCapacity")
    
    if [ $? -eq 0 ]; then
        log_success "Workspace assigned to Fabric capacity"
    else
        log_warning "Failed to assign workspace to capacity. Response: $assignment_response"
    fi
}

# Function to add Service Principal to workspace
add_service_principal_to_workspace() {
    if [ -z "$SERVICE_PRINCIPAL_ID" ]; then
        log_warning "No Service Principal ID provided. Skipping SP assignment."
        return
    fi
    
    log_info "Adding Service Principal to workspace as Admin..."
    
    # Add Service Principal as workspace admin
    sp_response=$(curl -s -X POST \
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{
            \"identifier\": \"$SERVICE_PRINCIPAL_ID\",
            \"groupUserAccessRight\": \"Admin\",
            \"principalType\": \"App\"
        }" \
        "$POWERBI_API_BASE/groups/$WORKSPACE_ID/users")
    
    if [ $? -eq 0 ]; then
        log_success "Service Principal added to workspace as Admin"
    else
        log_warning "Failed to add Service Principal to workspace. Response: $sp_response"
        log_info "You may need to add the Service Principal manually through PowerBI Portal"
    fi
}

# Function to create sample dataset with RLS
create_sample_dataset() {
    log_info "Creating sample dataset with Row Level Security..."
    
    # Create a simple dataset definition with RLS
    dataset_json='{
        "name": "Fabric Embedded Sample Dataset",
        "tables": [
            {
                "name": "SalesData",
                "columns": [
                    {"name": "Region", "dataType": "string"},
                    {"name": "Sales", "dataType": "double"},
                    {"name": "Date", "dataType": "dateTime"},
                    {"name": "Product", "dataType": "string"}
                ],
                "rows": [
                    ["A", 1000, "2024-01-01T00:00:00", "Product1"],
                    ["A", 1500, "2024-01-02T00:00:00", "Product2"],
                    ["B", 2000, "2024-01-01T00:00:00", "Product1"],
                    ["B", 2500, "2024-01-02T00:00:00", "Product2"]
                ]
            },
            {
                "name": "Users",
                "columns": [
                    {"name": "UserName", "dataType": "string"},
                    {"name": "Region", "dataType": "string"},
                    {"name": "Role", "dataType": "string"}
                ],
                "rows": [
                    ["user@rola.com", "A", "RolA"],
                    ["user@rolb.com", "B", "RolB"],
                    ["admin@company.com", "", "Admin"]
                ]
            }
        ]
    }'
    
    # Create dataset
    dataset_response=$(curl -s -X POST \
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        -H "Content-Type: application/json" \
        -d "$dataset_json" \
        "$POWERBI_API_BASE/groups/$WORKSPACE_ID/datasets")
    
    DATASET_ID=$(echo "$dataset_response" | jq -r '.id')
    
    if [ -n "$DATASET_ID" ] && [ "$DATASET_ID" != "null" ]; then
        log_success "Created sample dataset (ID: $DATASET_ID)"
        export DATASET_ID
    else
        log_warning "Failed to create sample dataset. Response: $dataset_response"
    fi
}

# Function to configure Row Level Security
configure_rls() {
    if [ -z "$DATASET_ID" ]; then
        log_warning "No dataset ID available. Skipping RLS configuration."
        return
    fi
    
    log_info "Configuring Row Level Security (RLS)..."
    
    # Define RLS roles
    rls_roles='[
        {
            "name": "Admin",
            "modelPermission": "Read",
            "tablePermissions": [
                {
                    "name": "SalesData",
                    "filterExpression": "1=1"
                }
            ]
        },
        {
            "name": "RolA",
            "modelPermission": "Read",
            "tablePermissions": [
                {
                    "name": "SalesData",
                    "filterExpression": "[Region] = \"A\""
                }
            ]
        },
        {
            "name": "RolB",
            "modelPermission": "Read",
            "tablePermissions": [
                {
                    "name": "SalesData",
                    "filterExpression": "[Region] = \"B\""
                }
            ]
        }
    ]'
    
    # Add RLS roles to dataset
    rls_response=$(curl -s -X POST \
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"roles\": $rls_roles}" \
        "$POWERBI_API_BASE/groups/$WORKSPACE_ID/datasets/$DATASET_ID/rls")
    
    if [ $? -eq 0 ]; then
        log_success "Row Level Security configured"
    else
        log_warning "Failed to configure RLS. Response: $rls_response"
        log_info "You may need to configure RLS manually in PowerBI Desktop"
    fi
}

# Function to test embed token generation
test_embed_token() {
    if [ -z "$DATASET_ID" ]; then
        log_warning "No dataset ID available. Skipping embed token test."
        return
    fi
    
    log_info "Testing embed token generation..."
    
    # Test token generation for RolA
    token_request='{
        "datasets": [{"id": "'"$DATASET_ID"'"}],
        "targetWorkspaces": [{"id": "'"$WORKSPACE_ID"'"}],
        "identities": [
            {
                "username": "user@rola.com",
                "roles": ["RolA"],
                "datasets": ["'"$DATASET_ID"'"]
            }
        ]
    }'
    
    token_response=$(curl -s -X POST \
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        -H "Content-Type: application/json" \
        -d "$token_request" \
        "$POWERBI_API_BASE/GenerateToken")
    
    TOKEN=$(echo "$token_response" | jq -r '.token')
    
    if [ -n "$TOKEN" ] && [ "$TOKEN" != "null" ]; then
        log_success "Embed token generated successfully"
        log_info "Token expires: $(echo "$token_response" | jq -r '.expiration')"
    else
        log_warning "Failed to generate embed token. Response: $token_response"
    fi
}

# Function to create configuration files
create_config_files() {
    log_info "Creating PowerBI configuration files..."
    
    # Create output directory
    mkdir -p "./config"
    
    # Create PowerBI configuration
    cat > "./config/powerbi-config.json" << EOF
{
    "workspaceId": "$WORKSPACE_ID",
    "workspaceName": "$WORKSPACE_NAME",
    "datasetId": "$DATASET_ID",
    "capacityId": "$CAPACITY_GUID",
    "capacityName": "$FABRIC_CAPACITY_NAME",
    "servicePrincipalId": "$SERVICE_PRINCIPAL_ID",
    "tenantId": "$TENANT_ID",
    "apiEndpoints": {
        "powerbi": "$POWERBI_API_BASE",
        "fabric": "$FABRIC_API_BASE"
    },
    "embedUrls": {
        "reports": "https://app.powerbi.com/reportEmbed",
        "dashboards": "https://app.powerbi.com/dashboardEmbed",
        "tiles": "https://app.powerbi.com/embed"
    },
    "roles": [
        {
            "name": "Admin",
            "description": "Full access to all data",
            "filter": "1=1"
        },
        {
            "name": "RolA",
            "description": "Access to Region A data only",
            "filter": "[Region] = 'A'"
        },
        {
            "name": "RolB",
            "description": "Access to Region B data only",
            "filter": "[Region] = 'B'"
        }
    ]
}
EOF

    # Create environment variables for backend
    cat >> "./config/backend.env" << EOF

# PowerBI Configuration
POWERBI_WORKSPACE_ID=$WORKSPACE_ID
POWERBI_DATASET_ID=$DATASET_ID
FABRIC_CAPACITY_ID=$CAPACITY_GUID

# API Endpoints
POWERBI_API_BASE=$POWERBI_API_BASE
FABRIC_API_BASE=$FABRIC_API_BASE
EOF

    # Create environment variables for frontend
    cat >> "./config/frontend.env" << EOF

# PowerBI Configuration
VITE_POWERBI_WORKSPACE_ID=$WORKSPACE_ID
VITE_POWERBI_DATASET_ID=$DATASET_ID
EOF

    log_success "Configuration files created in ./config/"
}

# Function to display PowerBI admin tasks
display_admin_tasks() {
    log_info "=== PowerBI Admin Tasks ==="
    echo ""
    echo -e "${YELLOW}Important tasks to complete in PowerBI Admin Portal:${NC}"
    echo ""
    echo "1. Enable Service Principal access:"
    echo "   - Go to PowerBI Admin Portal → Tenant Settings"
    echo "   - Enable 'Allow service principals to use PowerBI APIs'"
    echo "   - Add your Service Principal to the allowed list"
    echo ""
    echo "2. Configure Embed settings:"
    echo "   - Enable 'Allow apps to embed Power BI content'"
    echo "   - Configure allowed domains for embedding"
    echo ""
    echo "3. Capacity settings (if using Premium/Fabric):"
    echo "   - Assign workspaces to capacity"
    echo "   - Configure capacity settings for embedding"
    echo ""
    echo "4. Security settings:"
    echo "   - Review and configure security policies"
    echo "   - Set up data loss prevention if needed"
    echo ""
}

# Function to display next steps
display_next_steps() {
    log_info "=== Next Steps ==="
    echo ""
    echo -e "${GREEN}✅ PowerBI Configuration Summary:${NC}"
    echo "   Workspace ID: $WORKSPACE_ID"
    echo "   Workspace Name: $WORKSPACE_NAME"
    [ -n "$DATASET_ID" ] && echo "   Dataset ID: $DATASET_ID"
    [ -n "$CAPACITY_GUID" ] && echo "   Capacity ID: $CAPACITY_GUID"
    echo ""
    echo -e "${BLUE}🔧 Configuration files created:${NC}"
    echo "   - ./config/powerbi-config.json"
    echo "   - ./config/backend.env (updated)"
    echo "   - ./config/frontend.env (updated)"
    echo ""
    echo -e "${YELLOW}📋 Manual tasks required:${NC}"
    echo "1. Complete PowerBI Admin Portal configuration"
    echo "2. Upload actual reports to the workspace"
    echo "3. Configure proper RLS in PowerBI Desktop"
    echo "4. Test embedding in your application"
    echo "5. Configure monitoring and alerts"
    echo ""
    echo -e "${BLUE}🔗 Useful links:${NC}"
    echo "   PowerBI Portal: https://app.powerbi.com"
    echo "   Fabric Portal: https://app.fabric.microsoft.com"
    echo "   Admin Portal: https://app.powerbi.com/admin-portal"
    echo "   Workspace: https://app.powerbi.com/groups/$WORKSPACE_ID"
    echo ""
}

# Main execution function
main() {
    log_info "🚀 Starting PowerBI and Microsoft Fabric configuration"
    
    # Check prerequisites
    check_prerequisites
    
    # Set defaults
    set_defaults
    
    # Get access tokens
    get_powerbi_access_token
    get_fabric_access_token
    
    # List existing workspaces
    list_workspaces
    
    # Create or get workspace
    create_or_get_workspace
    
    # Assign workspace to Fabric capacity
    assign_workspace_to_capacity
    
    # Add Service Principal to workspace
    add_service_principal_to_workspace
    
    # Create sample dataset (optional)
    read -p "Do you want to create a sample dataset with RLS? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        create_sample_dataset
        configure_rls
        test_embed_token
    fi
    
    # Create configuration files
    create_config_files
    
    # Display admin tasks
    display_admin_tasks
    
    # Display next steps
    display_next_steps
    
    log_success "🎉 PowerBI configuration completed!"
}

# Show help
show_help() {
    echo "Microsoft Fabric Embedded - PowerBI Configuration"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -n, --app-name NAME           Application name"
    echo "  -w, --workspace-name NAME     PowerBI workspace name"
    echo "  -c, --capacity-name NAME      Fabric capacity name"
    echo "  -s, --service-principal ID    Service Principal ID"
    echo "  -t, --tenant ID              Azure tenant ID"
    echo "  -g, --resource-group NAME     Resource group name"
    echo "  -h, --help                   Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  APP_NAME                     Application name"
    echo "  WORKSPACE_NAME              PowerBI workspace name"
    echo "  FABRIC_CAPACITY_NAME        Fabric capacity name"
    echo "  SERVICE_PRINCIPAL_ID        Service Principal ID"
    echo "  TENANT_ID                   Azure tenant ID"
    echo "  RESOURCE_GROUP              Resource group name"
    echo ""
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -n|--app-name)
            APP_NAME="$2"
            shift 2
            ;;
        -w|--workspace-name)
            WORKSPACE_NAME="$2"
            shift 2
            ;;
        -c|--capacity-name)
            FABRIC_CAPACITY_NAME="$2"
            shift 2
            ;;
        -s|--service-principal)
            SERVICE_PRINCIPAL_ID="$2"
            shift 2
            ;;
        -t|--tenant)
            TENANT_ID="$2"
            shift 2
            ;;
        -g|--resource-group)
            RESOURCE_GROUP="$2"
            shift 2
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Run main function
main "$@"