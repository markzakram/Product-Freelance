# Security

## Secrets

- Runtime credentials must be supplied through deployment environment variables.
- Use `GOOGLE_SERVICE_ACCOUNT_JSON` for the Google service account.
- Never commit service-account JSON, OAuth tokens, `.env` files, browser profiles, runtime databases, logs, or exports.
- `.env.example` may contain variable names and non-secret placeholders only.

## Required credential rotation

A legacy service-account credential was previously committed to this repository.
Treat the associated key as exposed even when the repository is private.

Required containment:

1. Create a replacement key or use a keyless workload identity.
2. Update the deployment environment.
3. Verify read/write access to the required spreadsheets.
4. Revoke the legacy key in Google Cloud.
5. Purge `credentials.json` from Git history and invalidate old clones.

Do not put credential values, private-key IDs, spreadsheet IDs, or customer data
in issues, commits, screenshots, or support messages.
