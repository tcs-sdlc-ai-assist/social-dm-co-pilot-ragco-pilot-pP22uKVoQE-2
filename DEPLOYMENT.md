# Deployment Guide — Social DM Copilot

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Variables](#environment-variables)
- [Vercel Deployment](#vercel-deployment)
- [Domain Setup](#domain-setup)
- [CI/CD Pipeline](#cicd-pipeline)
- [Staging vs Production Environments](#staging-vs-production-environments)
- [Monitoring Setup](#monitoring-setup)
- [Troubleshooting Common Issues](#troubleshooting-common-issues)

---

## Prerequisites

Before deploying, ensure you have the following:

- **Node.js** >= 18.x installed locally
- **npm** >= 9.x or **pnpm** >= 8.x
- A **Vercel** account linked to your Git provider (GitHub, GitLab, or Bitbucket)
- Access to all required third-party service credentials (database, AI provider, messaging APIs)
- The Vercel CLI installed globally (optional but recommended):

```bash
npm install -g vercel
```

---

## Environment Variables

### Server-Side Variables

These variables are available only on the server (API routes, Server Components, server actions). They must **not** be prefixed with `NEXT_PUBLIC_`.

| Variable                    | Description                                  | Required | Example                                      |
| --------------------------- | -------------------------------------------- | -------- | -------------------------------------------- |
| `DATABASE_URL`              | Connection string for the primary database   | Yes      | `postgresql://user:pass@host:5432/dbname`    |
| `OPENAI_API_KEY`            | API key for OpenAI (draft generation)        | Yes      | `sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`        |
| `SALESFORCE_CLIENT_ID`      | Salesforce OAuth client ID                   | No       | `3MVG9...`                                   |
| `SALESFORCE_CLIENT_SECRET`  | Salesforce OAuth client secret               | No       | `ABCDEF1234567890`                           |
| `SALESFORCE_REDIRECT_URI`   | Salesforce OAuth redirect URI                | No       | `https://app.example.com/api/auth/salesforce`|
| `SLACK_WEBHOOK_URL`         | Slack incoming webhook for notifications     | No       | `https://hooks.slack.com/services/T.../B.../xxx` |
| `EMAIL_SMTP_HOST`           | SMTP host for email notifications            | No       | `smtp.sendgrid.net`                          |
| `EMAIL_SMTP_PORT`           | SMTP port                                    | No       | `587`                                        |
| `EMAIL_SMTP_USER`           | SMTP username                                | No       | `apikey`                                     |
| `EMAIL_SMTP_PASS`           | SMTP password                                | No       | `SG.xxxxxxxx`                                |
| `NEXTAUTH_SECRET`           | Secret for NextAuth.js session encryption    | Yes      | `a-random-32-char-string`                    |
| `NEXTAUTH_URL`              | Canonical URL of the application             | Yes      | `https://app.example.com`                    |

### Client-Side Variables

These variables are exposed to the browser and **must** be prefixed with `NEXT_PUBLIC_`.

| Variable                          | Description                              | Required | Example                        |
| --------------------------------- | ---------------------------------------- | -------- | ------------------------------ |
| `NEXT_PUBLIC_APP_URL`             | Public-facing application URL            | Yes      | `https://app.example.com`      |
| `NEXT_PUBLIC_WEBSOCKET_URL`       | WebSocket endpoint for real-time updates | No       | `wss://ws.example.com`         |
| `NEXT_PUBLIC_ANALYTICS_ID`        | Analytics tracking ID                    | No       | `G-XXXXXXXXXX`                 |

### Setting Environment Variables Locally

Create a `.env.local` file in the project root (this file is gitignored):

```bash
cp .env.example .env.local
```

Edit `.env.local` and fill in all required values. Never commit `.env.local` or any file containing secrets to version control.

### Setting Environment Variables on Vercel

1. Navigate to your project in the [Vercel Dashboard](https://vercel.com/dashboard).
2. Go to **Settings** → **Environment Variables**.
3. Add each variable, selecting the appropriate environment scope:
   - **Production** — only available in production deployments
   - **Preview** — available in preview/staging deployments
   - **Development** — available when running `vercel dev` locally
4. For sensitive values, Vercel encrypts them at rest automatically.

---

## Vercel Deployment

### Initial Setup

1. **Import the repository:**

   - Go to [vercel.com/new](https://vercel.com/new).
   - Select your Git provider and authorize access.
   - Choose the `social-dm-copilot` repository.

2. **Configure the project:**

   - **Framework Preset:** Next.js (auto-detected)
   - **Root Directory:** `.` (default)
   - **Build Command:** `npm run build` (or `next build`)
   - **Output Directory:** `.next` (default, managed by Vercel)
   - **Install Command:** `npm install`

3. **Add environment variables** as described in the [Environment Variables](#environment-variables) section.

4. **Click Deploy.** Vercel will build and deploy the application.

### Deploying via CLI

```bash
# Login to Vercel
vercel login

# Link the project (first time only)
vercel link

# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

### Deploying via Git Push

Once the repository is connected to Vercel:

- **Push to `main`** → triggers a **production** deployment
- **Push to any other branch** → triggers a **preview** deployment
- **Open a pull request** → generates a unique preview URL with a comment on the PR

### Build Configuration

The project uses the following scripts defined in `package.json`:

```bash
# Development server
npm run dev

# Production build
npm run build

# Start production server (local testing)
npm start

# Lint
npm run lint

# Type check
npx tsc --noEmit
```

---

## Domain Setup

### Adding a Custom Domain

1. Go to your Vercel project → **Settings** → **Domains**.
2. Enter your custom domain (e.g., `app.example.com`) and click **Add**.
3. Vercel will provide DNS records to configure.

### DNS Configuration

**Option A — Using Vercel DNS (recommended):**

Update your domain's nameservers to Vercel's nameservers:

```
ns1.vercel-dns.com
ns2.vercel-dns.com
```

**Option B — External DNS provider:**

Add the following records at your DNS provider:

| Type  | Name              | Value                  | TTL  |
| ----- | ----------------- | ---------------------- | ---- |
| A     | `@`               | `76.76.21.21`          | 3600 |
| CNAME | `www`             | `cname.vercel-dns.com` | 3600 |

For subdomains (e.g., `app.example.com`):

| Type  | Name  | Value                  | TTL  |
| ----- | ----- | ---------------------- | ---- |
| CNAME | `app` | `cname.vercel-dns.com` | 3600 |

### SSL/TLS

Vercel automatically provisions and renews SSL certificates via Let's Encrypt. No manual configuration is required. HTTPS is enforced by default.

### Redirect Configuration

To redirect the root domain to `www` (or vice versa), configure this in **Settings** → **Domains** by selecting the redirect option next to the domain entry.

---

## CI/CD Pipeline

### GitHub Actions Workflow

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  lint-and-typecheck:
    name: Lint & Type Check
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 18
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Type check
        run: npx tsc --noEmit

  test:
    name: Tests
    runs-on: ubuntu-latest
    needs: lint-and-typecheck
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 18
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test
        env:
          DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
          NEXTAUTH_SECRET: test-secret-for-ci
          NEXTAUTH_URL: http://localhost:3000

  build:
    name: Build
    runs-on: ubuntu-latest
    needs: [lint-and-typecheck, test]
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 18
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build
        env:
          DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
          NEXTAUTH_SECRET: test-secret-for-ci
          NEXTAUTH_URL: http://localhost:3000
```

### Pipeline Flow

```
Push / PR
  │
  ├─► Lint & Type Check
  │     └─► Pass / Fail
  │
  ├─► Tests (after lint passes)
  │     └─► Pass / Fail
  │
  └─► Build (after lint + tests pass)
        └─► Pass / Fail
              │
              └─► Vercel auto-deploys on success (via Git integration)
```

### Branch Protection Rules

Configure the following on your `main` branch in GitHub:

1. **Require status checks to pass before merging:**
   - `lint-and-typecheck`
   - `test`
   - `build`
2. **Require pull request reviews** (at least 1 approval)
3. **Require branches to be up to date before merging**
4. **Do not allow force pushes**

---

## Staging vs Production Environments

### Environment Strategy

| Aspect              | Staging (`develop` branch)                  | Production (`main` branch)                  |
| ------------------- | ------------------------------------------- | ------------------------------------------- |
| **Branch**          | `develop`                                   | `main`                                      |
| **Vercel Env**      | Preview                                     | Production                                  |
| **URL**             | `staging.example.com` or Vercel preview URL | `app.example.com`                           |
| **Database**        | Staging database instance                   | Production database instance                |
| **AI API Key**      | Separate key with lower rate limits         | Production key with full rate limits        |
| **Salesforce**      | Sandbox org                                 | Production org                              |
| **Notifications**   | Routed to test channels                     | Routed to real recipients                   |
| **Debug Logging**   | Verbose                                     | Errors and warnings only                    |

### Setting Up a Staging Domain on Vercel

1. In Vercel, go to **Settings** → **Domains**.
2. Add `staging.example.com`.
3. Under **Settings** → **Git**, configure the `develop` branch to deploy to the staging domain:
   - Go to **Domains** → click on `staging.example.com` → set **Git Branch** to `develop`.

### Promoting Staging to Production

```bash
# After verifying staging is stable
git checkout main
git merge develop
git push origin main
```

This triggers a production deployment on Vercel automatically.

### Environment Variable Scoping

When adding environment variables on Vercel, use the scope selectors:

- **Production-only variables:** Select only "Production"
- **Staging-only variables:** Select only "Preview" and optionally set a branch filter for `develop`
- **Shared variables:** Select both "Production" and "Preview"

Example scoping:

```
DATABASE_URL (Production)  → postgresql://prod-host:5432/prod_db
DATABASE_URL (Preview)     → postgresql://staging-host:5432/staging_db
```

---

## Monitoring Setup

### Vercel Analytics

1. In the Vercel Dashboard, go to your project → **Analytics**.
2. Enable **Web Vitals** to track Core Web Vitals (LCP, FID, CLS).
3. Enable **Speed Insights** for real-user performance monitoring.

No code changes are required — Vercel injects the analytics script automatically.

### Vercel Logs

- **Runtime Logs:** Available in the Vercel Dashboard under **Logs** → **Runtime**.
- **Build Logs:** Available under each deployment's detail page.
- Use `console.error()` and `console.warn()` in server-side code; these appear in runtime logs.

### Application-Level Logging

For structured logging in API routes and server actions:

```typescript
function log(level: "info" | "warn" | "error", message: string, meta?: Record<string, unknown>) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
  };
  if (level === "error") {
    console.error(JSON.stringify(entry));
  } else if (level === "warn") {
    console.warn(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}
```

### Health Check Endpoint

Create an API route at `src/app/api/health/route.ts`:

```typescript
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: process.env.VERCEL_GIT_COMMIT_SHA ?? "unknown",
  });
}
```

Use this endpoint for uptime monitoring with services like:

- **UptimeRobot** — free tier supports 50 monitors
- **Pingdom** — advanced alerting and SLA tracking
- **Vercel Checks** — built-in deployment checks

### Error Tracking (Optional)

If using an error tracking service (e.g., Sentry), add the integration:

1. Install the Vercel Sentry integration from the Vercel Marketplace.
2. Set the `SENTRY_DSN` environment variable.
3. Configure `next.config.js` with the Sentry webpack plugin if needed.

### Alerting

Configure alerts for:

| Condition                          | Channel       | Threshold                    |
| ---------------------------------- | ------------- | ---------------------------- |
| Health check failure               | Slack / Email | 2 consecutive failures       |
| API response time > 5s             | Slack         | 95th percentile              |
| Error rate > 5%                    | Email         | Over a 5-minute window       |
| Build failure                      | Slack / Email | Any failure on `main`        |
| Draft generation confidence < 0.3  | In-app        | Per occurrence               |

---

## Troubleshooting Common Issues

### Build Failures

**Issue: `Type error: Cannot find module '...'`**

- Verify all imports reference existing files with correct paths.
- Run `npx tsc --noEmit` locally to catch type errors before pushing.
- Ensure `tsconfig.json` path aliases match the project structure.

**Issue: `Module not found: Can't resolve '...'`**

- Run `npm install` to ensure all dependencies are installed.
- Check that the package is listed in `package.json`.
- Clear the Vercel build cache: **Settings** → **General** → **Build Cache** → **Clear**.

**Issue: Build exceeds memory limit**

- Add to Vercel project settings: `NODE_OPTIONS=--max-old-space-size=4096` as an environment variable.
- Review and optimize large imports; use dynamic imports for heavy modules.

### Runtime Errors

**Issue: `500 Internal Server Error` on API routes**

- Check Vercel Runtime Logs for the full error stack trace.
- Verify all required environment variables are set for the correct environment scope.
- Ensure database connection strings are accessible from Vercel's network (check IP allowlists).

**Issue: `NEXTAUTH_URL` mismatch**

- `NEXTAUTH_URL` must exactly match the deployment URL (including protocol).
- For preview deployments, use `VERCEL_URL` as a fallback:

```typescript
// In next.config.js or auth configuration
const baseUrl = process.env.NEXTAUTH_URL ?? `https://${process.env.VERCEL_URL}`;
```

**Issue: Environment variables are `undefined`**

- Server-side variables: Ensure they are set in Vercel and scoped to the correct environment.
- Client-side variables: Ensure they are prefixed with `NEXT_PUBLIC_`.
- After changing environment variables, redeploy — changes are not applied to existing deployments.

### Database Connection Issues

**Issue: `Connection refused` or `timeout`**

- Verify the database host is accessible from Vercel's serverless functions.
- For managed databases (e.g., Supabase, PlanetScale, Neon), ensure the connection string uses the correct pooling endpoint.
- Add the database provider's recommended connection parameters (e.g., `?sslmode=require&connection_limit=1`).

**Issue: `Too many connections`**

- Use connection pooling (e.g., PgBouncer, PlanetScale's built-in pooling).
- Set `connection_limit=1` in the connection string for serverless environments.

### Deployment-Specific Issues

**Issue: Preview deployment shows stale content**

- Vercel caches aggressively. Add cache-control headers to API routes:

```typescript
return NextResponse.json(data, {
  headers: { "Cache-Control": "no-store, max-age=0" },
});
```

**Issue: Domain not resolving**

- DNS propagation can take up to 48 hours. Check propagation status at [dnschecker.org](https://dnschecker.org).
- Verify DNS records match the values provided by Vercel.
- Ensure the domain is added and verified in the Vercel Dashboard.

**Issue: CORS errors in preview deployments**

- Preview deployments have unique URLs. If your API checks allowed origins, add a wildcard for Vercel preview URLs:

```typescript
const allowedOrigins = [
  process.env.NEXT_PUBLIC_APP_URL,
  /\.vercel\.app$/,
];
```

### Performance Issues

**Issue: Slow initial page load**

- Ensure Server Components are used by default (no unnecessary `'use client'` directives).
- Use `next/dynamic` for heavy client-side components with `{ ssr: false }`.
- Check bundle size with `npx next build` and review the output summary.

**Issue: High serverless function duration**

- Review Vercel Function Logs for slow operations.
- Add database query indexes for frequently accessed fields.
- Cache expensive computations using `unstable_cache` or external caching (Redis).

---

## Quick Reference

### Useful Commands

```bash
# Local development
npm run dev

# Production build (local)
npm run build && npm start

# Type check
npx tsc --noEmit

# Lint
npm run lint

# Deploy preview
vercel

# Deploy production
vercel --prod

# View logs
vercel logs <deployment-url>

# List environment variables
vercel env ls

# Pull environment variables locally
vercel env pull .env.local
```

### Key URLs

| Resource              | URL                                              |
| --------------------- | ------------------------------------------------ |
| Vercel Dashboard      | `https://vercel.com/dashboard`                   |
| Production            | `https://app.example.com`                        |
| Staging               | `https://staging.example.com`                    |
| Health Check          | `https://app.example.com/api/health`             |
| Vercel Docs           | `https://vercel.com/docs`                        |
| Next.js Docs          | `https://nextjs.org/docs`                        |