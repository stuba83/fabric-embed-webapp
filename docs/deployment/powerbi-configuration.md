# Configuración de Microsoft Fabric

Esta guía te ayudará a configurar Microsoft Fabric Capacity y workspace para embedar contenido de PowerBI en tu aplicación.

## 🎯 Descripción General

Microsoft Fabric ofrece una plataforma unificada que incluye PowerBI, Data Factory, Synapse y más. Para esta aplicación, utilizaremos:

- **Microsoft Fabric Capacity F8**: Proporciona recursos computacionales
- **Fabric Workspace**: Contiene los reportes y datasets  
- **Service Principal**: Acceso programático a la API
- **Row Level Security (RLS)**: Control de acceso a datos

## 💰 Comparación de Costos

| Opción | SKU | Costo/Mes (USD) | Usuarios Concurrentes | Casos de Uso |
|--------|-----|----------------|----------------------|--------------|
| **Fabric F8** | F8 | ~$320 | ~200 | **Recomendado** para producción |
| Fabric F4 | F4 | ~$160 | ~100 | Desarrollo/staging |
| Fabric F16 | F16 | ~$640 | ~400 | Alta demanda |
| PowerBI Embedded A1 | A1 | ~$750 | ~100 | Alternativa legacy |

> 💡 **Microsoft Fabric F8 ofrece mejor valor** que PowerBI Embedded A1, con menos costo y más capacidad.

## 🚀 Paso 1: Crear Microsoft Fabric Capacity

### 1.1 Desde Azure Portal (ÚNICO MÉTODO)
Microsoft Fabric Capacity se crea exclusivamente como un recurso de Azure desde Azure Portal:

```bash
# Crear Fabric Capacity con Azure CLI
az resource create \
  --resource-group "rg-fabric-embedded" \
  --name "fabric-capacity-f8" \
  --resource-type "Microsoft.Fabric/capacities" \
  --location "westus3" \
  --properties '{
    "administration": {
      "members": ["admin@yourdomain.com"]
    },
    "sku": {
      "name": "F8",
      "tier": "Fabric"
    }
  }'
```

