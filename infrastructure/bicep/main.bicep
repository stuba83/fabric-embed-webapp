// main.bicep - Template principal para Microsoft Fabric Embedded App
@description('Nombre base para todos los recursos')
param appName string = 'fabric-embedded-app'

@description('Ubicación de los recursos')
param location string = resourceGroup().location

@description('Client ID de la aplicación en Entra ID')
param entraClientId string

@description('Client Secret de la aplicación en Entra ID')
@secure()
param entraClientSecret string

@description('Tenant ID de Entra ID')
param entraTenantId string

@description('Workspace ID de Microsoft Fabric')
param fabricWorkspaceId string = ''

@description('SKU del App Service Plan')
@allowed(['B1', 'B2', 'S1', 'S2', 'P1v2', 'P2v2'])
param appServiceSku string = 'B1'

@description('SKU de Microsoft Fabric Capacity')
@allowed(['F2', 'F4', 'F8', 'F16', 'F32', 'F64', 'F128', 'F256', 'F512'])
param fabricCapacitySku string = 'F8'

@description('Email del administrador para Microsoft Fabric Capacity')
param adminEmail string

// Variables
var uniqueSuffix = substring(uniqueString(resourceGroup().id), 0, 6)
var appServicePlanName = '${appName}-asp-${uniqueSuffix}'
var frontendAppName = '${appName}-frontend-${uniqueSuffix}'
var backendAppName = '${appName}-backend-${uniqueSuffix}'
var keyVaultName = '${appName}-kv-${uniqueSuffix}'
var fabricCapacityName = '${appName}-fabric-${uniqueSuffix}'
var appInsightsName = '${appName}-ai-${uniqueSuffix}'
var managedIdentityName = '${appName}-identity-${uniqueSuffix}'

// Managed Identity para acceso a Key Vault
resource managedIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: managedIdentityName
  location: location
}

// Key Vault para almacenar secrets
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: keyVaultName
  location: location
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    enablePurgeProtection: true
    networkAcls: {
      defaultAction: 'Allow'
      bypass: 'AzureServices'
    }
  }
}

// Application Insights
resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    RetentionInDays: 90
    IngestionMode: 'ApplicationInsights'
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}

// App Service Plan (Linux)
resource appServicePlan 'Microsoft.Web/serverfarms@2023-01-01' = {
  name: appServicePlanName
  location: location
  sku: {
    name: appServiceSku
    capacity: 1
  }
  kind: 'linux'
  properties: {
    reserved: true
  }
}

// Frontend App Service (React)
resource frontendApp 'Microsoft.Web/sites@2023-01-01' = {
  name: frontendAppName
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${managedIdentity.id}': {}
    }
  }
  properties: {
    serverFarmId: appServicePlan.id
    siteConfig: {
      linuxFxVersion: 'NODE|18-lts'
      alwaysOn: true
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      http20Enabled: true
      appSettings: [
        {
          name: 'WEBSITE_NODE_DEFAULT_VERSION'
          value: '18.17.0'
        }
        {
          name: 'SCM_DO_BUILD_DURING_DEPLOYMENT'
          value: 'true'
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsights.properties.ConnectionString
        }
      ]
    }
    httpsOnly: true
    clientAffinityEnabled: false
  }
}

// Backend App Service (Python)
resource backendApp 'Microsoft.Web/sites@2023-01-01' = {
  name: backendAppName
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${managedIdentity.id}': {}
    }
  }
  properties: {
    serverFarmId: appServicePlan.id
    siteConfig: {
      linuxFxVersion: 'PYTHON|3.11'
      alwaysOn: true
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      http20Enabled: true
      appSettings: [
        {
          name: 'ENTRA_CLIENT_ID'
          value: entraClientId
        }
        {
          name: 'ENTRA_TENANT_ID'
          value: entraTenantId
        }
        {
          name: 'FABRIC_WORKSPACE_ID'
          value: fabricWorkspaceId
        }
        {
          name: 'KEY_VAULT_URL'
          value: keyVault.properties.vaultUri
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsights.properties.ConnectionString
        }
        {
          name: 'MANAGED_IDENTITY_CLIENT_ID'
          value: managedIdentity.properties.clientId
        }
        {
          name: 'PYTHONPATH'
          value: '/home/site/wwwroot'
        }
      ]
    }
    httpsOnly: true
    clientAffinityEnabled: false
  }
}

// Microsoft Fabric Capacity
resource fabricCapacity 'Microsoft.Fabric/capacities@2023-11-01' = {
  name: fabricCapacityName
  location: location
  sku: {
    name: fabricCapacitySku
    tier: 'Fabric'
  }
  properties: {
    administration: {
      members: [
        adminEmail
      ]
    }
  }
}

// Role assignment - Key Vault Secrets User para Managed Identity
resource keyVaultSecretsUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, managedIdentity.id, 'Key Vault Secrets User')
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')
    principalId: managedIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// Secrets en Key Vault
resource entraClientSecretKV 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'entra-client-secret'
  properties: {
    value: entraClientSecret
    contentType: 'text/plain'
  }
}

resource fabricClientSecretKV 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'fabric-client-secret'
  properties: {
    value: entraClientSecret // Mismo secret para Fabric
    contentType: 'text/plain'
  }
}

// CORS configuration para Frontend
resource frontendCors 'Microsoft.Web/sites/config@2023-01-01' = {
  parent: frontendApp
  name: 'web'
  properties: {
    cors: {
      allowedOrigins: [
        'https://${backendApp.properties.defaultHostName}'
        'https://app.powerbi.com'
        'https://app.fabric.microsoft.com'
      ]
      supportCredentials: true
    }
  }
}

// CORS configuration para Backend
resource backendCors 'Microsoft.Web/sites/config@2023-01-01' = {
  parent: backendApp
  name: 'web'
  properties: {
    cors: {
      allowedOrigins: [
        'https://${frontendApp.properties.defaultHostName}'
      ]
      supportCredentials: true
    }
  }
}

// Outputs
output frontendUrl string = 'https://${frontendApp.properties.defaultHostName}'
output backendUrl string = 'https://${backendApp.properties.defaultHostName}'
output keyVaultName string = keyVault.name
output keyVaultUrl string = keyVault.properties.vaultUri
output fabricCapacityName string = fabricCapacity.name
output managedIdentityClientId string = managedIdentity.properties.clientId
output managedIdentityPrincipalId string = managedIdentity.properties.principalId
output appInsightsConnectionString string = appInsights.properties.ConnectionString
output resourceGroupName string = resourceGroup().name

// Información para configuración post-deployment
output postDeploymentInfo object = {
  frontendAppName: frontendApp.name
  backendAppName: backendApp.name
  fabricCapacityId: fabricCapacity.id
  entraClientId: entraClientId
  entraTenantId: entraTenantId
  keyVaultSecretsToCreate: [
    'entra-client-secret'
    'fabric-client-secret'
  ]
  nextSteps: [
    'Configure Microsoft Fabric workspace to use the created capacity'
    'Add Service Principal to Fabric workspace as Admin'
    'Configure Row Level Security (RLS) in PowerBI dataset'
    'Deploy frontend and backend applications'
    'Test authentication and PowerBI embedding'
  ]
}