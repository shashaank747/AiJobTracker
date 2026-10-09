# 🚀 JobTrackerAI

An AI-powered Job Application Tracker that converts unstructured Job Descriptions (JDs), URLs, or follow-up notes into organized applications with automated **Supabase cloud sync** and an interactive **ChatGPT/Gemini-style workspace**.

---

## ✨ Features

1. **AI Chat Assistant (Primary View)**:
   - ChatGPT / Gemini conversational style.
   - Simply paste raw text, email snippets, or job links.
   - Instant extraction of:
     - **Company Name** & **Role / Title**
     - **Job Type** (Full-time, Internship, Contract, Part-time)
     - **Work Mode** (Remote, Hybrid, On-site) & **Location**
     - **Salary / Compensation Range**
     - **Source Portal** (LinkedIn, Indeed, Glassdoor, etc.)
     - **Application Link** & **Listing URL**
     - **Skills & Tech Stack**
   - Conversational updates: type *"Here is the application link: https://..."* or *"Updated status to Interviewing"* and the AI automatically updates the active application record.

2. **Applications Tracker (Dashboard View)**:
   - Rectangular card grid view designed for quick scannability.
   - Shows **Company Name**, **Role Title**, **"Applied X days ago"**, **Work Mode**, and **Salary**.
   - 1-click status dropdown (`Applied` → `Interviewing` → `Offer` → `Rejected` → `Bookmarked`).
   - Direct clickable buttons for **Apply Portal** and **Job Listing**.
   - Instant search & filtering by status, work mode, or keyword.
   - **Export to CSV** with 1 click.

3. **Supabase Cloud Sync & Offline Resiliency**:
   - Real-time persistence to your Supabase PostgreSQL database.
   - Automatic local storage fallback (so the app works 100% offline or before keys are entered).

4. **Multi-Model AI Engine**:
   - **Google Gemini API** (`gemini-1.5-flash` or custom models).
   - **OpenAI API** (`gpt-4o-mini`).
   - **Smart NLP Heuristics**: Built-in regex and heuristic parsing that works out of the box with **zero API keys** required!

---

## 🛠️ Supabase Setup (1 Minute)

Run this SQL snippet in your [Supabase SQL Editor](https://app.supabase.com):

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

Then in the app:
1. Click **"Supabase & AI Keys"** (top right) or the gear icon in the sidebar.
2. Enter your **Supabase Project URL** and **Anon Key**.
3. Click **"Test Connection"** and **"Save Settings"**.

---

## 🖥️ Running Locally

The app is running on:
```
http://localhost:3000
```

Or open `index.html` in any browser or launch:
```bash
python -m http.server 3000
```