**Pasos en Azure Portal UI:**
1. Ve a [Azure Portal](https://portal.azure.com)
2. Buscar "Microsoft Fabric" en la barra de búsqueda
3. Seleccionar "Microsoft Fabric capacities"
4. Click en "Create" 
5. Configurar:
   - **Subscription**: Tu suscripción de Azure
   - **Resource Group**: Grupo de recursos existente
   - **Capacity name**: Nombre único
   - **Location**: westus3 (o tu región preferida)
   - **Size**: F8
   - **Fabric administrators**: Tu email
6. Review + Create

### 1.2 Verificar en Fabric Portal
Una vez creada la capacity en Azure Portal:
1. Ve a [Microsoft Fabric Portal](https://app.fabric.microsoft.com)
2. Settings ⚙️ → Admin Portal
3. Capacity settings → Fabric capacities  
4. Verificar que tu nueva capacity aparece en la lista
5. Pausar/reanudar capacity según necesidades

## ⚙️ Paso 2: Configurar Workspace

### 2.1 Crear Workspace en Fabric
```bash
# Usar PowerShell con módulo de Fabric
Install-Module -Name MicrosoftPowerBIMgmt
Connect-PowerBIServiceAccount

# Crear workspace
New-PowerBIWorkspace -Name "Fabric-Embedded-Workspace"
```

### 2.2 Asignar Capacity al Workspace
1. En Fabric Portal → Workspaces
2. Seleccionar tu workspace  
3. Settings → Capacity assignment
4. Asignar a tu Fabric Capacity F8

## 🔐 Paso 3: Service Principal Setup

### 3.1 Habilitar Service Principal en Fabric
1. **Admin Portal** → Tenant settings
2. **Developer settings** → Service principals can use Fabric APIs
3. **Enable** para toda la organización o grupos específicos

### 3.2 Agregar Service Principal al Workspace
```bash
# PowerShell para agregar SP como Admin
$workspaceId = "tu-workspace-id"
$servicePrincipalId = "tu-service-principal-id" 

Add-PowerBIWorkspaceUser -Scope Organization -Id $workspaceId -PrincipalType App -Identifier $servicePrincipalId -AccessRight Admin
```

### 3.3 Permisos necesarios del Service Principal
En Azure Portal → App registrations → Tu app → API permissions:

```
Microsoft Graph:
- User.Read

Power BI Service:
- Dataset.ReadWrite.All
- Report.ReadWrite.All  
- Workspace.ReadWrite.All
- Tenant.Read.All (opcional, para admin)
```

## 📊 Paso 4: Configurar Row Level Security (RLS)

### 4.1 En PowerBI Desktop
```dax
-- Crear tabla de seguridad
UserSecurity = 
DATATABLE(
    "UserEmail", STRING,
    "Role", STRING,
    {
        {"admin@domain.com", "Admin"},
        {"userA@domain.com", "RolA"}, 
        {"userB@domain.com", "RolB"}
    }
)

-- Crear relación con tabla principal
-- Relacionar UserSecurity[UserEmail] con tu tabla de datos
```

### 4.2 Definir Roles de RLS
1. **Modeling** → Manage roles
2. Crear roles:

**Admin Role:**
```dax
-- Sin filtros (ve todo)
TRUE()
```

**RolA Role:**
```dax
-- Solo datos de región A
[Region] = "A" 
|| USERPRINCIPALNAME() IN VALUES(UserSecurity[UserEmail]) 
&& RELATED(UserSecurity[Role]) = "RolA"
```

**RolB Role:**
```dax
-- Solo datos de región B  
[Region] = "B"
|| USERPRINCIPALNAME() IN VALUES(UserSecurity[UserEmail])
&& RELATED(UserSecurity[Role]) = "RolB"
```

### 4.3 Mapeo Dinámico con Entra ID Groups
```dax
-- Filtro dinámico basado en grupos de Entra ID
VAR UserEmail = USERPRINCIPALNAME()
VAR UserGroups = 
    SWITCH(
        TRUE(),
        UserEmail IN {"admin@domain.com"}, "Admin",
        UserEmail IN {"userA1@domain.com", "userA2@domain.com"}, "RolA", 
        UserEmail IN {"userB1@domain.com", "userB2@domain.com"}, "RolB",
        "None"
    )
RETURN
    SWITCH(
        UserGroups,
        "Admin", TRUE(),
        "RolA", [Region] = "A",
        "RolB", [Region] = "B", 
        FALSE()
    )
```

## 🔄 Paso 5: Publicar y Configurar Dataset

### 5.1 Publicar desde PowerBI Desktop
1. **File** → Publish → Publish to Power BI
2. Seleccionar tu workspace de Fabric
3. Confirmar publicación

### 5.2 Configurar Dataset Settings
```bash
# PowerShell para configurar dataset
$datasetId = "tu-dataset-id"
$workspaceId = "tu-workspace-id"

# Habilitar RLS para Service Principal
Set-PowerBIDataset -Scope Organization -WorkspaceId $workspaceId -DatasetId $datasetId -TargetStorageMode Import
```

### 5.3 Validar RLS
1. En Fabric Portal → Dataset → Security
2. **Test as role** para cada rol definido
3. Verificar filtros funcionan correctamente

## 🛠️ Paso 6: Configuración de la Aplicación

### 6.1 Variables de Entorno del Backend
```bash
# Fabric Configuration
FABRIC_CAPACITY_ID=tu-capacity-id
FABRIC_WORKSPACE_ID=tu-workspace-id  
FABRIC_DATASET_ID=tu-dataset-id
FABRIC_REPORT_ID=tu-report-id

# Service Principal
ENTRA_CLIENT_ID=tu-client-id
ENTRA_CLIENT_SECRET=tu-client-secret
ENTRA_TENANT_ID=tu-tenant-id
```

### 6.2 Mapeo de Grupos en Código
```python
# backend/src/utils/role_mapping.py
ENTRA_GROUP_TO_FABRIC_ROLE = {
    "PBI-Admin": "Admin",
    "PBI-RolA": "RolA", 
    "PBI-RolB": "RolB"
}

def map_user_groups_to_fabric_roles(user_groups):
    """Mapea grupos de Entra ID a roles de Fabric"""
    fabric_roles = []
    for group in user_groups:
        if group in ENTRA_GROUP_TO_FABRIC_ROLE:
            fabric_roles.append(ENTRA_GROUP_TO_FABRIC_ROLE[group])
    
    return fabric_roles if fabric_roles else ["Public"]
```

## 📈 Paso 7: Monitoreo y Optimización

### 7.1 Métricas de Fabric Capacity
- **CPU utilization**: Mantener < 80%
- **Memory usage**: Monitorear picos
- **Query duration**: Optimizar consultas lentas
- **Concurrent users**: Escalar si necesario

### 7.2 Alertas Recomendadas
```bash
# Azure CLI para crear alertas
az monitor metrics alert create \
  --name "Fabric-High-CPU" \
  --resource-group "rg-fabric-embedded" \
  --condition "avg Percentage CPU > 80" \
  --description "High CPU usage in Fabric capacity"
```

### 7.3 Pausar/Reanudar Capacity
```bash
# Pausar capacity para ahorrar costos
az resource invoke-action \
  --resource-group "rg-fabric-embedded" \
  --resource-type "Microsoft.Fabric/capacities" \
  --name "fabric-capacity-f8" \
  --action "suspend"

# Reanudar capacity  
az resource invoke-action \
  --resource-group "rg-fabric-embedded" \
  --resource-type "Microsoft.Fabric/capacities" \
  --name "fabric-capacity-f8" \
  --action "resume"
```

## 🔍 Troubleshooting

### Error: Service Principal sin permisos
```bash
# Verificar permisos del SP
az ad app permission list --id $SERVICE_PRINCIPAL_ID

# Otorgar admin consent
az ad app permission admin-consent --id $SERVICE_PRINCIPAL_ID
```

### Error: RLS no funciona
1. Verificar roles están publicados en el dataset
2. Confirmar mapeo de usuarios es correcto
3. Probar RLS en PowerBI Desktop primero
4. Verificar Service Principal tiene permisos de Dataset.ReadWrite.All

### Error: Capacity saturada
```bash
# Verificar métricas de capacity
az monitor metrics list \
  --resource "/subscriptions/.../Microsoft.Fabric/capacities/fabric-capacity-f8" \
  --metric "CpuPercentage"
```

## 📋 Checklist de Configuración

- [ ] Microsoft Fabric Capacity F8 creada
- [ ] Workspace asignado a la capacity
- [ ] Service Principal registrado
- [ ] Permisos API otorgados y consentidos
- [ ] Service Principal agregado como Admin al workspace
- [ ] RLS configurado en PowerBI Desktop
- [ ] Dataset publicado al workspace
- [ ] Roles de RLS funcionando correctamente
- [ ] Variables de entorno configuradas
- [ ] Mapeo de grupos implementado
- [ ] Monitoreo y alertas configuradas

## 🎯 Próximos Pasos

1. **Testing**: Probar embed con diferentes usuarios/roles
2. **Performance**: Optimizar consultas y dataset
3. **Scaling**: Monitorear uso y planificar escalamiento
4. **Security**: Revisar periódicamente permisos y accesos
5. **Backup**: Configurar respaldo de reportes y datasets

---

**🚀 Tu configuración de Microsoft Fabric está lista para embedar PowerBI de manera segura y escalable.**