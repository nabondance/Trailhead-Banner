# Security Policy

## Supported Versions

Trailhead Banner is a hosted web app. Only the version running at [thb.nabondance.me](https://thb.nabondance.me) (the latest release on `main`) gets security fixes.

## Reporting a Vulnerability

**Please do not open a public issue for security problems.**

Report it privately through GitHub instead:

1. Go to the [Security tab](https://github.com/nabondance/Trailhead-Banner/security) of this repository.
2. Click **Report a vulnerability**.
3. Describe the issue, how to reproduce it, and its possible impact.

You can expect a first reply within a few days. Once the issue is confirmed, a fix is released as soon as possible and you are credited in the advisory, unless you prefer to stay anonymous.

## Scope

In scope:

- The API routes under `/api/` (for example SSRF through image URLs, rate-limit bypass, input validation)
- Leaks of secrets or private data
- Anything in this repository's code

Out of scope:

- The Trailhead API and other third-party services (report those to their owners)
- Denial-of-service or load testing against the live site
- Reports from automated scanners without a working proof of concept
