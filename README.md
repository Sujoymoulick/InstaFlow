# InstaFlow — Instagram Automation & Projects Dashboard

> A full-stack admin dashboard for managing personal projects, SaaS apps, and Instagram DM/comment automation — built with **Astro**, **Tailwind CSS**, **Flowbite**, and **Neon (Postgres)**.

---

## 🖥 Overview

**InstaFlow** is a self-hosted, real-time operations dashboard that gives you two superpowers in one place:

1. **Personal Project Tracker** — Keep tabs on all your websites, SaaS products, and side-projects across lifecycle stages (Draft → In Development → Published).
2. **Instagram Automation Engine** — Define keyword-based rules that automatically reply to Instagram comments and Direct Messages via the Meta Webhooks API, with built-in rate limiting, delivery tracking, and a live activity feed.

---

## ✨ Key Features

### 📊 Dashboard (Home)
- **4-stat overview cards** — Total Projects, Published, In Development, Draft
- **My Projects panel** — A compact, filterable list of all your apps with status badges and quick links
- **Instagram Automation KPIs** — Active Rules count, total Events received, Successful Replies, Failed Replies, and Delivery Rate %
- **Recent Automation Activity table** — Live feed of the last 10 events showing event type (Comment / DM), Sender ID, Matched Keyword, Rule name, delivery Status (Delivered / Failed / Rate-Limited), and Timestamp
- **Status banners** — Friendly alerts when the Neon database or Instagram webhook isn't configured yet

### 🤖 Automation Rules (`/automations`)
- Create, edit, and delete keyword-triggered reply rules
- Each rule defines: **trigger keywords** (JSON array), **reply template**, **event type** (comment, DM, or both), and an **enabled/disabled** toggle
- Rules are matched in real time when Instagram webhooks fire

### ⚙️ Global Settings (`/settings`)
- **Global kill switch** — Pause all outgoing automated replies without deleting rules (events are still logged)
- **Per-user rate limit** — Minimum cooldown (in minutes) before the same user can receive another automated reply; prevents spam
- **Default fallback message** — Optional catch-all reply sent when no keyword rule matches an incoming DM

### 📈 Analytics (`/analytics`)
- Event volume and delivery success metrics over time

### 📬 Activity Log (`/activity`)
- Full paginated history of all automation events

### 📥 Inbox (`/inbox`)
- Browse incoming messages and manually inspect matched rules

### 🧪 Playground (`/playground`)
- Test automation rules against sample payloads without firing live replies

### 🔒 Authentication
- Sign in, sign up, forgot password, reset password, and profile lock pages

---

## 🗂 Project Structure

