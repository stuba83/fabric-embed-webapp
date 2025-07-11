#!/bin/bash

# deploy.sh - Script principal para deployment de Microsoft Fabric Embedded en Azure
# Uso: ./deploy.sh [environment] [resource-group]

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Funciones helper
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar prerequisitos
check_prerequisites() {
    log_info "Verificando prerequisitos..."
    
    # Verificar Azure CLI
    if ! command -v az &> /dev/null; then
        log_error "Azure CLI no está instalado. Por favor, instálalo desde: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
        exit 1
    fi
    
    # Verificar login en Azure
    if ! az account show &> /dev/null; then
        log_error "No estás logueado en Azure. Ejecuta: az login"
        exit 1
    fi
    
    # Verificar Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js no está instalado"
        exit 1
    fi
    
    # Verificar Python
    if ! command -v python3 &> /dev/null; then
        log_error "Python 3 no está instalado"
        exit 1
    fi
    
    log_success "Todos los prerequisitos están instalados"
}

# Configurar variables de entorno
setup_environment() {
    local env=${1:-"dev"}
    
    log_info "Configurando ambiente: $env"
    
    # Variables base
    export ENVIRONMENT=$env
    export APP_NAME="fabric-embedded-app"
    export LOCATION="westus3"
    export RESOURCE_GROUP=${2:-"rg-${APP_NAME}-${env}"}
    
    # Obtener información de Azure
    export SUBSCRIPTION_ID=$(az account show --query id -o tsv)
    export TENANT_ID=$(az account show --query tenantId -o tsv)
    export USER_OBJECT_ID=$(az ad signed-in-user show --query id -o tsv)
    
    log_info "Configuración de ambiente:"
    log_info "  Environment: $ENVIRONMENT"
    log_info "  App Name: $APP_NAME"
    log_info "  Resource Group: $RESOURCE_GROUP"
    log_info "  Location: $LOCATION"
    log_info "  Subscription: $SUBSCRIPTION_ID"
    log_info "  Tenant: $TENANT_ID"
}

# Crear resource group si no existe
create_resource_group() {
    log_info "Verificando resource group: $RESOURCE_GROUP"
    
    if ! az group show --name $RESOURCE_GROUP &> /dev/null; then
        log_info "Creando resource group: $RESOURCE_GROUP"
        az group create --name $RESOURCE_GROUP --location $LOCATION
        log_success "Resource group creado"
    else
        log_info "Resource group ya existe"
    fi
}

# Crear grupos de Entra ID
create_entra_groups() {
    log_info "Creando grupos de Entra ID..."
    
    local groups=("PBI-Admin" "PBI-RolA" "PBI-RolB")
    
    for group in "${groups[@]}"; do
        if ! az ad group show --group "$group" &> /dev/null; then
            log_info "Creando grupo: $group"
            az ad group create --display-name "$group" --mail-nickname "$group"
            log_success "Grupo $group creado"
        else
            log_info "Grupo $group ya existe"
        fi
    done
    
    # Agregar usuario actual al grupo Admin
    local admin_group_id=$(az ad group show --group "PBI-Admin" --query id -o tsv)
    az ad group member add --group $admin_group_id --member-id $USER_OBJECT_ID || true
    log_success "Usuario agregado al grupo PBI-Admin"
}

# Crear app registrations
create_app_registrations() {
    log_info "Creando app registrations en Entra ID..."
    
    # Frontend App (SPA)
    local frontend_app_name="${APP_NAME}-frontend-${ENVIRONMENT}"
    export FRONTEND_CLIENT_ID=$(az ad app list --display-name "$frontend_app_name" --query "[0].appId" -o tsv)
    
    if [ -z "$FRONTEND_CLIENT_ID" ] || [ "$FRONTEND_CLIENT_ID" == "null" ]; then
        log_info "Creando frontend app registration..."
        export FRONTEND_CLIENT_ID=$(az ad app create \
            --display-name "$frontend_app_name" \
            --spa-redirect-uris "https://${APP_NAME}-frontend-${ENVIRONMENT}.azurewebsites.net" \
            --spa-redirect-uris "http://localhost:5173" \
            --query appId -o tsv)
        log_success "Frontend app registration creado: $FRONTEND_CLIENT_ID"
    else
        log_info "Frontend app registration ya existe: $FRONTEND_CLIENT_ID"
    fi
    
    # Backend App (Service Principal)
    local backend_app_name="${APP_NAME}-backend-${ENVIRONMENT}"
    export BACKEND_CLIENT_ID=$(az ad app list --display-name "$backend_app_name" --query "[0].appId" -o tsv)
    
    if [ -z "$BACKEND_CLIENT_ID" ] || [ "$BACKEND_CLIENT_ID" == "null" ]; then
        log_info "Creando backend app registration..."
        export BACKEND_CLIENT_ID=$(az ad app create \
            --display-name "$backend_app_name" \
            --query appId -o tsv)
        
        # Crear service principal
        az ad sp create --id $BACKEND_CLIENT_ID
        
        log_success "Backend app registration creado: $BACKEND_CLIENT_ID"
    else
        log_info "Backend app registration ya existe: $BACKEND_CLIENT_ID"
    fi
    
    # Crear/renovar secret para backend
    log_info "Generando secret para backend app..."
    export BACKEND_CLIENT_SECRET=$(az ad app credential reset \
        --id $BACKEND_CLIENT_ID \
        --append \
        --display-name "Backend-Secret-$(date +%Y%m%d)" \
        --query password -o tsv)
    
    log_success "Secret generado para backend app"
}

