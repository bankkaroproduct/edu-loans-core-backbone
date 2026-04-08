

# Disable Email Confirmation for Testing

## What changes
Use the `cloud--configure_auth` tool to enable auto-confirm for email signups. This lets you sign up with the seeded partner emails (e.g. `priya@edubridge.in`) and log in immediately without email verification.

## Steps
1. Call `configure_auth` to set `autoconfirm: true` for email signups
2. No code changes needed

