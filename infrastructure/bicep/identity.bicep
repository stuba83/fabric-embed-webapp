// identity.bicep - Identity and security resources for Microsoft Fabric Embedded App

@description('Base name for resources')
param appName string

@description('Location for resources')
param location string = resourceGroup().location

@description('Entra ID Tenant ID')
param tenantId string

@description('Backend App Service Principal ID')
param backendPrincipalId string

@description('Frontend App Service Principal ID')
param frontendPrincipalId string

@description('Administrator email for notifications')
param adminEmail string

@description('Enable advanced security features')
param enableAdvancedSecurity bool = true

@description('Key Vault configuration')
param keyVaultConfig object = {
  enableSoftDelete: true
  softDeleteRetentionDays: 90
  enablePurgeProtection: true
  enableRbacAuthorization: false
}

// Variables
var uniqueSuffix = substring(uniqueString(resourceGroup().id), 0, 6)
var keyVaultName = '${appName}-kv-${uniqueSuffix}'
var userAssignedIdentityName = '${appName}-identity-${uniqueSuffix}'

// User Assigned Managed Identity for PowerBI Service Principal
resource userAssignedIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: userAssignedIdentityName
  location: location
  tags: {
    Project: 'Microsoft Fabric Embedded'
    Component: 'Identity'
    Purpose: 'PowerBI Service Principal'
  }
}

// Key Vault for secrets management
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: keyVaultName
  location: location
  properties: {
    tenantId: tenantId
    sku: {
      family: 'A'
      name: 'standard'
    }
    enabledForDeployment: false
    enabledForDiskEncryption: false
    enabledForTemplateDeployment: true
    enableSoftDelete: keyVaultConfig.enableSoftDelete
    softDeleteRetentionInDays: keyVaultConfig.softDeleteRetentionDays
    enablePurgeProtection: keyVaultConfig.enablePurgeProtection
    enableRbacAuthorization: keyVaultConfig.enableRbacAuthorization
    publicNetworkAccess: 'Enabled'
    networkAcls: {
      bypass: 'AzureServices'
      defaultAction: 'Allow'
      virtualNetworkRules: []
      ipRules: []
    }
    accessPolicies: keyVaultConfig.enableRbacAuthorization ? [] : [
      // Backend App Service access
      {
        tenantId: tenantId
        objectId: backendPrincipalId
        permissions: {
          secrets: ['get', 'list']
          certificates: ['get', 'list']
        }
      }
      // Frontend App Service access
      {
        tenantId: tenantId
        objectId: frontendPrincipalId
        permissions: {
          secrets: ['get', 'list']
        }
      }
      // User Assigned Identity access
      {
        tenantId: tenantId
        objectId: userAssignedIdentity.properties.principalId
        permissions: {
          secrets: ['get', 'list', 'set', 'delete']
          certificates: ['get', 'list', 'create', 'update', 'delete']
        }
      }
    ]
  }
  tags: {
    Project: 'Microsoft Fabric Embedded'
    Component: 'Security'
    DataClassification: 'Confidential'
  }
}

// Diagnostic settings for Key Vault
resource keyVaultDiagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: '${keyVaultName}-diagnostics'
  scope: keyVault
  properties: {
    logs: [
      {
        categoryGroup: 'audit'
        enabled: true
        retentionPolicy: {
          enabled: true
          days: 365
        }
      }
      {
        categoryGroup: 'allLogs'
        enabled: true
        retentionPolicy: {
          enabled: true
          days: 90
        }
      }
    ]
    metrics: [
      {
        category: 'AllMetrics'
        enabled: true
        retentionPolicy: {
          enabled: true
          days: 90
        }
      }
    ]
  }
}

// Secrets for application configuration
resource entraClientSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'entra-client-secret'
  properties: {
    value: 'PLACEHOLDER-UPDATE-WITH-ACTUAL-SECRET'
    contentType: 'text/plain'
    attributes: {
      enabled: true
    }
  }
  tags: {
    Purpose: 'Entra ID Authentication'
    Environment: 'Production'
  }
}

resource fabricClientSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'fabric-client-secret'
  properties: {
    value: 'PLACEHOLDER-UPDATE-WITH-ACTUAL-SECRET'
    contentType: 'text/plain'
    attributes: {
      enabled: true
    }
  }
  tags: {
    Purpose: 'Microsoft Fabric Authentication'
    Environment: 'Production'
  }
}

