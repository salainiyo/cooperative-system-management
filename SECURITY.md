# Security Policy

Do not report security issues in public issues. Never include real member
data, credentials, vault passwords or personal identifiers in a PR.

## Reporting a vulnerability

Use GitHub's "Report a vulnerability" feature on the repository's Security tab.
Include the affected component, impact and a minimal reproduction.

## Credential handling

- Secrets stay in local `.env` files and the Ansible vault; only `*.example`
  files are committed.
- SMTP settings are stored encrypted by the application.
- Rotate any credential that may have been exposed, including Terraform Cloud
  tokens and demo-VM SSH keys.
