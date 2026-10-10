# 🚀 JobTrackerAI (Zuno AI)

> An AI-powered Job Application Tracker and Career Copilot that transforms raw Job Descriptions (JDs), email updates, and URLs into organized, actionable application records with real-time **Supabase cloud sync**, rich **interactive analytics**, and an intelligent **ChatGPT/Gemini-style workspace**.

---

## 🌟 Overview

**JobTrackerAI** combines conversational AI with structured application tracking. Instead of manually filling out tedious spreadsheets, simply paste a job description, an email snippet, or a job link into **Zuno AI**. The assistant extracts company details, role seniority, compensation, required skills, and deadline links into your database.

---

## ✨ Core Features

### 1. 🤖 Zuno AI Chat Assistant
- **Conversational Job Extraction**: Paste raw text, JDs, or links from LinkedIn, Indeed, Greenhouse, Lever, Workday, etc.
- **Smart Field Extraction**: Automatically captures:
  - **Company Name** & **Role Title**
  - **Job Type** (Full-time, Internship, Contract, Part-time)
  - **Work Mode** (Remote, Hybrid, On-site) & **Location**
  - **Salary / Compensation Range**
  - **Source Portal & Direct Application URL**
  - **Skills & Tech Stack**
- **Rich Interactive Cards**:
  - Responses for current time, dates, application counts, and analytics render in custom interactive cards.
  - Quick action buttons to preview, edit, or directly open application URLs.
- **Bi-Directional Updates**: Conversational updates like *"I got an interview scheduled for Tuesday"* or *"Change salary to $140k"* instantly update the active record in real time.
- **High-Speed Engine**: Sub-second fast-path for conversational greetings, date inquiries, and metric summaries, backed by Google Gemini Flash / Groq / OpenAI.

### 2. ⚡ Slash Command Palette
Type `/` in the chat input to access quick commands:
- **`/search <query>`**: Instantly search all applications stored in your database by company, role, skill, status, or notes with interactive result cards.
- **`/compare <company1> vs <company2>`**: Generate a side-by-side comparison of roles, compensation, and statuses.
- **`/store`**: Commit the current conversation's extracted job draft to Supabase immediately.
- **`/new`**: Start a fresh, clean chat session without losing saved applications.
- **`/help`**: Display available commands and tips.

### 3. 📊 Dashboard & Velocity Analytics
- **Application Velocity Chart**: Interactive SVG daily velocity bar graph and trend lines.
- **Conversion Metrics**: Real-time KPI cards for:
  - Total Applications
  - Applications Applied Today
  - Active Interviews & Interview Rate (%)
  - Received Offers & Offer Rate (%)
  - Pending Review & Rejections
- **Flexible Date Filtering**: Filter metrics by **Today**, **Yesterday**, **Last 7 Days**, **Last 30 Days**, or a **Custom Date Range**.
- **Application Grid & List Views**:
  - Filter by status (`Applied`, `Interviewing`, `Offer`, `Rejected`, `Bookmarked`), work mode, or keyword.
  - 1-click status dropdown changes that auto-sync to Supabase.
  - Direct clickable buttons for **Apply Portal** and original **Job Listing**.
  - **Export to CSV** with a single click.

### 4. 👤 "About Me" Candidate Profile
- **Candidate Hub**: Dedicated view to record your target roles, years of experience, degrees, university, technical skills, certifications, and portfolio links.
- **Dedicated Social Links**: Fields for GitHub, LinkedIn, and personal portfolio.
- **AI Profile Sync**: Zuno AI automatically references your profile to evaluate JD match scores and can dynamically update your profile during chat.

### 5. 🎨 Modern UI & Responsive Design
- **Animated Day/Night Switch**: Toggle seamlessly between custom **Dull Light** and **Deep Dark** modes.
- **Mobile Optimized**: Responsive topbar view-switcher, full-drawer sidebar with backdrop, and touch-friendly cards.
- **Offline Resilient**: Built-in `localStorage` fallback ensures all features, drafts, and applications work 100% offline even before database keys are entered.

---

## 🛠️ Supabase Database Setup

Run this SQL snippet in your [Supabase SQL Editor](https://app.supabase.com) to create the schema with Row Level Security:

```sql
CREATE TABLE IF NOT EXISTS public.job_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    company_name TEXT NOT NULL,
    role_title TEXT NOT NULL,
    job_type TEXT DEFAULT 'Full-time',
    work_mode TEXT DEFAULT 'On-site',
    location TEXT DEFAULT 'Not specified',
    salary TEXT DEFAULT 'Not disclosed',
    source TEXT DEFAULT 'Manual / Portal',
    application_url TEXT DEFAULT '',
    source_url TEXT DEFAULT '',
    status TEXT DEFAULT 'Applied',
    applied_date DATE DEFAULT CURRENT_DATE,
    skills TEXT[] DEFAULT '{}',
    notes TEXT DEFAULT '',
    chat_history JSONB DEFAULT '[]'::jsonb
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;

-- Allow public read/write access (for anon API key)
CREATE POLICY "Allow public full access" ON public.job_applications
    FOR ALL
    USING (true)
    WITH CHECK (true);
```

### Linking Supabase in the App
1. Open the app and click **Settings / Keys** in the sidebar.
2. Enter your **Supabase Project URL** and **Anon Key** (found in your Supabase project settings under *API*).
3. Click **"Test Connection"** and **"Save Settings"**.

---

## ⚙️ Environment Variables (Optional Serverless Proxy)

For deployment on [Vercel](https://vercel.com), the repository includes a serverless proxy at `/api/chat.js`. You can set the following environment variables in your Vercel Project Settings:

| Variable | Description |
| :--- | :--- |
| `GEMINI_API_KEY` | Google Gemini API key (recommended: `gemini-2.5-flash` or `gemini-1.5-flash`) |
| `OPENAI_API_KEY` | OpenAI API key (optional fallback) |
| `GROQ_API_KEY` | Groq API key for low-latency Llama models (optional fallback) |

> **Note**: You can also enter your API keys directly into the app UI via the Settings modal. If no API keys are provided, the built-in **Smart NLP Heuristics** engine extracts key job fields client-side with zero setup required.

---

## 🚀 Getting Started

### Option 1: Serve Locally
No build step or bundler is required. Simply launch a local static HTTP server:

```bash
# Using Python
python -m http.server 3000

# Using Node / npx
npx serve -l 3000 .
```

Then visit:
```
http://localhost:3000
```

### Option 2: Deploy to Vercel
Deploy with 1 command using the Vercel CLI:

```bash
npx vercel
```

---

## 📁 Project Architecture

```
JobTrackerAI/
├── index.html            # Main single-page application structure & modals
├── style.css             # Comprehensive design system, themes, and responsiveness
├── app.js                # Core UI controller, event bindings & view routing
├── ai-extractor.js       # Zuno AI prompt engine, fast-path & slash commands
├── supabase-client.js    # Supabase PostgreSQL client & offline storage sync
├── api/
│   └── chat.js           # Vercel serverless function proxying LLM providers
├── package.json          # Project metadata and dependencies
└── README.md             # Project documentation
```

---

## 🔒 Privacy & Security

- **Direct Storage**: Application data is stored directly in your private Supabase database or local browser cache.
- **Client-Side Key Storage**: Any API keys entered in the browser settings remain in your browser's `localStorage` and are never shared.
- **Zero Lock-In**: Export your entire application dataset to CSV anytime from the Dashboard.

---

## 📄 License

This project is licensed under the [ISC License](LICENSE).