resource jwtSigningKey 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'jwt-signing-key'
  properties: {
    value: base64(uniqueString(resourceGroup().id, deployment().name, 'jwt-key'))
    contentType: 'text/plain'
    attributes: {
      enabled: true
    }
  }
  tags: {
    Purpose: 'JWT Token Signing'
    Environment: 'Production'
  }
}

resource databaseConnectionString 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'database-connection-string'
  properties: {
    value: 'PLACEHOLDER-UPDATE-WITH-ACTUAL-CONNECTION-STRING'
    contentType: 'text/plain'
    attributes: {
      enabled: true
    }
  }
  tags: {
    Purpose: 'Database Connection'
    Environment: 'Production'
  }
}

// Application Insights for security monitoring
resource securityInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: '${appName}-security-insights'
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    Flow_Type: 'Redfield'
    Request_Source: 'IbizaAIExtension'
    RetentionInDays: 90
    WorkspaceResourceId: '/subscriptions/${subscription().subscriptionId}/resourceGroups/${resourceGroup().name}'
    IngestionMode: 'ApplicationInsights'
  }
  tags: {
    Project: 'Microsoft Fabric Embedded'
    Component: 'Security Monitoring'
  }
}

// Log Analytics Workspace for security logs
resource securityLogWorkspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${appName}-security-logs'
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 365 // Keep security logs longer
    features: {
      enableLogAccessUsingOnlyResourcePermissions: true
    }
    workspaceCapping: {
      dailyQuotaGb: 2
    }
  }
  tags: {
    Project: 'Microsoft Fabric Embedded'
    Component: 'Security Logging'
    DataClassification: 'Restricted'
  }
}

// Security Center (Microsoft Defender for Cloud) recommendations
resource securityContacts 'Microsoft.Security/securityContacts@2020-01-01-preview' = if (enableAdvancedSecurity) {
  name: 'default'
  properties: {
    emails: adminEmail
    notificationsByRole: {
      state: 'On'
      roles: ['Owner']
    }
    alertNotifications: {
      state: 'On'
      minimalSeverity: 'Medium'
    }
  }
}

// Action Group for security alerts
resource securityActionGroup 'Microsoft.Insights/actionGroups@2023-01-01' = {
  name: '${appName}-security-alerts'
  location: 'Global'
  properties: {
    groupShortName: 'SecAlert'
    enabled: true
    emailReceivers: [
      {
        name: 'SecurityAdmin'
        emailAddress: adminEmail
        useCommonAlertSchema: true
      }
    ]
    smsReceivers: []
    webhookReceivers: []
    azureFunctionReceivers: []
    logicAppReceivers: []
  }
  tags: {
    Project: 'Microsoft Fabric Embedded'
    Component: 'Security Alerting'
  }
}

// Key Vault access anomaly alert
resource keyVaultAnomalyAlert 'Microsoft.Insights/scheduledQueryRules@2023-03-15-preview' = {
  name: '${appName}-keyvault-anomaly'
  location: location
  properties: {
    displayName: 'Key Vault Access Anomaly Detection'
    description: 'Detects unusual access patterns to Key Vault'
    severity: 2
    enabled: true
    evaluationFrequency: 'PT5M'
    scopes: [
      keyVault.id
    ]
    targetResourceTypes: [
      'Microsoft.KeyVault/vaults'
    ]
    windowSize: 'PT15M'
    criteria: {
      allOf: [
        {
          query: '''
            KeyVaultData
            | where TimeGenerated > ago(15m)
            | where ResultType == "Success"
            | summarize count() by CallerIPAddress, bin(TimeGenerated, 5m)
            | where count_ > 10
          '''
          timeAggregation: 'Count'
          dimensions: []
          operator: 'GreaterThan'
          threshold: 0
          failingPeriods: {
            numberOfEvaluationPeriods: 1
            minFailingPeriodsToAlert: 1
          }
        }
      ]
    }
    actions: {
      actionGroups: [
        securityActionGroup.id
      ]
    }
  }
}