# Configurar PowerBI permissions
configure_fabric_permissions() {
    log_info "Configurando permisos de Microsoft Fabric para Service Principal..."
    
    # PowerBI Service API permissions
    local powerbi_resource_id="00000009-0000-0000-c000-000000000000"
    local permissions=(
        "Dataset.ReadWrite.All=63519ef3-b2ec-4be1-8398-48f4b72d462a"
        "Report.ReadWrite.All=7504609f-c495-4c64-8542-686125a5a36e"
        "Workspace.ReadWrite.All=2448370f-f988-42cd-909c-6528467d972a"
    )
    
    for permission in "${permissions[@]}"; do
        local scope_name=$(echo $permission | cut -d'=' -f1)
        local scope_id=$(echo $permission | cut -d'=' -f2)
        
        log_info "Agregando permiso: $scope_name"
        az ad app permission add \
            --id $BACKEND_CLIENT_ID \
            --api $powerbi_resource_id \
            --api-permissions "$scope_id=Role" || true
    done
    
    # Grant admin consent
    log_warning "IMPORTANTE: Debes otorgar admin consent manualmente en Azure Portal"
    log_warning "Ve a: Azure Portal > App registrations > $backend_app_name > API permissions > Grant admin consent"
}

# Deploy infraestructura con Bicep
deploy_infrastructure() {
    log_info "Deployando infraestructura con Bicep..."
    
    # Obtener email del usuario para Microsoft Fabric Capacity
    local admin_email=$(az ad signed-in-user show --query mail -o tsv)
    if [ -z "$admin_email" ] || [ "$admin_email" == "null" ]; then
        admin_email=$(az ad signed-in-user show --query userPrincipalName -o tsv)
    fi
    
    # Crear archivo de parámetros temporal
    local params_file="/tmp/deployment-params-${RANDOM}.json"
    cat > $params_file << EOF
{
  "\$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "appName": {
      "value": "${APP_NAME}-${ENVIRONMENT}"
    },
    "location": {
      "value": "$LOCATION"
    },
    "entraClientId": {
      "value": "$BACKEND_CLIENT_ID"
    },
    "entraClientSecret": {
      "value": "$BACKEND_CLIENT_SECRET"
    },
    "entraTenantId": {
      "value": "$TENANT_ID"
    },
    "adminEmail": {
      "value": "$admin_email"
    }
  }
}
EOF
    
    log_info "Ejecutando deployment de Bicep..."
    local deployment_output=$(az deployment group create \
        --resource-group $RESOURCE_GROUP \
        --template-file infrastructure/bicep/main.bicep \
        --parameters $params_file \
        --query properties.outputs -o json)
    
    # Limpiar archivo temporal
    rm $params_file
    
    # Extraer outputs
    export FRONTEND_URL=$(echo $deployment_output | jq -r '.frontendUrl.value')
    export BACKEND_URL=$(echo $deployment_output | jq -r '.backendUrl.value')
    export KEY_VAULT_NAME=$(echo $deployment_output | jq -r '.keyVaultName.value')
    export FABRIC_CAPACITY_NAME=$(echo $deployment_output | jq -r '.fabricCapacityName.value')
    
    log_success "Infraestructura deployada exitosamente"
    log_info "Frontend URL: $FRONTEND_URL"
    log_info "Backend URL: $BACKEND_URL"
    log_info "Key Vault: $KEY_VAULT_NAME"
    log_info "Microsoft Fabric Capacity: $FABRIC_CAPACITY_NAME"
}

