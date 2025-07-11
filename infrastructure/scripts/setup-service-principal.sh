#!/bin/bash

# setup-service-principal.sh - Create and configure Service Principal for Microsoft Fabric Embedded

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
APP_NAME="${APP_NAME:-fabric-embedded-app}"
ENVIRONMENT="${ENVIRONMENT:-production}"
SUBSCRIPTION_ID="${SUBSCRIPTION_ID:-}"
TENANT_ID="${TENANT_ID:-}"
RESOURCE_GROUP="${RESOURCE_GROUP:-}"

# PowerBI/Fabric specific permissions
POWERBI_PERMISSIONS=(
    "https://analysis.windows.net/powerbi/api/Dataset.ReadWrite.All"
    "https://analysis.windows.net/powerbi/api/Report.ReadWrite.All"
    "https://analysis.windows.net/powerbi/api/Workspace.ReadWrite.All"
    "https://analysis.windows.net/powerbi/api/Content.Create"
    "https://analysis.windows.net/powerbi/api/Metadata.View_Any"
)

# Microsoft Graph permissions for user management
GRAPH_PERMISSIONS=(
    "https://graph.microsoft.com/User.Read.All"
    "https://graph.microsoft.com/Group.Read.All"
    "https://graph.microsoft.com/GroupMember.Read.All"
    "https://graph.microsoft.com/Directory.Read.All"
)

# Logging function
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
    
    # Check if jq is installed
    if ! command -v jq &> /dev/null; then
        log_error "jq is not installed. Please install it first."
        exit 1
    fi
    
    # Check if logged in to Azure
    if ! az account show &> /dev/null; then
        log_error "Not logged in to Azure CLI. Please run 'az login' first."
        exit 1
    fi
    
    log_success "Prerequisites check completed"
}

# Function to set default values if not provided
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
    
    log_success "Default values set"
}

# Function to create Entra ID groups
create_entra_groups() {
    log_info "Creating Entra ID groups for role-based access..."
    
    # Define groups
    declare -A GROUPS=(
        ["PowerBI-Admin"]="Administrators with full access to PowerBI embedded application"
        ["PowerBI-RolA"]="Users with access to Role A data and reports"
        ["PowerBI-RolB"]="Users with access to Role B data and reports"
    )
    
    for group_name in "${!GROUPS[@]}"; do
        description="${GROUPS[$group_name]}"
        
        log_info "Creating group: $group_name"
        
        # Check if group already exists
        existing_group=$(az ad group list --filter "displayName eq '$group_name'" --query "[0].id" -o tsv)
        
        if [ -z "$existing_group" ] || [ "$existing_group" = "null" ]; then
            # Create the group
            group_id=$(az ad group create \
                --display-name "$group_name" \
                --mail-nickname "$group_name" \
                --description "$description" \
                --query id -o tsv)
            
            log_success "Created group: $group_name (ID: $group_id)"
            
            # Export group ID for later use
            export "${group_name//-/_}_GROUP_ID=$group_id"
        else
            log_warning "Group $group_name already exists (ID: $existing_group)"
            export "${group_name//-/_}_GROUP_ID=$existing_group"
        fi
    done
}

