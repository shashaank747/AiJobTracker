// JobTrackerAI - Main Application Controller
import { Config } from './config.js';
import { SupabaseService } from './supabase-client.js';
import { AiExtractor } from './ai-extractor.js';

// Pre-packaged realistic sample job descriptions
const SAMPLE_JDS = {
  stripe: `Stripe - Full Stack Software Engineer
Location: Remote (US / Canada)
Employment Type: Full-time
Salary: $145,000 - $190,000 USD per year + Equity + Comprehensive Benefits
Job Portal: https://linkedin.com/jobs/view/stripe-fullstack-dev-2026
Apply URL: https://stripe.com/jobs/apply/fullstack-eng-core-infra

About the role:
We are looking for a Full Stack Engineer to join our Payment Infrastructure team.
You will build scalable web applications using TypeScript, React, Node.js, and Postgres.
Collaborate with product designers and engineers to create seamless financial experiences.

Requirements:
- 3+ years experience in full-stack web development
- Proficiency with React, TypeScript, Node.js, and SQL databases
- Experience building secure, high-availability APIs and distributed systems`,

  google: `Google - Software Engineering Intern, AI Systems
Company: Google LLC
Position: Software Engineering Intern
Location: Mountain View, CA (Hybrid: 3 days in-office)
Stipend: $52 - $60 / hour ($9,000 / month)
Status: Applied
Apply Portal: https://careers.google.com/jobs/results/sw-intern-ai-2026
Source: Google Careers

Description:
As a Software Engineering Intern on the Gemini Core Intelligence team, you will help design and evaluate large-scale machine learning models.
Technologies: Python, C++, TensorFlow, JAX, Cloud TPU.`,

  amazon: `Role: Software Development Engineer II (SDE II)
Employer: Amazon Web Services (AWS)
Location: Seattle, WA (On-site)
Base Salary: $165,000 - $210,000 / year + Sign-on Bonus
Job Source: LinkedIn Jobs
Application Link: https://amazon.jobs/en/jobs/aws-sde2-compute-cloud

Join AWS EC2 Core Platforms to design cloud compute backends handling billions of requests daily.
Required: Java, Python, AWS, Distributed Systems, Docker, Kubernetes.`
};

class JobTrackerApp {
  constructor() {
    this.applications = [];
    this.activeApplication = null;
    this.activeView = 'chat'; // 'chat' or 'dashboard'
    this.chatMessages = [];
    this.currentFilterStatus = 'all';
    this.currentFilterWorkMode = 'all';
    this.searchQuery = '';

    this.initElements();
    this.bindEvents();
  }

  initElements() {
    // Views & Tabs
    this.viewChat = document.getElementById('viewChat');
    this.viewDashboard = document.getElementById('viewDashboard');
    this.navTabChat = document.getElementById('navTabChat');
    this.navTabDashboard = document.getElementById('navTabDashboard');
    this.totalAppsBadge = document.getElementById('totalAppsBadge');

    // Sidebar
    this.sidebar = document.getElementById('sidebar');
    this.btnToggleSidebar = document.getElementById('btnToggleSidebar');
    this.btnNewChat = document.getElementById('btnNewChat');
    this.sidebarSearchInput = document.getElementById('sidebarSearchInput');
    this.historyList = document.getElementById('historyList');
    this.cloudStatusBadge = document.getElementById('cloudStatusBadge');
    this.cloudStatusDot = this.cloudStatusBadge.querySelector('.status-dot');
    this.cloudStatusText = document.getElementById('cloudStatusText');

    // Chat UI
    this.chatViewport = document.getElementById('chatViewport');
    this.chatMessagesEl = document.getElementById('chatMessages');
    this.welcomeHero = document.getElementById('welcomeHero');
    this.chatInput = document.getElementById('chatInput');
    this.btnSend = document.getElementById('btnSend');
    this.topbarSessionMeta = document.getElementById('topbarSessionMeta');
    this.topbarCompany = document.getElementById('topbarCompany');
    this.topbarRole = document.getElementById('topbarRole');
    this.activeAiModelTag = document.getElementById('activeAiModelTag');

    // Dashboard UI
    this.dashSearchInput = document.getElementById('dashSearchInput');
    this.filterStatus = document.getElementById('filterStatus');
    this.filterWorkMode = document.getElementById('filterWorkMode');
    this.btnExportCsv = document.getElementById('btnExportCsv');
    this.applicationsGrid = document.getElementById('applicationsGrid');
    this.dashEmptyState = document.getElementById('dashEmptyState');
    this.btnEmptyGoChat = document.getElementById('btnEmptyGoChat');

    // Stats
    this.statTotalCount = document.getElementById('statTotalCount');
    this.statAppliedCount = document.getElementById('statAppliedCount');
    this.statInterviewCount = document.getElementById('statInterviewCount');
    this.statOfferCount = document.getElementById('statOfferCount');

    // Settings Modal
    this.settingsModal = document.getElementById('settingsModal');
    this.btnOpenSettings = document.getElementById('btnOpenSettings');
    this.btnHeaderSettings = document.getElementById('btnHeaderSettings');
    this.btnCloseSettings = document.getElementById('btnCloseSettings');
    this.btnCancelSettings = document.getElementById('btnCancelSettings');
    this.btnSaveSettings = document.getElementById('btnSaveSettings');
    this.btnTestSupabase = document.getElementById('btnTestSupabase');
    this.btnCopySql = document.getElementById('btnCopySql');
    this.supabaseTestResult = document.getElementById('supabaseTestResult');
    this.inputSupabaseUrl = document.getElementById('inputSupabaseUrl');
    this.inputSupabaseKey = document.getElementById('inputSupabaseKey');
    this.inputSupabaseTable = document.getElementById('inputSupabaseTable');
    this.selectAiProvider = document.getElementById('selectAiProvider');
    this.inputGeminiKey = document.getElementById('inputGeminiKey');
    this.inputOpenAiKey = document.getElementById('inputOpenAiKey');
    this.geminiConfigGroup = document.getElementById('geminiConfigGroup');
    this.openaiConfigGroup = document.getElementById('openaiConfigGroup');

    // OCR & Voice Controls
    this.fileUploadInput = document.getElementById('fileUploadInput');
    this.btnAttachFile = document.getElementById('btnAttachFile');
    this.btnVoiceDictate = document.getElementById('btnVoiceDictate');
    this.attachmentPreview = document.getElementById('attachmentPreview');
    this.attachmentIcon = document.getElementById('attachmentIcon');
    this.attachmentName = document.getElementById('attachmentName');
    this.attachmentStatus = document.getElementById('attachmentStatus');
    this.btnRemoveAttachment = document.getElementById('btnRemoveAttachment');
    this.voiceStatusBanner = document.getElementById('voiceStatusBanner');
    this.dropZoneContainer = document.getElementById('dropZoneContainer');

    this.isRecording = false;
    this.speechRecognition = null;
    this.currentAttachment = null;

    // Toast Container
    this.toastContainer = document.getElementById('toastContainer');
  }

