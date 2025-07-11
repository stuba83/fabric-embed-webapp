# 📚 Microsoft Fabric Embedded App Documentation

Welcome to the comprehensive documentation for the Microsoft Fabric Embedded Web Application. This documentation will guide you through every aspect of the application, from initial setup to advanced customization.

## 🎯 Quick Navigation

### 🚀 **Getting Started**
- [📖 Main README](../README.md) - Project overview and quick start
- [💻 Local Development Setup](deployment/local-development.md) - Set up your development environment
- [🔧 Environment Configuration](deployment/local-development.md#environment-setup) - Configure environment variables

### 🏗️ **Architecture & Design**
- [🏛️ System Architecture](architecture/system-architecture.md) - High-level system design
- [🔐 Security Model](architecture/security-model.md) - Authentication and authorization
- [📊 Data Flow Diagrams](architecture/system-architecture.md#data-flow) - How data flows through the system

### 🚀 **Deployment Guides**
- [☁️ Azure Setup](deployment/azure-setup.md) - Complete Azure deployment guide
- [🔷 Microsoft Fabric Configuration](deployment/fabric-configuration.md) - Set up Fabric Capacity and workspaces
- [👥 Entra ID Setup](deployment/entra-id-setup.md) - Configure authentication and user groups
- [🐳 Local Development](deployment/local-development.md) - Docker and local development setup

### 🛠️ **Development**
- [⚛️ Frontend Development](../frontend/README.md) - React application development
- [🐍 Backend Development](../backend/README.md) - Python FastAPI development
- [🧪 Testing Guidelines](../CONTRIBUTING.md#testing-guidelines) - How to test your changes
- [🎨 Style Guidelines](../CONTRIBUTING.md#style-guidelines) - Code formatting and standards

### 🔧 **Configuration**
- [⚙️ Environment Variables](deployment/local-development.md#environment-variables) - All configuration options
- [🔑 Secrets Management](deployment/azure-setup.md#key-vault-setup) - Azure Key Vault integration
- [🌐 CORS Configuration](deployment/local-development.md#cors-setup) - Cross-origin configuration

## 📋 Documentation Structure

```
docs/
├── README.md                          # This file - documentation overview
├── architecture/                      # System design and architecture
│   ├── system-architecture.md         # High-level system architecture
│   └── security-model.md             # Security design and implementation
└── deployment/                       # Deployment and configuration guides
    ├── azure-setup.md                # Complete Azure deployment
    ├── fabric-configuration.md       # Microsoft Fabric setup
    ├── entra-id-setup.md            # Entra ID configuration
    └── local-development.md          # Local development environment
```

## 🎯 Common Use Cases

### 🆕 **New to the Project?**
1. Start with the [Main README](../README.md)
2. Follow the [Azure Setup Guide](deployment/azure-setup.md)
3. Configure [Microsoft Fabric](deployment/fabric-configuration.md)
4. Set up [local development](deployment/local-development.md)

### 🏗️ **Setting Up for Development?**
1. Review the [System Architecture](architecture/system-architecture.md)
2. Follow [Local Development Setup](deployment/local-development.md)
3. Read the [Contributing Guidelines](../CONTRIBUTING.md)
4. Check [Frontend](../frontend/README.md) and [Backend](../backend/README.md) specific docs

### ☁️ **Deploying to Production?**
1. Complete [Azure Setup](deployment/azure-setup.md)
2. Configure [Microsoft Fabric](deployment/fabric-configuration.md)
3. Set up [Entra ID](deployment/entra-id-setup.md)
4. Review [Security Model](architecture/security-model.md)

### 🐛 **Troubleshooting Issues?**
1. Check the [Troubleshooting sections](deployment/azure-setup.md#troubleshooting-común) in deployment guides
2. Review [GitHub Issues](../../issues) for known problems
3. Consult the [Security Model](architecture/security-model.md) for auth issues
4. Join our [GitHub Discussions](../../discussions) for community help

## 🔍 Key Concepts

### 🏢 **Microsoft Fabric Integration**
- **Capacity**: F8 SKU providing compute resources for analytics workloads
- **Workspace**: Container for reports, datasets, and other Fabric items
- **Service Principal**: Application identity for programmatic access
- **Row Level Security (RLS)**: Data filtering based on user roles

### 🔐 **Authentication & Authorization**
- **Entra ID**: Microsoft's identity platform (formerly Azure AD)
- **MSAL**: Microsoft Authentication Library for token management
- **Groups**: Entra ID groups mapped to PowerBI roles (Admin, RolA, RolB)
- **Embed Tokens**: Short-lived tokens for PowerBI content access

### 🌐 **Application Architecture**
- **Frontend**: React SPA with MSAL authentication and PowerBI embedding
- **Backend**: Python FastAPI serving embed tokens and user management
- **Infrastructure**: Azure App Services with Key Vault for secrets management

## 📊 Cost Estimation

| Component | Monthly Cost (USD) | Notes |
|-----------|-------------------|--------|
| Microsoft Fabric F8 | ~$320 | Can be paused when not in use |
| App Services (2x B1) | ~$25 | Frontend and backend hosting |
| Key Vault | ~$3 | Secret storage |
| Application Insights | Free tier | Monitoring and logging |
| **Total** | **~$348** | Significant savings vs PowerBI Embedded A1 |

## 🔧 Prerequisites

### 🏢 **Organizational Requirements**
- Azure subscription with Contributor access
- Entra ID tenant with Global Administrator access
- Microsoft Fabric licensing or trial capacity
- PowerBI Pro license (for initial setup)

### 💻 **Development Requirements**
- Node.js 18+ and Python 3.9+
- Docker and Docker Compose
- Azure CLI and Git
- Code editor (VS Code recommended)

## 🚀 Quick Start Checklist

### ☁️ **Azure Setup**
- [ ] Create Azure resource group
- [ ] Set up Entra ID app registrations
- [ ] Deploy infrastructure with Bicep
- [ ] Configure Key Vault secrets

### 🔷 **Microsoft Fabric**
- [ ] Create Fabric Capacity F8
- [ ] Set up Fabric workspace
- [ ] Configure Service Principal permissions
- [ ] Set up Row Level Security (RLS)

### 💻 **Local Development**
- [ ] Clone repository
- [ ] Configure environment variables
- [ ] Start development environment
- [ ] Test authentication and PowerBI embedding

## 📞 Getting Help

### 🎯 **Quick Help**
- 📖 **Documentation**: You're here! Check the specific guides above
- 🐛 **Known Issues**: [GitHub Issues](../../issues)
- 💬 **Community**: [GitHub Discussions](../../discussions)
- 📧 **Security**: Email maintainers for security-related issues

### 🛠️ **Troubleshooting Resources**
- [Azure Setup Troubleshooting](deployment/azure-setup.md#troubleshooting-común)
- [Fabric Configuration Issues](deployment/fabric-configuration.md#troubleshooting)
- [Authentication Problems](architecture/security-model.md#troubleshooting)
- [Local Development Issues](deployment/local-development.md#troubleshooting)

## 🔄 Keeping Documentation Updated

This documentation is a living resource. If you notice:
- ❌ Outdated information
- 📝 Missing procedures
- 🐛 Broken links
- 💡 Improvement opportunities

Please [create an issue](../../issues/new) or submit a pull request following our [Contributing Guidelines](../CONTRIBUTING.md).

## 📈 What's Next?

### 🔮 **Roadmap Items**
- Advanced monitoring and alerting setup
- Multi-tenant support documentation
- Performance optimization guides
- Advanced security configurations

### 🤝 **Community Contributions**
- Example implementations and use cases
- Integration guides with other Microsoft services
- Best practices and lessons learned
- Troubleshooting guides from real deployments

---

**🎉 Ready to get started? Begin with the [Azure Setup Guide](deployment/azure-setup.md) or jump into [Local Development](deployment/local-development.md)!**