# Function to create Service Principal for backend API
create_backend_service_principal() {
    log_info "Creating Service Principal for backend API..."
    
    local app_name="${APP_NAME}-backend"
    local app_uri="https://${app_name}"
    
    # Check if app registration already exists
    existing_app=$(az ad app list --filter "displayName eq '$app_name'" --query "[0].appId" -o tsv)
    
    if [ -z "$existing_app" ] || [ "$existing_app" = "null" ]; then
        log_info "Creating new app registration: $app_name"
        
        # Create app registration
        app_id=$(az ad app create \
            --display-name "$app_name" \
            --identifier-uris "$app_uri" \
            --query appId -o tsv)
        
        log_success "Created app registration: $app_name (App ID: $app_id)"
    else
        app_id=$existing_app
        log_warning "App registration $app_name already exists (App ID: $app_id)"
    fi
    
    # Create Service Principal
    sp_id=$(az ad sp create --id $app_id --query id -o tsv)
    log_success "Created Service Principal for backend (SP ID: $sp_id)"
    
    # Create client secret
    log_info "Creating client secret..."
    client_secret=$(az ad app credential reset --id $app_id --append --query password -o tsv)
    
    # Add required API permissions
    log_info "Adding API permissions..."
    
    # Add PowerBI permissions
    for permission in "${POWERBI_PERMISSIONS[@]}"; do
        log_info "Adding permission: $permission"
        # Note: This requires admin consent after creation
    done
    
    # Add Microsoft Graph permissions
    for permission in "${GRAPH_PERMISSIONS[@]}"; do
        log_info "Adding permission: $permission"
        # Note: This requires admin consent after creation
    done
    
    # Export values
    export BACKEND_CLIENT_ID=$app_id
    export BACKEND_CLIENT_SECRET=$client_secret
    export BACKEND_SP_ID=$sp_id
    
    log_success "Backend Service Principal created successfully"
}

# Function to create Service Principal for frontend (SPA)
create_frontend_service_principal() {
    log_info "Creating Service Principal for frontend SPA..."
    
    local app_name="${APP_NAME}-frontend"
    local redirect_uri="https://${APP_NAME}-frontend.azurewebsites.net/"
    
    # Check if app registration already exists
    existing_app=$(az ad app list --filter "displayName eq '$app_name'" --query "[0].appId" -o tsv)
    
    if [ -z "$existing_app" ] || [ "$existing_app" = "null" ]; then
        log_info "Creating new SPA app registration: $app_name"
        
        # Create SPA app registration
        app_id=$(az ad app create \
            --display-name "$app_name" \
            --spa-redirect-uris "$redirect_uri" \
            --enable-access-token-issuance true \
            --query appId -o tsv)
        
        log_success "Created SPA app registration: $app_name (App ID: $app_id)"
    else
        app_id=$existing_app
        log_warning "SPA app registration $app_name already exists (App ID: $app_id)"
    fi
    
    # Create Service Principal for frontend
    sp_id=$(az ad sp create --id $app_id --query id -o tsv)
    log_success "Created Service Principal for frontend (SP ID: $sp_id)"
    
    # Configure SPA settings
    log_info "Configuring SPA settings..."
    
    # Add additional redirect URIs for development
    az ad app update --id $app_id \
        --spa-redirect-uris "$redirect_uri" "http://localhost:3000" "http://localhost:5173"
    
    # Export values
    export FRONTEND_CLIENT_ID=$app_id
    export FRONTEND_SP_ID=$sp_id
    
    log_success "Frontend Service Principal created successfully"
}

# Function to configure PowerBI Service Principal permissions
configure_powerbi_permissions() {
    log_info "Configuring PowerBI specific permissions..."
    
    # Get PowerBI Service resource ID
    powerbi_resource_id=$(az ad sp list --filter "appId eq '00000009-0000-0000-c000-000000000000'" --query "[0].id" -o tsv)
    
    if [ -n "$powerbi_resource_id" ]; then
        log_info "Found PowerBI Service resource ID: $powerbi_resource_id"
        
        # Add PowerBI permissions to backend app
        log_info "Adding PowerBI permissions to backend Service Principal..."
        
        # Dataset.ReadWrite.All
        az ad app permission add --id $BACKEND_CLIENT_ID \
            --api 00000009-0000-0000-c000-000000000000 \
            --api-permissions 47fbb099-0bdf-47b0-8216-9b2b5e9e9d1e=Role
        
        # Report.ReadWrite.All
        az ad app permission add --id $BACKEND_CLIENT_ID \
            --api 00000009-0000-0000-c000-000000000000 \
            --api-permissions 7f33e027-4039-419b-938e-2f8ca153e68e=Role
        
        # Workspace.ReadWrite.All
        az ad app permission add --id $BACKEND_CLIENT_ID \
            --api 00000009-0000-0000-c000-000000000000 \
            --api-permissions b2f1b2fa-f35c-407c-979c-a858a808ba85=Role
        
        log_success "PowerBI permissions added"
    else
        log_warning "PowerBI Service resource not found. Permissions need to be configured manually."
    fi
}

