# Contributing to Microsoft Fabric Embedded App

Thank you for your interest in contributing to this project! This guide will help you get started with contributing to the Microsoft Fabric Embedded Web Application.

## 🎯 Code of Conduct

By participating in this project, you agree to abide by our code of conduct:
- Be respectful and inclusive
- Focus on constructive feedback
- Help create a welcoming environment for all contributors
- Report any unacceptable behavior to the maintainers

## 🚀 Getting Started

### Prerequisites
- Azure subscription with appropriate permissions
- Node.js 18+ and Python 3.9+
- Git and basic knowledge of React and FastAPI
- Understanding of Microsoft Fabric and PowerBI

### Development Setup
1. Fork the repository
2. Clone your fork locally
3. Follow the [Local Development Guide](docs/deployment/local-development.md)
4. Set up your development environment with `docker-compose up -d`

## 📋 How to Contribute

### 🐛 Reporting Bugs
Before submitting a bug report:
1. Check existing issues to avoid duplicates
2. Use the bug report template
3. Include steps to reproduce
4. Provide environment details (OS, browser, versions)
5. Include relevant logs or error messages

### ✨ Suggesting Features
When suggesting new features:
1. Check if it's already requested
2. Use the feature request template
3. Explain the use case and benefits
4. Consider the impact on existing functionality

### 🛠️ Development Workflow

#### 1. Branch Naming
Use descriptive branch names:
```
feature/add-new-authentication-method
bugfix/fix-powerbi-embed-token-refresh
docs/update-deployment-guide
hotfix/critical-security-patch
```

#### 2. Commit Messages
Follow conventional commit format:
```
feat: add support for Microsoft Fabric F16 capacity
fix: resolve token refresh issue in PowerBI embed
docs: update Azure deployment instructions
style: format code according to style guide
test: add unit tests for authentication service
```

#### 3. Pull Request Process
1. Create a feature branch from `main`
2. Make your changes with appropriate tests
3. Update documentation if needed
4. Ensure all tests pass
5. Submit a pull request with a clear description

### 🧪 Testing Guidelines

#### Frontend Testing
```bash
cd frontend
npm test                    # Run unit tests
npm run test:e2e           # Run end-to-end tests
npm run test:coverage      # Generate coverage report
```

#### Backend Testing
```bash
cd backend
pytest                     # Run all tests
pytest --cov=src          # Run with coverage
pytest -v tests/test_auth.py  # Run specific tests
```

#### Integration Testing
```bash
docker-compose -f docker-compose.test.yml up --abort-on-container-exit
```

### 📝 Documentation Standards

#### Code Documentation
- Use clear, descriptive variable and function names
- Add docstrings for all public functions
- Include type hints in Python code
- Add JSDoc comments for complex JavaScript functions

#### Example Python Docstring:
```python
def generate_embed_token(user_groups: List[str], report_id: str) -> Dict[str, Any]:
    """
    Generate PowerBI embed token with RLS based on user groups.
    
    Args:
        user_groups: List of Entra ID groups the user belongs to
        report_id: PowerBI report identifier
        
    Returns:
        Dictionary containing embed token and configuration
        
    Raises:
        AuthenticationError: If user lacks required permissions
        PowerBIError: If token generation fails
    """
```

#### README Updates
- Keep installation instructions current
- Update version compatibility
- Include new environment variables
- Add troubleshooting sections for new features

### 🎨 Style Guidelines

#### Python Code Style
- Follow PEP 8 standards
- Use Black for code formatting: `black src/`
- Use isort for import sorting: `isort src/`
- Maximum line length: 100 characters
- Use type hints consistently

#### JavaScript/React Style
- Use Prettier for formatting: `npm run format`
- Follow ESLint rules: `npm run lint`
- Use functional components with hooks
- Prefer arrow functions for simple functions
- Use descriptive prop types

#### CSS/Styling
- Use Tailwind CSS utility classes
- Follow mobile-first responsive design
- Maintain consistent spacing and colors
- Use semantic class names when custom CSS is needed

### 🔧 Technical Guidelines

#### Security Best Practices
- Never commit secrets or API keys
- Use environment variables for configuration
- Validate all user inputs
- Follow OWASP security guidelines
- Use parameterized queries for any database operations

#### Performance Considerations
- Optimize API calls and minimize requests
- Use appropriate caching strategies
- Optimize bundle sizes for frontend
- Consider async operations for heavy tasks
- Monitor and profile performance impacts

#### Error Handling
- Use appropriate error types and messages
- Log errors with sufficient context
- Provide user-friendly error messages
- Implement proper retry mechanisms
- Handle edge cases gracefully

### 📦 Release Process

#### Version Numbering
We follow Semantic Versioning (SemVer):
- `MAJOR.MINOR.PATCH`
- MAJOR: Breaking changes
- MINOR: New features (backward compatible)
- PATCH: Bug fixes (backward compatible)

#### Release Checklist
- [ ] All tests pass
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] Version numbers bumped
- [ ] Security scan completed
- [ ] Deployment tested in staging

### 🤝 Review Process

#### Code Review Guidelines
- Review for functionality, security, and performance
- Check test coverage and quality
- Verify documentation updates
- Ensure style guidelines are followed
- Provide constructive feedback

#### Review Timeline
- Small changes: 1-2 business days
- Feature additions: 3-5 business days
- Major changes: 1 week
- Security fixes: Same day (high priority)

### 🏷️ Issue Labels

We use the following labels:
- `bug`: Something isn't working
- `enhancement`: New feature or request
- `documentation`: Improvements to documentation
- `good first issue`: Good for newcomers
- `help wanted`: Extra attention is needed
- `priority/high`: High priority items
- `status/in-progress`: Currently being worked on

### 🌟 Recognition

Contributors will be recognized in:
- README.md contributors section
- Release notes for significant contributions
- Annual contributor appreciation post

## 📞 Getting Help

- 💬 Join our [GitHub Discussions](../../discussions)
- 📧 Email maintainers for security issues
- 📖 Check our [documentation](docs/)
- 🐛 Search existing [issues](../../issues)

## 📋 Contributor Checklist

Before submitting your contribution:
- [ ] Code follows style guidelines
- [ ] Tests pass locally
- [ ] Documentation updated
- [ ] Commit messages are clear
- [ ] PR description explains changes
- [ ] No secrets in code
- [ ] Security implications considered

---

**Thank you for contributing to Microsoft Fabric Embedded App! 🚀**

Your contributions help make this project better for everyone in the community.