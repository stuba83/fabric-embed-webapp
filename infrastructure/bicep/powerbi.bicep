// powerbi.bicep - Microsoft Fabric and PowerBI resources

@description('Base name for resources')
param appName string

@description('Location for resources')
param location string = resourceGroup().location

@description('Microsoft Fabric Capacity SKU')
@allowed(['F2', 'F4', 'F8', 'F16', 'F32', 'F64', 'F128', 'F256', 'F512'])
param fabricCapacitySku string = 'F8'

@description('Email of the capacity administrator')
param adminEmail string

@description('PowerBI Workspace ID (optional - if existing)')
param existingWorkspaceId string = ''

@description('Fabric Workspace configuration')
param workspaceConfig object = {
  name: '${appName}-workspace'
  description: 'Microsoft Fabric workspace for embedded analytics'
}

@description('Enable automatic scaling')
param enableAutoScale bool = true

@description('Scale settings')
param scaleSettings object = {
  minCapacity: fabricCapacitySku
  maxCapacity: 'F16'
  scaleUpThreshold: 80
  scaleDownThreshold: 40
}

// Variables
var uniqueSuffix = substring(uniqueString(resourceGroup().id), 0, 6)
var fabricCapacityName = '${appName}-fabric-${uniqueSuffix}'
var workspaceName = workspaceConfig.name

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
    // Auto-pause configuration
    autoPause: {
      enabled: true
      delayInMinutes: 60 // Pause after 60 minutes of inactivity
    }
    // Auto-scale configuration
    autoScale: enableAutoScale ? {
      enabled: true
      minCapacity: scaleSettings.minCapacity
      maxCapacity: scaleSettings.maxCapacity
      scaleUpThreshold: scaleSettings.scaleUpThreshold
      scaleDownThreshold: scaleSettings.scaleDownThreshold
    } : {
      enabled: false
    }
  }
  tags: {
    Project: 'Microsoft Fabric Embedded'
    Environment: 'Production'
    Component: 'Fabric Capacity'
    CostCenter: 'Analytics'
    AutoPause: 'Enabled'
  }
}

// Application Insights for monitoring
resource fabricInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: '${fabricCapacityName}-insights'
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
    Component: 'Monitoring'
  }
}

// Log Analytics Workspace for advanced monitoring
resource logAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${fabricCapacityName}-logs'
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
    features: {
      enableLogAccessUsingOnlyResourcePermissions: true
    }
    workspaceCapping: {
      dailyQuotaGb: 1
    }
  }
  tags: {
    Project: 'Microsoft Fabric Embedded'
    Component: 'Logging'
  }
}

// Diagnostic settings for Fabric Capacity
resource fabricDiagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: '${fabricCapacityName}-diagnostics'
  scope: fabricCapacity
  properties: {
    workspaceId: logAnalyticsWorkspace.id
    metrics: [
      {
        category: 'AllMetrics'
        enabled: true
        retentionPolicy: {
          enabled: true
          days: 30
        }
      }
    ]
    logs: [
      {
        categoryGroup: 'allLogs'
        enabled: true
        retentionPolicy: {
          enabled: true
          days: 30
        }
      }
    ]
  }
}

// Action Group for alerts
resource actionGroup 'Microsoft.Insights/actionGroups@2023-01-01' = {
  name: '${fabricCapacityName}-alerts'
  location: 'Global'
  properties: {
    groupShortName: 'FabricAlert'
    enabled: true
    emailReceivers: [
      {
        name: 'AdminEmail'
        emailAddress: adminEmail
        useCommonAlertSchema: true
      }
    ]
  }
  tags: {
    Project: 'Microsoft Fabric Embedded'
    Component: 'Alerting'
  }
}

// High CPU Alert
resource highCpuAlert 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: '${fabricCapacityName}-high-cpu'
  location: 'Global'
  properties: {
    description: 'Alert when Fabric Capacity CPU usage is high'
    severity: 2
    enabled: true
    scopes: [
      fabricCapacity.id
    ]
    evaluationFrequency: 'PT1M'
    windowSize: 'PT5M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'HighCPU'
          metricName: 'cpu_percentage'
          metricNamespace: 'Microsoft.Fabric/capacities'
          operator: 'GreaterThan'
          threshold: 85
          timeAggregation: 'Average'
        }
      ]
    }
    actions: [
      {
        actionGroupId: actionGroup.id
      }
    ]
  }
}

// Memory Alert
resource highMemoryAlert 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: '${fabricCapacityName}-high-memory'
  location: 'Global'
  properties: {
    description: 'Alert when Fabric Capacity memory usage is high'
    severity: 2
    enabled: true
    scopes: [
      fabricCapacity.id
    ]
    evaluationFrequency: 'PT1M'
    windowSize: 'PT5M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'HighMemory'
          metricName: 'memory_percentage'
          metricNamespace: 'Microsoft.Fabric/capacities'
          operator: 'GreaterThan'
          threshold: 90
          timeAggregation: 'Average'
        }
      ]
    }
    actions: [
      {
        actionGroupId: actionGroup.id
      }
    ]
  }
}

