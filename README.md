# Social DM Copilot

An AI-powered direct message management platform that helps teams draft, review, and send responses to social media DMs while automatically extracting and qualifying leads.

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Testing:** Jest + React Testing Library
- **Deployment:** Vercel

## Features

- **DM Inbox:** Aggregate direct messages from multiple social platforms into a unified inbox
- **AI Draft Generation:** Automatically generate context-aware reply drafts with confidence scoring
- **Lead Extraction:** Identify and qualify leads from incoming messages with priority classification
- **Review Workflow:** Multi-role approval flow for draft responses (admin, agent, reviewer, readonly)
- **Notifications:** Multi-channel alerts (email, SMS, in-app, Slack) for leads, drafts, and escalations
- **Knowledge Base:** Contextual reference library to improve AI-generated responses
- **Audit Logging:** Full traceability of all actions across the platform

## Folder Structure

```
social-dm-copilot/
├── src/
│   ├── app/                    # Next.js App Router pages and layouts
│   │   ├── api/                # API route handlers
│   │   │   ├── dms/            # DM endpoints (CRUD, list)
│   │   │   ├── drafts/         # Draft endpoints (generate, review, approve)
│   │   │   ├── leads/          # Lead endpoints (extract, qualify, sync)
│   │   │   ├── notifications/  # Notification endpoints
│   │   │   ├── knowledge-base/ # Knowledge base endpoints
│   │   │   └── audit-logs/     # Audit log endpoints
│   │   ├── dashboard/          # Dashboard pages
│   │   ├── inbox/              # DM inbox views
│   │   ├── leads/              # Lead management views
│   │   ├── settings/           # Settings and configuration
│   │   ├── layout.tsx          # Root layout
│   │   ├── page.tsx            # Home page
│   │   ├── loading.tsx         # Root loading state
│   │   └── error.tsx           # Root error boundary
│   ├── components/             # Shared React components
│   │   ├── ui/                 # Base UI components
│   │   └── features/           # Feature-specific components
│   ├── lib/                    # Utility libraries and helpers
│   │   ├── api/                # API client utilities
│   │   ├── ai/                 # AI/LLM integration logic
│   │   └── utils/              # General utility functions
│   ├── services/               # Business logic services
│   │   ├── dm-service.ts       # DM processing service
│   │   ├── draft-service.ts    # Draft generation service
│   │   ├── lead-service.ts     # Lead extraction service
│   │   ├── notification-service.ts # Notification dispatch service
│   │   └── audit-service.ts    # Audit logging service
│   ├── hooks/                  # Custom React hooks
│   └── types.ts                # Central type definitions
├── public/                     # Static assets
├── __tests__/                  # Test files
├── tailwind.config.ts          # Tailwind CSS configuration
├── tsconfig.json               # TypeScript configuration
├── next.config.js              # Next.js configuration
├── package.json                # Dependencies and scripts
└── README.md                   # Project documentation
```

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     Next.js Frontend                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐  │
│  │  Inbox   │  │ Dashboard│  │  Leads   │  │Settings│  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └───┬────┘  │
│       └──────────────┴─────────────┴────────────┘       │
│                          │                               │
│                   React Hooks Layer                       │
├──────────────────────────┼───────────────────────────────┤
│                   API Route Handlers                      │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌─────────────────┐   │
│  │  DMs   │ │ Drafts │ │ Leads  │ │  Notifications  │   │
│  └───┬────┘ └───┬────┘ └───┬────┘ └───────┬─────────┘   │
├──────┴──────────┴──────────┴───────────────┴─────────────┤
│                    Service Layer                          │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐   │
│  │  DM Service  │  │Draft Service │  │ Lead Service  │   │
│  └──────┬───────┘  └──────┬───────┘  └──────┬────────┘   │
│         │                 │                  │            │
│  ┌──────┴─────────────────┴──────────────────┴────────┐  │
│  │              AI / LLM Integration Layer             │  │
│  └─────────────────────────┬───────────────────────────┘  │
│                            │                              │
│  ┌─────────────────────────┴───────────────────────────┐  │
│  │           Knowledge Base / Context Store             │  │
│  └─────────────────────────────────────────────────────┘  │
├───────────────────────────────────────────────────────────┤
│                   External Integrations                    │
│  ┌───────────┐  ┌────────────┐  ┌──────────────────────┐ │
│  │ Social    │  │ Salesforce │  │  Notification Svcs   │ │
│  │ Platforms │  │    CRM     │  │ (Email/SMS/Slack)    │ │
│  └───────────┘  └────────────┘  └──────────────────────┘ │
└───────────────────────────────────────────────────────────┘
```

### Key Architectural Decisions

- **Server Components by default:** Client components are only used when hooks, event handlers, or browser APIs are required
- **Role-based access control:** Four roles (admin, agent, reviewer, readonly) govern permissions across all endpoints
- **Confidence scoring:** AI-generated drafts include a confidence score (high/medium/low) to guide the review workflow
- **Audit trail:** Every significant action is logged for compliance and traceability

## Getting Started

### Prerequisites

- Node.js 18.x or later
- npm 9.x or later

### Installation

```bash
git clone <repository-url>
cd social-dm-copilot
npm install
```

### Environment Configuration

Create a `.env.local` file in the project root:

```env
# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000

# AI / LLM Provider
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4

# Database
DATABASE_URL=your_database_connection_string

# Authentication
AUTH_SECRET=your_auth_secret
NEXTAUTH_URL=http://localhost:3000

# Salesforce Integration
SALESFORCE_CLIENT_ID=your_salesforce_client_id
SALESFORCE_CLIENT_SECRET=your_salesforce_client_secret
SALESFORCE_INSTANCE_URL=https://your-instance.salesforce.com

