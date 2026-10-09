// JobTrackerAI - Configuration & Storage Management
const STORAGE_KEYS = {
  SUPABASE_URL: 'jobtracker_supabase_url',
  SUPABASE_KEY: 'jobtracker_supabase_key',
  SUPABASE_TABLE: 'jobtracker_supabase_table',
  AI_PROVIDER: 'jobtracker_ai_provider', // 'heuristic', 'gemini', 'openai'
  GEMINI_KEY: 'jobtracker_gemini_key',
  GEMINI_MODEL: 'jobtracker_gemini_model',
  OPENAI_KEY: 'jobtracker_openai_key',
  APPLICATIONS: 'jobtracker_local_applications',
  ACTIVE_SESSION_ID: 'jobtracker_active_session_id',
  THEME: 'jobtracker_theme'
};

export const Config = {
  getSettings() {
    return {
      supabaseUrl: localStorage.getItem(STORAGE_KEYS.SUPABASE_URL) || 'https://bcblfftacinxymmgfjsz.supabase.co',
      supabaseKey: localStorage.getItem(STORAGE_KEYS.SUPABASE_KEY) || 'sb_publishable_e-5eedNJWiqBm7UQxWv7kw__7wT2OX9',
      supabaseTable: localStorage.getItem(STORAGE_KEYS.SUPABASE_TABLE) || 'job_applications',
      aiProvider: localStorage.getItem(STORAGE_KEYS.AI_PROVIDER) || 'gemini',
      geminiKey: localStorage.getItem(STORAGE_KEYS.GEMINI_KEY) || '',
      geminiModel: localStorage.getItem(STORAGE_KEYS.GEMINI_MODEL) || 'gemini-1.5-flash',
      openaiKey: localStorage.getItem(STORAGE_KEYS.OPENAI_KEY) || '',
      theme: localStorage.getItem(STORAGE_KEYS.THEME) || 'dark'
    };
  },

  saveSettings(settings) {
    if (settings.supabaseUrl !== undefined) localStorage.setItem(STORAGE_KEYS.SUPABASE_URL, settings.supabaseUrl.trim());
    if (settings.supabaseKey !== undefined) localStorage.setItem(STORAGE_KEYS.SUPABASE_KEY, settings.supabaseKey.trim());
    if (settings.supabaseTable !== undefined) localStorage.setItem(STORAGE_KEYS.SUPABASE_TABLE, settings.supabaseTable.trim() || 'job_applications');
    if (settings.aiProvider !== undefined) localStorage.setItem(STORAGE_KEYS.AI_PROVIDER, settings.aiProvider);
    if (settings.geminiKey !== undefined) localStorage.setItem(STORAGE_KEYS.GEMINI_KEY, settings.geminiKey.trim());
    if (settings.geminiModel !== undefined) localStorage.setItem(STORAGE_KEYS.GEMINI_MODEL, settings.geminiModel);
    if (settings.openaiKey !== undefined) localStorage.setItem(STORAGE_KEYS.OPENAI_KEY, settings.openaiKey.trim());
    if (settings.theme !== undefined) localStorage.setItem(STORAGE_KEYS.THEME, settings.theme);
  },

  getLocalApplications() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.APPLICATIONS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Failed to parse local applications:', e);
      return [];
    }
  },

  saveLocalApplications(apps) {
    try {
      localStorage.setItem(STORAGE_KEYS.APPLICATIONS, JSON.stringify(apps));
    } catch (e) {
      console.error('Failed to save local applications:', e);
    }
  },

  getActiveSessionId() {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_SESSION_ID);
  },

  setActiveSessionId(id) {
    if (id) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_SESSION_ID, id);
    } else {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_SESSION_ID);
    }
  },

  getSqlSchemaSnippet() {
    const table = this.getSettings().supabaseTable || 'job_applications';
    return `-- Run this in your Supabase SQL Editor:
CREATE TABLE IF NOT EXISTS public.${table} (
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
ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;

-- Allow public read/write access (for anon API key)
CREATE POLICY "Allow public full access" ON public.${table}
    FOR ALL
    USING (true)
    WITH CHECK (true);
`;
  }
};