  async init() {
    this.updateAiModelTag();
    await this.loadApplications();
    await this.checkSupabaseConnectionStatus();

    // Check active session
    const savedSessionId = Config.getActiveSessionId();
    if (savedSessionId) {
      const found = this.applications.find(a => a.id === savedSessionId);
      if (found) {
        this.selectApplication(found);
      }
    }
  }

  bindEvents() {
    // Tab switching
    this.navTabChat.addEventListener('click', () => this.switchView('chat'));
    this.navTabDashboard.addEventListener('click', () => this.switchView('dashboard'));
    if (this.btnEmptyGoChat) {
      this.btnEmptyGoChat.addEventListener('click', () => this.switchView('chat'));
    }

    // Sidebar
    this.btnNewChat.addEventListener('click', () => this.startNewChatSession());
    this.sidebarSearchInput.addEventListener('input', (e) => this.filterHistoryList(e.target.value));
    if (this.btnToggleSidebar) {
      this.btnToggleSidebar.addEventListener('click', () => this.sidebar.classList.toggle('open'));
    }

    // Chat input auto-grow and submit
    this.chatInput.addEventListener('input', () => {
      this.chatInput.style.height = 'auto';
      this.chatInput.style.height = Math.min(this.chatInput.scrollHeight, 180) + 'px';
    });

    this.chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSendMessage();
      }
    });

    this.btnSend.addEventListener('click', () => this.handleSendMessage());

    // Quick sample chips in welcome hero
    document.querySelectorAll('.sample-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const sampleKey = chip.getAttribute('data-sample');
        if (SAMPLE_JDS[sampleKey]) {
          this.chatInput.value = SAMPLE_JDS[sampleKey];
          this.handleSendMessage();
        }
      });
    });

    // Quick prompt pills
    document.querySelectorAll('.quick-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        const action = pill.getAttribute('data-action');
        if (action === 'link') {
          this.chatInput.value = 'Application URL: ';
        } else if (action === 'salary') {
          this.chatInput.value = 'Salary range is: ';
        } else if (action === 'interview') {
          this.chatInput.value = 'I got an interview! Update status to Interviewing.';
        } else if (action === 'offer') {
          this.chatInput.value = 'Received an offer letter! Update status to Offer.';
        }
        this.chatInput.focus();
      });
    });

    // Dashboard filters
    this.dashSearchInput.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.toLowerCase().trim();
      this.renderApplicationsGrid();
    });

    this.filterStatus.addEventListener('change', (e) => {
      this.currentFilterStatus = e.target.value;
      this.renderApplicationsGrid();
    });

    this.filterWorkMode.addEventListener('change', (e) => {
      this.currentFilterWorkMode = e.target.value;
      this.renderApplicationsGrid();
    });

    // Stat cards click filter
    document.querySelectorAll('.stat-card').forEach(card => {
      card.addEventListener('click', () => {
        const filter = card.getAttribute('data-filter');
        this.filterStatus.value = filter;
        this.currentFilterStatus = filter;
        this.renderApplicationsGrid();
      });
    });

    // Export CSV
    this.btnExportCsv.addEventListener('click', () => this.exportCsv());

    // Settings Modal
    const openSettings = () => this.openSettingsModal();
    this.btnOpenSettings.addEventListener('click', openSettings);
    this.btnHeaderSettings.addEventListener('click', openSettings);
    this.cloudStatusBadge.addEventListener('click', openSettings);

    this.btnCloseSettings.addEventListener('click', () => this.closeSettingsModal());
    this.btnCancelSettings.addEventListener('click', () => this.closeSettingsModal());
    this.btnSaveSettings.addEventListener('click', () => this.saveSettingsFromModal());
    this.btnTestSupabase.addEventListener('click', () => this.testSupabaseConnection());
    this.btnCopySql.addEventListener('click', () => this.copySqlSchema());

    this.selectAiProvider.addEventListener('change', (e) => {
      const val = e.target.value;
      this.geminiConfigGroup.style.display = val === 'gemini' ? 'flex' : 'none';
      this.openaiConfigGroup.style.display = val === 'openai' ? 'flex' : 'none';
    });

    // File Upload & OCR
    this.btnAttachFile.addEventListener('click', () => this.fileUploadInput.click());
    this.fileUploadInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        this.handleFileUpload(e.target.files[0]);
      }
    });
    this.btnRemoveAttachment.addEventListener('click', () => this.clearAttachment());

    // Voice Dictation
    this.btnVoiceDictate.addEventListener('click', () => this.toggleVoiceDictation());

    // Drag & Drop
    this.setupDragAndDrop();
  }

  // ==========================================
  // View Navigation
  // ==========================================
  switchView(viewName) {
    this.activeView = viewName;
    if (viewName === 'chat') {
      this.viewChat.classList.add('active');
      this.viewDashboard.classList.remove('active');
      this.navTabChat.classList.add('active');
      this.navTabDashboard.classList.remove('active');
    } else {
      this.viewChat.classList.remove('active');
      this.viewDashboard.classList.add('active');
      this.navTabChat.classList.remove('active');
      this.navTabDashboard.classList.add('active');
      this.renderApplicationsGrid();
    }
  }

  // ==========================================
  // Data Loading & Syncing
  // ==========================================
  async loadApplications() {
    const res = await SupabaseService.getAllApplications();
    this.applications = res.data || [];
    this.updateStats();
    this.renderHistoryList();
    this.renderApplicationsGrid();
    this.totalAppsBadge.textContent = this.applications.length;
  }

  async checkSupabaseConnectionStatus() {
    const res = await SupabaseService.testConnection();
    if (res.success) {
      this.cloudStatusDot.className = 'status-dot status-connected';
      this.cloudStatusText.textContent = 'Supabase Cloud';
      this.cloudStatusBadge.title = 'Connected to Supabase database';
    } else {
      this.cloudStatusDot.className = 'status-dot status-local';
      this.cloudStatusText.textContent = 'Local Storage';
      this.cloudStatusBadge.title = 'Running locally. Click to connect Supabase.';
    }
  }

  updateStats() {
    const total = this.applications.length;
    const applied = this.applications.filter(a => a.status === 'Applied').length;
    const interviewing = this.applications.filter(a => a.status === 'Interviewing').length;
    const offers = this.applications.filter(a => a.status === 'Offer').length;

    this.statTotalCount.textContent = total;
    this.statAppliedCount.textContent = applied;
    this.statInterviewCount.textContent = interviewing;
    this.statOfferCount.textContent = offers;
    this.totalAppsBadge.textContent = total;
  }

  // ==========================================
  // Chat Session Management
  // ==========================================
  startNewChatSession() {
    this.activeApplication = null;
    Config.setActiveSessionId(null);
    this.chatMessages = [];
    this.topbarSessionMeta.style.display = 'none';
    this.chatMessagesEl.innerHTML = '';
    this.chatMessagesEl.appendChild(this.welcomeHero);
    this.welcomeHero.style.display = 'flex';
    this.chatInput.value = '';
    this.switchView('chat');
    this.highlightActiveHistoryItem();
    this.chatInput.focus();
  }

  selectApplication(app) {
    this.activeApplication = app;
    Config.setActiveSessionId(app.id);

    this.topbarSessionMeta.style.display = 'flex';
    this.topbarCompany.textContent = app.companyName;
    this.topbarRole.textContent = app.roleTitle;

    this.welcomeHero.style.display = 'none';
    this.chatMessagesEl.innerHTML = '';

    // Render chat history
    if (app.chatHistory && app.chatHistory.length > 0) {
      this.chatMessages = [...app.chatHistory];
      for (const msg of this.chatMessages) {
        if (msg.role === 'user') {
          this.appendUserMessage(msg.text, false);
        } else {
          this.appendAssistantMessage(msg.text, msg.data || app, false);
        }
      }
    } else {
      // Create initial synthetic message showing this job
      const msg = {
        role: 'assistant',
        text: `Loaded application for **${app.roleTitle}** at **${app.companyName}**.`,
        data: app
      };
      this.chatMessages = [msg];
      this.appendAssistantMessage(msg.text, app, false);
    }

    this.highlightActiveHistoryItem();
    this.switchView('chat');
    this.scrollToBottom();
  }

  highlightActiveHistoryItem() {
    document.querySelectorAll('.history-item').forEach(el => {
      const id = el.getAttribute('data-id');
      if (this.activeApplication && id === this.activeApplication.id) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });
  }

  // ==========================================
  // Chat Messaging & Extraction Flow
  // ==========================================
  async handleSendMessage() {
    const text = this.chatInput.value.trim();
    if (!text) return;

    this.welcomeHero.style.display = 'none';
    this.appendUserMessage(text);
    this.chatInput.value = '';
    this.chatInput.style.height = 'auto';

    // Show AI thinking indicator
    const thinkingEl = this.appendThinkingIndicator();
    this.scrollToBottom();

    try {
      const result = await AiExtractor.processInput(
        text,
        this.activeApplication,
        this.chatMessages
      );

      thinkingEl.remove();

      if (result.data) {
        // A job was created or updated!
        const appData = {
          ...(this.activeApplication || {}),
          ...result.data,
          id: this.activeApplication?.id || crypto.randomUUID(),
          createdAt: this.activeApplication?.createdAt || new Date().toISOString()
        };

        const assistantMsg = {
          role: 'assistant',
          text: result.message,
          data: appData
        };

        this.chatMessages.push({ role: 'user', text });
        this.chatMessages.push(assistantMsg);
        appData.chatHistory = this.chatMessages;

        // Save to Supabase & local storage
        const saveRes = await SupabaseService.saveApplication(appData);
        this.activeApplication = saveRes.data;
        Config.setActiveSessionId(this.activeApplication.id);

        // Render assistant bubble with extraction card
        this.appendAssistantMessage(result.message, this.activeApplication);

        // Update UI
        this.topbarSessionMeta.style.display = 'flex';
        this.topbarCompany.textContent = this.activeApplication.companyName;
        this.topbarRole.textContent = this.activeApplication.roleTitle;

        await this.loadApplications();
        this.highlightActiveHistoryItem();
        this.scrollToBottom();

        const syncNote = saveRes.isRemote ? 'Saved to Supabase!' : 'Saved locally!';
        this.showToast(syncNote, 'success');
      } else {
        // Pure conversational message (e.g., greeting, help, inquiry) - DO NOT create a dummy card!
        const assistantMsg = {
          role: 'assistant',
          text: result.message,
          data: null
        };

        this.chatMessages.push({ role: 'user', text });
        this.chatMessages.push(assistantMsg);

        if (this.activeApplication) {
          this.activeApplication.chatHistory = this.chatMessages;
          await SupabaseService.saveApplication(this.activeApplication);
        }

        // Render assistant bubble without an extraction card
        this.appendAssistantMessage(result.message, null);
        this.scrollToBottom();
      }

    } catch (err) {
      thinkingEl.remove();
      this.appendAssistantMessage(`❌ **Extraction Error**: ${err.message || 'Unable to parse job.'}`, null);
      this.scrollToBottom();
      this.showToast(err.message, 'error');
    }
  }

  appendUserMessage(text, pushToState = true) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'chat-msg user';
    msgDiv.innerHTML = `
      <div class="msg-avatar">You</div>
      <div class="msg-body">
        <div class="msg-bubble-user">${this.escapeHtml(text)}</div>
      </div>
    `;
    this.chatMessagesEl.appendChild(msgDiv);
  }

  appendThinkingIndicator() {
    const div = document.createElement('div');
    div.className = 'chat-msg assistant thinking-wrapper';
    div.innerHTML = `
      <div class="msg-avatar">AI</div>
      <div class="msg-body">
        <div class="ai-thinking">
          <span>Analyzing Job Description & extracting data</span>
          <div class="thinking-dots">
            <span class="thinking-dot"></span>
            <span class="thinking-dot"></span>
            <span class="thinking-dot"></span>
          </div>
        </div>
      </div>
    `;
    this.chatMessagesEl.appendChild(div);
    return div;
  }

  renderMarkdown(text) {
    if (!text) return '';
    let html = text;

    // Headers
    html = html.replace(/^### (.*$)/gim, '<h4 style="margin: 12px 0 6px 0; color: #f8fafc; font-size: 1.05rem; font-weight: 700;">$1</h4>');
    html = html.replace(/^## (.*$)/gim, '<h3 style="margin: 14px 0 8px 0; color: #f8fafc; font-size: 1.15rem; font-weight: 700;">$1</h3>');

    // Bold & Italic
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // Markdown Links [text](url)
    html = html.replace(/\[(.*?)\]\((https?:\/\/.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color: #38bdf8; text-decoration: underline; font-weight: 600;">$1 ↗</a>');

    // Unordered lists
    html = html.replace(/^- (.*$)/gim, '<li style="margin-left: 18px; margin-bottom: 4px; line-height: 1.5;">$1</li>');

    // Ordered lists
    html = html.replace(/^(\d+)\. (.*$)/gim, '<li style="margin-left: 18px; margin-bottom: 4px; list-style-type: decimal; line-height: 1.5;">$2</li>');

    // Paragraph separation
    html = html.replace(/\n\n/g, '<div style="height: 8px;"></div>');
    html = html.replace(/\n/g, '<br/>');

    return html;
  }

  appendAssistantMessage(text, jobData, animate = true) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'chat-msg assistant';

    let cardHtml = '';
    if (jobData) {
      cardHtml = this.createExtractionCardHtml(jobData);
    }

    const formattedText = this.renderMarkdown(text);

    msgDiv.innerHTML = `
      <div class="msg-avatar">AI</div>
      <div class="msg-body">
        <div class="msg-assistant-text">${formattedText}</div>
        ${cardHtml}
      </div>
    `;

    this.chatMessagesEl.appendChild(msgDiv);

    // Bind events inside the card
    if (jobData) {
      this.bindCardEvents(msgDiv, jobData);
    }
  }

  createExtractionCardHtml(data) {
    const initial = (data.companyName || 'C').charAt(0).toUpperCase();
    const statusClass = `status-${(data.status || 'applied').toLowerCase()}`;

    // Skills tags
    const skillsHtml = (data.skills && data.skills.length > 0)
      ? `<div class="card-skills-row">
          ${data.skills.map(s => `<span class="skill-tag">${this.escapeHtml(s)}</span>`).join('')}
         </div>`
      : '';

    // External links
    let linksHtml = '';
    if (data.applicationUrl) {
      linksHtml += `
        <a href="${this.escapeHtml(data.applicationUrl)}" target="_blank" rel="noopener noreferrer" class="link-button">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
          <span>Apply Portal</span>
        </a>
      `;
    }
    if (data.sourceUrl) {
      linksHtml += `
        <a href="${this.escapeHtml(data.sourceUrl)}" target="_blank" rel="noopener noreferrer" class="link-button">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
          <span>Job Post (${this.escapeHtml(data.source || 'Listing')})</span>
        </a>
      `;
    }

    return `
      <div class="ai-extraction-card">
        <div class="card-header-row">
          <div class="card-company-identity">
            <div class="company-badge-icon">${initial}</div>
            <div>
              <h3 class="card-job-title">${this.escapeHtml(data.roleTitle || 'Job Title')}</h3>
              <p class="card-company-name">${this.escapeHtml(data.companyName || 'Company')}</p>
            </div>
          </div>
          <span class="status-pill ${statusClass}">${data.status || 'Applied'}</span>
        </div>

        <div class="card-meta-chips">
          <span class="meta-chip chip-salary">💰 <strong>${this.escapeHtml(data.salary || 'Not disclosed')}</strong></span>
          <span class="meta-chip chip-mode">🏢 <strong>${this.escapeHtml(data.workMode || 'On-site')}</strong></span>
          <span class="meta-chip">📍 ${this.escapeHtml(data.location || 'Not specified')}</span>
          <span class="meta-chip">💼 ${this.escapeHtml(data.jobType || 'Full-time')}</span>
          <span class="meta-chip">📅 Applied: ${this.escapeHtml(data.appliedDate || 'Today')}</span>
        </div>

        ${skillsHtml}

        <div class="card-actions-row">
          <div class="card-external-links">
            ${linksHtml || '<span style="font-size: 0.78rem; color: var(--text-subtle);">No direct URLs detected yet. You can paste them in the chat.</span>'}
          </div>
          <button class="btn btn-secondary btn-sm btn-view-in-dash">
            <span>View in Tracker</span>
          </button>
        </div>
      </div>
    `;
  }

  bindCardEvents(msgDiv, jobData) {
    const btnView = msgDiv.querySelector('.btn-view-in-dash');
    if (btnView) {
      btnView.addEventListener('click', () => {
        this.switchView('dashboard');
      });
    }
  }

  // ==========================================
  // VIEW 2: Dashboard Grid & Cards Rendering
  // ==========================================
  renderApplicationsGrid() {
    let filtered = [...this.applications];

    // Status filter
    if (this.currentFilterStatus !== 'all') {
      filtered = filtered.filter(a => a.status === this.currentFilterStatus);
    }

    // Work Mode filter
    if (this.currentFilterWorkMode !== 'all') {
      filtered = filtered.filter(a => a.workMode === this.currentFilterWorkMode);
    }

    // Search query
    if (this.searchQuery) {
      filtered = filtered.filter(a => {
        const text = `${a.companyName} ${a.roleTitle} ${a.location} ${(a.skills || []).join(' ')}`.toLowerCase();
        return text.includes(this.searchQuery);
      });
    }

    this.applicationsGrid.innerHTML = '';

    if (filtered.length === 0) {
      this.dashEmptyState.style.display = 'flex';
      return;
    }

    this.dashEmptyState.style.display = 'none';

    for (const app of filtered) {
      const card = this.createJobCardElement(app);
      this.applicationsGrid.appendChild(card);
    }
  }

  createJobCardElement(app) {
    const card = document.createElement('div');
    card.className = 'job-card';

    const initial = (app.companyName || 'C').charAt(0).toUpperCase();
    const daysAgoText = this.formatDaysAgo(app.appliedDate || app.createdAt);

    const statusOptions = ['Applied', 'Interviewing', 'Offer', 'Rejected', 'Bookmarked'];
    const selectOptionsHtml = statusOptions.map(st => `
      <option value="${st}" ${st === app.status ? 'selected' : ''}>${st}</option>
    `).join('');

    let linksHtml = '';
    if (app.applicationUrl) {
      linksHtml += `
        <a href="${this.escapeHtml(app.applicationUrl)}" target="_blank" rel="noopener noreferrer" class="job-link-btn" title="Open Application Link">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
          <span>Apply Portal</span>
        </a>
      `;
    }
    if (app.sourceUrl) {
      linksHtml += `
        <a href="${this.escapeHtml(app.sourceUrl)}" target="_blank" rel="noopener noreferrer" class="job-link-btn" title="View Source Post">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
          <span>${this.escapeHtml(app.source || 'Portal')}</span>
        </a>
      `;
    }

    const statusClass = `status-${(app.status || 'applied').toLowerCase()}`;

    card.innerHTML = `
      <div class="job-card-top">
        <div class="job-company-identity">
          <div class="job-logo-initial">${initial}</div>
          <div class="job-title-group">
            <h4 class="job-role-text" title="${this.escapeHtml(app.roleTitle)}">${this.escapeHtml(app.roleTitle)}</h4>
            <p class="job-company-text">${this.escapeHtml(app.companyName)}</p>
          </div>
        </div>

        <select class="job-status-select ${statusClass}" data-id="${app.id}">
          ${selectOptionsHtml}
        </select>
      </div>

      <div class="job-meta-row">
        <span class="badge-days-ago">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
          <span>${daysAgoText}</span>
        </span>
        <span class="badge-workmode">${this.escapeHtml(app.workMode || 'On-site')}</span>
        ${app.salary && app.salary !== 'Not disclosed' ? `<span class="badge-salary">${this.escapeHtml(app.salary)}</span>` : ''}
        <span class="badge-location">📍 ${this.escapeHtml(app.location || 'Location')}</span>
      </div>

      <div class="job-card-bottom">
        <div class="job-links-group">
          ${linksHtml || '<span style="font-size: 0.72rem; color: var(--text-subtle);">No links saved</span>'}
        </div>

        <div class="job-actions-group">
          <button class="btn-icon btn-chat-job" title="Open AI Chat for this application">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
          </button>
          <button class="btn-icon btn-delete-job" title="Delete application">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      </div>
    `;

    // Status select change
    const statusSelect = card.querySelector('.job-status-select');
    statusSelect.addEventListener('change', async (e) => {
      const newStatus = e.target.value;
      app.status = newStatus;
      await SupabaseService.saveApplication(app);
      this.updateStats();
      this.renderHistoryList();
      statusSelect.className = `job-status-select status-${newStatus.toLowerCase()}`;
      this.showToast(`Updated status of ${app.companyName} to ${newStatus}`, 'info');
    });

    // Open in chat
    const btnChat = card.querySelector('.btn-chat-job');
    btnChat.addEventListener('click', () => {
      this.selectApplication(app);
    });

    // Delete
    const btnDelete = card.querySelector('.btn-delete-job');
    btnDelete.addEventListener('click', async () => {
      if (confirm(`Are you sure you want to delete application for ${app.companyName} (${app.roleTitle})?`)) {
        await SupabaseService.deleteApplication(app.id);
        if (this.activeApplication?.id === app.id) {
          this.startNewChatSession();
        }
        await this.loadApplications();
        this.showToast(`Deleted ${app.companyName}`, 'info');
      }
    });

    return card;
  }

  // ==========================================
  // Sidebar History List
  // ==========================================
  renderHistoryList() {
    this.historyList.innerHTML = '';

    for (const app of this.applications) {
      const item = document.createElement('div');
      item.className = 'history-item';
      item.setAttribute('data-id', app.id);
      if (this.activeApplication && this.activeApplication.id === app.id) {
        item.classList.add('active');
      }

      item.innerHTML = `
        <div class="history-item-content">
          <span class="history-company">${this.escapeHtml(app.companyName)}</span>
          <span class="history-role">${this.escapeHtml(app.roleTitle)} • ${this.escapeHtml(app.status)}</span>
        </div>
        <button class="history-del-btn" title="Delete">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      `;

      item.addEventListener('click', (e) => {
        if (!e.target.closest('.history-del-btn')) {
          this.selectApplication(app);
        }
      });

      const delBtn = item.querySelector('.history-del-btn');
      delBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm(`Delete ${app.companyName}?`)) {
          await SupabaseService.deleteApplication(app.id);
          if (this.activeApplication?.id === app.id) {
            this.startNewChatSession();
          }
          await this.loadApplications();
          this.showToast(`Deleted ${app.companyName}`, 'info');
        }
      });

      this.historyList.appendChild(item);
    }
  }

  filterHistoryList(query) {
    const q = query.toLowerCase().trim();
    document.querySelectorAll('.history-item').forEach(el => {
      const text = el.textContent.toLowerCase();
      el.style.display = text.includes(q) ? 'flex' : 'none';
    });
  }

  // ==========================================
  // Settings & Supabase Modal Management
  // ==========================================
  openSettingsModal() {
    const settings = Config.getSettings();
    this.inputSupabaseUrl.value = settings.supabaseUrl;
    this.inputSupabaseKey.value = settings.supabaseKey;
    this.inputSupabaseTable.value = settings.supabaseTable;
    this.selectAiProvider.value = settings.aiProvider;
    this.inputGeminiKey.value = settings.geminiKey;
    this.inputOpenAiKey.value = settings.openaiKey;

    this.geminiConfigGroup.style.display = settings.aiProvider === 'gemini' ? 'flex' : 'none';
    this.openaiConfigGroup.style.display = settings.aiProvider === 'openai' ? 'flex' : 'none';

    this.supabaseTestResult.textContent = '';
    this.settingsModal.classList.add('open');
  }

  closeSettingsModal() {
    this.settingsModal.classList.remove('open');
  }

  async saveSettingsFromModal() {
    Config.saveSettings({
      supabaseUrl: this.inputSupabaseUrl.value,
      supabaseKey: this.inputSupabaseKey.value,
      supabaseTable: this.inputSupabaseTable.value,
      aiProvider: this.selectAiProvider.value,
      geminiKey: this.inputGeminiKey.value,
      openaiKey: this.inputOpenAiKey.value
    });

    this.updateAiModelTag();
    this.closeSettingsModal();
    this.showToast('Settings saved successfully!', 'success');

    // Test connection and reload data
    await this.checkSupabaseConnectionStatus();
    await this.loadApplications();
  }

  async testSupabaseConnection() {
    this.supabaseTestResult.textContent = 'Testing connection...';
    this.supabaseTestResult.className = 'test-result-text';

    // Temporarily save to test
    Config.saveSettings({
      supabaseUrl: this.inputSupabaseUrl.value,
      supabaseKey: this.inputSupabaseKey.value,
      supabaseTable: this.inputSupabaseTable.value
    });

    const res = await SupabaseService.testConnection();
    if (res.success) {
      this.supabaseTestResult.textContent = '✓ ' + res.message;
      this.supabaseTestResult.className = 'test-result-text success';
    } else {
      this.supabaseTestResult.textContent = '✗ ' + res.message;
      this.supabaseTestResult.className = 'test-result-text error';
    }
  }

  copySqlSchema() {
    const sql = Config.getSqlSchemaSnippet();
    navigator.clipboard.writeText(sql).then(() => {
      this.showToast('Supabase SQL Schema copied to clipboard!', 'success');
    }).catch(() => {
      prompt('Copy the SQL table script below:', sql);
    });
  }

  updateAiModelTag() {
    const settings = Config.getSettings();
    let text = 'Model: Smart Heuristics';
    if (settings.aiProvider === 'gemini' && settings.geminiKey) {
      text = 'Model: Google Gemini';
    } else if (settings.aiProvider === 'openai' && settings.openaiKey) {
      text = 'Model: OpenAI ChatGPT';
    }
    this.activeAiModelTag.textContent = text;
  }

  // ==========================================
  // CSV Export Utility
  // ==========================================
  exportCsv() {
    if (this.applications.length === 0) {
      this.showToast('No applications to export', 'error');
      return;
    }

    const headers = ['Company', 'Role', 'Status', 'Applied Date', 'Work Mode', 'Location', 'Salary', 'Application URL', 'Source URL', 'Skills'];
    const rows = this.applications.map(a => [
      `"${(a.companyName || '').replace(/"/g, '""')}"`,
      `"${(a.roleTitle || '').replace(/"/g, '""')}"`,
      `"${(a.status || '').replace(/"/g, '""')}"`,
      `"${(a.appliedDate || '').replace(/"/g, '""')}"`,
      `"${(a.workMode || '').replace(/"/g, '""')}"`,
      `"${(a.location || '').replace(/"/g, '""')}"`,
      `"${(a.salary || '').replace(/"/g, '""')}"`,
      `"${(a.applicationUrl || '').replace(/"/g, '""')}"`,
      `"${(a.sourceUrl || '').replace(/"/g, '""')}"`,
      `"${((a.skills || []).join(', ')).replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `job_applications_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    this.showToast('Applications exported to CSV!', 'success');
  }

  // ==========================================
  // Helper Utilities
  // ==========================================
  formatDaysAgo(dateStr) {
    if (!dateStr) return 'Applied today';
    try {
      const appliedDate = new Date(dateStr);
      const today = new Date();
      appliedDate.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);

      const diffTime = today - appliedDate;
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays <= 0) return 'Applied today';
      if (diffDays === 1) return 'Applied yesterday';
      if (diffDays < 7) return `Applied ${diffDays} days ago`;
      if (diffDays < 30) {
        const weeks = Math.floor(diffDays / 7);
        return `Applied ${weeks} week${weeks > 1 ? 's' : ''} ago`;
      }
      const months = Math.floor(diffDays / 30);
      return `Applied ${months} month${months > 1 ? 's' : ''} ago`;
    } catch (e) {
      return 'Applied recently';
    }
  }

  // ==========================================
  // Voice Dictation (Web Speech API)
  // ==========================================
  initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      return null;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      this.isRecording = true;
      this.btnVoiceDictate.classList.add('recording');
      this.voiceStatusBanner.style.display = 'flex';
      this.showToast('Microphone active. Speak your job details now...', 'info');
    };

    recognition.onresult = (event) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + ' ';
        }
      }
      if (finalTranscript) {
        this.chatInput.value = (this.chatInput.value ? this.chatInput.value.trim() + ' ' : '') + finalTranscript.trim();
        this.chatInput.style.height = 'auto';
        this.chatInput.style.height = Math.min(this.chatInput.scrollHeight, 180) + 'px';
      }
    };

    recognition.onerror = (event) => {
      console.warn('Speech recognition event:', event.error);
      this.stopVoiceDictation();
      if (event.error !== 'no-speech') {
        this.showToast(`Microphone: ${event.error}`, 'error');
      }
    };

    recognition.onend = () => {
      this.stopVoiceDictation();
    };

    return recognition;
  }

  toggleVoiceDictation() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      this.showToast('Voice dictation is supported in Google Chrome, Edge, and modern browsers.', 'error');
      return;
    }

    if (this.isRecording) {
      if (this.speechRecognition) {
        try { this.speechRecognition.stop(); } catch (e) {}
      }
      this.stopVoiceDictation();
    } else {
      if (!this.speechRecognition) {
        this.speechRecognition = this.initSpeechRecognition();
      }
      if (this.speechRecognition) {
        try {
          this.speechRecognition.start();
        } catch (e) {
          console.warn('Speech recognition start error:', e);
          this.stopVoiceDictation();
        }
      }
    }
  }

  stopVoiceDictation() {
    this.isRecording = false;
    this.btnVoiceDictate.classList.remove('recording');
    this.voiceStatusBanner.style.display = 'none';
  }

  // ==========================================
  // OCR & File Text Extraction (PDF.js & Tesseract.js)
  // ==========================================
  async handleFileUpload(file) {
    if (!file) return;

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|webp|bmp|gif)$/i.test(file.name);

    if (!isPdf && !isImage) {
      this.showToast('Please upload a PDF document or image file (PNG/JPG/WebP).', 'error');
      return;
    }

    // Display attachment preview box
    this.attachmentPreview.style.display = 'flex';
    this.attachmentName.textContent = file.name;
    this.attachmentIcon.textContent = isPdf ? '📑' : '🖼️';
    this.attachmentStatus.textContent = isPdf ? 'Extracting PDF pages...' : 'Initializing Tesseract OCR...';

    try {
      let extractedText = '';
      if (isPdf) {
        extractedText = await this.extractTextFromPdf(file);
      } else {
        extractedText = await this.extractTextFromImage(file);
      }

      if (!extractedText || !extractedText.trim()) {
        this.attachmentStatus.textContent = 'No readable text found in document.';
        this.showToast('No readable text found in file. Ensure the scan is clear.', 'error');
        return;
      }

      this.currentAttachment = { file, text: extractedText };
      this.attachmentStatus.textContent = `✓ Extracted ${extractedText.length} characters`;

      // Fill extracted text into prompt bar
      this.chatInput.value = extractedText.trim();
      this.chatInput.style.height = 'auto';
      this.chatInput.style.height = Math.min(this.chatInput.scrollHeight, 180) + 'px';
      this.chatInput.focus();

      this.showToast(`OCR Extracted text from ${file.name}! Press Enter to analyze.`, 'success');
    } catch (err) {
      console.error('File extraction error:', err);
      this.attachmentStatus.textContent = 'Extraction error: ' + (err.message || 'Failed');
      this.showToast('Failed to extract text from file: ' + err.message, 'error');
    }
  }

  async extractTextFromPdf(file) {
    if (!window.pdfjsLib) {
      throw new Error('PDF library not ready. Please try again.');
    }
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      this.attachmentStatus.textContent = `Extracting page ${i} of ${pdf.numPages}...`;
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += pageText + '\n\n';
    }

    return fullText;
  }

  async extractTextFromImage(file) {
    if (!window.Tesseract) {
      throw new Error('OCR library not loaded.');
    }

    this.attachmentStatus.textContent = 'OCR: Scanning image...';

    const result = await window.Tesseract.recognize(
      file,
      'eng',
      {
        logger: m => {
          if (m.status === 'recognizing text' && m.progress) {
            const pct = Math.round(m.progress * 100);
            this.attachmentStatus.textContent = `OCR: Extracting text (${pct}%)...`;
          }
        }
      }
    );

    return result.data.text;
  }

  clearAttachment() {
    this.currentAttachment = null;
    this.fileUploadInput.value = '';
    this.attachmentPreview.style.display = 'none';
  }

  setupDragAndDrop() {
    const handleDrag = (e, isOver) => {
      e.preventDefault();
      e.stopPropagation();
      if (isOver) {
        this.dropZoneContainer.classList.add('drag-over');
      } else {
        this.dropZoneContainer.classList.remove('drag-over');
      }
    };

    ['dragenter', 'dragover'].forEach(name => {
      this.dropZoneContainer.addEventListener(name, (e) => handleDrag(e, true));
      this.chatViewport.addEventListener(name, (e) => handleDrag(e, true));
    });

    ['dragleave', 'dragend'].forEach(name => {
      this.dropZoneContainer.addEventListener(name, (e) => handleDrag(e, false));
      this.chatViewport.addEventListener(name, (e) => handleDrag(e, false));
    });

    const handleDrop = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.dropZoneContainer.classList.remove('drag-over');
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        this.handleFileUpload(files[0]);
      }
    };

    this.dropZoneContainer.addEventListener('drop', handleDrop);
    this.chatViewport.addEventListener('drop', handleDrop);
  }

  scrollToBottom() {
    setTimeout(() => {
      this.chatViewport.scrollTop = this.chatViewport.scrollHeight;
    }, 50);
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${this.escapeHtml(message)}</span>`;
    this.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }
}

// Instantiate app on load
window.addEventListener('DOMContentLoaded', () => {
  const app = new JobTrackerApp();
  app.init();
});
