# Guía de Deployment en Azure

Esta guía te llevará paso a paso por el proceso completo de deployment de la aplicación PowerBI Embedded en Azure.

## 📋 Prerequisitos

Antes de comenzar, asegúrate de tener:

- ✅ Suscripción de Azure activa
- ✅ Azure CLI instalado y configurado
- ✅ Permisos de Global Administrator en Entra ID
- ✅ PowerBI Pro o Premium license
- ✅ Git y repositorio clonado

## 🚀 Paso 1: Configuración Inicial de Azure

### 1.1 Login y configuración
```bash
# Login en Azure
az login

# Seleccionar suscripción
az account set --subscription "tu-subscription-id"

# Crear resource group
az group create \
  --name "rg-powerbi-embedded" \
  --location "westus3"
```

### 1.2 Configurar variables de entorno
```bash
# Configurar variables para el deployment
export RESOURCE_GROUP="rg-powerbi-embedded"
export LOCATION="westus3"
export APP_NAME="powerbi-embedded-app"
export ENTRA_TENANT_ID=$(az account show --query tenantId -o tsv)
```

## 🔐 Paso 2: Configuración de Entra ID

### 2.1 Crear grupos de usuario
```bash
# Ejecutar script de creación de grupos
./infrastructure/scripts/create-entra-groups.sh
```

El script creará:
- `PBI-Admin`: Administradores con acceso completo
- `PBI-RolA`: Usuarios con acceso a datos del Rol A
- `PBI-RolB`: Usuarios con acceso a datos del Rol B

### 2.2 Registrar aplicaciones en Entra ID

#### Frontend Application (SPA)
```bash
# Crear app registration para frontend
az ad app create \
  --display-name "${APP_NAME}-frontend" \
  --spa-redirect-uris "https://${APP_NAME}-frontend.azurewebsites.net" \
  --query appId -o tsv
```

#### Backend Application (Service Principal)
```bash
# Crear app registration para backend
BACKEND_APP_ID=$(az ad app create \
  --display-name "${APP_NAME}-backend" \
  --query appId -o tsv)

# Crear service principal
az ad sp create --id $BACKEND_APP_ID

# Crear secret para el backend
BACKEND_SECRET=$(az ad app credential reset \
  --id $BACKEND_APP_ID \
  --append \
  --display-name "Backend-Secret" \
  --query password -o tsv)
```

## 📊 Paso 3: Configuración de PowerBI

### 3.1 Configurar Service Principal para PowerBI
```bash
# Ejecutar script de configuración
./infrastructure/scripts/setup-service-principal.sh $BACKEND_APP_ID
```

### 3.2 Configurar PowerBI Workspace

1. **Crear workspace dedicado**:
   - Ve a PowerBI Service
   - Crear nuevo workspace: `PowerBI-Embedded-Workspace`
   - Configurar como Pro o Premium

2. **Agregar Service Principal al workspace**:
   ```bash
   # El script automáticamente agrega el SP como Admin
   ./infrastructure/scripts/configure-powerbi.sh $BACKEND_APP_ID
   ```

3. **Configurar Row Level Security (RLS)**:
   - En PowerBI Desktop, configurar roles:
     - `Admin`: Sin filtros
     - `RolA`: `[Region] = "A"`
     - `RolB`: `[Region] = "B"`
   - Publicar dataset al workspace

## 🏗️ Paso 4: Deploy de Infraestructura

### 4.1 Preparar parámetros
```bash
# Crear archivo de parámetros
cat > infrastructure/bicep/parameters.json << EOF
{
  "\$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "appName": {
      "value": "${APP_NAME}"
    },
    "location": {
      "value": "${LOCATION}"
    },
    "entraClientId": {
      "value": "${BACKEND_APP_ID}"
    },
    "entraClientSecret": {
      "value": "${BACKEND_SECRET}"
    },
    "entraTenantId": {
      "value": "${ENTRA_TENANT_ID}"
    }
  }
}
EOF
```

### 4.2 Deploy con Bicep
```bash
# Deploy de infraestructura principal
az deployment group create \
  --resource-group $RESOURCE_GROUP \
  --template-file infrastructure/bicep/main.bicep \
  --parameters infrastructure/bicep/parameters.json
```