// Cost Alert
resource costAlert 'Microsoft.CostManagement/budgets@2023-11-01' = {
  name: '${fabricCapacityName}-budget'
  scope: resourceGroup().id
  properties: {
    displayName: 'Fabric Capacity Monthly Budget'
    amount: 500 // $500 USD budget
    timeGrain: 'Monthly'
    timePeriod: {
      startDate: '2025-01-01'
    }
    category: 'Cost'
    notifications: {
      alert1: {
        enabled: true
        operator: 'GreaterThan'
        threshold: 80
        contactEmails: [
          adminEmail
        ]
        thresholdType: 'Forecasted'
      }
      alert2: {
        enabled: true
        operator: 'GreaterThan'
        threshold: 100
        contactEmails: [
          adminEmail
        ]
        thresholdType: 'Actual'
      }
    }
    filter: {
      dimensions: {
        name: 'ResourceGroupName'
        operator: 'In'
        values: [
          resourceGroup().name
        ]
      }
    }
  }
}

// Automation Account for capacity management
resource automationAccount 'Microsoft.Automation/automationAccounts@2023-11-01' = {
  name: '${fabricCapacityName}-automation'
  location: location
  properties: {
    sku: {
      name: 'Basic'
    }
    publicNetworkAccess: true
  }
  identity: {
    type: 'SystemAssigned'
  }
  tags: {
    Project: 'Microsoft Fabric Embedded'
    Component: 'Automation'
  }
}

// PowerShell runbook for capacity management
resource capacityManagementRunbook 'Microsoft.Automation/automationAccounts/runbooks@2020-01-13-preview' = {
  parent: automationAccount
  name: 'ManageFabricCapacity'
  properties: {
    runbookType: 'PowerShell'
    logProgress: true
    logVerbose: true
    description: 'Automatically manage Fabric Capacity scaling and pausing'
    publishContentLink: {
      uri: 'https://raw.githubusercontent.com/Azure/azure-quickstart-templates/master/quickstarts/microsoft.automation/automation-runbook-manage-fabric/ManageFabricCapacity.ps1'
      version: '1.0.0.0'
    }
  }
}

// Schedule for off-hours pause
resource pauseSchedule 'Microsoft.Automation/automationAccounts/schedules@2020-01-13-preview' = {
  parent: automationAccount
  name: 'PauseCapacityEvening'
  properties: {
    description: 'Pause Fabric Capacity during off-hours'
    frequency: 'Day'
    interval: 1
    startTime: '2025-01-01T18:00:00Z' // 6 PM UTC
    timeZone: 'UTC'
    advancedSchedule: {
      weekDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
    }
  }
}

// Schedule for morning resume
resource resumeSchedule 'Microsoft.Automation/automationAccounts/schedules@2020-01-13-preview' = {
  parent: automationAccount
  name: 'ResumeCapacityMorning'
  properties: {
    description: 'Resume Fabric Capacity during business hours'
    frequency: 'Day'
    interval: 1
    startTime: '2025-01-01T08:00:00Z' // 8 AM UTC
    timeZone: 'UTC'
    advancedSchedule: {
      weekDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
    }
  }
}

// Role assignment for automation account
resource fabricContributorRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(resourceGroup().id, automationAccount.id, 'FabricContributor')
  scope: fabricCapacity
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'b24988ac-6180-42a0-ab88-20f7382dd24c') // Contributor
    principalId: automationAccount.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// Outputs
output fabricCapacityId string = fabricCapacity.id
output fabricCapacityName string = fabricCapacity.name
output fabricCapacitySku string = fabricCapacitySku
output fabricCapacityLocation string = location

output workspaceName string = workspaceName
output workspaceId string = existingWorkspaceId

output applicationInsightsId string = fabricInsights.id
output applicationInsightsConnectionString string = fabricInsights.properties.ConnectionString
output logAnalyticsWorkspaceId string = logAnalyticsWorkspace.id

output automationAccountId string = automationAccount.id
output automationAccountName string = automationAccount.name

output monitoringDashboardUrl string = 'https://portal.azure.com/#@${tenant().tenantId}/dashboard/arm${resourceGroup().id}/providers/Microsoft.Portal/dashboards/${fabricCapacityName}-dashboard'

output costEstimate object = {
  fabricCapacity: {
    sku: fabricCapacitySku
    estimatedMonthlyCost: fabricCapacitySku == 'F8' ? 320 : fabricCapacitySku == 'F4' ? 160 : fabricCapacitySku == 'F16' ? 640 : 320
    currency: 'USD'
    billing: 'Hourly with auto-pause'
  }
  additionalServices: {
    applicationInsights: 5
    logAnalytics: 10
    automation: 5
    totalEstimated: 20
  }
}

output managementInstructions object = {
  pauseCapacity: 'az fabric capacity suspend --name ${fabricCapacityName} --resource-group ${resourceGroup().name}'
  resumeCapacity: 'az fabric capacity resume --name ${fabricCapacityName} --resource-group ${resourceGroup().name}'
  scaleCapacity: 'az fabric capacity update --name ${fabricCapacityName} --resource-group ${resourceGroup().name} --sku F16'
  viewMetrics: 'Visit Azure Portal > ${fabricCapacityName} > Metrics'
  manageBudget: 'Visit Azure Portal > Cost Management > Budgets > ${fabricCapacityName}-budget'
}

output nextSteps array = [
  'Configure PowerBI workspace to use this Fabric Capacity'
  'Add Service Principal as workspace admin in PowerBI Portal'
  'Configure Row Level Security (RLS) in PowerBI Desktop'
  'Test embed token generation with your application'
  'Configure alerts and monitoring dashboards'
  'Set up automated scaling policies if needed'
]