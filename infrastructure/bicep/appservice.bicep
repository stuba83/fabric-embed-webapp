// appservice.bicep - App Service resources for Microsoft Fabric Embedded App

@description('Base name for resources')
param appName string

@description('Location for resources')
param location string = resourceGroup().location

@description('App Service Plan SKU')
@allowed(['F1', 'D1', 'B1', 'B2', 'B3', 'S1', 'S2', 'S3', 'P1', 'P2', 'P3'])
param appServicePlanSku string = 'B1'

@description('Key Vault name for secrets')
param keyVaultName string

@description('Application Insights name')
param appInsightsName string

@description('Frontend environment variables')
param frontendEnvVars object = {}

@description('Backend environment variables')
param backendEnvVars object = {}

@description('Enable staging slots')
param enableStagingSlots bool = false

// Variables
var uniqueSuffix = substring(uniqueString(resourceGroup().id), 0, 6)
var appServicePlanName = '${appName}-plan-${uniqueSuffix}'
var frontendAppName = '${appName}-frontend-${uniqueSuffix}'
var backendAppName = '${appName}-backend-${uniqueSuffix}'

// App Service Plan
resource appServicePlan 'Microsoft.Web/serverfarms@2023-01-01' = {
  name: appServicePlanName
  location: location
  kind: 'linux'
  properties: {
    reserved: true
  }
  sku: {
    name: appServicePlanSku
    tier: appServicePlanSku == 'F1' ? 'Free' : appServicePlanSku == 'D1' ? 'Shared' : appServicePlanSku == 'B1' ? 'Basic' : 'Standard'
  }
  tags: {
    Project: 'Microsoft Fabric Embedded'
    Environment: 'Production'
    Component: 'App Service Plan'
  }
}

// Key Vault reference (existing)
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

// Application Insights reference (existing)
resource appInsights 'Microsoft.Insights/components@2020-02-02' existing = {
  name: appInsightsName
}

// Frontend App Service
resource frontendApp 'Microsoft.Web/sites@2023-01-01' = {
  name: frontendAppName
  location: location
  kind: 'app,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    clientAffinityEnabled: false
    siteConfig: {
      linuxFxVersion: 'NODE|18-lts'
      alwaysOn: appServicePlanSku != 'F1' && appServicePlanSku != 'D1'
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      scmMinTlsVersion: '1.2'
      http20Enabled: true
      healthCheckPath: '/health'
      appSettings: union([
        {
          name: 'WEBSITE_NODE_DEFAULT_VERSION'
          value: '18-lts'
        }
        {
          name: 'SCM_DO_BUILD_DURING_DEPLOYMENT'
          value: 'true'
        }
        {
          name: 'WEBSITE_RUN_FROM_PACKAGE'
          value: '1'
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsights.properties.ConnectionString
        }
        {
          name: 'WEBSITE_HEALTHCHECK_MAXPINGFAILURES'
          value: '3'
        }
        {
          name: 'WEBSITE_HEALTHCHECK_MAXUNHEALTHYWORKERPERCENT'
          value: '50'
        }
      ], [for key in items(frontendEnvVars): {
        name: key.key
        value: key.value
      }])
      cors: {
        allowedOrigins: [
          'https://${backendAppName}.azurewebsites.net'
          'https://app.powerbi.com'
          'https://app.fabric.microsoft.com'
        ]
        supportCredentials: true
      }
    }
  }
  tags: {
    Project: 'Microsoft Fabric Embedded'
    Environment: 'Production'
    Component: 'Frontend'
  }
}

// Frontend Staging Slot
resource frontendStagingSlot 'Microsoft.Web/sites/slots@2023-01-01' = if (enableStagingSlots) {
  parent: frontendApp
  name: 'staging'
  location: location
  kind: 'app,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    clientAffinityEnabled: false
    siteConfig: {
      linuxFxVersion: 'NODE|18-lts'
      alwaysOn: appServicePlanSku != 'F1' && appServicePlanSku != 'D1'
      appSettings: [
        {
          name: 'WEBSITE_NODE_DEFAULT_VERSION'
          value: '18-lts'
        }
        {
          name: 'STAGING_ENVIRONMENT'
          value: 'true'
        }
      ]
    }
  }
  tags: {
    Project: 'Microsoft Fabric Embedded'
    Environment: 'Staging'
    Component: 'Frontend'
  }
}

// Backend App Service
resource backendApp 'Microsoft.Web/sites@2023-01-01' = {
  name: backendAppName
  location: location
  kind: 'app,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    clientAffinityEnabled: false
    siteConfig: {
      linuxFxVersion: 'PYTHON|3.11'
      alwaysOn: appServicePlanSku != 'F1' && appServicePlanSku != 'D1'
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      scmMinTlsVersion: '1.2'
      http20Enabled: true
      healthCheckPath: '/api/health'
      appSettings: union([
        {
          name: 'SCM_DO_BUILD_DURING_DEPLOYMENT'
          value: 'true'
        }
        {
          name: 'WEBSITES_ENABLE_APP_SERVICE_STORAGE'
          value: 'false'
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsights.properties.ConnectionString
        }
        {
          name: 'AZURE_KEY_VAULT_URL'
          value: keyVault.properties.vaultUri
        }
        {
          name: 'WEBSITE_HEALTHCHECK_MAXPINGFAILURES'
          value: '3'
        }
        {
          name: 'PYTHONPATH'
          value: '/home/site/wwwroot'
        }
      ], [for key in items(backendEnvVars): {
        name: key.key
        value: key.value
      }])
      cors: {
        allowedOrigins: [
          'https://${frontendAppName}.azurewebsites.net'
          'https://app.powerbi.com'
          'https://app.fabric.microsoft.com'
        ]
        supportCredentials: true
      }
    }
  }
  tags: {
    Project: 'Microsoft Fabric Embedded'
    Environment: 'Production'
    Component: 'Backend'
  }
}