# Notification Services
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your_smtp_user
SMTP_PASSWORD=your_smtp_password

TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_PHONE_NUMBER=+1234567890

SLACK_WEBHOOK_URL=https://hooks.slack.com/services/your/webhook/url
```

> **Note:** Server-only variables (without `NEXT_PUBLIC_` prefix) are never exposed to the client bundle. Only variables prefixed with `NEXT_PUBLIC_` are available in client components.

### Development Server

```bash
npm run dev
```

The application will be available at [http://localhost:3000](http://localhost:3000).

### Build

```bash
npm run build
```

### Production Server

```bash
npm run start
```

### Linting

```bash
npm run lint
```

### Testing

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## API Endpoints

### DMs

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/dms` | List all DMs with pagination and filtering |
| `GET` | `/api/dms/[id]` | Get a single DM by ID |
| `POST` | `/api/dms` | Create a new DM record |
| `PATCH` | `/api/dms/[id]` | Update DM status |

#### Query Parameters (GET /api/dms)

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | `number` | Page number (default: 1) |
| `pageSize` | `number` | Items per page (default: 20) |
| `status` | `DMStatus` | Filter by status: `new`, `drafted`, `sent`, `escalated` |
| `platform` | `string` | Filter by platform |

### Drafts

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/drafts` | List all drafts with pagination |
| `GET` | `/api/drafts/[id]` | Get a single draft by ID |
| `POST` | `/api/drafts` | Generate a new AI draft for a DM |
| `PATCH` | `/api/drafts/[id]` | Update draft text or status |
| `POST` | `/api/drafts/[id]/approve` | Approve a draft for sending |
| `POST` | `/api/drafts/[id]/reject` | Reject a draft |

### Leads

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/leads` | List all leads with pagination and filtering |
| `GET` | `/api/leads/[id]` | Get a single lead by ID |
| `POST` | `/api/leads` | Create a lead from a candidate lead |
| `PATCH` | `/api/leads/[id]` | Update lead details or status |
| `POST` | `/api/leads/[id]/sync` | Sync lead to Salesforce |

#### Query Parameters (GET /api/leads)

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | `number` | Page number (default: 1) |
| `pageSize` | `number` | Items per page (default: 20) |
| `priority` | `LeadPriority` | Filter by priority: `high`, `medium`, `low` |
| `status` | `LeadStatus` | Filter by status: `new`, `contacted`, `qualified`, `converted`, `lost` |

### Notifications

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/notifications` | List notifications for the current user |
| `PATCH` | `/api/notifications/[id]` | Mark notification as read |
| `POST` | `/api/notifications` | Create a notification |

### Knowledge Base

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/knowledge-base` | List all knowledge base entries |
| `GET` | `/api/knowledge-base/[id]` | Get a single entry |
| `POST` | `/api/knowledge-base` | Create a new entry |
| `PUT` | `/api/knowledge-base/[id]` | Update an entry |
| `DELETE` | `/api/knowledge-base/[id]` | Delete an entry |

### Audit Logs

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/audit-logs` | List audit logs with pagination and filtering |
| `GET` | `/api/audit-logs/[id]` | Get a single audit log entry |

### Response Format

All API endpoints return responses in a consistent format:

**Single resource:**
```json
{
  "success": true,
  "data": { ... },
  "error": null,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**Paginated list:**
```json
{
  "success": true,
  "data": [ ... ],
  "error": null,
  "timestamp": "2024-01-01T00:00:00.000Z",
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 100,
    "totalPages": 5
  }
}
```

**Error:**
```json
{
  "success": false,
  "data": null,
  "error": "Description of what went wrong",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Deployment

### Vercel (Recommended)

1. **Connect Repository:**
   - Go to [vercel.com](https://vercel.com) and sign in
   - Click "New Project" and import your Git repository
   - Vercel will auto-detect the Next.js framework

2. **Configure Environment Variables:**
   - In the Vercel project dashboard, go to **Settings → Environment Variables**
   - Add all variables from your `.env.local` file
   - Set appropriate scopes (Production, Preview, Development)

3. **Build Settings:**
   - **Framework Preset:** Next.js (auto-detected)
   - **Build Command:** `npm run build`
   - **Output Directory:** `.next` (default)
   - **Install Command:** `npm install`

4. **Deploy:**
   - Push to your main branch to trigger an automatic deployment
   - Preview deployments are created for every pull request

5. **Custom Domain (Optional):**
   - In the Vercel dashboard, go to **Settings → Domains**
   - Add your custom domain and configure DNS records as instructed

### Environment Variable Checklist for Production

Ensure the following are set in your Vercel project:

- [ ] `NEXT_PUBLIC_APP_URL` — Set to your production URL
- [ ] `OPENAI_API_KEY` — Your OpenAI API key
- [ ] `OPENAI_MODEL` — Model identifier (e.g., `gpt-4`)
- [ ] `DATABASE_URL` — Production database connection string
- [ ] `AUTH_SECRET` — A strong random secret for authentication
- [ ] `NEXTAUTH_URL` — Your production URL
- [ ] `SALESFORCE_CLIENT_ID` — Salesforce OAuth client ID
- [ ] `SALESFORCE_CLIENT_SECRET` — Salesforce OAuth client secret
- [ ] `SALESFORCE_INSTANCE_URL` — Your Salesforce instance URL
- [ ] `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` — Email service credentials
- [ ] `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` — SMS service credentials
- [ ] `SLACK_WEBHOOK_URL` — Slack notification webhook

## License

Private — All rights reserved.