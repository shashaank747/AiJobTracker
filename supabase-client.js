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
          // Normalize data supporting both schema column variants
          const normalized = data.map(item => {
            // Extract skills from item.skills or item.notes
            let parsedSkills = Array.isArray(item.skills) ? item.skills : [];
            if ((!parsedSkills || parsedSkills.length === 0) && item.notes && item.notes.startsWith('Skills: ')) {
              parsedSkills = item.notes.replace(/^Skills:\s*/, '').split(',').map(s => s.trim()).filter(Boolean);
            }

            // Extract chatHistory from item.chat_history or item.job_description
            let parsedChatHistory = Array.isArray(item.chat_history) ? item.chat_history : [];
            if ((!parsedChatHistory || parsedChatHistory.length === 0) && item.job_description) {
              try {
                const parsed = JSON.parse(item.job_description);
                if (Array.isArray(parsed)) parsedChatHistory = parsed;
              } catch (e) {}
            }

            return {
              id: item.id,
              createdAt: item.created_at,
              updatedAt: item.updated_at || item.created_at,
              companyName: item.company_name || 'Unknown Company',
              roleTitle: item.job_title || item.role_title || 'Undisclosed Role',
              jobType: item.job_type || 'Full-time',
              workMode: item.work_mode || 'On-site',
              location: item.location || 'Not specified',
              salary: item.salary_ctc || item.salary || 'Not disclosed',
              source: item.applied_through || item.source || 'Portal',
              applicationUrl: item.job_link || item.application_url || '',
              sourceUrl: item.company_link || item.source_url || '',
              status: item.status || 'Applied',
              appliedDate: item.date_added || item.applied_date || new Date().toISOString().split('T')[0],
              skills: parsedSkills,
              notes: item.notes || '',
              chatHistory: parsedChatHistory,
              isStored: true
            };
          });

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

    const now = new Date().toISOString();
    const appId = appData.id || crypto.randomUUID();

    // Sanitize chat history to avoid circular structure errors
    const safeChatHistory = (Array.isArray(appData.chatHistory) ? appData.chatHistory : []).map(msg => ({
      role: msg.role || 'assistant',
      text: typeof msg.text === 'string' ? msg.text : '',
      data: msg.data ? {
        companyName: msg.data.companyName || '',
        roleTitle: msg.data.roleTitle || '',
        status: msg.data.status || '',
        salary: msg.data.salary || '',
        location: msg.data.location || '',
        workMode: msg.data.workMode || '',
        appliedDate: msg.data.appliedDate || '',
        isStored: true
      } : null
    }));

    const normalizedApp = {
      id: appId,
      createdAt: appData.createdAt || now,
      updatedAt: now,
      companyName: appData.companyName || '',
      roleTitle: appData.roleTitle || '',
      jobType: appData.jobType || 'Full-time',
      workMode: appData.workMode || 'On-site',
      location: appData.location || 'Not specified',
      salary: appData.salary || 'Not disclosed',
      source: appData.source || 'Portal',
      applicationUrl: appData.applicationUrl || '',
      sourceUrl: appData.sourceUrl || '',
      status: appData.status || 'Applied',
      appliedDate: appData.appliedDate || now.split('T')[0],
      skills: appData.skills || [],
      notes: appData.notes || '',
      chatHistory: safeChatHistory,
      isStored: true
    };

    // Update local storage first
    let localApps = Config.getLocalApplications();
    const existingIndex = localApps.findIndex(a => a.id === appId);
    if (existingIndex >= 0) {
      localApps[existingIndex] = normalizedApp;
    } else {
      localApps.unshift(normalizedApp);
    }
    Config.saveLocalApplications(localApps);

    // Save to Supabase if available
    if (client) {
      // Primary payload for actual table schema
      const primaryPayload = {
        id: appId,
        company_name: appData.companyName || '',
        job_title: appData.roleTitle || '',
        location: appData.location || '',
        work_mode: appData.workMode || 'On-site',
        job_type: appData.jobType || 'Full-time',
        experience_required: appData.experienceRequired || '',
        salary_ctc: appData.salary || '',
        applied_through: appData.source || 'Portal',
        status: appData.status || 'Applied',
        date_added: appData.appliedDate || now.split('T')[0],
        recruiter_name: appData.recruiterName || '',
        recruiter_email: appData.recruiterEmail || '',
        recruiter_phone: appData.recruiterPhone || '',
        job_link: appData.applicationUrl || '',
        company_link: appData.sourceUrl || '',
        website_link: appData.websiteLink || '',
        notes: appData.notes || (Array.isArray(appData.skills) && appData.skills.length ? 'Skills: ' + appData.skills.join(', ') : ''),
        job_description: appData.jobDescription || JSON.stringify(safeChatHistory)
      };

      try {
        let { error } = await client
          .from(supabaseTable)
          .upsert(primaryPayload, { onConflict: 'id' });

        // If primary payload failed due to column mismatch, retry with alternative schema
        if (error && (error.message.includes('job_title') || error.message.includes('salary_ctc') || error.message.includes('date_added'))) {
          const fallbackPayload = {
            id: appId,
            created_at: appData.createdAt || now,
            updated_at: now,
            company_name: appData.companyName || '',
            role_title: appData.roleTitle || '',
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
            chat_history: safeChatHistory
          };

          const retryRes = await client.from(supabaseTable).upsert(fallbackPayload, { onConflict: 'id' });
          error = retryRes.error;
        }

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
  },

  async getUserProfile() {
    // 1. Try local storage first for instant load
    let profile = Config.getUserProfile();

    // 2. Try remote Supabase if connected
    const client = this.getClient();
    if (client) {
      try {
        const { data, error } = await client
          .from('user_profiles')
          .select('profile_data')
          .eq('id', 'primary_user')
          .maybeSingle();

        if (!error && data && data.profile_data) {
          profile = {
            ...profile,
            ...data.profile_data
          };
          Config.saveUserProfile(profile);
        }
      } catch (err) {
        // Table may not exist yet in Supabase, smoothly ignore and use local
        console.debug('user_profiles table query notice:', err);
      }
    }

    return profile;
  },

  async saveUserProfile(profile) {
    // Always persist to local storage first
    Config.saveUserProfile(profile);

    const client = this.getClient();
    if (client) {
      try {
        await client
          .from('user_profiles')
          .upsert({
            id: 'primary_user',
            updated_at: new Date().toISOString(),
            profile_data: profile
          }, { onConflict: 'id' });
      } catch (err) {
        console.debug('user_profiles remote sync notice:', err);
      }
    }

    return { success: true, data: profile };
  }
};