// Backend Staging Slot
resource backendStagingSlot 'Microsoft.Web/sites/slots@2023-01-01' = if (enableStagingSlots) {
  parent: backendApp
  name: 'staging'
  location: location
  kind: 'app,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    clientAffinityEnabled: false
    siteConfig: {
      linuxFxVersion: 'PYTHON|3.11'
      alwaysOn: appServicePlanSku != 'F1' && appServicePlanSku != 'D1'
      appSettings: [
        {
          name: 'SCM_DO_BUILD_DURING_DEPLOYMENT'
          value: 'true'
        }
        {
          name: 'STAGING_ENVIRONMENT'
          value: 'true'
        }
        {
          name: 'AZURE_KEY_VAULT_URL'
          value: keyVault.properties.vaultUri
        }
      ]
    }
  }
  tags: {
    Project: 'Microsoft Fabric Embedded'
    Environment: 'Staging'
    Component: 'Backend'
  }
}

// Grant Key Vault access to App Services
resource frontendKeyVaultAccess 'Microsoft.KeyVault/vaults/accessPolicies@2023-07-01' = {
  parent: keyVault
  name: 'add'
  properties: {
    accessPolicies: [
      {
        tenantId: frontendApp.identity.tenantId
        objectId: frontendApp.identity.principalId
        permissions: {
          secrets: ['get', 'list']
        }
      }
    ]
  }
}

resource backendKeyVaultAccess 'Microsoft.KeyVault/vaults/accessPolicies@2023-07-01' = {
  parent: keyVault
  name: 'add'
  properties: {
    accessPolicies: [
      {
        tenantId: backendApp.identity.tenantId
        objectId: backendApp.identity.principalId
        permissions: {
          secrets: ['get', 'list']
          certificates: ['get', 'list']
        }
      }
    ]
  }
  dependsOn: [frontendKeyVaultAccess]
}

// Custom Domain and SSL (optional)
resource frontendCustomDomain 'Microsoft.Web/sites/hostNameBindings@2023-01-01' = if (!empty(frontendEnvVars.CUSTOM_DOMAIN ?? '')) {
  parent: frontendApp
  name: frontendEnvVars.CUSTOM_DOMAIN ?? 'example.com'
  properties: {
    siteName: frontendApp.name
    hostNameType: 'Verified'
    sslState: 'SniEnabled'
    customHostNameDnsRecordType: 'CName'
  }
}

// Application Insights connection for detailed monitoring
resource frontendAppInsightsExtension 'Microsoft.Web/sites/extensions@2023-01-01' = {
  parent: frontendApp
  name: 'Microsoft.ApplicationInsights.AzureWebSites'
  properties: {}
  dependsOn: [frontendApp]
}

resource backendAppInsightsExtension 'Microsoft.Web/sites/extensions@2023-01-01' = {
  parent: backendApp
  name: 'Microsoft.ApplicationInsights.AzureWebSites'
  properties: {}
  dependsOn: [backendApp]
}

// Outputs
output appServicePlanId string = appServicePlan.id
output appServicePlanName string = appServicePlan.name

output frontendAppId string = frontendApp.id
output frontendAppName string = frontendApp.name
output frontendUrl string = 'https://${frontendApp.properties.defaultHostName}'
output frontendPrincipalId string = frontendApp.identity.principalId

output backendAppId string = backendApp.id
output backendAppName string = backendApp.name
output backendUrl string = 'https://${backendApp.properties.defaultHostName}'
output backendPrincipalId string = backendApp.identity.principalId

output frontendStagingUrl string = enableStagingSlots ? 'https://${frontendApp.name}-staging.azurewebsites.net' : ''
output backendStagingUrl string = enableStagingSlots ? 'https://${backendApp.name}-staging.azurewebsites.net' : ''

output deploymentSummary object = {
  appServicePlan: {
    name: appServicePlan.name
    sku: appServicePlanSku
    location: location
  }
  frontend: {
    name: frontendApp.name
    url: 'https://${frontendApp.properties.defaultHostName}'
    runtime: 'Node.js 18 LTS'
  }
  backend: {
    name: backendApp.name
    url: 'https://${backendApp.properties.defaultHostName}'
    runtime: 'Python 3.11'
  }
  features: {
    stagingSlots: enableStagingSlots
    customDomain: !empty(frontendEnvVars.CUSTOM_DOMAIN ?? '')
    applicationInsights: true
    keyVaultIntegration: true
  }
}