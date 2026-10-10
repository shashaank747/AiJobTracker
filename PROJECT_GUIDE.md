# 📘 JobTrackerAI — Comprehensive Project Guide & Architecture Overview

> **A human-readable breakdown of what JobTrackerAI does, how it is built, its complete tech stack, database architecture, AI integration, and deployment workflow.**

---

## 📌 1. Project Overview & What Was Built

**JobTrackerAI** is a smart, full-featured web and mobile application designed to eliminate the manual friction of job hunting. It combines an **AI career copilot (named "Zuno")** with an interactive dashboard, pipeline tracker, and deep analytics suite.

### 🌟 Key Problems Solved:
1. **Job descriptions are long and messy:** Pasting an entire LinkedIn/Indeed/Naukri post into the app automatically parses job title, company, salary, tech stack, requirements, and deadline using AI.
2. **Scattered job hunting journey:** Tracks where you found the job (e.g., LinkedIn) vs. where you actually submitted the application (e.g., Workday portal).
3. **Recruiter call & interview tracking:** Captures recruiter names, call dates, interview questions asked, and prep notes directly inside the application card.
4. **Insight into job hunt health:** Automatic calculations for submission rates, interview conversion percentages, salary insights, and top technologies applied to.
5. **Mobile-first accessibility:** Installs on mobile phones directly as a native-feeling app (PWA) without needing Google Play Store or App Store downloads.

---

## 💻 2. Complete Technology Stack

| Layer | Technology | Purpose & Why It Was Chosen |
|---|---|---|
| **Frontend UI** | **Vanilla HTML5 & CSS3** | Zero build step overhead, hyper-fast page loads, custom modern glassmorphic theme with CSS variables. |
| **Frontend Logic** | **Vanilla JavaScript (ES6 Modules)** | Lightweight, reactive state management without the weight of heavy UI frameworks. |
| **AI Backend** | **Google Gemini 2.5 Flash / 1.5 Flash** | High accuracy, fast JSON structured responses, and conversational memory for assistant "Zuno". |
| **Serverless API** | **Vercel Serverless Functions (`/api/chat.js`)** | Node.js endpoint that securely hides the Gemini API keys from browser clients. |
| **Cloud Database** | **Supabase (PostgreSQL)** | Enterprise-grade relational database with real-time syncing and Row Level Security (RLS). |
| **Local Cache** | **Browser `localStorage`** | Offline persistence and zero-latency instant loading on mobile and desktop. |
| **Hosting & CI/CD** | **Vercel + GitHub** | Automatic zero-downtime deployment on every `git push`. |

---

## 🛠️ 3. Core Features & What Was Implemented

### 🤖 1. Zuno — AI Copilot & Natural Language Extractor
* **Paste & Parse:** Users can paste messy raw job postings or share links. Gemini AI parses and extracts structured fields:
  * Company Name, Job Title, Location, Workplace Type (Remote / Hybrid / Onsite).
  * Salary Range (min, max, currency, period).
  * Tech Stack Tags (e.g., Python, React, PostgreSQL).
  * Application Deadlines & Experience Levels.
* **Conversational Updates:** Users can type natural prompts like *"I got a call from Google recruiter Sarah today, they asked about system design and SQL"* and Zuno logs the recruiter name, notes, and interview questions automatically into the database.
* **Dual Link Tracking:**
  * **Discovered Source:** Where the job was found (e.g., LinkedIn, Indeed) + URL.
  * **Application Portal:** Where the resume was actually submitted (e.g., Greenhouse, Workday) + URL.

### 📊 2. Dashboard & Pipeline Management
* **Status Badges & Filtering:** Applications are organized across standard pipeline stages:
  * `Saved` ➔ `Applied` ➔ `Screening` ➔ `Interviewing` ➔ `Offer` ➔ `Rejected` / `Withdrawn`.
* **Quick Stats:** Instant metric cards showing Total Applications, Active Interviews, Offers, and Rejection rates.
* **Detailed Job Cards:** Expandable cards displaying interview questions, call notes, salary badges, and direct links.

### 📈 3. Deep Analytics & Insights
* **Funnel Conversion:** Tracks stage progression (e.g., Applied ➔ Interview rate).
* **Skills Cloud / Tech Frequency:** Highlights which tech stacks appear most in target roles.
* **Salary Tracking:** Computes averages across applied positions.

### 📱 4. Mobile PWA (Progressive Web App)
* Supports **"Install to Home Screen"** on Chrome / Android and Safari / iOS.
* Spawns into a **standalone full-screen app** without browser address bars.
* Responsive sliding drawers and mobile navigation pills.

---

## 🗄️ 4. Database Architecture (Supabase / PostgreSQL)

JobTrackerAI uses a cloud Postgres database hosted on Supabase, backed by browser `localStorage` as a fail-safe cache.

### Schema: `applications` Table

```sql
CREATE TABLE applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Basic Job Details
    company TEXT NOT NULL,
    role TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Applied', -- 'Saved', 'Applied', 'Screening', 'Interviewing', 'Offer', 'Rejected'
    location TEXT,
    workplace_type TEXT,                   -- 'Remote', 'Hybrid', 'Onsite'
    applied_date DATE DEFAULT CURRENT_DATE,
    deadline DATE,

    -- Dual Link & Source Tracking
    source TEXT,                           -- e.g., 'LinkedIn', 'Indeed'
    source_url TEXT,                       -- Link to initial job posting
    portal_name TEXT,                      -- e.g., 'Greenhouse', 'Company Portal'
    application_url TEXT,                  -- Link to actual submitted portal

    -- Recruiter & Interview Data
    recruiter_name TEXT,                   -- Name of recruiter or contact
    call_notes TEXT,                       -- Summary of recruiter phone screen
    interview_questions JSONB DEFAULT '[]'::jsonb, -- Array of questions asked
    
    -- Technical & Compensation
    tags JSONB DEFAULT '[]'::jsonb,        -- Skills e.g. ["React", "Node.js"]
    salary JSONB DEFAULT '{}'::jsonb,      -- { "min": 80000, "max": 120000, "currency": "USD" }
    notes TEXT                             -- General candidate notes
);
```

### Fallback Sync Pattern
1. App reads from Supabase when connected with valid credentials.
2. App mirrors all records in `localStorage`.
3. If offline or if Supabase keys aren't configured yet, the app runs 100% offline seamlessly.

---

## 🌐 5. Deployment & Infrastructure Workflow

### How it is Deployed:
1. **Code Repository:** Hosted privately/publicly on GitHub (`shashaank747/AiJobTracker`).
2. **Hosting Provider:** Connected to **Vercel**.
3. **Automated CI/CD Pipeline:**
   * Every time you push code (`git push origin main`), Vercel detects changes.
   * Static assets (`index.html`, `style.css`, `app.js`) are served via global CDN edges.
   * The serverless backend (`api/chat.js`) is automatically bundled and deployed.
4. **Environment Variables Configured on Vercel:**
   * `GEMINI_API_KEY`: Kept secret on Vercel servers so nobody can steal your AI quota.
   * `SUPABASE_URL` & `SUPABASE_ANON_KEY`: Injected safely for database interactions.

---

## 📁 6. Project File Structure

```text
JobTrackerAI/
├── 📄 index.html              # Main HTML markup (Dashboard, Drawer, Analytics, Modals)
├── 🎨 style.css               # Design system, glassmorphism UI, themes, responsive CSS
├── ⚡ app.js                  # Frontend app controller, state management, UI rendering
├── 🤖 ai-extractor.js         # Client-side AI prompt handling & data normalization
├── 🔌 supabase-client.js      # Supabase cloud database CRUD functions & sync manager
├── ⚙️ config.js               # Application configuration & default fallbacks
├── 📁 api/
│   └── 💬 chat.js             # Vercel serverless function communicating with Gemini API
├── 🖼️ Glossy JobTrackerAI...  # App logo and mobile PWA launcher icon
├── 📄 vercel.json             # Vercel deployment configuration
├── 📄 package.json            # Node.js dependencies & scripts
└── 📘 README.md               # User & contributor documentation
```

---

## 🚀 7. Key Lessons & Reusable Patterns for Future Projects

When starting your next project next week, you can reuse these battle-tested patterns:
1. **Lightweight Frontend Stack:** Starting with Vanilla JS/CSS keeps you fast, with zero compile/build steps or toolchain debugging.
2. **Serverless Proxy Pattern:** Keeping API keys in `/api/*.js` prevents API key leakage while maintaining cheap, serverless scalability.
3. **Offline-First Hybrid Persistence:** Coupling `localStorage` with a cloud database ensures the app never shows a blank loading spinner and works on spotty mobile internet.
4. **Instant PWA Setup:** Adding responsive meta tags and proper touch icons instantly turns any web project into an installable mobile app.