```
instaflow/
├── src/
│   ├── app/                    # Layouts, sidebar, navbar, footers
│   ├── assets/                 # SVGs and static images
│   ├── components/             # Atomic UI elements (color-mode switcher, pagination, etc.)
│   ├── db/
│   │   ├── index.ts            # Neon DB connection factory
│   │   └── schema.ts           # Drizzle ORM schema (automationRules, automationEvents, projects, settings)
│   ├── lib/
│   │   └── data.ts             # URL helpers and shared utilities
│   ├── modules/
│   │   ├── InstaFlowDashboard.astro   # Main dashboard view (metrics + activity table)
│   │   ├── InstaFlowSettings.astro    # Global automation settings panel
│   │   └── ...                        # Other page modules
│   ├── pages/
│   │   ├── index.astro              # Home → renders InstaFlowDashboard
│   │   ├── automations/
│   │   │   ├── index.astro          # List all automation rules
│   │   │   ├── new.astro            # Create a new rule
│   │   │   └── [id].astro           # Edit / delete a rule
│   │   ├── activity.astro           # Full activity log
│   │   ├── analytics.astro          # Analytics charts
│   │   ├── inbox.astro              # Inbox view
│   │   ├── settings.astro           # Global settings page
│   │   ├── settings/instagram.astro # Instagram account / webhook config
│   │   ├── dashboard/projects.astro # Project management board
│   │   └── api/                     # Catch-all REST endpoints (CRUD)
│   ├── services/
│   │   ├── analytics.ts        # getDashboardMetrics(), getRecentActivity()
│   │   ├── automation-engine.ts # Core rule-matching and reply dispatch
│   │   ├── instagram.ts        # Meta Graph API / Webhooks integration
│   │   └── projects.ts         # getProjectMetrics()
│   └── types/                  # TypeScript data entity types
└── data/                       # Static JSON data sources (fallback / seeding)
```

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Astro](https://astro.build/) v2 (SSR mode) |
| UI Components | [Flowbite](https://flowbite.com/) + [Tailwind CSS](https://tailwindcss.com/) v3 |
| Charts | [ApexCharts](https://apexcharts.com/) |
| Database | [Neon](https://neon.tech/) — serverless Postgres |
| ORM | [Drizzle ORM](https://orm.drizzle.team/) |
| Deployment | [Vercel](https://vercel.com/) (via `@astrojs/vercel` adapter) |
| Language | TypeScript (strict mode) |
| Package Manager | [pnpm](https://pnpm.io/) |

---

## 🚀 Getting Started

### Prerequisites

- Node.js ≥ 18
- pnpm (`npm i -g pnpm`)
- A [Neon](https://neon.tech/) account with a Postgres database
- A Meta Developer App with Instagram Webhooks configured (for automation features)

### 1. Clone & Install

```sh
git clone https://github.com/your-username/instaflow.git
cd instaflow
pnpm install
```

### 2. Configure Environment Variables

Create a `.env` file at the project root:

```env
# Neon Postgres connection string
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require

# Meta / Instagram Webhooks
INSTAGRAM_VERIFY_TOKEN=your_webhook_verify_token
INSTAGRAM_ACCESS_TOKEN=your_page_access_token
INSTAGRAM_PAGE_ID=your_instagram_page_id
```

### 3. Run Database Migrations

```sh
pnpm db:generate   # Generate migration files from schema
pnpm db:migrate    # Apply migrations to the database
```

Or push the schema directly (for development):

```sh
pnpm db:push
```

### 4. Start the Dev Server

```sh
pnpm dev
```

The dashboard will be available at `http://localhost:4321`.

### 5. Build for Production

```sh
pnpm build
pnpm preview   # Preview the built output locally
```

---

## 🔁 How Automation Works

```
Instagram Comment / DM
        │
        ▼
  Meta Webhook POST ──▶ /api/webhook
        │
        ▼
  automation-engine.ts
    ├── Is global automation enabled?  (globalEnabled setting)
    ├── Is the user within rate limit? (rateLimitPerUserMinutes)
    ├── Does any rule's keyword match the message?
    │       ├── YES → send rule's reply template via Graph API
    │       └── NO  → send defaultFallbackResponse (if set)
        │
        ▼
  Log event to `automationEvents` table
  (eventType, senderId, matchedKeyword, ruleName, status, errorDetails)
```

Every event is logged regardless of outcome, so you always have a full audit trail visible in the **Recent Activity** table and **Activity Log** page.

---

## 📐 Database Schema (Drizzle ORM)

| Table | Description |
|---|---|
| `automationRules` | Keyword rules with reply templates and trigger type |
| `automationEvents` | Log of every incoming event and its dispatch result |
| `automationSettings` | Global kill switch, rate limit, and fallback message |
| `projects` | Personal websites, apps, and SaaS projects with status |

---

## 🛠 Developer Tools

This project ships with a fully configured local development experience:

- **TypeScript**: strictest Astro settings — full-stack type safety
- **ESLint**: `astro-eslint-parser` + `eslint-plugin-astro` + airbnb-typescript ruleset
- **Prettier**: `prettier-plugin-astro` (bundled with Astro)
- **Editorconfig**: aligned with Prettier settings
- **VS Code**: extension recommendations and workspace settings
- **Tailwind**: Astro + Vite + PostCSS integration
- **Flowbite**: core + typography plugins

---

## 🌐 Deployment

The project is pre-configured for **Vercel** deployment via the `@astrojs/vercel` adapter. SSR (Server-Side Rendering) is enabled by default since the dashboard fetches live data from Neon on every request.

For other targets, swap the adapter in `astro.config.mjs`. For static export, uncomment `output: "server"` and switch to a static adapter.

---

## 📄 License

MIT © [Bergside Inc.](https://flowbite.com) — Built on the [Flowbite Astro Admin Dashboard](https://github.com/themesberg/flowbite-astro-admin-dashboard) template.