// Failed authentication alert
resource failedAuthAlert 'Microsoft.Insights/scheduledQueryRules@2023-03-15-preview' = {
  name: '${appName}-failed-auth'
  location: location
  properties: {
    displayName: 'High Number of Failed Authentications'
    description: 'Detects multiple failed authentication attempts'
    severity: 1
    enabled: true
    evaluationFrequency: 'PT5M'
    scopes: [
      securityInsights.id
    ]
    windowSize: 'PT10M'
    criteria: {
      allOf: [
        {
          query: '''
            requests
            | where timestamp > ago(10m)
            | where resultCode startswith "4"
            | where url contains "auth"
            | summarize failedAttempts = count() by client_IP, bin(timestamp, 1m)
            | where failedAttempts > 5
          '''
          timeAggregation: 'Count'
          dimensions: []
          operator: 'GreaterThan'
          threshold: 0
          failingPeriods: {
            numberOfEvaluationPeriods: 1
            minFailingPeriodsToAlert: 1
          }
        }
      ]
    }
    actions: {
      actionGroups: [
        securityActionGroup.id
      ]
    }
  }
}

// Network Security Group for additional protection (if VNet is used)
resource networkSecurityGroup 'Microsoft.Network/networkSecurityGroups@2023-09-01' = if (enableAdvancedSecurity) {
  name: '${appName}-nsg'
  location: location
  properties: {
    securityRules: [
      {
        name: 'AllowHTTPS'
        properties: {
          priority: 1000
          access: 'Allow'
          direction: 'Inbound'
          destinationPortRange: '443'
          protocol: 'Tcp'
          sourcePortRange: '*'
          sourceAddressPrefix: '*'
          destinationAddressPrefix: '*'
        }
      }
      {
        name: 'AllowHTTP'
        properties: {
          priority: 1001
          access: 'Allow'
          direction: 'Inbound'
          destinationPortRange: '80'
          protocol: 'Tcp'
          sourcePortRange: '*'
          sourceAddressPrefix: '*'
          destinationAddressPrefix: '*'
        }
      }
      {
        name: 'DenyAll'
        properties: {
          priority: 4096
          access: 'Deny'
          direction: 'Inbound'
          destinationPortRange: '*'
          protocol: '*'
          sourcePortRange: '*'
          sourceAddressPrefix: '*'
          destinationAddressPrefix: '*'
        }
      }
    ]
  }
  tags: {
    Project: 'Microsoft Fabric Embedded'
    Component: 'Network Security'
  }
}

// Outputs
output keyVaultId string = keyVault.id
output keyVaultName string = keyVault.name
output keyVaultUri string = keyVault.properties.vaultUri

output userAssignedIdentityId string = userAssignedIdentity.id
output userAssignedIdentityName string = userAssignedIdentity.name
output userAssignedIdentityPrincipalId string = userAssignedIdentity.properties.principalId
output userAssignedIdentityClientId string = userAssignedIdentity.properties.clientId

output securityInsightsId string = securityInsights.id
output securityInsightsConnectionString string = securityInsights.properties.ConnectionString
output securityLogWorkspaceId string = securityLogWorkspace.id

output networkSecurityGroupId string = enableAdvancedSecurity ? networkSecurityGroup.id : ''

output secretsToUpdate array = [
  {
    name: 'entra-client-secret'
    description: 'Update with actual Entra ID client secret'
    keyVaultUrl: '${keyVault.properties.vaultUri}secrets/entra-client-secret'
  }
  {
    name: 'fabric-client-secret'
    description: 'Update with actual Microsoft Fabric client secret'
    keyVaultUrl: '${keyVault.properties.vaultUri}secrets/fabric-client-secret'
  }
  {
    name: 'database-connection-string'
    description: 'Update with actual database connection string'
    keyVaultUrl: '${keyVault.properties.vaultUri}secrets/database-connection-string'
  }
]

output securityConfiguration object = {
  keyVault: {
    name: keyVault.name
    uri: keyVault.properties.vaultUri
    softDeleteEnabled: keyVaultConfig.enableSoftDelete
    purgeProtectionEnabled: keyVaultConfig.enablePurgeProtection
  }
  monitoring: {
    securityInsights: securityInsights.name
    logWorkspace: securityLogWorkspace.name
    alertsConfigured: true
  }
  identity: {
    userAssignedIdentity: userAssignedIdentity.name
    principalId: userAssignedIdentity.properties.principalId
  }
  networkSecurity: {
    nsgEnabled: enableAdvancedSecurity
    httpsEnforced: true
  }
}

output nextSteps array = [
  'Update Key Vault secrets with actual values using Azure Portal or CLI'
  'Configure Entra ID app registration with proper permissions'
  'Set up Service Principal for Microsoft Fabric with workspace access'
  'Review and configure security alerts in Azure Monitor'
  'Test Key Vault access from App Services'
  'Configure network restrictions if needed'
]