# Build y deploy frontend
deploy_frontend() {
    log_info "Building y deployando frontend..."
    
    cd frontend
    
    # Crear archivo de configuración de producción
    cat > .env.production << EOF
VITE_ENTRA_CLIENT_ID=$FRONTEND_CLIENT_ID
VITE_ENTRA_AUTHORITY=https://login.microsoftonline.com/$TENANT_ID
VITE_API_BASE_URL=$BACKEND_URL
VITE_ENVIRONMENT=$ENVIRONMENT
EOF
    
    # Install dependencies y build
    log_info "Instalando dependencias del frontend..."
    npm install
    
    log_info "Building frontend..."
    npm run build
    
    # Crear ZIP para deployment
    cd dist
    zip -r ../frontend-dist.zip .
    cd ..
    
    # Deploy a App Service
    log_info "Deployando frontend a App Service..."
    az webapp deployment source config-zip \
        --resource-group $RESOURCE_GROUP \
        --name "${APP_NAME}-frontend-${ENVIRONMENT}" \
        --src frontend-dist.zip
    
    # Cleanup
    rm frontend-dist.zip
    
    cd ..
    log_success "Frontend deployado exitosamente"
}

# Deploy backend
deploy_backend() {
    log_info "Deployando backend..."
    
    cd backend
    
    # Crear ZIP para deployment
    log_info "Preparando archivos del backend..."
    zip -r backend-app.zip . -x "*.pyc" "__pycache__/*" "*.git*" "venv/*" ".env*"
    
    # Deploy a App Service
    log_info "Deployando backend a App Service..."
    az webapp deployment source config-zip \
        --resource-group $RESOURCE_GROUP \
        --name "${APP_NAME}-backend-${ENVIRONMENT}" \
        --src backend-app.zip
    
    # Cleanup
    rm backend-app.zip
    
    cd ..
    log_success "Backend deployado exitosamente"
}

# Ejecutar health checks
run_health_checks() {
    log_info "Ejecutando health checks..."
    
    # Wait for apps to start
    sleep 30
    
    # Check backend health
    log_info "Verificando backend health..."
    local backend_health=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/health" || echo "000")
    if [ "$backend_health" == "200" ]; then
        log_success "Backend health check: OK"
    else
        log_warning "Backend health check: Failed (HTTP $backend_health)"
    fi
    
    # Check frontend
    log_info "Verificando frontend..."
    local frontend_health=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL" || echo "000")
    if [ "$frontend_health" == "200" ]; then
        log_success "Frontend health check: OK"
    else
        log_warning "Frontend health check: Failed (HTTP $frontend_health)"
    fi
}

# Mostrar resumen final
show_deployment_summary() {
    log_info "=== DEPLOYMENT COMPLETADO ==="
    log_success "🎉 Aplicación deployada exitosamente!"
    echo ""
    log_info "URLs de la aplicación:"
    log_info "  Frontend: $FRONTEND_URL"
    log_info "  Backend:  $BACKEND_URL"
    echo ""
    log_info "Recursos creados:"
    log_info "  Resource Group: $RESOURCE_GROUP"
    log_info "  Key Vault: $KEY_VAULT_NAME"
    log_info "  PowerBI Capacity: $POWERBI_CAPACITY_NAME"
    echo ""
    log_warning "⚠️  PASOS MANUALES PENDIENTES:"
    log_warning "1. Otorgar admin consent para Microsoft Fabric permisos en Azure Portal"
    log_warning "2. Configurar Row Level Security (RLS) en PowerBI Desktop"
    log_warning "3. Agregar Service Principal como Admin en Microsoft Fabric workspace"
    log_warning "4. Asignar workspace a Microsoft Fabric capacity creada"
    log_warning "5. Agregar usuarios a los grupos de Entra ID (PBI-Admin, PBI-RolA, PBI-RolB)"
    echo ""
    log_info "Para más detalles, consulta la documentación en: docs/deployment/"
}

# Función principal
main() {
    local environment=${1:-"dev"}
    local resource_group=${2:-""}
    
    log_info "🚀 Iniciando deployment de Microsoft Fabric Embedded App"
    echo ""
    
    check_prerequisites
    setup_environment $environment $resource_group
    create_resource_group
    create_entra_groups
    create_app_registrations
    configure_fabric_permissions
    deploy_infrastructure
    deploy_frontend
    deploy_backend
    run_health_checks
    show_deployment_summary
}

# Ejecutar si es llamado directamente
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi