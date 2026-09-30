<div align="center">
  <img src="public/logo.png" alt="InstaFlow Logo" width="160" />
  <h1>InstaFlow</h1>
  <p><strong>Instagram Automation &amp; Projects Dashboard</strong></p>

  <!-- Version & meta badges -->
  <p>
    <img src="https://img.shields.io/badge/version-1.0.2-blue?style=flat-square" alt="version" />
    <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="license" />
    <img src="https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square" alt="PRs welcome" />
  </p>

  <!-- Tech stack badges -->
  <p>
    <img src="https://img.shields.io/badge/Astro-2.0.4-FF5D01?style=flat-square&logo=astro&logoColor=white" alt="Astro" />
    <img src="https://img.shields.io/badge/TypeScript-strict-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
    <img src="https://img.shields.io/badge/Tailwind_CSS-3.0.24-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
    <img src="https://img.shields.io/badge/Flowbite-2.1.1-1C64F2?style=flat-square" alt="Flowbite" />
    <img src="https://img.shields.io/badge/Neon_Postgres-serverless-00E5A0?style=flat-square&logo=postgresql&logoColor=white" alt="Neon Postgres" />
    <img src="https://img.shields.io/badge/Drizzle_ORM-0.45.3-C5F74F?style=flat-square" alt="Drizzle ORM" />
    <img src="https://img.shields.io/badge/ApexCharts-3.37.2-00B0FF?style=flat-square" alt="ApexCharts" />
    <img src="https://img.shields.io/badge/Vercel-SSR-000000?style=flat-square&logo=vercel&logoColor=white" alt="Vercel" />
    <img src="https://img.shields.io/badge/pnpm-package_manager-F69220?style=flat-square&logo=pnpm&logoColor=white" alt="pnpm" />
  </p>

  <!-- Tooling badges -->
  <p>
    <img src="https://img.shields.io/badge/ESLint-8.35.0-4B32C3?style=flat-square&logo=eslint&logoColor=white" alt="ESLint" />
    <img src="https://img.shields.io/badge/Prettier-plugin--astro-F7B93E?style=flat-square&logo=prettier&logoColor=black" alt="Prettier" />
    <img src="https://img.shields.io/badge/drizzle--kit-0.31.11-C5F74F?style=flat-square" alt="drizzle-kit" />
    <img src="https://img.shields.io/badge/dotenv-18.0.4-ECD53F?style=flat-square" alt="dotenv" />
    <img src="https://img.shields.io/badge/shiki-0.14.1-7C3AED?style=flat-square" alt="shiki" />
  </p>

  <p><em>A full-stack admin dashboard for managing personal projects, SaaS apps, and Instagram DM/comment automation.</em></p>
</div>

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

## 🛠 Tech Stack & Versions

<div align="center">

| Category | Technology | Package / Specification | Version |
|:---|:---|:---|:---:|
| **Core Framework** | [Astro](https://astro.build/) | `astro` | `^2.0.4` |
| **Framework Integration** | [Astro Tailwind](https://docs.astro.build/en/guides/integrations-guide/tailwind/) | `@astrojs/tailwind` | `^3.0.1` |
| **Deployment Adapter** | [Astro Vercel SSR](https://docs.astro.build/en/guides/integrations-guide/vercel/) | `@astrojs/vercel` | `^3.8.2` |
| **SEO & Sitemap** | [Astro Sitemap](https://docs.astro.build/en/guides/integrations-guide/sitemap/) | `@astrojs/sitemap` | `^1.1.0` |
| **UI Framework** | [Tailwind CSS](https://tailwindcss.com/) | `tailwindcss` | `^3.0.24` |
| **Component Library** | [Flowbite](https://flowbite.com/) | `flowbite` | `^2.1.1` |
| **Typography Plugin** | Flowbite Typography | `flowbite-typography` | `^1.0.3` |
| **Scrollbar Utility** | Tailwind Scrollbar | `tailwind-scrollbar` | `^3.0.0` |
| **Database** | [Neon Serverless Postgres](https://neon.tech/) | `@neondatabase/serverless` | `^1.1.0` |
| **ORM** | [Drizzle ORM](https://orm.drizzle.team/) | `drizzle-orm` | `^0.45.3` |
| **Migration & Schema CLI**| Drizzle Kit | `drizzle-kit` | `^0.31.11` |
| **Charts & Visualization**| [ApexCharts](https://apexcharts.com/) | `apexcharts` | `^3.37.2` |
| **Syntax Highlighting** | [Shiki](https://shiki.style/) | `shiki` | `^0.14.1` |
| **Environment Config** | Dotenv | `dotenv` | `^18.0.4` |
| **Mock & Fixture Data** | Faker JS | `@faker-js/faker` | `^7.6.0` |
| **Language & Types** | TypeScript | `typescript` | `^5.54.1` |
| **Linter** | [ESLint](https://eslint.org/) | `eslint` | `^8.35.0` |
| **Astro ESLint Parser** | Astro Parser | `astro-eslint-parser` | `^0.11.0` |
| **Code Formatter** | Prettier | `eslint-plugin-prettier` | `^4.2.1` |
| **Package Manager** | [pnpm](https://pnpm.io/) | `pnpm` | `≥ 8.x` |
| **Runtime Environment** | Node.js | `node` | `≥ 18.0.0` |

</div>

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
