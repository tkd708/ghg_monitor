# Contributing to GHG Monitor

Thank you for your interest in contributing to GHG Monitor! This document provides guidelines for contributing to the project.

## 🤝 Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct:

- Be respectful and inclusive
- Focus on constructive feedback
- Help others learn and grow
- Prioritize the project's scientific accuracy and user needs

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Git
- Basic understanding of TypeScript, React, and Node.js
- Familiarity with greenhouse gas measurement concepts (helpful but not required)

### Development Setup
1. Fork the repository
2. Clone your fork: `git clone https://github.com/yourusername/ghg-monitor.git`
3. Install dependencies:
   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   ```
4. Start development servers:
   ```bash
   # Terminal 1 - Backend
   cd backend && npm run dev
   
   # Terminal 2 - Frontend  
   cd frontend && npm run dev
   ```

## 🔧 Development Guidelines

### Code Style
- **TypeScript**: Use strict mode, provide proper types
- **React**: Use functional components with hooks
- **Naming**: Use descriptive names, follow camelCase for variables, PascalCase for components
- **Comments**: Document complex algorithms, especially scientific calculations
- **Formatting**: Use ESLint and Prettier configurations

### Commit Messages
Follow conventional commits format:
```
type(scope): description

feat(analysis): add cumulative flux calculation
fix(dashboard): resolve chamber count display issue
docs(api): update endpoint documentation
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

### Branch Naming
- Feature branches: `feature/description-of-feature`
- Bug fixes: `fix/description-of-fix`
- Documentation: `docs/description-of-change`

## 🧪 Testing

### Running Tests
```bash
# Backend tests
cd backend && npm test

# Frontend tests
cd frontend && npm test

# E2E tests
npm run test:e2e
```

### Writing Tests
- Write unit tests for utility functions (especially flux calculations)
- Write integration tests for API endpoints
- Write component tests for React components
- Include edge cases and error scenarios

### Test Requirements
- All new features must include tests
- Bug fixes should include regression tests
- Maintain or improve test coverage
- Scientific calculations must have validation tests

## 📊 Scientific Accuracy

### Flux Calculations
- Reference scientific literature for formulas
- Include units in variable names and comments
- Validate against known test cases
- Document assumptions and limitations

### Quality Control
- Maintain configurable thresholds
- Document quality control criteria
- Test with various data quality scenarios
- Consider edge cases in field measurements

## 🎨 UI/UX Guidelines

### Design Principles
- **Clarity**: Scientific data should be easy to read and interpret
- **Accessibility**: Follow WCAG guidelines
- **Responsiveness**: Support desktop, tablet, and mobile
- **Performance**: Optimize for large datasets

### Component Structure
- Use atomic design principles
- Create reusable components
- Implement proper loading states
- Handle error states gracefully

## 📝 Documentation

### Code Documentation
- Document all public APIs
- Include examples for complex functions
- Explain scientific concepts for non-experts
- Update documentation with code changes

### API Documentation
- Document all endpoints in `API.md`
- Include request/response examples
- Specify error codes and messages
- Update OpenAPI specification

## 🐛 Bug Reports

### Before Submitting
1. Check existing issues
2. Try to reproduce the bug
3. Test with minimal example
4. Check if it's a configuration issue

### Bug Report Template
```markdown
**Describe the bug**
Clear description of the issue

**To Reproduce**
Steps to reproduce the behavior

**Expected behavior**
What you expected to happen

**Screenshots/Data**
Screenshots or sample data files

**Environment**
- OS: [e.g., Windows 10]
- Node.js version: [e.g., 18.17.0]
- Browser: [e.g., Chrome 118]

**Additional context**
Any other relevant information
```

## ✨ Feature Requests

### Feature Request Template
```markdown
**Feature Description**
Clear description of the proposed feature

**Scientific Justification**
Why this feature is needed for GHG research

**Proposed Implementation**
Ideas for how to implement the feature

**Alternatives Considered**
Other solutions you've considered

**Additional Context**
Any other relevant information
```

## 🔄 Pull Request Process

### Before Submitting
1. Ensure all tests pass
2. Update documentation
3. Add/update tests for new features
4. Check code style with linter
5. Test on different browsers/devices

### Pull Request Template
```markdown
**Description**
Brief description of changes

**Type of Change**
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

**Scientific Impact**
How this affects flux calculations or data interpretation

**Testing**
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed

**Checklist**
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No breaking changes (or documented)
```

### Review Process
1. Automated checks must pass
2. At least one reviewer approval required
3. Scientific accuracy review for calculation changes
4. Performance review for data processing changes

## 🎯 Areas for Contribution

### High Priority
- Additional quality control metrics
- Performance optimizations for large datasets
- Mobile responsiveness improvements
- Accessibility enhancements

### Scientific Features
- Additional flux calculation methods
- Advanced statistical analysis
- Data export formats
- Calibration and validation tools

### Technical Improvements
- Database integration
- Real-time data streaming
- Advanced caching strategies
- Monitoring and logging

### Documentation
- User tutorials and guides
- Scientific methodology documentation
- Video demonstrations
- Translation to other languages

## 🚀 Release Process

### Version Numbers
Follow semantic versioning (semver):
- Major: Breaking changes
- Minor: New features (backward compatible)
- Patch: Bug fixes

### Release Checklist
- [ ] All tests pass
- [ ] Documentation updated
- [ ] Change log updated
- [ ] Version numbers bumped
- [ ] Security review completed
- [ ] Performance benchmarks run

## 🔒 Security

### Reporting Security Issues
- Email security issues to: security@ghg-monitor.com
- Do not create public issues for security vulnerabilities
- Include detailed description and reproduction steps

### Security Guidelines
- Never commit secrets or API keys
- Validate all user inputs
- Use HTTPS in production
- Follow OWASP guidelines

## 📞 Getting Help

### Communication Channels
- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: Questions and general discussion
- **Email**: contact@ghg-monitor.com

### Response Times
- Bug reports: Within 2 business days
- Feature requests: Within 1 week
- Security issues: Within 24 hours

## 🏆 Recognition

Contributors will be recognized in:
- README.md contributors section
- Release notes
- Project documentation
- Conference presentations (with permission)

Thank you for contributing to sustainable agriculture research! 🌱