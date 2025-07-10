# Microsoft Fabric Embedded Web Application

Una aplicación web moderna para embedar contenido de PowerBI usando Microsoft Fabric Capacity con autenticación de Entra ID y control de acceso basado en roles.

## 🎯 Descripción

Esta solución implementa el patrón **"Embed for your customers"** de PowerBI utilizando **Microsoft Fabric Capacity**, permitiendo que los usuarios accedan a reportes y dashboards sin necesidad de licencias individuales de PowerBI Pro. La aplicación utiliza autenticación de Entra ID con tres roles predefinidos y Row Level Security (RLS) para controlar el acceso a los datos.

## 🏗️ Arquitectura

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │     Backend      │    │   PowerBI       │
│   (React)       │◄──►│   (Python)       │◄──►│   + Fabric      │
│                 │    │                  │    │                 │
│ • MSAL Auth     │    │ • FastAPI        │    │ • Service       │
│ • Role-based UI │    │ • Entra ID       │    │   Principal     │
│ • PowerBI SDK   │    │ • Token Service  │    │ • RLS           │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │
         └────────────────────────┼─────────────────────────────────┐
                                  │                                 │
                 ┌─────────────────▼──────────────┐    ┌──────────▼──────────┐
                 │         Entra ID               │    │      Azure          │
                 │                                │    │                     │
                 │ • User Authentication          │    │ • App Services      │
                 │ • Groups (Admin, RolA, RolB)   │    │ • Fabric Capacity   │
                 │ • Role Assignment              │    │ • Key Vault         │
                 └────────────────────────────────┘    └─────────────────────┘
```

## 🔐 Modelo de Seguridad

### Roles de Usuario
- **Admin**: Acceso completo a todos los reportes y funciones administrativas
- **Rol A**: Acceso a reportes filtrados específicos para el grupo A
- **Rol B**: Acceso a reportes filtrados específicos para el grupo B

### Row Level Security (RLS)
Los filtros se aplican automáticamente en PowerBI basándose en los roles de Entra ID, garantizando que cada usuario solo vea los datos autorizados.

## 🚀 Características

- ✅ Autenticación con Entra ID (Azure AD)
- ✅ Embed de PowerBI con Microsoft Fabric Capacity
- ✅ Control de acceso basado en roles
- ✅ Row Level Security (RLS)
- ✅ Interfaz responsive con React
- ✅ API REST con Python/FastAPI
- ✅ Deployment automatizado en Azure
- ✅ Refresh automático de tokens
- ✅ Ambiente de desarrollo con Docker

## 💰 Estimación de Costos (Mensual)

| Recurso | Tipo | Costo Estimado (USD) |
|---------|------|---------------------|
| App Service (Frontend) | B1 Linux | ~$12.50 |
| App Service (Backend) | B1 Linux | ~$12.50 |
| Microsoft Fabric Capacity | F8 SKU | ~$320.00 |
| Entra ID | Básico | Gratis |
| **Total** | | **~$345/mes** |

> 💡 Los costos pueden variar según el uso real. Microsoft Fabric F8 puede pausarse cuando no se use.

## ⏱️ Estimación de Desarrollo

| Componente | Horas Estimadas |
|------------|----------------|
| Setup Azure + Entra ID | 4-6h |
| Backend (Python/FastAPI) | 12-16h |
| Frontend (React) | 16-20h |
| Microsoft Fabric + Service Principal | 6-8h |
| Deployment + Testing | 8-10h |
| **Total** | **46-60h** |

## 📋 Prerequisitos

- Cuenta de Azure con permisos para crear recursos
- Tenant de Entra ID configurado
- Workspace de PowerBI con reportes/dashboards
- Microsoft Fabric workspace configurado
- Node.js 18+ y Python 3.9+
- Docker (para desarrollo local)

## 🚀 Quick Start

### 1. Clonar el repositorio
```bash
git clone <repository-url>
cd powerbi-embedded-app
```

### 2. Configurar Azure y PowerBI
```bash
# Ejecutar scripts de configuración
./infrastructure/scripts/setup-service-principal.sh
./infrastructure/scripts/create-entra-groups.sh
./infrastructure/scripts/configure-powerbi.sh
```

### 3. Deploy en Azure
```bash
# Deploy de infraestructura
cd infrastructure
az deployment group create --resource-group <rg-name> --template-file bicep/main.bicep

# Deploy de aplicaciones
./scripts/deploy.sh
```

### 4. Desarrollo Local
```bash
# Usar Docker Compose
docker-compose up -d

# O manualmente
cd backend && python -m uvicorn main:app --reload
cd frontend && npm run dev
```

## 📚 Documentación

- [📖 Guía de Deployment](docs/deployment/azure-setup.md)
- [🏗️ Arquitectura del Sistema](docs/architecture/system-architecture.md)
- [🔐 Modelo de Seguridad](docs/architecture/security-model.md)
- [⚙️ Configuración de Microsoft Fabric](docs/deployment/fabric-configuration.md)
- [👥 Setup de Entra ID](docs/deployment/entra-id-setup.md)
- [💻 Desarrollo Local](docs/deployment/local-development.md)

## 🛠️ Stack Tecnológico

### Frontend
- **React 18** con Vite
- **MSAL React** para autenticación
- **PowerBI JavaScript SDK** para embed
- **Tailwind CSS** para estilos

### Backend  
- **Python 3.9+** con FastAPI
- **MSAL Python** para validación de tokens
- **PowerBI REST API** para embed tokens
- **Uvicorn** como servidor ASGI

### Infraestructura
- **Azure App Service** (Linux)
- **Entra ID** para autenticación
- **Microsoft Fabric Capacity** (F8 SKU)
- **Azure Key Vault** para secrets
- **GitHub Actions** para CI/CD

## 🤝 Contribución

1. Fork el proyecto
2. Crea una feature branch (`git checkout -b feature/nueva-funcionalidad`)
3. Commit tus cambios (`git commit -m 'Agregar nueva funcionalidad'`)
4. Push a la branch (`git push origin feature/nueva-funcionalidad`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la licencia MIT. Ver [LICENSE](LICENSE) para más detalles.

## 🆘 Soporte

Para preguntas y soporte:
- 📧 Crear un [Issue](../../issues)
- 📖 Revisar la [documentación](docs/)
- 💬 Discusiones en [GitHub Discussions](../../discussions)

---

**⚡ Developed with ❤️ for Microsoft Fabric Embedded**