# Function to configure Microsoft Graph permissions
configure_graph_permissions() {
    log_info "Configuring Microsoft Graph permissions..."
    
    # Get Microsoft Graph resource ID
    graph_resource_id=$(az ad sp list --filter "appId eq '00000003-0000-0000-c000-000000000000'" --query "[0].id" -o tsv)
    
    if [ -n "$graph_resource_id" ]; then
        log_info "Found Microsoft Graph resource ID: $graph_resource_id"
        
        # Add Graph permissions to backend app
        log_info "Adding Microsoft Graph permissions to backend Service Principal..."
        
        # User.Read.All
        az ad app permission add --id $BACKEND_CLIENT_ID \
            --api 00000003-0000-0000-c000-000000000000 \
            --api-permissions df021288-bdef-4463-88db-98f22de89214=Role
        
        # Group.Read.All
        az ad app permission add --id $BACKEND_CLIENT_ID \
            --api 00000003-0000-0000-c000-000000000000 \
            --api-permissions 5b567255-7703-4780-807c-7be8301ae99b=Role
        
        # GroupMember.Read.All
        az ad app permission add --id $BACKEND_CLIENT_ID \
            --api 00000003-0000-0000-c000-000000000000 \
            --api-permissions 98830695-27a2-44f7-8c18-0c3ebc9698f6=Role
        
        # Directory.Read.All
        az ad app permission add --id $BACKEND_CLIENT_ID \
            --api 00000003-0000-0000-c000-000000000000 \
            --api-permissions 7ab1d382-f21e-4acd-a863-ba3e13f7da61=Role
        
        log_success "Microsoft Graph permissions added"
    else
        log_warning "Microsoft Graph resource not found. Permissions need to be configured manually."
    fi
}

# Function to grant admin consent
grant_admin_consent() {
    log_info "Granting admin consent for permissions..."
    
    # Grant admin consent for backend app
    if az ad app permission admin-consent --id $BACKEND_CLIENT_ID 2>/dev/null; then
        log_success "Admin consent granted for backend app"
    else
        log_warning "Could not grant admin consent automatically. Manual consent required."
        log_warning "Please visit: https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationMenuBlade/~/CallAnAPI/appId/$BACKEND_CLIENT_ID"
    fi
}

# Function to configure role assignments
configure_role_assignments() {
    log_info "Configuring Azure role assignments..."
    
    # Assign Contributor role to backend SP for the resource group
    az role assignment create \
        --assignee $BACKEND_SP_ID \
        --role "Contributor" \
        --scope "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP" \
        --description "Allow backend Service Principal to manage resources"
    
    log_success "Role assignments configured"
}

# Function to store secrets in Key Vault (if exists)
store_secrets_in_keyvault() {
    log_info "Checking for Key Vault to store secrets..."
    
    # Try to find Key Vault
    keyvault_name=$(az keyvault list --resource-group $RESOURCE_GROUP --query "[0].name" -o tsv 2>/dev/null || echo "")
    
    if [ -n "$keyvault_name" ] && [ "$keyvault_name" != "null" ]; then
        log_info "Found Key Vault: $keyvault_name"
        
        # Store backend client secret
        az keyvault secret set \
            --vault-name $keyvault_name \
            --name "entra-client-secret" \
            --value "$BACKEND_CLIENT_SECRET" \
            --description "Backend Service Principal client secret"
        
        # Store fabric client secret (same as backend for now)
        az keyvault secret set \
            --vault-name $keyvault_name \
            --name "fabric-client-secret" \
            --value "$BACKEND_CLIENT_SECRET" \
            --description "Microsoft Fabric Service Principal client secret"
        
        log_success "Secrets stored in Key Vault: $keyvault_name"
    else
        log_warning "Key Vault not found. Secrets will be displayed for manual storage."
    fi
}

