# Security Policy

## Supported Versions

We release patches for security vulnerabilities. Currently supported versions:

| Version | Supported          |
| ------- | ------------------ |
| 2.x.x   | :white_check_mark: |
| < 2.0   | :x:                |

## Security Considerations

**Important:** This add-on has minimal security features and should only be deployed on trusted networks.

### Known Limitations

- **No Authentication**: The HTTP server (port 10000) has no authentication mechanism
- **No Rate Limiting**: Unlimited requests can be made
- **Access Token Storage**: Home Assistant access token is stored in plain text in configuration
- **Network Exposure**: If exposed to the internet, anyone can make screenshots of your Home Assistant instance

### Recommended Security Practices

1. **Network Isolation**
   - Only run on trusted networks (home network, VPN)
   - Do NOT expose port 10000 to the internet
   - Use Home Assistant's built-in firewall rules

2. **Access Control**
   - Use a reverse proxy with authentication if external access is needed
   - Consider using Home Assistant's Ingress feature for authenticated access
   - Implement network-level access controls (firewall, VLANs)

3. **Token Management**
   - Use Home Assistant long-lived tokens with minimal permissions
   - Create a dedicated service account for the add-on
   - Rotate tokens periodically

4. **Docker Security**
   - Keep the add-on updated to receive security patches
   - Review add-on permissions in Home Assistant Supervisor
   - Monitor add-on resource usage for anomalies

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability, please follow these steps:

### 1. Do NOT Create a Public Issue

Please do not create a public GitHub issue for security vulnerabilities.

### 2. Report Privately

Report security vulnerabilities by:

- **Preferred**: Using GitHub's private vulnerability reporting feature
  - Go to the repository
  - Click "Security" tab
  - Click "Report a vulnerability"

- **Alternative**: Email the repository maintainers directly
  - Include "[SECURITY]" in the subject line
  - Provide detailed information about the vulnerability

### 3. Include This Information

- **Description**: Clear description of the vulnerability
- **Impact**: What can an attacker do with this vulnerability?
- **Steps to Reproduce**: Detailed steps to reproduce the issue
- **Environment**: Version numbers, configuration details
- **Proof of Concept**: If applicable, include PoC code (do not include actual exploits)
- **Suggested Fix**: If you have ideas for remediation

### 4. What to Expect

- **Acknowledgment**: We will acknowledge receipt within 48 hours
- **Initial Assessment**: We will provide an initial assessment within 7 days
- **Updates**: We will keep you informed of progress
- **Disclosure**: We will coordinate disclosure timing with you
- **Credit**: We will credit you in the security advisory (unless you prefer to remain anonymous)

## Security Update Process

When a security vulnerability is confirmed:

1. **Patch Development**: We develop a fix in a private branch
2. **Testing**: The fix is thoroughly tested
3. **Release**: A new version is released with the security patch
4. **Advisory**: A security advisory is published with details
5. **Notification**: Users are notified through GitHub releases and add-on update notifications

## Security Best Practices for Users

### Before Installing

- Review the add-on's required permissions
- Check the add-on's reputation and community feedback
- Read the documentation thoroughly

### After Installing

- Keep the add-on updated
- Monitor add-on logs for suspicious activity
- Use strong, unique Home Assistant access tokens
- Implement network-level security controls
- Regularly review add-on configuration

### Deployment Scenarios

#### ✅ Safe Deployment

```yaml
# Internal network only
# Behind Home Assistant's authentication
# Using dedicated service account token
# Regular security updates applied
```

#### ⚠️ Risky Deployment

```yaml
# Exposed to internet without authentication
# Using admin access token
# Port 10000 open to public
# Outdated version
```

## Vulnerability Disclosure Policy

- We follow **coordinated disclosure** principles
- Security vulnerabilities will be disclosed after a patch is available
- We aim for a 90-day disclosure timeline
- Critical vulnerabilities may have accelerated timelines
- We will credit researchers unless they prefer anonymity

## Security Checklist for Contributors

If you're contributing code, please consider:

- [ ] Does this change handle user input? (validate and sanitize)
- [ ] Does this change access sensitive data? (minimize exposure)
- [ ] Does this change add new dependencies? (audit them)
- [ ] Does this change modify authentication? (review carefully)
- [ ] Does this change expose new endpoints? (consider access control)
- [ ] Does this change log sensitive data? (redact tokens, passwords)
- [ ] Does this change introduce command execution? (prevent injection)

## Contact

For security-related questions that are not vulnerabilities:

- Open a GitHub Discussion in the "Security" category
- Review existing security documentation

For actual vulnerabilities, follow the reporting process above.

---

**Remember**: When in doubt, report it privately. We'd rather investigate a false positive than miss a real vulnerability.

Thank you for helping keep this project and its users secure!