Los recursos creados incluyen:
- App Service Plan (Linux B1)
- App Service para Frontend
- App Service para Backend  
- Key Vault
- Managed Identity

## 🔑 Paso 5: Configuración de Secrets

### 5.1 Key Vault setup
```bash
# Obtener nombre del Key Vault
KEY_VAULT_NAME=$(az keyvault list \
  --resource-group $RESOURCE_GROUP \
  --query "[0].name" -o tsv)

# Almacenar secrets
az keyvault secret set \
  --vault-name $KEY_VAULT_NAME \
  --name "powerbi-client-secret" \
  --value $BACKEND_SECRET

az keyvault secret set \
  --vault-name $KEY_VAULT_NAME \
  --name "entra-client-secret" \
  --value $BACKEND_SECRET
```

## 📱 Paso 6: Deploy de Aplicaciones

### 6.1 Frontend (React)
```bash
cd frontend

# Configurar variables de entorno
cat > .env.production << EOF
VITE_ENTRA_CLIENT_ID=$FRONTEND_APP_ID
VITE_ENTRA_AUTHORITY=https://login.microsoftonline.com/$ENTRA_TENANT_ID
VITE_API_BASE_URL=https://${APP_NAME}-backend.azurewebsites.net
EOF

# Build y deploy
npm install
npm run build

# Deploy a App Service
az webapp deployment source config-zip \
  --resource-group $RESOURCE_GROUP \
  --name "${APP_NAME}-frontend" \
  --src dist.zip
```

### 6.2 Backend (Python)
```bash
cd backend

# Configurar variables de entorno en App Service
az webapp config appsettings set \
  --resource-group $RESOURCE_GROUP \
  --name "${APP_NAME}-backend" \
  --settings \
    ENTRA_CLIENT_ID=$BACKEND_APP_ID \
    ENTRA_TENANT_ID=$ENTRA_TENANT_ID \
    KEY_VAULT_URL="https://${KEY_VAULT_NAME}.vault.azure.net/"

# Deploy con ZIP
zip -r app.zip .
az webapp deployment source config-zip \
  --resource-group $RESOURCE_GROUP \
  --name "${APP_NAME}-backend" \
  --src app.zip
```

## ⚡ Paso 7: Microsoft Fabric Capacity

### 7.1 Crear Microsoft Fabric Capacity (desde Azure Portal)
**IMPORTANTE**: Microsoft Fabric Capacity se crea únicamente desde Azure Portal como recurso de Azure.

```bash
# Crear capacity F8 desde Azure CLI
az resource create \
  --resource-group $RESOURCE_GROUP \
  --name "${APP_NAME}-fabric" \
  --resource-type "Microsoft.Fabric/capacities" \
  --location $LOCATION \
  --properties "{
    \"administration\": {
      \"members\": [\"$(az ad signed-in-user show --query mail -o tsv)\"]
    },
    \"sku\": {
      \"name\": \"F8\",
      \"tier\": \"Fabric\"
    }
  }"
```

**Pasos desde Azure Portal UI:**
1. Buscar "Microsoft Fabric" en Azure Portal
2. Seleccionar "Microsoft Fabric capacities" 
3. Create → Configurar F8 SKU y región
4. Asignar a tu resource group y administradores

**NOTA IMPORTANTE**: La capacity aparecerá en Azure Portal pero la gestión operacional (pausar/reanudar, asignar workspaces) se hace desde el Fabric Portal.

