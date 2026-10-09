// Supabase Client Wrapper for JobTrackerAI
import { Config } from './config.js';

let supabaseClient = null;

export const SupabaseService = {
  getClient() {
    const { supabaseUrl, supabaseKey } = Config.getSettings();
    if (!supabaseUrl || !supabaseKey) {
      supabaseClient = null;
      return null;
    }

    if (window.supabase) {
      try {
        if (!supabaseClient || supabaseClient._url !== supabaseUrl) {
          supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
          supabaseClient._url = supabaseUrl;
        }
        return supabaseClient;
      } catch (err) {
        console.error('Error initializing Supabase client:', err);
        return null;
      }
    }
    return null;
  },

  async testConnection() {
    const client = this.getClient();
    if (!client) {
      return { success: false, message: 'Supabase credentials missing' };
    }

    const { supabaseTable } = Config.getSettings();
    try {
      const { data, error } = await client
        .from(supabaseTable)
        .select('id')
        .limit(1);

      if (error) {
        return { success: false, message: error.message };
      }
      return { success: true, message: 'Connected to Supabase!' };
    } catch (err) {
      return { success: false, message: err.message || 'Connection failed' };
    }
  },

  async getAllApplications() {
    const client = this.getClient();
    const { supabaseTable } = Config.getSettings();

    if (client) {
      try {
        const { data, error } = await client
          .from(supabaseTable)
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && Array.isArray(data)) {
          // Normalize data
          const normalized = data.map(item => ({
            id: item.id,
            createdAt: item.created_at,
            updatedAt: item.updated_at,
            companyName: item.company_name || 'Unknown Company',
            roleTitle: item.role_title || 'Undisclosed Role',
            jobType: item.job_type || 'Full-time',
            workMode: item.work_mode || 'On-site',
            location: item.location || 'Not specified',
            salary: item.salary || 'Not disclosed',
            source: item.source || 'Portal',
            applicationUrl: item.application_url || '',
            sourceUrl: item.source_url || '',
            status: item.status || 'Applied',
            appliedDate: item.applied_date || new Date().toISOString().split('T')[0],
            skills: item.skills || [],
            notes: item.notes || '',
            chatHistory: item.chat_history || []
          }));

          // Cache in local storage for offline resiliency
          Config.saveLocalApplications(normalized);
          return { data: normalized, isRemote: true };
        } else {
          console.warn('Supabase query error, using local data:', error);
        }
      } catch (err) {
        console.warn('Failed to fetch from Supabase, falling back to local:', err);
      }
    }

    // Fallback to local
    return { data: Config.getLocalApplications(), isRemote: false };
  },

  async saveApplication(appData) {
    const client = this.getClient();
    const { supabaseTable } = Config.getSettings();

    // Prepare payload
    const now = new Date().toISOString();
    const payload = {
      id: appData.id || crypto.randomUUID(),
      created_at: appData.createdAt || now,
      updated_at: now,
      company_name: appData.companyName,
      role_title: appData.roleTitle,
      job_type: appData.jobType || 'Full-time',
      work_mode: appData.workMode || 'On-site',
      location: appData.location || 'Not specified',
      salary: appData.salary || 'Not disclosed',
      source: appData.source || 'Portal',
      application_url: appData.applicationUrl || '',
      source_url: appData.sourceUrl || '',
      status: appData.status || 'Applied',
      applied_date: appData.appliedDate || now.split('T')[0],
      skills: appData.skills || [],
      notes: appData.notes || '',
      chat_history: appData.chatHistory || []
    };

    // Update local storage first
    let localApps = Config.getLocalApplications();
    const existingIndex = localApps.findIndex(a => a.id === payload.id);
    const normalizedApp = {
      id: payload.id,
      createdAt: payload.created_at,
      updatedAt: payload.updated_at,
      companyName: payload.company_name,
      roleTitle: payload.role_title,
      jobType: payload.job_type,
      workMode: payload.work_mode,
      location: payload.location,
      salary: payload.salary,
      source: payload.source,
      applicationUrl: payload.application_url,
      sourceUrl: payload.source_url,
      status: payload.status,
      appliedDate: payload.applied_date,
      skills: payload.skills,
      notes: payload.notes,
      chatHistory: payload.chat_history
    };

    if (existingIndex >= 0) {
      localApps[existingIndex] = normalizedApp;
    } else {
      localApps.unshift(normalizedApp);
    }
    Config.saveLocalApplications(localApps);

    // Save to Supabase if available
    if (client) {
      try {
        const { error } = await client
          .from(supabaseTable)
          .upsert(payload);

        if (error) {
          console.error('Supabase upsert error:', error);
          return { success: false, data: normalizedApp, error: error.message };
        }
        return { success: true, data: normalizedApp, isRemote: true };
      } catch (err) {
        console.error('Supabase write error:', err);
        return { success: false, data: normalizedApp, error: err.message };
      }
    }

    return { success: true, data: normalizedApp, isRemote: false };
  },

  async deleteApplication(id) {
    const client = this.getClient();
    const { supabaseTable } = Config.getSettings();

    // Remove from local storage
    let localApps = Config.getLocalApplications();
    localApps = localApps.filter(a => a.id !== id);
    Config.saveLocalApplications(localApps);

    if (client) {
      try {
        const { error } = await client
          .from(supabaseTable)
          .delete()
          .eq('id', id);

        if (error) {
          console.error('Supabase delete error:', error);
          return { success: false, error: error.message };
        }
      } catch (err) {
        console.error('Supabase delete exception:', err);
      }
    }

    return { success: true };
  }
};