# Function to generate configuration files
generate_config_files() {
    log_info "Generating configuration files..."
    
    # Create output directory
    mkdir -p "./config"
    
    # Generate backend environment file
    cat > "./config/backend.env" << EOF
# Backend Service Principal Configuration
ENTRA_CLIENT_ID=$BACKEND_CLIENT_ID
ENTRA_CLIENT_SECRET=$BACKEND_CLIENT_SECRET
ENTRA_TENANT_ID=$TENANT_ID

# Microsoft Fabric Configuration
FABRIC_CLIENT_ID=$BACKEND_CLIENT_ID
FABRIC_CLIENT_SECRET=$BACKEND_CLIENT_SECRET
FABRIC_TENANT_ID=$TENANT_ID

# Azure Configuration
AZURE_SUBSCRIPTION_ID=$SUBSCRIPTION_ID
AZURE_RESOURCE_GROUP=$RESOURCE_GROUP
EOF

    # Generate frontend environment file
    cat > "./config/frontend.env" << EOF
# Frontend SPA Configuration
VITE_ENTRA_CLIENT_ID=$FRONTEND_CLIENT_ID
VITE_ENTRA_TENANT_ID=$TENANT_ID
VITE_ENTRA_REDIRECT_URI=https://${APP_NAME}-frontend.azurewebsites.net/

# API Configuration
VITE_API_BASE_URL=https://${APP_NAME}-backend.azurewebsites.net
EOF

    # Generate PowerBI configuration
    cat > "./config/powerbi.json" << EOF
{
  "clientId": "$BACKEND_CLIENT_ID",
  "clientSecret": "$BACKEND_CLIENT_SECRET",
  "tenantId": "$TENANT_ID",
  "authorityUrl": "https://login.microsoftonline.com/$TENANT_ID",
  "scope": "https://analysis.windows.net/powerbi/api/.default",
  "groups": {
    "admin": "$PowerBI_Admin_GROUP_ID",
    "rolA": "$PowerBI_RolA_GROUP_ID",
    "rolB": "$PowerBI_RolB_GROUP_ID"
  }
}
EOF

    # Generate deployment summary
    cat > "./config/deployment-summary.json" << EOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "subscription": "$SUBSCRIPTION_ID",
  "tenant": "$TENANT_ID",
  "resourceGroup": "$RESOURCE_GROUP",
  "appName": "$APP_NAME",
  "backend": {
    "clientId": "$BACKEND_CLIENT_ID",
    "servicePrincipalId": "$BACKEND_SP_ID"
  },
  "frontend": {
    "clientId": "$FRONTEND_CLIENT_ID",
    "servicePrincipalId": "$FRONTEND_SP_ID"
  },
  "groups": {
    "admin": "$PowerBI_Admin_GROUP_ID",
    "rolA": "$PowerBI_RolA_GROUP_ID",
    "rolB": "$PowerBI_RolB_GROUP_ID"
  }
}
EOF

    log_success "Configuration files generated in ./config/"
}