### 7.2 Verificar y asignar workspace a capacity
1. Ve a [Microsoft Fabric Portal](https://app.fabric.microsoft.com)  
2. Admin Portal → Capacity settings → Verificar que aparece la nueva capacity
3. Workspaces → Tu workspace → Settings → Premium
4. Asignar a la capacity creada en Azure

## 🧪 Paso 8: Validación y Testing

### 8.1 Health checks
```bash
# Verificar backend
curl https://${APP_NAME}-backend.azurewebsites.net/health

# Verificar frontend
curl https://${APP_NAME}-frontend.azurewebsites.net
```

### 8.2 Test de autenticación
1. Accede a la aplicación frontend
2. Login con usuario de prueba
3. Verificar que aparece el reporte embedado
4. Verificar filtros según el rol

## 🔄 Paso 9: CI/CD Setup

### 9.1 Configurar GitHub Actions
```bash
# Crear service principal para CI/CD
CI_SP=$(az ad sp create-for-rbac \
  --name "${APP_NAME}-cicd" \
  --role contributor \
  --scopes /subscriptions/$(az account show --query id -o tsv)/resourceGroups/$RESOURCE_GROUP)

echo "Add this JSON to GitHub Secrets as AZURE_CREDENTIALS:"
echo $CI_SP
```

### 9.2 GitHub Secrets necesarios
En tu repositorio de GitHub, agregar estos secrets:
- `AZURE_CREDENTIALS`: JSON del service principal
- `AZURE_RESOURCE_GROUP`: Nombre del resource group
- `AZURE_APP_NAME`: Nombre base de la aplicación

## 📊 Paso 10: Monitoreo y Alertas

### 10.1 Application Insights
```bash
# El template de Bicep ya incluye App Insights
# Configurar alertas básicas
az monitor metrics alert create \
  --name "High-Response-Time" \
  --resource-group $RESOURCE_GROUP \
  --condition "avg requests/duration > 1000" \
  --description "Alert when response time > 1s"
```

## 🛠️ Troubleshooting Común

### Error: PowerBI Token Inválido
```bash
# Verificar permisos del Service Principal
az rest --method GET \
  --url "https://api.powerbi.com/v1.0/myorg/groups" \
  --headers "Authorization=Bearer $(az account get-access-token --resource https://analysis.windows.net/powerbi/api --query accessToken -o tsv)"
```

### Error: Autenticación Entra ID
- Verificar redirect URIs en app registration
- Verificar que los grupos existen y tienen usuarios
- Verificar permisos API de la aplicación

### Error: App Service no inicia
```bash
# Ver logs de la aplicación
az webapp log tail \
  --resource-group $RESOURCE_GROUP \
  --name "${APP_NAME}-backend"
```

## 📋 Checklist de Deployment

- [ ] Resource group creado
- [ ] Grupos de Entra ID creados
- [ ] App registrations configuradas
- [ ] PowerBI workspace configurado
- [ ] RLS configurado en PowerBI
- [ ] Service Principal con permisos PowerBI
- [ ] Infraestructura deployada con Bicep
- [ ] Secrets configurados en Key Vault
- [ ] Frontend deployado y funcionando
- [ ] Backend deployado y funcionando
- [ ] Microsoft Fabric Capacity F8 creada (desde Azure Portal)
- [ ] Capacity verificada en Fabric Portal (Admin Portal)
- [ ] Workspace asignado a la capacity (desde Fabric Portal)
- [ ] Service Principal con permisos Microsoft Fabric
- [ ] Health checks passing
- [ ] CI/CD configurado
- [ ] Monitoreo configurado

## 💰 Optimización de Costos

### Pausar Microsoft Fabric Capacity cuando no se use
```bash
# Pausar capacity (desde Azure Portal o CLI)
az fabric capacity suspend \
  --resource-group $RESOURCE_GROUP \
  --capacity-name "${APP_NAME}-fabric"

# Reanudar capacity
az fabric capacity resume \
  --resource-group $RESOURCE_GROUP \
  --capacity-name "${APP_NAME}-fabric"
```

**Alternativa desde Azure Portal:**
1. Azure Portal → Microsoft Fabric → Tu capacity
2. Click "Stop" para pausar / "Start" para reanudar

### Auto-scaling de App Services
- Configurar reglas de scaling basadas en CPU/memoria
- Usar deployment slots para zero-downtime deployments

---

**🎉 ¡Deployment completado! Tu aplicación Microsoft Fabric Embedded está lista para usar.**

**📋 Recordatorio importante:**
- **Creación de capacity**: Solo desde Azure Portal  
- **Gestión operacional**: Fabric Portal (pausar, asignar workspaces)
- **Monitoreo y billing**: Azure Portal

Para actualizaciones y mantenimiento, consulta la [documentación de CI/CD](../deployment/local-development.md).