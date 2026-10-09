// JobTrackerAI - Main Application Controller
import { Config } from './config.js';
import { SupabaseService } from './supabase-client.js';
import { AiExtractor } from './ai-extractor.js';

// Interactive Slash Commands for Zuno
const SLASH_COMMANDS = [
  {
    cmd: '/store',
    label: 'Store in Database',
    desc: 'Permanently save the current drafted job to your database & tracker',
    icon: '💾',
    action: 'store'
  },
  {
    cmd: '/compare',
    label: 'Compare Profile vs Company Requirements',
    desc: 'Compare your About Me profile (education, sem marks, projects, certs) against company requirements',
    icon: '⚖️',
    action: 'compare'
  },
  {
    cmd: '/interview',
    label: 'Status: Interviewing',
    desc: 'Mark job as Interviewing and ask Zuno for targeted interview questions',
    icon: '🎯',
    action: 'interview'
  },
  {
    cmd: '/offer',
    label: 'Status: Offer Received',
    desc: 'Mark job as Offer and get salary negotiation advice from Zuno',
    icon: '🎉',
    action: 'offer'
  },
  {
    cmd: '/rejected',
    label: 'Status: Rejected',
    desc: 'Update application status to Rejected and log outcome',
    icon: '🛑',
    action: 'rejected'
  },
  {
    cmd: '/salary',
    label: 'Update Salary',
    desc: 'Set compensation for the active application (e.g. /salary 12 LPA)',
    icon: '💵',
    action: 'salary'
  },
  {
    cmd: '/clear',
    label: 'Clear Chat',
    desc: 'Clear the current conversation history and start fresh',
    icon: '🧹',
    action: 'clear'
  },
  {
    cmd: '/help',
    label: 'Zuno Help & Commands',
    desc: 'Show all shortcut commands, tips, and tracking instructions',
    icon: '💡',
    action: 'help'
  }
];

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
    this.brandIconCollapse = document.getElementById('brandIconCollapse');
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

    // Slash Commands Menu
    this.slashCommandMenu = document.getElementById('slashCommandMenu');
    this.slashMenuList = document.getElementById('slashMenuList');
    this.activeSlashCommandIndex = 0;
    this.currentFilteredCommands = [];

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
    this.chatAiEngineSelect = document.getElementById('chatAiEngineSelect');
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
    this.voiceStatusText = document.getElementById('voiceStatusText');
    this.dropZoneContainer = document.getElementById('dropZoneContainer');

    this.isRecording = false;
    this.speechRecognition = null;
    this.baseVoiceText = '';
    this.voiceSilenceTimer = null;
    this.VOICE_SILENCE_TIMEOUT_MS = 12000; // 12 seconds silence timeout (within 10-15s range)
    this.currentAttachment = null;

    // Toast Container
    this.toastContainer = document.getElementById('toastContainer');

    // Profile State & Elements
    this.navTabProfile = document.getElementById('navTabProfile');
    this.viewProfile = document.getElementById('viewProfile');
    this.userProfile = null;
    this.editingProjectId = null;
    this.editingCertId = null;

    this.profFullName = document.getElementById('profFullName');
    this.profHeadline = document.getElementById('profHeadline');
    this.profBio = document.getElementById('profBio');
    this.profEmail = document.getElementById('profEmail');
    this.profPhone = document.getElementById('profPhone');
    this.profLocation = document.getElementById('profLocation');
    this.profPortfolio = document.getElementById('profPortfolio');
    this.profGithub = document.getElementById('profGithub');
    this.profLinkedin = document.getElementById('profLinkedin');
    this.profAvatarUrl = document.getElementById('profAvatarUrl');
    this.profileAvatarImg = document.getElementById('profileAvatarImg');
    this.profileAvatarFallback = document.getElementById('profileAvatarFallback');
    this.inputAvatarFile = document.getElementById('inputAvatarFile');
    this.btnSaveProfile = document.getElementById('btnSaveProfile');
    this.btnProfTalkZuno = document.getElementById('btnProfTalkZuno');

    // Education inputs
    this.prof10thSchool = document.getElementById('prof10thSchool');
    this.prof10thBoard = document.getElementById('prof10thBoard');
    this.prof10thMarks = document.getElementById('prof10thMarks');
    this.prof10thYear = document.getElementById('prof10thYear');

    this.prof12thSchool = document.getElementById('prof12thSchool');
    this.prof12thBoard = document.getElementById('prof12thBoard');
    this.prof12thMarks = document.getElementById('prof12thMarks');
    this.prof12thYear = document.getElementById('prof12thYear');

    this.profCollegeName = document.getElementById('profCollegeName');
    this.profCollegeDegree = document.getElementById('profCollegeDegree');
    this.profCollegeBranch = document.getElementById('profCollegeBranch');
    this.profCollegeCgpa = document.getElementById('profCollegeCgpa');
    this.profCollegeGradYear = document.getElementById('profCollegeGradYear');

    this.profSemInputs = [
      document.getElementById('profSem1'),
      document.getElementById('profSem2'),
      document.getElementById('profSem3'),
      document.getElementById('profSem4'),
      document.getElementById('profSem5'),
      document.getElementById('profSem6'),
      document.getElementById('profSem7'),
      document.getElementById('profSem8')
    ];
    this.profSemAvgBadge = document.getElementById('profSemAvgBadge');

    // Projects & Certs Elements
    this.projectsList = document.getElementById('projectsList');
    this.btnOpenAddProjectModal = document.getElementById('btnOpenAddProjectModal');
    this.projectModal = document.getElementById('projectModal');
    this.btnCloseProjectModal = document.getElementById('btnCloseProjectModal');
    this.btnCancelProjectModal = document.getElementById('btnCancelProjectModal');
    this.btnSaveProjectModal = document.getElementById('btnSaveProjectModal');
    this.projectModalTitle = document.getElementById('projectModalTitle');
    this.modalProjTitle = document.getElementById('modalProjTitle');
    this.modalProjDesc = document.getElementById('modalProjDesc');
    this.modalProjTech = document.getElementById('modalProjTech');
    this.modalProjLink = document.getElementById('modalProjLink');
    this.modalProjStartDate = document.getElementById('modalProjStartDate');
    this.modalProjFinishDate = document.getElementById('modalProjFinishDate');

    this.certificationsList = document.getElementById('certificationsList');
    this.btnOpenAddCertModal = document.getElementById('btnOpenAddCertModal');
    this.certModal = document.getElementById('certModal');
    this.btnCloseCertModal = document.getElementById('btnCloseCertModal');
    this.btnCancelCertModal = document.getElementById('btnCancelCertModal');
    this.btnSaveCertModal = document.getElementById('btnSaveCertModal');
    this.certModalTitle = document.getElementById('certModalTitle');
    this.modalCertName = document.getElementById('modalCertName');
    this.modalCertIssuer = document.getElementById('modalCertIssuer');
    this.modalCertDate = document.getElementById('modalCertDate');
    this.modalCertLink = document.getElementById('modalCertLink');

    // Skills Elements
    this.profileSkillsContainer = document.getElementById('profileSkillsContainer');
    this.inputNewSkill = document.getElementById('inputNewSkill');
    this.btnAddSkill = document.getElementById('btnAddSkill');

    // Profile Top Action Buttons
    this.btnSaveProfile = document.getElementById('btnSaveProfile');
    this.btnProfTalkZuno = document.getElementById('btnProfTalkZuno');
    this.btnProfileCompare = document.getElementById('btnProfileCompare');
  }

  async init() {
    this.updateAiModelTag();
    await this.loadApplications();
    await this.loadUserProfile();
    await this.checkSupabaseConnectionStatus();

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
    if (this.navTabProfile) {
      this.navTabProfile.addEventListener('click', () => this.switchView('profile'));
    }
    if (this.btnEmptyGoChat) {
      this.btnEmptyGoChat.addEventListener('click', () => this.switchView('chat'));
    }

    // Profile Actions
    if (this.btnSaveProfile) {
      this.btnSaveProfile.addEventListener('click', () => this.saveProfileManually());
    }
    if (this.btnProfTalkZuno) {
      this.btnProfTalkZuno.addEventListener('click', () => {
        this.switchView('chat');
        this.chatInput.value = 'Can you review my profile and projects and give me suggestions?';
        this.chatInput.focus();
      });
    }
    if (this.btnProfileCompare) {
      this.btnProfileCompare.addEventListener('click', () => {
        this.switchView('chat');
        this.handleCompareCommand('/compare');
      });
    }

    // Avatar Upload (Local image file reader)
    if (this.inputAvatarFile) {
      this.inputAvatarFile.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (loadEvent) => {
            const dataUrl = loadEvent.target.result;
            if (this.userProfile) this.userProfile.avatarUrl = dataUrl;
            if (this.profAvatarUrl) this.profAvatarUrl.value = dataUrl;
            this.updateAvatarDisplay(dataUrl);
            this.showToast('Profile photo updated! Click Save Profile to persist.', 'info');
          };
          reader.readAsDataURL(file);
        }
      });
    }

    if (this.profAvatarUrl) {
      this.profAvatarUrl.addEventListener('input', (e) => {
        const url = e.target.value.trim();
        if (this.userProfile) this.userProfile.avatarUrl = url;
        this.updateAvatarDisplay(url);
      });
    }

    // Semester input change -> dynamic average SGPA computation
    this.profSemInputs.forEach(input => {
      if (input) {
        input.addEventListener('input', () => this.updateSemAvgDisplay());
      }
    });

    // Project Modal bindings
    if (this.btnOpenAddProjectModal) {
      this.btnOpenAddProjectModal.addEventListener('click', () => this.openProjectModal());
    }
    if (this.btnCloseProjectModal) {
      this.btnCloseProjectModal.addEventListener('click', () => this.closeProjectModal());
    }
    if (this.btnCancelProjectModal) {
      this.btnCancelProjectModal.addEventListener('click', () => this.closeProjectModal());
    }
    if (this.btnSaveProjectModal) {
      this.btnSaveProjectModal.addEventListener('click', () => this.saveProjectFromModal());
    }

    // Cert Modal bindings
    if (this.btnOpenAddCertModal) {
      this.btnOpenAddCertModal.addEventListener('click', () => this.openCertModal());
    }
    if (this.btnCloseCertModal) {
      this.btnCloseCertModal.addEventListener('click', () => this.closeCertModal());
    }
    if (this.btnCancelCertModal) {
      this.btnCancelCertModal.addEventListener('click', () => this.closeCertModal());
    }
    if (this.btnSaveCertModal) {
      this.btnSaveCertModal.addEventListener('click', () => this.saveCertFromModal());
    }

    // Skills input binding
    if (this.btnAddSkill && this.inputNewSkill) {
      this.btnAddSkill.addEventListener('click', () => {
        const val = this.inputNewSkill.value.trim();
        if (val) {
          this.addSkill(val);
          this.inputNewSkill.value = '';
        }
      });
      this.inputNewSkill.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const val = this.inputNewSkill.value.trim();
          if (val) {
            this.addSkill(val);
            this.inputNewSkill.value = '';
          }
        }
      });
    }

    // Sidebar
    this.btnNewChat.addEventListener('click', () => this.startNewChatSession());
    this.sidebarSearchInput.addEventListener('input', (e) => this.filterHistoryList(e.target.value));
    if (this.btnToggleSidebar) {
      this.btnToggleSidebar.addEventListener('click', () => this.toggleSidebar());
    }
    if (this.brandIconCollapse) {
      this.brandIconCollapse.addEventListener('click', () => this.closeSidebar());
    }

    // Chat input auto-grow, slash commands, and submit
    this.chatInput.addEventListener('input', () => {
      this.chatInput.style.height = 'auto';
      const scrollH = this.chatInput.scrollHeight;
      this.chatInput.style.height = Math.min(scrollH, 180) + 'px';
      this.chatInput.style.overflowY = scrollH > 180 ? 'auto' : 'hidden';

      // Slash command auto-suggestions
      const val = this.chatInput.value;
      if (val.startsWith('/')) {
        this.showSlashCommandMenu(val);
      } else {
        this.hideSlashCommandMenu();
      }
    });

    this.chatInput.addEventListener('keydown', (e) => {
      // Intercept navigation if slash command suggestions menu is open
      if (this.slashCommandMenu && this.slashCommandMenu.style.display !== 'none') {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          this.moveSlashCommandSelection(1);
          return;
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          this.moveSlashCommandSelection(-1);
          return;
        } else if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          this.executeActiveSlashCommand();
          return;
        } else if (e.key === 'Escape') {
          e.preventDefault();
          this.hideSlashCommandMenu();
          return;
        }
      }

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.hideSlashCommandMenu();
        this.handleSendMessage();
      }
    });

    // Close slash command menu on click outside
    document.addEventListener('click', (e) => {
      if (this.slashCommandMenu && this.slashCommandMenu.style.display !== 'none') {
        if (!this.slashCommandMenu.contains(e.target) && e.target !== this.chatInput) {
          this.hideSlashCommandMenu();
        }
      }
    });

    this.btnSend.addEventListener('click', () => {
      this.hideSlashCommandMenu();
      this.handleSendMessage();
    });

    // Extraction Engine selector near input box
    if (this.chatAiEngineSelect) {
      this.chatAiEngineSelect.addEventListener('change', (e) => {
        const newProvider = e.target.value;
        const currentSettings = Config.getSettings();
        currentSettings.aiProvider = newProvider;
        Config.saveSettings(currentSettings);

        if (this.selectAiProvider) {
          this.selectAiProvider.value = newProvider;
        }
        this.updateAiModelTag();

        const providerNames = {
          gemini: 'Google Gemini API (Recommended)',
          openai: 'OpenAI ChatGPT API',
          heuristic: 'Smart NLP Heuristics (Offline / Free)'
        };
        this.showToast(`Switched engine to ${providerNames[newProvider] || newProvider}`, 'info');

        if (newProvider === 'openai' && !currentSettings.openaiKey) {
          this.showToast('Note: If calling client directly, set your OpenAI key in Settings (⚙️)', 'info');
        }
      });
    }

    // Quick prompt pills
    document.querySelectorAll('.quick-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        const action = pill.getAttribute('data-action');
        if (action === 'store') {
          this.handleStoreCommand();
          return;
        } else if (action === 'compare') {
          this.handleCompareCommand('/compare');
          return;
        } else if (action === 'link') {
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
    if (this.btnHeaderSettings) this.btnHeaderSettings.addEventListener('click', openSettings);
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
      if (this.viewProfile) this.viewProfile.classList.remove('active');
      this.navTabChat.classList.add('active');
      this.navTabDashboard.classList.remove('active');
      if (this.navTabProfile) this.navTabProfile.classList.remove('active');
    } else if (viewName === 'profile') {
      this.viewChat.classList.remove('active');
      this.viewDashboard.classList.remove('active');
      if (this.viewProfile) this.viewProfile.classList.add('active');
      this.navTabChat.classList.remove('active');
      this.navTabDashboard.classList.remove('active');
      if (this.navTabProfile) this.navTabProfile.classList.add('active');
      this.renderProfileView();
    } else {
      this.viewChat.classList.remove('active');
      this.viewDashboard.classList.add('active');
      if (this.viewProfile) this.viewProfile.classList.remove('active');
      this.navTabChat.classList.remove('active');
      this.navTabDashboard.classList.add('active');
      if (this.navTabProfile) this.navTabProfile.classList.remove('active');
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
  // ==========================================
  // Slash Commands & Autocomplete Popup
  // ==========================================
  showSlashCommandMenu(inputText) {
    if (!this.slashCommandMenu) return;

    // Filter query without the leading slash
    const query = inputText.slice(1).trim().toLowerCase();

    if (!query) {
      this.currentFilteredCommands = [...SLASH_COMMANDS];
    } else {
      this.currentFilteredCommands = SLASH_COMMANDS.filter(cmd =>
        cmd.cmd.toLowerCase().includes(query) ||
        cmd.label.toLowerCase().includes(query) ||
        cmd.desc.toLowerCase().includes(query)
      );
    }

    if (this.currentFilteredCommands.length === 0) {
      this.hideSlashCommandMenu();
      return;
    }

    this.activeSlashCommandIndex = 0;
    this.renderSlashCommandMenu();
    this.slashCommandMenu.style.display = 'block';
  }

  hideSlashCommandMenu() {
    if (this.slashCommandMenu) {
      this.slashCommandMenu.style.display = 'none';
    }
  }

  renderSlashCommandMenu() {
    if (!this.slashMenuList) return;

    this.slashMenuList.innerHTML = this.currentFilteredCommands.map((cmd, idx) => `
      <div class="slash-item ${idx === this.activeSlashCommandIndex ? 'active' : ''}" data-index="${idx}">
        <span class="slash-item-icon">${cmd.icon}</span>
        <div class="slash-item-info">
          <div class="slash-item-top">
            <span class="slash-item-cmd">${cmd.cmd}</span>
            <span class="slash-item-label">${cmd.label}</span>
          </div>
          <div class="slash-item-desc">${cmd.desc}</div>
        </div>
        <span class="slash-item-enter">↵ Select</span>
      </div>
    `).join('');

    const items = this.slashMenuList.querySelectorAll('.slash-item');
    items.forEach(el => {
      el.addEventListener('mousedown', (e) => {
        e.preventDefault(); // prevent losing textarea focus
        const idx = parseInt(el.dataset.index, 10);
        this.activeSlashCommandIndex = idx;
        this.executeActiveSlashCommand();
      });
      el.addEventListener('mouseenter', () => {
        const idx = parseInt(el.dataset.index, 10);
        this.activeSlashCommandIndex = idx;
        this.updateSlashCommandHighlight();
      });
    });
  }

  moveSlashCommandSelection(delta) {
    if (!this.currentFilteredCommands.length) return;
    const len = this.currentFilteredCommands.length;
    this.activeSlashCommandIndex = (this.activeSlashCommandIndex + delta + len) % len;
    this.updateSlashCommandHighlight();
  }

  updateSlashCommandHighlight() {
    if (!this.slashMenuList) return;
    const items = this.slashMenuList.querySelectorAll('.slash-item');
    items.forEach((item, idx) => {
      if (idx === this.activeSlashCommandIndex) {
        item.classList.add('active');
        item.scrollIntoView({ block: 'nearest' });
      } else {
        item.classList.remove('active');
      }
    });
  }

  async executeActiveSlashCommand() {
    const selected = this.currentFilteredCommands[this.activeSlashCommandIndex];
    this.hideSlashCommandMenu();
    if (!selected) return;

    if (selected.action === 'store') {
      await this.handleStoreCommand();
    } else if (selected.action === 'compare') {
      await this.handleCompareCommand('/compare');
    } else if (selected.action === 'clear') {
      this.clearCurrentChat();
    } else if (selected.action === 'interview') {
      await this.handleStatusCommand('Interviewing');
    } else if (selected.action === 'offer') {
      await this.handleStatusCommand('Offer');
    } else if (selected.action === 'rejected') {
      await this.handleStatusCommand('Rejected');
    } else if (selected.action === 'salary') {
      this.chatInput.value = '/salary ';
      this.chatInput.focus();
    } else if (selected.action === 'help') {
      this.handleHelpCommand();
    }
  }

  handleHelpCommand() {
    this.chatInput.value = '';
    this.chatInput.style.height = 'auto';
    this.welcomeHero.style.display = 'none';

    const helpMsg = `💡 **Zuno Command Center & Shortcuts**\n\n` +
      `You can use slash commands anytime in the input box to rapidly manage your jobs:\n\n` +
      `• **/store** — Save the current drafted application to your Supabase Cloud database & Tracker\n` +
      `• **/compare [company]** — Compare your About Me profile (skills, projects, marks, certs) against company requirements\n` +
      `• **/interview** — Set status to **Interviewing** and get tailored interview prep checklists\n` +
      `• **/offer** — Set status to **Offer** and receive offer negotiation guidance\n` +
      `• **/rejected** — Set status to **Rejected** and update application records\n` +
      `• **/salary [amount]** — Set compensation (e.g. \`/salary $160,000\` or \`/salary 15 LPA\`)\n` +
      `• **/clear** — Clear current chat session\n` +
      `• **/help** — Show this command manual\n\n` +
      `*Pro tip: Just press \`/\` in the chat input to see all options with live search and arrow-key navigation!*`;

    this.appendAssistantMessage(helpMsg, this.activeApplication);
    this.scrollToBottom();
  }

  async handleStatusCommand(newStatus) {
    this.chatInput.value = '';
    this.chatInput.style.height = 'auto';

    if (!this.activeApplication || (!this.activeApplication.companyName && !this.activeApplication.roleTitle)) {
      this.appendAssistantMessage(
        `⚠️ **No active application selected.**\n\nPlease paste a Job Description (JD) or select an application from history before setting status to **${newStatus}**.`,
        null
      );
      this.scrollToBottom();
      return;
    }

    this.activeApplication.status = newStatus;
    if (this.activeApplication.isStored) {
      await SupabaseService.saveApplication(this.activeApplication);
      await this.loadApplications();
    }

    let statusMsg = '';
    if (newStatus === 'Interviewing') {
      statusMsg = `🎯 **Status Updated to Interviewing!**\n\n` +
        `Application for **${this.activeApplication.roleTitle}** at **${this.activeApplication.companyName}** is now marked as **Interviewing**.\n\n` +
        `**Zuno Interview Prep Checklist:**\n` +
        `1. **Core Skills to Review:** ${this.activeApplication.skills && this.activeApplication.skills.length ? this.activeApplication.skills.join(', ') : 'Primary tech stack & system design'}\n` +
        `2. **Behavioral Prep:** Practice 2-3 stories using the STAR method (Situation, Task, Action, Result).\n` +
        `3. **Company Intel:** Research **${this.activeApplication.companyName}**'s latest products and engineering culture.\n\n` +
        `Ask Zuno anytime if you'd like practice interview questions for this role!`;
    } else if (newStatus === 'Offer') {
      statusMsg = `🎉 **Congratulations on the Offer!**\n\n` +
        `Application for **${this.activeApplication.roleTitle}** at **${this.activeApplication.companyName}** is now marked as **Offer**.\n\n` +
        `**Zuno Offer Review Tips:**\n` +
        `• Current logged salary: **${this.activeApplication.salary || 'Not specified (type /salary [amount] to update)'}**\n` +
        `• Ensure you consider the full total rewards package: Base, Bonus, Equity/Stock Grants, and Benefits.\n` +
        `• Type **/salary [amount]** anytime if you want to record your finalized offer package.`;
    } else if (newStatus === 'Rejected') {
      statusMsg = `🛑 **Status Updated to Rejected**\n\n` +
        `Application for **${this.activeApplication.roleTitle}** at **${this.activeApplication.companyName}** is now logged as **Rejected**.\n\n` +
        `Stay resilient! Every application provides insights for the next one. Keep applying and tracking!`;
    }

    this.appendAssistantMessage(statusMsg, this.activeApplication);
    this.scrollToBottom();
    this.showToast(`Status updated to ${newStatus}`, 'success');
  }

  async handleSalaryCommand(text) {
    this.chatInput.value = '';
    this.chatInput.style.height = 'auto';

    if (!this.activeApplication || (!this.activeApplication.companyName && !this.activeApplication.roleTitle)) {
      this.appendAssistantMessage(
        `⚠️ **No active application selected.**\n\nPlease paste a Job Description (JD) or select an application from history before setting salary.`,
        null
      );
      this.scrollToBottom();
      return;
    }

    const cleanAmount = (text || '').replace(/^\/salary\s*/i, '').trim();
    if (!cleanAmount) {
      this.appendAssistantMessage(
        `💡 **Salary Command Usage:**\nType \`/salary [amount]\` (for example: \`/salary $145,000/yr\` or \`/salary 18 LPA\`).`,
        this.activeApplication
      );
      this.scrollToBottom();
      return;
    }

    this.activeApplication.salary = cleanAmount;
    if (this.activeApplication.isStored) {
      await SupabaseService.saveApplication(this.activeApplication);
      await this.loadApplications();
    }

    const salaryMsg = `💵 **Salary Updated!**\n\n` +
      `Updated compensation for **${this.activeApplication.roleTitle}** at **${this.activeApplication.companyName}** to **${cleanAmount}**.`;

    this.appendAssistantMessage(salaryMsg, this.activeApplication);
    this.scrollToBottom();
    this.showToast(`Salary updated to ${cleanAmount}`, 'success');
  }

  async handleCompareCommand(rawText = '/compare') {
    this.chatInput.value = '';
    this.chatInput.style.height = 'auto';
    this.chatInput.style.overflowY = 'hidden';
    this.welcomeHero.style.display = 'none';

    // Extract optional target argument, e.g. "/compare Stripe" or "/compare"
    const query = (rawText || '').replace(/^\/(?:compare|cmp)\s*/i, '').trim();

    // Identify target application
    let targetApp = this.activeApplication;
    if ((!targetApp || (!targetApp.companyName && !targetApp.roleTitle)) && this.applications && this.applications.length > 0) {
      if (query) {
        const q = query.toLowerCase();
        targetApp = this.applications.find(a =>
          (a.companyName && a.companyName.toLowerCase().includes(q)) ||
          (a.roleTitle && a.roleTitle.toLowerCase().includes(q))
        ) || this.applications[0];
      } else {
        targetApp = this.applications[0];
      }
    }

    if (!targetApp || (!targetApp.companyName && !targetApp.roleTitle)) {
      this.appendUserMessage(rawText || '/compare');
      this.appendAssistantMessage(
        `⚠️ **No active job application found to compare.**\n\n` +
        `To compare your **About Me** profile against company requirements:\n` +
        `1. Paste a **Job Description (JD)** in the chat or select an application from your **Applications Tracker**.\n` +
        `2. Type **/compare** to generate your full candidacy match audit!`,
        null
      );
      this.scrollToBottom();
      return;
    }

    // Ensure latest profile data is loaded
    if (!this.userProfile) {
      this.userProfile = await SupabaseService.getUserProfile();
    }

    const displayText = rawText || `/compare ${targetApp.companyName || ''}`;
    this.appendUserMessage(displayText);
    this.showAssistantTyping();

    try {
      const result = await AiExtractor.processInput(
        displayText,
        targetApp,
        this.chatMessages,
        this.applications,
        this.userProfile
      );

      this.removeAssistantTyping();
      this.appendAssistantMessage(result.message, targetApp);
      this.scrollToBottom();
      this.showToast(`Analyzed fit for ${targetApp.companyName || 'role'}!`, 'info');
    } catch (err) {
      this.removeAssistantTyping();
      this.appendAssistantMessage(`❌ **Comparison Error:** ${err.message}`, targetApp);
      this.scrollToBottom();
    }
  }

  clearCurrentChat() {
    this.chatMessages = [];
    if (this.activeApplication) {
      this.activeApplication.chatHistory = [];
      SupabaseService.saveApplication(this.activeApplication);
    }
    this.chatMessagesEl.innerHTML = '';
    this.chatMessagesEl.appendChild(this.welcomeHero);
    this.welcomeHero.style.display = 'flex';
    this.topbarSessionMeta.style.display = 'none';
    this.activeApplication = null;
    Config.setActiveSessionId(null);
    this.highlightActiveHistoryItem();
    this.chatInput.value = '';
    this.chatInput.style.height = 'auto';
    this.chatInput.style.overflowY = 'hidden';
    this.chatInput.focus();
    this.showToast('🧹 Chat cleared successfully', 'info');
  }

  async handleStoreCommand() {
    this.chatInput.value = '';
    this.chatInput.style.height = 'auto';

    if (!this.activeApplication || (!this.activeApplication.companyName && !this.activeApplication.roleTitle)) {
      this.appendAssistantMessage(
        "⚠️ **No active job application found to store.**\n\nTo store an application in your database:\n1. Paste a **Job Description (JD)**, job link, or company/role info.\n2. Add or refine any details in chat (e.g. *\"applied on 21 sept\"*, *\"applied through LinkedIn\"*).\n3. Type **/store** to save it to your database and Applications Tracker!",
        null
      );
      this.scrollToBottom();
      return;
    }

    // Mark as stored and record clean chat history
    this.activeApplication.isStored = true;
    this.activeApplication.chatHistory = this.chatMessages.map(m => ({
      role: m.role,
      text: m.text
    }));

    // Save to Supabase & local storage
    const saveRes = await SupabaseService.saveApplication(this.activeApplication);
    this.activeApplication = saveRes.data;
    this.activeApplication.isStored = true;
    Config.setActiveSessionId(this.activeApplication.id);

    // Refresh application tracker list & counter
    await this.loadApplications();
    this.highlightActiveHistoryItem();

    const storageLocation = saveRes.isRemote ? 'Supabase Cloud database' : 'local database';
    const storeMsg = `🎉 **Successfully stored in database!**\n\n` +
      `**${this.activeApplication.roleTitle}** at **${this.activeApplication.companyName}** is now permanently saved in your ${storageLocation} and added to your **Applications Tracker** dashboard.\n\n` +
      `• **Company:** ${this.activeApplication.companyName}\n` +
      `• **Role:** ${this.activeApplication.roleTitle}\n` +
      `• **Applied Date:** ${this.activeApplication.appliedDate || 'Today'}\n` +
      `• **Source:** ${this.activeApplication.source || 'Direct Portal'}\n` +
      `• **Salary:** ${this.activeApplication.salary || 'Not disclosed'}\n` +
      `• **Status:** ${this.activeApplication.status || 'Applied'}\n\n` +
      `You can view it anytime in the **Applications Tracker** dashboard above, or continue refining details right here in chat.`;

    this.appendAssistantMessage(storeMsg, this.activeApplication);
    this.scrollToBottom();
    this.showToast(`Saved to database (${storageLocation})!`, 'success');
  }

  async handleSendMessage() {
    const text = this.chatInput.value.trim();
    if (!text) return;

    // Slash command to clear chat
    const lower = text.toLowerCase();
    if (lower === '/clear' || lower === '/cls' || lower === '/reset' || lower.startsWith('/clear ')) {
      this.clearCurrentChat();
      return;
    }

    // Slash command to store currently drafted job in database
    if (lower === '/store' || lower === '/save' || lower.startsWith('/store ')) {
      await this.handleStoreCommand();
      return;
    }

    // Slash command to compare candidate profile vs company requirements
    if (lower === '/compare' || lower.startsWith('/compare ') || lower === '/cmp' || lower.startsWith('/cmp ')) {
      await this.handleCompareCommand(text);
      return;
    }

    // Slash command for help & shortcuts
    if (lower === '/help' || lower.startsWith('/help ')) {
      this.handleHelpCommand();
      return;
    }

    // Slash command to mark as interviewing
    if (lower === '/interview' || lower.startsWith('/interview ')) {
      await this.handleStatusCommand('Interviewing');
      return;
    }

    // Slash command to mark as offer received
    if (lower === '/offer' || lower.startsWith('/offer ')) {
      await this.handleStatusCommand('Offer');
      return;
    }

    // Slash command to mark as rejected
    if (lower === '/rejected' || lower === '/reject' || lower.startsWith('/rejected ')) {
      await this.handleStatusCommand('Rejected');
      return;
    }

    // Slash command to update salary
    if (lower.startsWith('/salary')) {
      await this.handleSalaryCommand(text);
      return;
    }

    if (this.isRecording) {
      this.stopVoiceDictation();
    }

    this.welcomeHero.style.display = 'none';
    this.appendUserMessage(text);
    this.chatInput.value = '';
    this.chatInput.style.height = 'auto';
    this.chatInput.style.overflowY = 'hidden';

    // Show AI thinking indicator
    const thinkingEl = this.appendThinkingIndicator();
    this.scrollToBottom();

    try {
      const result = await AiExtractor.processInput(
        text,
        this.activeApplication,
        this.chatMessages,
        this.applications,
        this.userProfile
      );

      thinkingEl.remove();

      if (result.profileUpdate) {
        await this.applyAiProfileUpdate(result.profileUpdate);
      }

      if (result.data) {
        // A job was created or updated in chat!
        const appData = {
          ...(this.activeApplication || {}),
          ...result.data,
          id: this.activeApplication?.id || crypto.randomUUID(),
          createdAt: this.activeApplication?.createdAt || new Date().toISOString(),
          isStored: this.activeApplication?.isStored ? true : false
        };

        this.activeApplication = appData;

        // If it was ALREADY stored in DB, keep DB synced with edits
        if (this.activeApplication.isStored) {
          const saveRes = await SupabaseService.saveApplication(this.activeApplication);
          this.activeApplication = saveRes.data;
          this.activeApplication.isStored = true;
          await this.loadApplications();
        }

        const promptHint = !this.activeApplication.isStored
          ? '\n\n💡 *Type `/store` or click **Store in DB** on the card to save this job to your database!*'
          : '';

        const assistantMsg = {
          role: 'assistant',
          text: result.message + promptHint,
          data: { ...this.activeApplication, chatHistory: [] }
        };

        this.chatMessages.push({ role: 'user', text });
        this.chatMessages.push(assistantMsg);
        this.activeApplication.chatHistory = this.chatMessages.map(m => ({ role: m.role, text: m.text }));

        // Render assistant bubble with extraction card
        this.appendAssistantMessage(assistantMsg.text, this.activeApplication);

        // Update UI
        this.topbarSessionMeta.style.display = 'flex';
        this.topbarCompany.textContent = this.activeApplication.companyName;
        this.topbarRole.textContent = this.activeApplication.roleTitle;

        this.scrollToBottom();
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
      <div class="msg-avatar">Zuno</div>
      <div class="msg-body">
        <div class="ai-thinking">
          <span>Zuno is analyzing Job Description & extracting data</span>
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
      <div class="msg-avatar">Zuno</div>
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
          <div style="display: flex; align-items: center; gap: 8px;">
            ${data.isStored ? `
              <span class="status-stored-badge" title="Stored in Database">✓ Saved in DB</span>
            ` : `
              <span class="status-draft-badge" title="Draft / Unsaved - Type /store to save">Draft • Unsaved</span>
            `}
            <span class="status-pill ${statusClass}">${data.status || 'Applied'}</span>
          </div>
        </div>

        <div class="card-meta-chips">
          <span class="meta-chip chip-salary">💰 <strong>${this.escapeHtml(data.salary || 'Not disclosed')}</strong></span>
          <span class="meta-chip chip-mode">🏢 <strong>${this.escapeHtml(data.workMode || 'On-site')}</strong></span>
          <span class="meta-chip">📍 ${this.escapeHtml(data.location || 'Not specified')}</span>
          <span class="meta-chip">💼 ${this.escapeHtml(data.jobType || 'Full-time')}</span>
          <span class="meta-chip chip-source">🌐 Source: <strong>${this.escapeHtml(data.source || 'Direct Portal')}</strong></span>
          <span class="meta-chip">📅 Applied: <strong>${this.escapeHtml(data.appliedDate || 'Today')}</strong> <em style="opacity: 0.85; font-size: 0.76rem;">(${this.formatDaysAgo(data.appliedDate)})</em></span>
        </div>

        ${skillsHtml}

        <div class="card-actions-row">
          <div class="card-external-links">
            ${linksHtml || '<span style="font-size: 0.78rem; color: var(--text-subtle);">No direct URLs detected yet. You can paste them in the chat.</span>'}
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            ${!data.isStored ? `
              <button class="btn btn-primary btn-sm btn-store-job" title="Save this application to database (/store)">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                <span>Store in DB (/store)</span>
              </button>
            ` : `
              <button class="btn btn-secondary btn-sm btn-store-job" title="Update in database (/store)">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                <span>Saved (Update /store)</span>
              </button>
            `}
            <button class="btn btn-secondary btn-sm btn-view-in-dash">
              <span>View in Tracker</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  bindCardEvents(msgDiv, jobData) {
    const btnView = msgDiv.querySelector('.btn-view-in-dash');
    if (btnView) {
      btnView.addEventListener('click', async () => {
        if (!this.activeApplication?.isStored) {
          await this.handleStoreCommand();
        }
        this.switchView('dashboard');
      });
    }

    const btnStore = msgDiv.querySelector('.btn-store-job');
    if (btnStore) {
      btnStore.addEventListener('click', async () => {
        await this.handleStoreCommand();
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
    let text = 'Model: Smart Heuristics (Offline)';
    if (settings.aiProvider === 'gemini') {
      text = 'Model: Google Gemini API';
    } else if (settings.aiProvider === 'openai') {
      text = 'Model: OpenAI ChatGPT API';
    }
    if (this.activeAiModelTag) this.activeAiModelTag.textContent = text;
    if (this.chatAiEngineSelect) this.chatAiEngineSelect.value = settings.aiProvider || 'gemini';
    if (this.selectAiProvider) this.selectAiProvider.value = settings.aiProvider || 'gemini';
  }

  // ==========================================
  // Sidebar Control
  // ==========================================
  closeSidebar() {
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
      if (this.sidebar) this.sidebar.classList.remove('open');
    } else {
      if (this.sidebar) this.sidebar.classList.add('collapsed');
      const app = document.getElementById('app');
      if (app) app.classList.add('sidebar-collapsed');
    }
  }

  openSidebar() {
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
      if (this.sidebar) this.sidebar.classList.add('open');
    } else {
      if (this.sidebar) this.sidebar.classList.remove('collapsed');
      const app = document.getElementById('app');
      if (app) app.classList.remove('sidebar-collapsed');
    }
  }

  toggleSidebar() {
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
      if (this.sidebar) this.sidebar.classList.toggle('open');
    } else {
      if (!this.sidebar) return;
      const isCollapsed = this.sidebar.classList.toggle('collapsed');
      const app = document.getElementById('app');
      if (app) app.classList.toggle('sidebar-collapsed', isCollapsed);
    }
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
  // Voice Dictation (Web Speech API) & Silence Auto-Stop
  // ==========================================
  startVoiceSilenceTimer() {
    this.clearVoiceSilenceTimer();
    this.voiceSilenceTimer = setTimeout(() => {
      if (this.isRecording) {
        this.stopVoiceDictation();
        this.showToast('🎙️ Mic auto-stopped after silence', 'info');
      }
    }, this.VOICE_SILENCE_TIMEOUT_MS);
  }

  resetVoiceSilenceTimer() {
    if (!this.isRecording) return;
    this.startVoiceSilenceTimer();
  }

  clearVoiceSilenceTimer() {
    if (this.voiceSilenceTimer) {
      clearTimeout(this.voiceSilenceTimer);
      this.voiceSilenceTimer = null;
    }
  }

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
      this.baseVoiceText = this.chatInput.value;
      this.btnVoiceDictate.classList.add('recording');
      this.btnVoiceDictate.title = 'Click to stop live voice transcription';
      this.voiceStatusBanner.style.display = 'flex';
      if (this.voiceStatusText) {
        this.voiceStatusText.textContent = 'Listening live... Speak now (auto-stops if silent for 12s)';
      }
      this.startVoiceSilenceTimer();
      this.showToast('🎙️ Live speech active — speak freely! (Auto-stops if silent)', 'info');
    };

    // Whenever user starts speaking sounds or words, reset the silence timer
    recognition.onspeechstart = () => {
      this.resetVoiceSilenceTimer();
    };

    recognition.onsoundstart = () => {
      this.resetVoiceSilenceTimer();
    };

    recognition.onresult = (event) => {
      // Some word was heard from the user -> reset timer!
      this.resetVoiceSilenceTimer();

      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = 0; i < event.results.length; ++i) {
        const item = event.results[i];
        if (item.isFinal) {
          finalTranscript += item[0].transcript + ' ';
        } else {
          interimTranscript += item[0].transcript;
        }
      }

      // Stream words live to the input box in real time
      const prefix = this.baseVoiceText ? this.baseVoiceText.trim() + ' ' : '';
      const liveText = (prefix + finalTranscript + interimTranscript).trim();

      this.chatInput.value = liveText;

      // Auto-grow input box smoothly
      this.chatInput.style.height = 'auto';
      const scrollH = this.chatInput.scrollHeight;
      this.chatInput.style.height = Math.min(scrollH, 180) + 'px';
      this.chatInput.style.overflowY = scrollH > 180 ? 'auto' : 'hidden';
      this.chatInput.scrollTop = this.chatInput.scrollHeight;

      // Update banner with real-time speech preview
      if (this.voiceStatusText) {
        if (interimTranscript.trim()) {
          this.voiceStatusText.textContent = `Speaking: "${interimTranscript.trim()}"`;
        } else {
          this.voiceStatusText.textContent = 'Listening live... Keep speaking (auto-stops if silent for 12s)';
        }
      }
    };

    recognition.onerror = (event) => {
      console.warn('Speech recognition error event:', event.error);
      if (event.error === 'no-speech') {
        // Natural pause, keep our silence countdown timer running
        return;
      }
      this.stopVoiceDictation();
      if (event.error === 'not-allowed') {
        this.showToast('Microphone permission blocked. Please allow mic in browser settings.', 'error');
      } else {
        this.showToast(`Microphone: ${event.error}`, 'error');
      }
    };

    recognition.onend = () => {
      // If user hasn't clicked stop and silence timer hasn't expired yet, keep listening
      if (this.isRecording) {
        try {
          this.baseVoiceText = this.chatInput.value;
          recognition.start();
        } catch (e) {
          this.stopVoiceDictation();
        }
      } else {
        this.stopVoiceDictation();
      }
    };

    return recognition;
  }

  toggleVoiceDictation() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      this.showToast('Voice dictation requires Google Chrome, Microsoft Edge, or a browser with Web Speech API.', 'error');
      return;
    }

    if (this.isRecording) {
      this.stopVoiceDictation();
      this.showToast('Voice dictation stopped.', 'info');
    } else {
      if (!this.speechRecognition) {
        this.speechRecognition = this.initSpeechRecognition();
      }
      if (this.speechRecognition) {
        try {
          this.baseVoiceText = this.chatInput.value;
          this.speechRecognition.start();
        } catch (e) {
          console.warn('Speech recognition start error:', e);
          this.stopVoiceDictation();
        }
      }
    }
  }

  stopVoiceDictation() {
    this.clearVoiceSilenceTimer();
    this.isRecording = false;
    if (this.speechRecognition) {
      try { this.speechRecognition.stop(); } catch (e) {}
    }
    this.baseVoiceText = this.chatInput.value;
    this.btnVoiceDictate.classList.remove('recording');
    this.btnVoiceDictate.title = 'Voice Dictation (Speak your JD)';
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
  // ==========================================
  // VIEW 3: Candidate Profile & "About Me"
  // ==========================================
  async loadUserProfile() {
    this.userProfile = await SupabaseService.getUserProfile();
    this.renderProfileView();
  }

  updateAvatarDisplay(url) {
    if (url && url.trim()) {
      this.profileAvatarImg.src = url.trim();
      this.profileAvatarImg.style.display = 'block';
      this.profileAvatarFallback.style.display = 'none';
    } else {
      this.profileAvatarImg.style.display = 'none';
      this.profileAvatarFallback.style.display = 'block';
    }
  }

  updateSemAvgDisplay() {
    if (!this.profSemAvgBadge) return;
    const scores = [];
    this.profSemInputs.forEach(input => {
      if (input && input.value) {
        const val = parseFloat(input.value.replace(/[^0-9.]/g, ''));
        if (!isNaN(val) && val > 0) scores.push(val);
      }
    });

    if (scores.length > 0) {
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      this.profSemAvgBadge.textContent = `Avg SGPA: ${avg.toFixed(2)}`;
      this.profSemAvgBadge.style.display = 'inline-block';
    } else {
      this.profSemAvgBadge.textContent = 'Avg: -';
    }
  }

  renderProfileView() {
    if (!this.userProfile) return;
    const p = this.userProfile;

    // Personal Details
    if (this.profFullName) this.profFullName.value = p.fullName || '';
    if (this.profHeadline) this.profHeadline.value = p.headline || '';
    if (this.profBio) this.profBio.value = p.bio || '';
    if (this.profEmail) this.profEmail.value = p.email || '';
    if (this.profPhone) this.profPhone.value = p.phone || '';
    if (this.profLocation) this.profLocation.value = p.location || '';
    if (this.profPortfolio) this.profPortfolio.value = p.portfolioUrl || '';
    if (this.profGithub) this.profGithub.value = p.githubUrl || '';
    if (this.profLinkedin) this.profLinkedin.value = p.linkedinUrl || '';
    if (this.profAvatarUrl) this.profAvatarUrl.value = p.avatarUrl || '';

    this.updateAvatarDisplay(p.avatarUrl);

    // 10th Standard
    const tenth = p.education?.tenth || {};
    if (this.prof10thSchool) this.prof10thSchool.value = tenth.schoolName || '';
    if (this.prof10thBoard) this.prof10thBoard.value = tenth.board || '';
    if (this.prof10thMarks) this.prof10thMarks.value = tenth.marks || '';
    if (this.prof10thYear) this.prof10thYear.value = tenth.year || '';

    // 12th Standard
    const twelfth = p.education?.twelfth || {};
    if (this.prof12thSchool) this.prof12thSchool.value = twelfth.schoolName || '';
    if (this.prof12thBoard) this.prof12thBoard.value = twelfth.board || '';
    if (this.prof12thMarks) this.prof12thMarks.value = twelfth.marks || '';
    if (this.prof12thYear) this.prof12thYear.value = twelfth.year || '';

    // Degree / College
    const college = p.education?.college || {};
    if (this.profCollegeName) this.profCollegeName.value = college.collegeName || '';
    if (this.profCollegeDegree) this.profCollegeDegree.value = college.degree || '';
    if (this.profCollegeBranch) this.profCollegeBranch.value = college.branch || '';
    if (this.profCollegeCgpa) this.profCollegeCgpa.value = college.overallCgpa || '';
    if (this.profCollegeGradYear) this.profCollegeGradYear.value = college.graduationYear || '';

    // Semester Marks
    const sMarks = college.semesterMarks || {};
    for (let i = 1; i <= 8; i++) {
      const input = document.getElementById(`profSem${i}`);
      if (input) input.value = sMarks[`sem${i}`] || '';
    }
    this.updateSemAvgDisplay();

    // Render Projects
    this.renderProjectsList();

    // Render Certifications
    this.renderCertificationsList();

    // Render Skills
    this.renderSkillsList();
  }

  renderProjectsList() {
    if (!this.projectsList) return;
    this.projectsList.innerHTML = '';
    const projects = this.userProfile?.projects || [];

    if (projects.length === 0) {
      this.projectsList.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 24px; text-align: center; color: var(--text-muted); background: rgba(255,255,255,0.02); border-radius: var(--radius-md); border: 1px dashed rgba(255,255,255,0.1);">
          <div style="font-size: 1.5rem; margin-bottom: 6px;">💻</div>
          <p style="font-weight: 600; color: var(--text-main);">No projects logged yet</p>
          <p style="font-size: 0.8rem; margin-top: 4px;">Click <strong>+ Add Project</strong> above or tell Zuno in chat: <em>"Add project: JobTracker with React, link https://..."</em></p>
        </div>
      `;
      return;
    }

    projects.forEach(proj => {
      const card = document.createElement('div');
      card.className = 'profile-project-card';

      const techTags = (proj.techStack || '').split(',').map(t => t.trim()).filter(Boolean);
      const tagsHtml = techTags.map(t => `<span class="proj-tech-tag">${this.escapeHtml(t)}</span>`).join('');

      card.innerHTML = `
        <div class="proj-top">
          <div>
            <h4 class="proj-title">${this.escapeHtml(proj.title)}</h4>
            <p class="proj-desc">${this.escapeHtml(proj.description || 'No description provided')}</p>
          </div>
          <button class="btn-icon btn-del-proj" title="Delete project" style="color: var(--text-subtle);">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>

        <div class="proj-tech-tags">
          ${tagsHtml}
        </div>

        <div class="proj-bottom">
          <div class="proj-dates">
            ${proj.finishDate ? `<span>✓ Done: <strong>${this.escapeHtml(proj.finishDate)}</strong></span>` : ''}
          </div>
          <div class="proj-actions">
            ${proj.projectUrl ? `
              <a href="${this.escapeHtml(proj.projectUrl)}" target="_blank" rel="noopener noreferrer" class="proj-link-btn">
                <span>View Project ↗</span>
              </a>
            ` : ''}
          </div>
        </div>
      `;

      const delBtn = card.querySelector('.btn-del-proj');
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteProject(proj.id);
      });

      this.projectsList.appendChild(card);
    });
  }

  renderCertificationsList() {
    if (!this.certificationsList) return;
    this.certificationsList.innerHTML = '';
    const certs = this.userProfile?.certifications || [];

    if (certs.length === 0) {
      this.certificationsList.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 24px; text-align: center; color: var(--text-muted); background: rgba(255,255,255,0.02); border-radius: var(--radius-md); border: 1px dashed rgba(255,255,255,0.1);">
          <div style="font-size: 1.5rem; margin-bottom: 6px;">📜</div>
          <p style="font-weight: 600; color: var(--text-main);">No certifications added yet</p>
          <p style="font-size: 0.8rem; margin-top: 4px;">Click <strong>+ Add Certification</strong> or tell Zuno: <em>"Add certification: AWS Solutions Architect from Amazon"</em></p>
        </div>
      `;
      return;
    }

    certs.forEach(cert => {
      const card = document.createElement('div');
      card.className = 'profile-cert-card';

      card.innerHTML = `
        <div class="cert-info">
          <span class="cert-name">${this.escapeHtml(cert.name)}</span>
          <span class="cert-issuer">🏛️ ${this.escapeHtml(cert.issuer || 'Verified')}</span>
          ${cert.issueDate ? `<span class="cert-date">📅 Issued: ${this.escapeHtml(cert.issueDate)}</span>` : ''}
          ${cert.credentialUrl ? `
            <a href="${this.escapeHtml(cert.credentialUrl)}" target="_blank" rel="noopener noreferrer" style="color: #38bdf8; font-size: 0.76rem; text-decoration: underline; margin-top: 4px;">
              Verify Credential ↗
            </a>
          ` : ''}
        </div>
        <button class="btn-icon btn-del-cert" title="Delete certification" style="color: var(--text-subtle);">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      `;

      const delBtn = card.querySelector('.btn-del-cert');
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteCert(cert.id);
      });

      this.certificationsList.appendChild(card);
    });
  }

  renderSkillsList() {
    if (!this.profileSkillsContainer) return;
    this.profileSkillsContainer.innerHTML = '';
    const skills = this.userProfile?.skills || [];

    skills.forEach(skill => {
      const pill = document.createElement('span');
      pill.className = 'profile-skill-pill';
      pill.innerHTML = `
        <span>${this.escapeHtml(skill)}</span>
        <button class="skill-remove-btn" title="Remove skill">&times;</button>
      `;

      const removeBtn = pill.querySelector('.skill-remove-btn');
      removeBtn.addEventListener('click', () => {
        this.removeSkill(skill);
      });

      this.profileSkillsContainer.appendChild(pill);
    });
  }

  async saveProfileManually() {
    if (!this.userProfile) {
      this.userProfile = Config.getUserProfile();
    }

    // Read form values
    this.userProfile.fullName = this.profFullName?.value?.trim() || '';
    this.userProfile.headline = this.profHeadline?.value?.trim() || '';
    this.userProfile.bio = this.profBio?.value?.trim() || '';
    this.userProfile.email = this.profEmail?.value?.trim() || '';
    this.userProfile.phone = this.profPhone?.value?.trim() || '';
    this.userProfile.location = this.profLocation?.value?.trim() || '';
    this.userProfile.portfolioUrl = this.profPortfolio?.value?.trim() || '';
    this.userProfile.githubUrl = this.profGithub?.value?.trim() || '';
    this.userProfile.linkedinUrl = this.profLinkedin?.value?.trim() || '';
    this.userProfile.avatarUrl = this.profAvatarUrl?.value?.trim() || this.userProfile.avatarUrl || '';

    // 10th
    this.userProfile.education = this.userProfile.education || {};
    this.userProfile.education.tenth = {
      schoolName: this.prof10thSchool?.value?.trim() || '',
      board: this.prof10thBoard?.value?.trim() || '',
      marks: this.prof10thMarks?.value?.trim() || '',
      year: this.prof10thYear?.value?.trim() || ''
    };

    // 12th
    this.userProfile.education.twelfth = {
      schoolName: this.prof12thSchool?.value?.trim() || '',
      board: this.prof12thBoard?.value?.trim() || '',
      marks: this.prof12thMarks?.value?.trim() || '',
      year: this.prof12thYear?.value?.trim() || ''
    };

    // College
    const sMarks = {};
    for (let i = 1; i <= 8; i++) {
      const val = document.getElementById(`profSem${i}`)?.value?.trim();
      if (val) sMarks[`sem${i}`] = val;
    }

    this.userProfile.education.college = {
      collegeName: this.profCollegeName?.value?.trim() || '',
      degree: this.profCollegeDegree?.value?.trim() || '',
      branch: this.profCollegeBranch?.value?.trim() || '',
      overallCgpa: this.profCollegeCgpa?.value?.trim() || '',
      graduationYear: this.profCollegeGradYear?.value?.trim() || '',
      semesterMarks: sMarks
    };

    const res = await SupabaseService.saveUserProfile(this.userProfile);
    this.showToast('Candidate profile and dossier saved successfully!', 'success');
  }

  async applyAiProfileUpdate(update) {
    if (!this.userProfile) {
      this.userProfile = Config.getUserProfile();
    }

    if (update.type === 'add_project' && update.project) {
      this.userProfile.projects = this.userProfile.projects || [];
      this.userProfile.projects.unshift(update.project);
    } else if (update.type === 'add_certification' && update.certification) {
      this.userProfile.certifications = this.userProfile.certifications || [];
      this.userProfile.certifications.unshift(update.certification);
    } else if (update.type === 'update_sem_marks' && update.sem) {
      if (!this.userProfile.education.college.semesterMarks) {
        this.userProfile.education.college.semesterMarks = {};
      }
      this.userProfile.education.college.semesterMarks[update.sem] = update.score;
    } else if (update.type === 'update_education_10th') {
      if (update.marks) this.userProfile.education.tenth.marks = update.marks;
      if (update.schoolName) this.userProfile.education.tenth.schoolName = update.schoolName;
      if (update.board) this.userProfile.education.tenth.board = update.board;
      if (update.year) this.userProfile.education.tenth.year = update.year;
    } else if (update.type === 'update_education_12th') {
      if (update.marks) this.userProfile.education.twelfth.marks = update.marks;
      if (update.schoolName) this.userProfile.education.twelfth.schoolName = update.schoolName;
      if (update.board) this.userProfile.education.twelfth.board = update.board;
      if (update.year) this.userProfile.education.twelfth.year = update.year;
    } else if (update.type === 'update_college') {
      if (update.collegeName) this.userProfile.education.college.collegeName = update.collegeName;
      if (update.degree) this.userProfile.education.college.degree = update.degree;
      if (update.branch) this.userProfile.education.college.branch = update.branch;
      if (update.overallCgpa) this.userProfile.education.college.overallCgpa = update.overallCgpa;
      if (update.graduationYear) this.userProfile.education.college.graduationYear = update.graduationYear;
    } else if (update.type === 'update_personal') {
      if (update.fullName) this.userProfile.fullName = update.fullName;
      if (update.headline) this.userProfile.headline = update.headline;
      if (update.bio) this.userProfile.bio = update.bio;
      if (update.email) this.userProfile.email = update.email;
      if (update.phone) this.userProfile.phone = update.phone;
      if (update.location) this.userProfile.location = update.location;
    } else if (update.type === 'add_skill' && update.skill) {
      this.userProfile.skills = this.userProfile.skills || [];
      if (!this.userProfile.skills.includes(update.skill)) {
        this.userProfile.skills.push(update.skill);
      }
    }

    await SupabaseService.saveUserProfile(this.userProfile);
    this.renderProfileView();
    this.showToast('Updated your About Me profile!', 'success');
  }

  // Project Modal Actions
  openProjectModal() {
    this.modalProjTitle.value = '';
    this.modalProjDesc.value = '';
    this.modalProjTech.value = '';
    this.modalProjLink.value = '';
    this.modalProjStartDate.value = '';
    this.modalProjFinishDate.value = new Date().toISOString().split('T')[0];
    this.projectModal.classList.add('open');
  }

  closeProjectModal() {
    this.projectModal.classList.remove('open');
  }

  async saveProjectFromModal() {
    const title = this.modalProjTitle.value.trim();
    if (!title) {
      alert('Please enter a Project Title');
      return;
    }

    const newProj = {
      id: 'proj_' + Date.now(),
      title,
      description: this.modalProjDesc.value.trim(),
      techStack: this.modalProjTech.value.trim(),
      projectUrl: this.modalProjLink.value.trim(),
      startDate: this.modalProjStartDate.value || '',
      finishDate: this.modalProjFinishDate.value || ''
    };

    this.userProfile.projects = this.userProfile.projects || [];
    this.userProfile.projects.unshift(newProj);
    await SupabaseService.saveUserProfile(this.userProfile);

    this.renderProjectsList();
    this.closeProjectModal();
    this.showToast(`Added project "${title}"!`, 'success');
  }

  async deleteProject(id) {
    if (confirm('Are you sure you want to delete this project?')) {
      this.userProfile.projects = (this.userProfile.projects || []).filter(p => p.id !== id);
      await SupabaseService.saveUserProfile(this.userProfile);
      this.renderProjectsList();
      this.showToast('Project removed', 'info');
    }
  }

  // Cert Modal Actions
  openCertModal() {
    this.modalCertName.value = '';
    this.modalCertIssuer.value = '';
    this.modalCertDate.value = new Date().toISOString().split('T')[0];
    this.modalCertLink.value = '';
    this.certModal.classList.add('open');
  }

  closeCertModal() {
    this.certModal.classList.remove('open');
  }

  async saveCertFromModal() {
    const name = this.modalCertName.value.trim();
    if (!name) {
      alert('Please enter Certificate Name');
      return;
    }

    const newCert = {
      id: 'cert_' + Date.now(),
      name,
      issuer: this.modalCertIssuer.value.trim() || 'Verified Org',
      issueDate: this.modalCertDate.value || '',
      credentialUrl: this.modalCertLink.value.trim()
    };

    this.userProfile.certifications = this.userProfile.certifications || [];
    this.userProfile.certifications.unshift(newCert);
    await SupabaseService.saveUserProfile(this.userProfile);

    this.renderCertificationsList();
    this.closeCertModal();
    this.showToast(`Added certification "${name}"!`, 'success');
  }

  async deleteCert(id) {
    if (confirm('Are you sure you want to delete this certification?')) {
      this.userProfile.certifications = (this.userProfile.certifications || []).filter(c => c.id !== id);
      await SupabaseService.saveUserProfile(this.userProfile);
      this.renderCertificationsList();
      this.showToast('Certification removed', 'info');
    }
  }

  async addSkill(skill) {
    this.userProfile.skills = this.userProfile.skills || [];
    if (!this.userProfile.skills.includes(skill)) {
      this.userProfile.skills.push(skill);
      await SupabaseService.saveUserProfile(this.userProfile);
      this.renderSkillsList();
    }
  }

  async removeSkill(skill) {
    this.userProfile.skills = (this.userProfile.skills || []).filter(s => s !== skill);
    await SupabaseService.saveUserProfile(this.userProfile);
    this.renderSkillsList();
  }
}

// Instantiate app on load
window.addEventListener('DOMContentLoaded', () => {
  const app = new JobTrackerApp();
  app.init();
});