# Function to display summary
display_summary() {
    log_info "=== Service Principal Configuration Summary ==="
    echo ""
    echo -e "${GREEN}✅ Backend Service Principal:${NC}"
    echo "   Client ID: $BACKEND_CLIENT_ID"
    echo "   Service Principal ID: $BACKEND_SP_ID"
    echo ""
    echo -e "${GREEN}✅ Frontend Service Principal:${NC}"
    echo "   Client ID: $FRONTEND_CLIENT_ID"
    echo "   Service Principal ID: $FRONTEND_SP_ID"
    echo ""
    echo -e "${GREEN}✅ Entra ID Groups Created:${NC}"
    echo "   PowerBI-Admin: $PowerBI_Admin_GROUP_ID"
    echo "   PowerBI-RolA: $PowerBI_RolA_GROUP_ID"
    echo "   PowerBI-RolB: $PowerBI_RolB_GROUP_ID"
    echo ""
    echo -e "${YELLOW}⚠️  Important Next Steps:${NC}"
    echo "1. Grant admin consent for API permissions:"
    echo "   https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationMenuBlade/~/CallAnAPI/appId/$BACKEND_CLIENT_ID"
    echo ""
    echo "2. Add Service Principal to PowerBI workspace as Admin:"
    echo "   - Go to PowerBI Portal"
    echo "   - Open your workspace settings"
    echo "   - Add $BACKEND_CLIENT_ID as Admin"
    echo ""
    echo "3. Configure Row Level Security (RLS) in PowerBI:"
    echo "   - Create roles: Admin, RolA, RolB"
    echo "   - Configure filters based on user groups"
    echo ""
    echo "4. Update deployment parameters with these values:"
    echo "   - Check ./config/backend.env"
    echo "   - Check ./config/frontend.env"
    echo "   - Update parameters.json file"
    echo ""
    echo "5. Deploy infrastructure using the main Bicep template"
    echo ""
}

# Function to cleanup on error
cleanup_on_error() {
    log_error "Script failed. Cleaning up..."
    
    # Remove created app registrations if they exist
    if [ -n "$BACKEND_CLIENT_ID" ]; then
        log_warning "Removing backend app registration: $BACKEND_CLIENT_ID"
        az ad app delete --id $BACKEND_CLIENT_ID || true
    fi
    
    if [ -n "$FRONTEND_CLIENT_ID" ]; then
        log_warning "Removing frontend app registration: $FRONTEND_CLIENT_ID"
        az ad app delete --id $FRONTEND_CLIENT_ID || true
    fi
    
    # Remove created groups
    for group_var in PowerBI_Admin_GROUP_ID PowerBI_RolA_GROUP_ID PowerBI_RolB_GROUP_ID; do
        group_id=${!group_var}
        if [ -n "$group_id" ]; then
            log_warning "Removing group: $group_id"
            az ad group delete --group $group_id || true
        fi
    done
}

# Main execution function
main() {
    log_info "🚀 Starting Service Principal setup for Microsoft Fabric Embedded App"
    
    # Set trap for cleanup on error
    trap cleanup_on_error ERR
    
    # Check prerequisites
    check_prerequisites
    
    # Set defaults
    set_defaults
    
    # Create Entra ID groups
    create_entra_groups
    
    # Create Service Principals
    create_backend_service_principal
    create_frontend_service_principal
    
    # Configure permissions
    configure_powerbi_permissions
    configure_graph_permissions
    
    # Grant admin consent
    grant_admin_consent
    
    # Configure role assignments
    configure_role_assignments
    
    # Store secrets in Key Vault if available
    store_secrets_in_keyvault
    
    # Generate configuration files
    generate_config_files
    
    # Display summary
    display_summary
    
    log_success "🎉 Service Principal setup completed successfully!"
}

# Show help
show_help() {
    echo "Microsoft Fabric Embedded - Service Principal Setup"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -n, --app-name NAME        Application name (default: fabric-embedded-app)"
    echo "  -e, --environment ENV      Environment (default: production)"
    echo "  -s, --subscription ID      Azure subscription ID"
    echo "  -t, --tenant ID           Azure tenant ID"
    echo "  -g, --resource-group NAME  Resource group name"
    echo "  -h, --help                Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  APP_NAME                  Application name"
    echo "  ENVIRONMENT              Environment name"
    echo "  SUBSCRIPTION_ID          Azure subscription ID"
    echo "  TENANT_ID               Azure tenant ID"
    echo "  RESOURCE_GROUP          Resource group name"
    echo ""
    echo "Examples:"
    echo "  $0 --app-name my-fabric-app --environment prod"
    echo "  APP_NAME=my-app $0"
    echo ""
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -n|--app-name)
            APP_NAME="$2"
            shift 2
            ;;
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -s|--subscription)
            SUBSCRIPTION_ID="$2"
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