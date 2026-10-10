// JobTrackerAI - Main Application Controller
import { Config } from './config.js';
import { SupabaseService } from './supabase-client.js';
import { AiExtractor } from './ai-extractor.js';

// Interactive Slash Commands for Zuno
const SLASH_COMMANDS = [
  {
    cmd: '/new',
    label: 'Start New Chat',
    desc: 'Start a fresh application chat session & reset active conversation',
    icon: '✨',
    action: 'new'
  },
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
    cmd: '/search',
    label: 'Search Stored Applications',
    desc: 'Search all stored applications in your database by company, role, skill, status, location, or salary',
    icon: '🔍',
    action: 'search'
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

    // Theme Switcher (Animated Day/Night Switch)
    this.themeToggleInput = document.getElementById('toggle');
    this.themeToggleButton = document.getElementById('theme-toggle-button');
    this.currentTheme = Config.getTheme();

    // Sidebar
    this.sidebar = document.getElementById('sidebar');
    this.btnToggleSidebar = document.getElementById('btnToggleSidebar');
    this.brandIconCollapse = document.getElementById('brandIconCollapse');
    this.btnSidebarDashboard = document.getElementById('btnSidebarDashboard');
    this.btnNewChat = document.getElementById('btnNewChat');
    this.sidebarSearchInput = document.getElementById('sidebarSearchInput');
    this.historyList = document.getElementById('historyList');
    this.cloudStatusBadge = document.getElementById('cloudStatusBadge');
    this.cloudStatusDot = this.cloudStatusBadge.querySelector('.status-dot');
    this.cloudStatusText = document.getElementById('cloudStatusText');
    this.sidebarBackdrop = document.getElementById('sidebarBackdrop');
    this.btnCloseSidebarMobile = document.getElementById('btnCloseSidebarMobile');

    // Sidebar Activity Dashboard
    this.sidebarDashboardWidget = document.getElementById('sidebarDashboardWidget');
    this.sidebarDateFilter = document.getElementById('sidebarDateFilter');
    this.btnClearDateFilter = document.getElementById('btnClearDateFilter');
    this.btnSDashAll = document.getElementById('btnSDashAll');
    this.btnSDashToday = document.getElementById('btnSDashToday');
    this.sStatAppliedCount = document.getElementById('sStatAppliedCount');
    this.sStatAppliedLabel = document.getElementById('sStatAppliedLabel');
    this.sStatCallsCount = document.getElementById('sStatCallsCount');
    this.sStatPendingCount = document.getElementById('sStatPendingCount');
    this.sStatRejectedCount = document.getElementById('sStatRejectedCount');
    this.sStatCallRate = document.getElementById('sStatCallRate');
    this.sStatCallProgress = document.getElementById('sStatCallProgress');
    this.sStatCardApplied = document.getElementById('sStatCardApplied');
    this.sStatCardCalls = document.getElementById('sStatCardCalls');
    this.sStatCardPending = document.getElementById('sStatCardPending');
    this.sStatCardRejected = document.getElementById('sStatCardRejected');
    this.activeSidebarDate = null;

    // Chat UI
    this.chatViewport = document.getElementById('chatViewport');
    this.chatMessagesEl = document.getElementById('chatMessages');
    this.welcomeHero = document.getElementById('welcomeHero');
    this.chatInput = document.getElementById('chatInput');
    this.btnSend = document.getElementById('btnSend');
    this.topbarSessionMeta = document.getElementById('topbarSessionMeta');
    this.topbarCompany = document.getElementById('topbarCompany');
    this.topbarRole = document.getElementById('topbarRole');
    this.topbarLiveClock = document.getElementById('topbarLiveClock');
    this.liveDateText = document.getElementById('liveDateText');
    this.liveTimeText = document.getElementById('liveTimeText');
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

    // Daily Applications Line Chart
    this.dashChartSection = document.getElementById('dashChartSection');
    this.dailyAppsSvg = document.getElementById('dailyAppsSvg');
    this.dashChartCanvasWrap = document.getElementById('dashChartCanvasWrap');
    this.chartHoverTooltip = document.getElementById('chartHoverTooltip');
    this.chartRangeButtons = document.querySelectorAll('.chart-range-btn');
    this.chartPeakDayVal = document.getElementById('chartPeakDayVal');
    this.chartAvgDailyVal = document.getElementById('chartAvgDailyVal');
    this.chartTodayCountVal = document.getElementById('chartTodayCountVal');
    this.chartMostActiveDayVal = document.getElementById('chartMostActiveDayVal');
    this.currentChartRange = '7';

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
    this.applyTheme(this.currentTheme);
    this.startLiveClock();
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

  startLiveClock() {
    const update = () => {
      const now = new Date();
      if (this.liveDateText) {
        this.liveDateText.textContent = now.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric'
        });
      }
      if (this.liveTimeText) {
        this.liveTimeText.textContent = now.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        });
      }
    };

    update();
    if (this._clockInterval) clearInterval(this._clockInterval);
    this._clockInterval = setInterval(update, 1000);
  }

  formatMessageTime(isoOrTimestamp) {
    if (!isoOrTimestamp) {
      isoOrTimestamp = new Date();
    }
    const d = new Date(isoOrTimestamp);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  formatTimeOnly(isoOrTimestamp) {
    if (!isoOrTimestamp) return '';
    const d = new Date(isoOrTimestamp);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
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

    // Theme Toggle
    if (this.themeToggleInput) {
      this.themeToggleInput.addEventListener('change', (e) => {
        const nextTheme = e.target.checked ? 'dark' : 'light';
        this.applyTheme(nextTheme);
        this.showToast(`Switched to ${nextTheme === 'light' ? 'Dull Light' : 'Dark'} theme`, 'info');
      });
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

    // Real-time synchronization of all About Me inputs to memory & storage
    const allProfileFormInputs = [
      this.profFullName, this.profHeadline, this.profBio, this.profEmail, this.profPhone,
      this.profLocation, this.profPortfolio, this.profGithub, this.profLinkedin,
      this.prof10thSchool, this.prof10thBoard, this.prof10thMarks, this.prof10thYear,
      this.prof12thSchool, this.prof12thBoard, this.prof12thMarks, this.prof12thYear,
      this.profCollegeName, this.profCollegeDegree, this.profCollegeBranch, this.profCollegeCgpa, this.profCollegeGradYear,
      ...this.profSemInputs
    ];

    let profileAutoSyncTimer = null;
    allProfileFormInputs.forEach(inp => {
      if (inp) {
        inp.addEventListener('input', () => {
          this.getEffectiveUserProfile();
          clearTimeout(profileAutoSyncTimer);
          profileAutoSyncTimer = setTimeout(() => {
            SupabaseService.saveUserProfile(this.userProfile);
          }, 800);
        });
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

    // Sidebar Navigation
    if (this.btnSidebarDashboard) {
      this.btnSidebarDashboard.addEventListener('click', () => {
        this.switchView('dashboard');
        if (window.innerWidth <= 768) {
          this.closeSidebar();
        }
      });
    }
    this.btnNewChat.addEventListener('click', () => this.startNewChatSession());
    this.sidebarSearchInput.addEventListener('input', (e) => this.filterHistoryList(e.target.value));
    if (this.btnToggleSidebar) {
      this.btnToggleSidebar.addEventListener('click', () => this.toggleSidebar());
    }
    if (this.brandIconCollapse) {
      this.brandIconCollapse.addEventListener('click', () => this.closeSidebar());
    }
    if (this.btnCloseSidebarMobile) {
      this.btnCloseSidebarMobile.addEventListener('click', () => this.closeSidebar());
    }
    if (this.sidebarBackdrop) {
      this.sidebarBackdrop.addEventListener('click', () => this.closeSidebar());
    }

    // Dashboard Analytics Banner Events
    if (this.sidebarDateFilter) {
      this.sidebarDateFilter.addEventListener('change', (e) => {
        this.activeSidebarDate = e.target.value || null;
        this.updateSidebarDatePresetUi();
        this.updateSidebarDashboard();
        this.renderApplicationsGrid();
      });
    }

    if (this.btnSDashAll) {
      this.btnSDashAll.addEventListener('click', () => {
        this.activeSidebarDate = null;
        if (this.sidebarDateFilter) this.sidebarDateFilter.value = '';
        this.updateSidebarDatePresetUi();
        this.updateSidebarDashboard();
        this.renderApplicationsGrid();
      });
    }

    if (this.btnSDashToday) {
      this.btnSDashToday.addEventListener('click', () => {
        const todayStr = new Date().toISOString().split('T')[0];
        this.activeSidebarDate = todayStr;
        if (this.sidebarDateFilter) this.sidebarDateFilter.value = todayStr;
        this.updateSidebarDatePresetUi();
        this.updateSidebarDashboard();
        this.renderApplicationsGrid();
      });
    }

    if (this.btnClearDateFilter) {
      this.btnClearDateFilter.addEventListener('click', () => {
        this.activeSidebarDate = null;
        if (this.sidebarDateFilter) this.sidebarDateFilter.value = '';
        this.updateSidebarDatePresetUi();
        this.updateSidebarDashboard();
        this.renderApplicationsGrid();
      });
    }

    // Chart Range Selector
    if (this.chartRangeButtons && this.chartRangeButtons.length > 0) {
      this.chartRangeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          this.chartRangeButtons.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.currentChartRange = btn.getAttribute('data-range') || '7';
          this.renderDailyLineChart();
        });
      });
    }

    // Interactive card clicks to navigate and filter
    const resetActiveMetricCards = () => {
      [this.sStatCardApplied, this.sStatCardCalls, this.sStatCardPending, this.sStatCardRejected].forEach(c => {
        if (c) c.classList.remove('active');
      });
    };

    if (this.sStatCardApplied) {
      this.sStatCardApplied.addEventListener('click', () => {
        this.switchView('dashboard');
        resetActiveMetricCards();
        this.sStatCardApplied.classList.add('active');
        if (this.filterStatus) this.filterStatus.value = 'all';
        this.currentFilterStatus = 'all';
        this.renderApplicationsGrid();
      });
    }

    if (this.sStatCardCalls) {
      this.sStatCardCalls.addEventListener('click', () => {
        this.switchView('dashboard');
        resetActiveMetricCards();
        this.sStatCardCalls.classList.add('active');
        if (this.filterStatus) this.filterStatus.value = 'all';
        this.currentFilterStatus = 'Calls';
        this.renderApplicationsGrid();
      });
    }

    if (this.sStatCardPending) {
      this.sStatCardPending.addEventListener('click', () => {
        this.switchView('dashboard');
        resetActiveMetricCards();
        this.sStatCardPending.classList.add('active');
        if (this.filterStatus) this.filterStatus.value = 'Applied';
        this.currentFilterStatus = 'Applied';
        this.renderApplicationsGrid();
      });
    }

    if (this.sStatCardRejected) {
      this.sStatCardRejected.addEventListener('click', () => {
        this.switchView('dashboard');
        resetActiveMetricCards();
        this.sStatCardRejected.classList.add('active');
        if (this.filterStatus) this.filterStatus.value = 'Rejected';
        this.currentFilterStatus = 'Rejected';
        this.renderApplicationsGrid();
      });
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
        } else if (action === 'search') {
          this.chatInput.value = '/search ';
          this.chatInput.focus();
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
      [this.sStatCardApplied, this.sStatCardCalls, this.sStatCardPending, this.sStatCardRejected].forEach(c => {
        if (c) c.classList.remove('active');
      });
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
  // Theme Switching (Dark & Dull Light)
  // ==========================================
  applyTheme(theme) {
    this.currentTheme = theme === 'light' ? 'light' : 'dark';
    if (this.currentTheme === 'light') {
      document.body.classList.remove('theme-dark');
      document.body.classList.add('theme-light');
      if (this.themeToggleInput) this.themeToggleInput.checked = false;
      if (this.themeToggleButton) this.themeToggleButton.setAttribute('title', 'Switch to Dark Theme');
    } else {
      document.body.classList.remove('theme-light');
      document.body.classList.add('theme-dark');
      if (this.themeToggleInput) this.themeToggleInput.checked = true;
      if (this.themeToggleButton) this.themeToggleButton.setAttribute('title', 'Switch to Dull Light Theme');
    }
    Config.setTheme(this.currentTheme);
  }

  toggleTheme() {
    const nextTheme = this.currentTheme === 'light' ? 'dark' : 'light';
    this.applyTheme(nextTheme);
    this.showToast(`Switched to ${nextTheme === 'light' ? 'Dull Light' : 'Dark'} theme`, 'info');
  }

  // ==========================================
  // View Navigation
  // ==========================================
  switchView(viewName) {
    this.activeView = viewName;
    if (this.btnSidebarDashboard) {
      this.btnSidebarDashboard.classList.toggle('active', viewName === 'dashboard');
    }
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
      this.updateSidebarDashboard();
      this.renderApplicationsGrid();
    }
    if (window.innerWidth <= 768) {
      this.closeSidebar();
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
    if (this.totalAppsBadge) {
      this.totalAppsBadge.textContent = this.applications.length;
    }
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
    if (this.totalAppsBadge) {
      this.totalAppsBadge.textContent = total;
    }
    this.updateSidebarDashboard();
  }

  updateSidebarDatePresetUi() {
    const todayStr = new Date().toISOString().split('T')[0];
    if (this.btnSDashAll) {
      this.btnSDashAll.classList.toggle('active', !this.activeSidebarDate);
    }
    if (this.btnSDashToday) {
      this.btnSDashToday.classList.toggle('active', this.activeSidebarDate === todayStr);
    }
    if (this.btnClearDateFilter) {
      this.btnClearDateFilter.style.display = this.activeSidebarDate ? 'inline-flex' : 'none';
    }
  }

  updateSidebarDashboard() {
    if (!this.sStatAppliedCount) return;

    let list = this.applications || [];
    if (this.activeSidebarDate) {
      list = list.filter(a => {
        const appDate = a.appliedDate || (a.createdAt ? a.createdAt.split('T')[0] : '');
        return appDate === this.activeSidebarDate;
      });
      if (this.sStatAppliedLabel) {
        const parts = this.activeSidebarDate.split('-');
        if (parts.length === 3) {
          const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
          const formatted = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          this.sStatAppliedLabel.textContent = `On ${formatted}`;
        } else {
          this.sStatAppliedLabel.textContent = 'Selected Date';
        }
      }
    } else {
      if (this.sStatAppliedLabel) {
        this.sStatAppliedLabel.textContent = 'Total Applied';
      }
    }

    const totalApplied = list.length;
    const gotCalls = list.filter(a => {
      const s = (a.status || '').toLowerCase();
      return s === 'interviewing' || s === 'offer';
    }).length;

    const noCallYet = list.filter(a => {
      const s = (a.status || '').toLowerCase();
      return s === 'applied' || s === 'draft';
    }).length;

    const rejected = list.filter(a => {
      const s = (a.status || '').toLowerCase();
      return s === 'rejected';
    }).length;

    const rate = totalApplied > 0 ? Math.round((gotCalls / totalApplied) * 100) : 0;

    if (this.sStatAppliedCount) this.sStatAppliedCount.textContent = totalApplied;
    if (this.sStatCallsCount) this.sStatCallsCount.textContent = gotCalls;
    if (this.sStatPendingCount) this.sStatPendingCount.textContent = noCallYet;
    if (this.sStatRejectedCount) this.sStatRejectedCount.textContent = rejected;
    if (this.sStatCallRate) this.sStatCallRate.textContent = `${rate}%`;
    if (this.sStatCallProgress) this.sStatCallProgress.style.width = `${rate}%`;

    // Render Daily Applications Line Chart
    this.renderDailyLineChart();
  }

  // ==========================================
  // Daily Applications Velocity Line Chart
  // ==========================================
  renderDailyLineChart() {
    if (!this.dailyAppsSvg) return;

    const apps = this.applications || [];

    // 1. Group applications by date (YYYY-MM-DD)
    const dateAppsMap = {};
    for (const a of apps) {
      const dateKey = a.appliedDate || (a.createdAt ? a.createdAt.split('T')[0] : '');
      if (dateKey) {
        if (!dateAppsMap[dateKey]) dateAppsMap[dateKey] = [];
        dateAppsMap[dateKey].push(a);
      }
    }

    // 2. Build continuous timeline based on currentChartRange ('7', '14', '30', 'all')
    const daysData = [];
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (this.currentChartRange === 'all') {
      const recordedDates = Object.keys(dateAppsMap).sort();
      let startDate = null;
      const endDate = new Date(now);

      if (recordedDates.length > 0) {
        const parts = recordedDates[0].split('-');
        if (parts.length === 3) {
          startDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        } else {
          startDate = new Date(now);
          startDate.setDate(startDate.getDate() - 13);
        }
      } else {
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 6);
      }

      // Cap at 60 days to prevent excessive clutter
      const dayDiff = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24));
      if (dayDiff > 60) {
        startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 60);
      }

      const cur = new Date(startDate);
      while (cur <= endDate) {
        const dStr = cur.toISOString().split('T')[0];
        const dayApps = dateAppsMap[dStr] || [];
        daysData.push({
          dateStr: dStr,
          label: cur.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          count: dayApps.length,
          apps: dayApps
        });
        cur.setDate(cur.getDate() + 1);
      }
    } else {
      const numDays = parseInt(this.currentChartRange, 10) || 7;
      for (let i = numDays - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dStr = d.toISOString().split('T')[0];
        const dayApps = dateAppsMap[dStr] || [];
        daysData.push({
          dateStr: dStr,
          label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          count: dayApps.length,
          apps: dayApps
        });
      }
    }

    if (daysData.length === 0) {
      this.dailyAppsSvg.innerHTML = `
        <text x="400" y="120" text-anchor="middle" fill="var(--text-subtle)" font-size="13">
          No application timeline data available.
        </text>
      `;
      return;
    }

    // Compute metrics
    let peakCount = 0;
    let peakDateLabel = '-';
    let totalInRange = 0;
    let todayCount = 0;

    daysData.forEach(d => {
      totalInRange += d.count;
      if (d.count > peakCount) {
        peakCount = d.count;
        peakDateLabel = d.label;
      }
      if (d.dateStr === todayStr) {
        todayCount = d.count;
      }
    });

    const avgDaily = (totalInRange / daysData.length).toFixed(1);

    if (this.chartPeakDayVal) this.chartPeakDayVal.textContent = `${peakCount} ${peakCount === 1 ? 'app' : 'apps'}`;
    if (this.chartAvgDailyVal) this.chartAvgDailyVal.textContent = `${avgDaily} / day`;
    if (this.chartTodayCountVal) this.chartTodayCountVal.textContent = `${todayCount} ${todayCount === 1 ? 'app' : 'apps'}`;
    if (this.chartMostActiveDayVal) this.chartMostActiveDayVal.textContent = peakCount > 0 ? `${peakDateLabel} (${peakCount})` : 'None';

    // SVG Layout parameters
    const svgW = 800;
    const svgH = 240;
    const padL = 46;
    const padR = 36;
    const padT = 30;
    const padB = 44;
    const chartW = svgW - padL - padR;
    const chartH = svgH - padT - padB;

    const maxVal = Math.max(3, peakCount);

    // Y-Axis Gridlines
    const ySteps = 3;
    let gridHtml = '';
    for (let s = 0; s <= ySteps; s++) {
      const val = Math.round((maxVal / ySteps) * s);
      const yPos = padT + chartH - (val / maxVal) * chartH;
      gridHtml += `
        <line x1="${padL}" y1="${yPos.toFixed(1)}" x2="${(padL + chartW).toFixed(1)}" y2="${yPos.toFixed(1)}" class="chart-gridline" />
        <text x="${(padL - 10).toFixed(1)}" y="${(yPos + 4).toFixed(1)}" text-anchor="end" class="chart-axis-text">${val}</text>
      `;
    }

    // Points Coordinates
    const N = daysData.length;
    const points = daysData.map((d, i) => {
      const x = N === 1 ? padL + chartW / 2 : padL + (i / (N - 1)) * chartW;
      const y = padT + chartH - (d.count / maxVal) * chartH;
      return { x, y, ...d };
    });

    // Bézier Spline
    let curvePath = '';
    if (points.length === 1) {
      curvePath = `M ${points[0].x} ${points[0].y}`;
    } else {
      curvePath = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
      for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i === 0 ? 0 : i - 1];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[i + 2] || p2;

        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = p1.y + (p2.y - p0.y) / 6;
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = p2.y - (p3.y - p1.y) / 6;

        curvePath += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
      }
    }

    const bottomY = padT + chartH;
    const areaPath = `${curvePath} L ${points[points.length - 1].x.toFixed(1)} ${bottomY} L ${points[0].x.toFixed(1)} ${bottomY} Z`;

    // X-Axis Labels
    const stepInterval = N > 18 ? (N > 30 ? 4 : 2) : 1;
    let xLabelsHtml = '';
    points.forEach((p, i) => {
      if (i % stepInterval === 0 || i === N - 1) {
        xLabelsHtml += `
          <text x="${p.x.toFixed(1)}" y="${bottomY + 22}" text-anchor="middle" class="chart-axis-text">
            ${p.label}
          </text>
        `;
      }
    });

    // Dots and interactive column hit areas
    const colWidth = N > 1 ? chartW / (N - 1) : chartW;
    let interactiveHtml = '';

    points.forEach((p, i) => {
      const colX = Math.max(0, p.x - colWidth / 2);
      const isToday = p.dateStr === todayStr;
      const dotR = p.count > 0 ? (isToday ? 7 : 5.5) : 3.5;
      const dotFill = p.count > 0 ? '#38bdf8' : 'rgba(255,255,255,0.2)';
      const dotStroke = p.count > 0 ? '#ffffff' : 'rgba(255,255,255,0.4)';

      interactiveHtml += `
        <rect class="chart-col-rect" x="${colX.toFixed(1)}" y="${padT}" width="${colWidth.toFixed(1)}" height="${(chartH + 20).toFixed(1)}" data-idx="${i}" />
        <circle class="chart-dot" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${dotR}" fill="${dotFill}" stroke="${dotStroke}" stroke-width="${p.count > 0 ? 2.5 : 1.5}" data-idx="${i}" />
      `;
    });

    // Assemble SVG
    this.dailyAppsSvg.innerHTML = `
      <defs>
        <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.32" />
          <stop offset="60%" stop-color="#6366f1" stop-opacity="0.08" />
          <stop offset="100%" stop-color="#6366f1" stop-opacity="0.0" />
        </linearGradient>
        <linearGradient id="lineStrokeGradient" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#38bdf8" />
          <stop offset="50%" stop-color="#818cf8" />
          <stop offset="100%" stop-color="#c084fc" />
        </linearGradient>
      </defs>
      ${gridHtml}
      <path d="${areaPath}" fill="url(#areaGradient)" />
      <path d="${curvePath}" fill="none" stroke="url(#lineStrokeGradient)" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" />
      ${xLabelsHtml}
      ${interactiveHtml}
    `;

    this.bindChartInteractions(points);
  }

  bindChartInteractions(points) {
    if (!this.dailyAppsSvg || !this.chartHoverTooltip || !this.dashChartCanvasWrap) return;

    const tooltip = this.chartHoverTooltip;

    const showTooltipForIndex = (idx, clientX, clientY) => {
      const p = points[idx];
      if (!p) return;

      const companyList = p.apps && p.apps.length > 0
        ? p.apps.map(a => a.companyName || 'Company').slice(0, 3).join(', ') + (p.apps.length > 3 ? ` +${p.apps.length - 3} more` : '')
        : 'None';

      tooltip.innerHTML = `
        <div class="tooltip-date">📅 ${p.label} (${p.dateStr})</div>
        <div class="tooltip-count">🚀 ${p.count} ${p.count === 1 ? 'application' : 'applications'}</div>
        <div class="tooltip-companies">🏢 ${this.escapeHtml(companyList)}</div>
        <div class="tooltip-action">👆 Click to filter table</div>
      `;

      tooltip.style.display = 'flex';

      const containerRect = this.dashChartCanvasWrap.getBoundingClientRect();
      const left = clientX - containerRect.left;
      const top = clientY - containerRect.top;

      tooltip.style.left = `${Math.max(70, Math.min(containerRect.width - 70, left))}px`;
      tooltip.style.top = `${Math.max(10, top)}px`;
    };

    const hideTooltip = () => {
      tooltip.style.display = 'none';
    };

    const handleSelectDate = (idx) => {
      const p = points[idx];
      if (!p) return;
      this.activeSidebarDate = p.dateStr;
      if (this.sidebarDateFilter) this.sidebarDateFilter.value = p.dateStr;
      this.updateSidebarDatePresetUi();
      this.updateSidebarDashboard();
      this.renderApplicationsGrid();

      if (this.applicationsGrid) {
        this.applicationsGrid.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
      this.showToast(`Filtered applications for ${p.label} (${p.count} jobs)`, 'info');
    };

    const hitElements = this.dailyAppsSvg.querySelectorAll('.chart-col-rect, .chart-dot');
    hitElements.forEach(el => {
      el.addEventListener('mouseenter', (e) => {
        const idx = parseInt(el.getAttribute('data-idx'), 10);
        showTooltipForIndex(idx, e.clientX, e.clientY);
      });
      el.addEventListener('mousemove', (e) => {
        const idx = parseInt(el.getAttribute('data-idx'), 10);
        showTooltipForIndex(idx, e.clientX, e.clientY);
      });
      el.addEventListener('mouseleave', hideTooltip);
      el.addEventListener('click', () => {
        const idx = parseInt(el.getAttribute('data-idx'), 10);
        handleSelectDate(idx);
      });
    });

    this.dailyAppsSvg.addEventListener('mouseleave', hideTooltip);
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
    this.activeApplication = { ...app, isStored: true };
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
          this.appendUserMessage(msg.text, false, msg.timestamp);
        } else {
          const cardData = msg.data ? { ...msg.data, isStored: true } : (msg.cardType ? null : { ...app, isStored: true });
          const specialCard = msg.cardType ? { type: msg.cardType, data: msg.cardData } : null;
          this.appendAssistantMessage(msg.text, cardData, false, msg.timestamp, specialCard);
        }
      }
    } else {
      // Create initial synthetic message showing this job
      const msg = {
        role: 'assistant',
        text: `Loaded application for **${app.roleTitle}** at **${app.companyName}**.`,
        data: { ...app, isStored: true },
        timestamp: app.createdAt || new Date().toISOString()
      };
      this.chatMessages = [msg];
      this.appendAssistantMessage(msg.text, { ...app, isStored: true }, false, msg.timestamp);
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

    if (selected.action === 'new') {
      this.startNewChatSession();
    } else if (selected.action === 'store') {
      await this.handleStoreCommand();
    } else if (selected.action === 'compare') {
      await this.handleCompareCommand('/compare');
    } else if (selected.action === 'search') {
      this.chatInput.value = '/search ';
      this.chatInput.focus();
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
      `• **/new** — Start a fresh new chat session & clear active drafted job\n` +
      `• **/store** — Save the current drafted application to your Supabase Cloud database & Tracker\n` +
      `• **/compare [company]** — Compare your About Me profile (skills, projects, marks, certs) against company requirements\n` +
      `• **/search [query]** — Search across all applications stored in your database (e.g. \`/search Google\` or \`/search React\`)\n` +
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
    if (this.isJobStored(this.activeApplication)) {
      this.activeApplication.isStored = true;
    }
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
    if (this.isJobStored(this.activeApplication)) {
      this.activeApplication.isStored = true;
    }
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

    const effectiveProfile = this.getEffectiveUserProfile();

    const displayText = rawText || `/compare ${targetApp.companyName || ''}`;
    this.appendUserMessage(displayText);
    const thinkingEl = this.appendThinkingIndicator();

    try {
      const result = await AiExtractor.processInput(
        displayText,
        targetApp,
        this.chatMessages,
        this.applications,
        effectiveProfile
      );

      thinkingEl.remove();
      this.appendAssistantMessage(result.message, targetApp);
      this.scrollToBottom();
      this.showToast(`Analyzed fit for ${targetApp.companyName || 'role'}!`, 'info');
    } catch (err) {
      thinkingEl.remove();
      this.appendAssistantMessage(`❌ **Comparison Error:** ${err.message}`, targetApp);
      this.scrollToBottom();
    }
  }

  async handleSearchCommand(rawText = '/search') {
    this.chatInput.value = '';
    this.chatInput.style.height = 'auto';
    this.chatInput.style.overflowY = 'hidden';
    this.welcomeHero.style.display = 'none';

    // Extract query argument, e.g. "/search Google", "/search React", or "/search"
    const query = (rawText || '').replace(/^\/(?:search|find)\s*/i, '').trim();

    this.appendUserMessage(rawText || '/search');
    this.scrollToBottom();

    const allApps = this.applications || [];

    if (allApps.length === 0) {
      const emptyVaultMsg = `🔍 **Applications Database is Empty**\n\n` +
        `You don't have any job applications stored in your database yet!\n\n` +
        `• Paste a **Job Description (JD)** in the chat box to draft your first application.\n` +
        `• Type **/store** to permanently save it to your Supabase Cloud vault.`;
      this.appendAssistantMessage(emptyVaultMsg, null);
      this.scrollToBottom();
      return;
    }

    let matchedApps = [];
    if (!query) {
      // If user typed just "/search" without keywords, return all stored applications
      matchedApps = [...allApps];
    } else {
      const qLower = query.toLowerCase();
      const qTerms = qLower.split(/\s+/).filter(Boolean);

      matchedApps = allApps.filter(app => {
        const co = (app.companyName || '').toLowerCase();
        const role = (app.roleTitle || '').toLowerCase();
        const status = (app.status || '').toLowerCase();
        const loc = (app.location || '').toLowerCase();
        const mode = (app.workMode || '').toLowerCase();
        const sal = (app.salary || '').toLowerCase();
        const date = (app.appliedDate || '').toLowerCase();
        const time = (app.appliedTime || '').toLowerCase();
        const source = (app.source || '').toLowerCase();
        const notes = (app.notes || app.description || '').toLowerCase();
        const skills = Array.isArray(app.skills) ? app.skills.map(s => String(s).toLowerCase()).join(' ') : '';
        const fullSearchable = `${co} ${role} ${status} ${loc} ${mode} ${sal} ${date} ${time} ${skills} ${source} ${notes}`;

        return qTerms.every(term => fullSearchable.includes(term));
      });
    }

    // Sort: most recent appliedDate first
    matchedApps.sort((a, b) => {
      const dateA = a.appliedDate || a.createdAt || '';
      const dateB = b.appliedDate || b.createdAt || '';
      return dateB.localeCompare(dateA);
    });

    // Compute status breakdown
    const statusCounts = { applied: 0, interviewing: 0, offer: 0, rejected: 0, bookmarked: 0 };
    matchedApps.forEach(a => {
      const s = (a.status || 'applied').toLowerCase();
      if (s.includes('interview')) statusCounts.interviewing++;
      else if (s.includes('offer')) statusCounts.offer++;
      else if (s.includes('reject')) statusCounts.rejected++;
      else if (s.includes('bookmark')) statusCounts.bookmarked++;
      else statusCounts.applied++;
    });

    let assistantMsgText = '';
    if (!query) {
      assistantMsgText = `🔍 **Application Database Vault**\n\n` +
        `Displaying all **${matchedApps.length}** application${matchedApps.length === 1 ? '' : 's'} stored in your database.\n` +
        `*Tip: Type \`/search <keyword>\` (e.g. \`/search Google\`, \`/search React\`, or \`/search Interviewing\`) to filter.*`;
    } else if (matchedApps.length === 0) {
      assistantMsgText = `🔍 **Search Results for "${query}"**\n\n` +
        `No applications found matching **"${query}"** in your database of ${allApps.length} saved application${allApps.length === 1 ? '' : 's'}.\n` +
        `Try searching with another company name, job title, technology, or status!`;
    } else {
      assistantMsgText = `🔍 **Search Results for "${query}"**\n\n` +
        `Found **${matchedApps.length}** matching application${matchedApps.length === 1 ? '' : 's'} in your database (${allApps.length} total saved).`;
    }

    const specialCardData = {
      query: query || '',
      results: matchedApps,
      totalCount: allApps.length,
      statusCounts
    };

    this.appendAssistantMessage(assistantMsgText, null, true, null, {
      type: 'search_results',
      data: specialCardData
    });
    this.scrollToBottom();
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
    this.activeApplication = { ...saveRes.data, isStored: true };
    Config.setActiveSessionId(this.activeApplication.id);

    // Refresh application tracker list & counter
    await this.loadApplications();
    this.highlightActiveHistoryItem();
    this.updateChatCardsToStored();

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

    // Slash command to start new chat
    const lower = text.toLowerCase();
    if (lower === '/new' || lower.startsWith('/new ')) {
      this.startNewChatSession();
      return;
    }

    // Slash command to clear chat
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

    // Slash command to search all stored applications in database
    if (lower === '/search' || lower.startsWith('/search ') || lower === '/find' || lower.startsWith('/find ')) {
      await this.handleSearchCommand(text);
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
    const userTimestamp = new Date().toISOString();
    this.appendUserMessage(text, true, userTimestamp);
    this.chatInput.value = '';
    this.chatInput.style.height = 'auto';
    this.chatInput.style.overflowY = 'hidden';

    // Show AI thinking indicator
    const thinkingEl = this.appendThinkingIndicator();
    this.scrollToBottom();

    try {
      const effectiveProfile = this.getEffectiveUserProfile();
      const result = await AiExtractor.processInput(
        text,
        this.activeApplication,
        this.chatMessages,
        this.applications,
        effectiveProfile
      );

      thinkingEl.remove();

      if (result.profileUpdate) {
        await this.applyAiProfileUpdate(result.profileUpdate);
      }

      if (result.data) {
        // Detect if matching job already exists in stored database applications
        const existingApp = this.applications.find(a => 
          (this.activeApplication?.id && a.id === this.activeApplication.id) ||
          (result.data.companyName && result.data.roleTitle &&
           (a.companyName || '').trim().toLowerCase() === result.data.companyName.trim().toLowerCase() &&
           (a.roleTitle || '').trim().toLowerCase() === result.data.roleTitle.trim().toLowerCase())
        );

        const isStored = Boolean(
          this.activeApplication?.isStored ||
          (existingApp && existingApp.isStored !== false)
        );

        const appId = this.activeApplication?.id || existingApp?.id || crypto.randomUUID();
        const createdAt = this.activeApplication?.createdAt || existingApp?.createdAt || new Date().toISOString();

        const appData = {
          ...(existingApp || {}),
          ...(this.activeApplication || {}),
          ...result.data,
          id: appId,
          createdAt: createdAt,
          appliedTime: result.data.appliedTime || (this.activeApplication?.appliedTime || existingApp?.appliedTime || this.formatTimeOnly(new Date())),
          isStored: isStored
        };

        this.activeApplication = appData;

        // If it was ALREADY stored in DB, keep DB synced with edits
        if (this.activeApplication.isStored) {
          const saveRes = await SupabaseService.saveApplication(this.activeApplication);
          this.activeApplication = { ...saveRes.data, isStored: true };
          await this.loadApplications();
        }

        const promptHint = !this.activeApplication.isStored
          ? '\n\n💡 *Type `/store` or click **Store in DB** on the card to save this job to your database!*'
          : '';

        const assistantTimestamp = new Date().toISOString();
        const assistantMsg = {
          role: 'assistant',
          text: result.message + promptHint,
          data: { ...this.activeApplication, chatHistory: [] },
          timestamp: assistantTimestamp
        };

        this.chatMessages.push({ role: 'user', text, timestamp: userTimestamp });
        this.chatMessages.push(assistantMsg);
        this.activeApplication.chatHistory = this.chatMessages.map(m => ({ role: m.role, text: m.text, timestamp: m.timestamp || userTimestamp }));

        // Render assistant bubble with extraction card
        this.appendAssistantMessage(assistantMsg.text, this.activeApplication, true, assistantTimestamp);

        // Update UI
        this.topbarSessionMeta.style.display = 'flex';
        this.topbarCompany.textContent = this.activeApplication.companyName;
        this.topbarRole.textContent = this.activeApplication.roleTitle;

        this.scrollToBottom();
      } else {
        // Pure conversational message (e.g., greeting, help, inquiry) or Special Card Widget (time_date, today_count, graph)
        const assistantTimestamp = new Date().toISOString();
        const assistantMsg = {
          role: 'assistant',
          text: result.message,
          data: null,
          cardType: result.cardType || null,
          cardData: result.cardData || null,
          timestamp: assistantTimestamp
        };

        this.chatMessages.push({ role: 'user', text, timestamp: userTimestamp });
        this.chatMessages.push(assistantMsg);

        if (this.activeApplication) {
          this.activeApplication.chatHistory = this.chatMessages;
          await SupabaseService.saveApplication(this.activeApplication);
        }

        const specialCard = result.cardType ? { type: result.cardType, data: result.cardData } : null;
        // Render assistant bubble with optional special widget card
        this.appendAssistantMessage(result.message, null, true, assistantTimestamp, specialCard);
        this.scrollToBottom();
      }

    } catch (err) {
      thinkingEl.remove();
      this.appendAssistantMessage(`❌ **Extraction Error**: ${err.message || 'Unable to parse job.'}`, null);
      this.scrollToBottom();
      this.showToast(err.message, 'error');
    }
  }

  appendUserMessage(text, pushToState = true, timestamp = null) {
    const timeVal = timestamp || new Date().toISOString();
    const timeDisplay = this.formatMessageTime(timeVal);
    const msgDiv = document.createElement('div');
    msgDiv.className = 'chat-msg user';
    msgDiv.innerHTML = `
      <div class="msg-avatar">You</div>
      <div class="msg-body">
        <div class="msg-bubble-user">${this.escapeHtml(text)}</div>
        <div class="msg-timestamp">${timeDisplay}</div>
      </div>
    `;
    this.chatMessagesEl.appendChild(msgDiv);
  }

  appendThinkingIndicator() {
    const div = document.createElement('div');
    div.className = 'chat-msg assistant thinking-wrapper';
    div.innerHTML = `
      <div class="msg-avatar msg-avatar-zuno" title="Zuno AI"><img src="logo.png" alt="Zuno" class="zuno-avatar-img" /></div>
      <div class="msg-body">
        <div class="ai-thinking-card">
          <div class="typewriter-loader-wrapper">
            <div class="typewriter">
              <div class="slide"><i></i></div>
              <div class="paper"></div>
              <div class="keyboard"></div>
            </div>
          </div>
          <div class="thinking-text-row">
            <span class="thinking-status-text">Zuno is thinking... <span class="thinking-counter" style="opacity: 0.8; font-weight: 500;">(1s)</span></span>
          </div>
        </div>
      </div>
    `;
    this.chatMessagesEl.appendChild(div);

    let sec = 1;
    const counterEl = div.querySelector('.thinking-counter');
    const timerId = setInterval(() => {
      sec++;
      if (counterEl) {
        counterEl.textContent = `(${sec}s)`;
      }
    }, 1000);

    const origRemove = div.remove.bind(div);
    div.remove = () => {
      clearInterval(timerId);
      origRemove();
    };

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

  appendAssistantMessage(text, jobData, animate = true, timestamp = null, specialCard = null) {
    const timeVal = timestamp || new Date().toISOString();
    const timeDisplay = this.formatMessageTime(timeVal);
    const msgDiv = document.createElement('div');
    msgDiv.className = 'chat-msg assistant';

    let cardHtml = '';
    if (jobData) {
      cardHtml = this.createExtractionCardHtml(jobData);
    } else if (specialCard) {
      if (specialCard.type === 'time_date') {
        cardHtml = this.createTimeDateCardHtml(specialCard.data);
      } else if (specialCard.type === 'today_count') {
        cardHtml = this.createTodayCountCardHtml(specialCard.data);
      } else if (specialCard.type === 'graph') {
        cardHtml = this.createGraphCardHtml(specialCard.data);
      } else if (specialCard.type === 'search_results') {
        cardHtml = this.createSearchResultsCardHtml(specialCard.data);
      }
    }

    const formattedText = this.renderMarkdown(text);

    msgDiv.innerHTML = `
      <div class="msg-avatar msg-avatar-zuno" title="Zuno AI"><img src="logo.png" alt="Zuno" class="zuno-avatar-img" /></div>
      <div class="msg-body">
        <div class="msg-assistant-text">${formattedText}</div>
        ${cardHtml}
        <div class="msg-timestamp">${timeDisplay}</div>
      </div>
    `;

    this.chatMessagesEl.appendChild(msgDiv);

    // Bind events inside the card
    if (jobData) {
      this.bindCardEvents(msgDiv, jobData);
    }
    if (specialCard) {
      this.bindWidgetCardEvents(msgDiv, specialCard);
    }
  }

  createTimeDateCardHtml(cardData) {
    const time = cardData?.time || this.formatTimeOnly(new Date());
    const date = cardData?.date || new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const day = cardData?.day || new Date().toLocaleDateString('en-US', { weekday: 'long' });
    const tz = cardData?.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local';
    const isoDate = cardData?.isoDate || new Date().toISOString().split('T')[0];

    return `
      <div class="zuno-widget-card zuno-time-card">
        <div class="widget-card-header">
          <div class="widget-header-title">
            <div class="widget-icon widget-icon-time">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
            </div>
            <div>
              <h4 class="widget-title">Live Clock & Date</h4>
              <span class="widget-subtitle">Real-Time System Synchronization</span>
            </div>
          </div>
          <span class="widget-badge widget-badge-live">
            <span class="live-dot-pulse"></span>
            LIVE
          </span>
        </div>

        <div class="time-card-body">
          <div class="time-main-display">
            <span class="time-big-digit" data-live-time>${this.escapeHtml(time)}</span>
            <span class="time-tz-badge">${this.escapeHtml(tz)}</span>
          </div>

          <div class="date-main-row">
            <div class="date-chip-item">
              <span class="date-chip-label">Day of Week</span>
              <span class="date-chip-val">${this.escapeHtml(day)}</span>
            </div>
            <div class="date-chip-item">
              <span class="date-chip-label">Full Date</span>
              <span class="date-chip-val">${this.escapeHtml(date)}</span>
            </div>
            <div class="date-chip-item">
              <span class="date-chip-label">ISO Format</span>
              <span class="date-chip-val font-mono">${this.escapeHtml(isoDate)}</span>
            </div>
          </div>
        </div>

        <div class="widget-card-footer">
          <span class="widget-footer-note">⚡ Real-time clock synchronized for tracking application submissions, deadlines, and follow-ups.</span>
        </div>
      </div>
    `;
  }

  createTodayCountCardHtml(cardData) {
    const count = typeof cardData?.count === 'number' ? cardData.count : 0;
    const dateStr = cardData?.date || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const apps = Array.isArray(cardData?.applications) ? cardData.applications : [];

    let appsHtml = '';
    if (apps.length > 0) {
      appsHtml = apps.map((app) => {
        const initial = (app.companyName || 'C').charAt(0).toUpperCase();
        const statusClass = `status-${(app.status || 'applied').toLowerCase()}`;
        return `
          <div class="today-app-item">
            <div class="today-app-initial">${initial}</div>
            <div class="today-app-info">
              <div class="today-app-title">${this.escapeHtml(app.roleTitle || 'Job Title')}</div>
              <div class="today-app-company">${this.escapeHtml(app.companyName || 'Company')}</div>
            </div>
            <div class="today-app-meta">
              ${app.appliedTime ? `<span class="today-app-time">🕒 ${this.escapeHtml(app.appliedTime)}</span>` : ''}
              <span class="status-pill ${statusClass}">${this.escapeHtml(app.status || 'Applied')}</span>
            </div>
          </div>
        `;
      }).join('');
    }

    return `
      <div class="zuno-widget-card zuno-today-count-card">
        <div class="widget-card-header">
          <div class="widget-header-title">
            <div class="widget-icon widget-icon-today">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
            </div>
            <div>
              <h4 class="widget-title">Applications Applied Today</h4>
              <span class="widget-subtitle">${this.escapeHtml(dateStr)}</span>
            </div>
          </div>
          <span class="widget-badge ${count > 0 ? 'badge-success' : 'badge-neutral'}">
            ${count > 0 ? '🎯 Active Submissions' : '☕ Standing By'}
          </span>
        </div>

        <div class="today-count-body">
          <div class="today-count-stat-box">
            <div class="today-big-number ${count > 0 ? 'highlight-positive' : ''}">${count}</div>
            <div class="today-number-label">
              <strong>${count === 1 ? 'Application' : 'Applications'}</strong> Applied Today
            </div>
          </div>

          ${count > 0 ? `
            <div class="today-apps-list">
              <div class="today-list-title">Submissions from Today (${count}):</div>
              ${appsHtml}
            </div>
          ` : `
            <div class="today-empty-state">
              <div class="today-empty-icon">📝</div>
              <p class="today-empty-title">No applications submitted today yet.</p>
              <p class="today-empty-sub">Paste any Job Description (JD) here to extract and track your first job today!</p>
            </div>
          `}
        </div>

        <div class="widget-card-footer">
          <button class="btn btn-secondary btn-sm btn-widget-dash" title="Open Applications Dashboard">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
            <span>Open Dashboard</span>
          </button>
        </div>
      </div>
    `;
  }

  createGraphCardHtml(cardData) {
    const initialRange = cardData?.range || 7;
    const apps = cardData?.allApplications || this.applications || [];
    const content = this.buildGraphCardContent(initialRange, apps);

    return `
      <div class="zuno-widget-card zuno-graph-card" data-card-range="${initialRange}">
        <div class="widget-card-header">
          <div class="widget-header-title">
            <div class="widget-icon widget-icon-graph">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
              </svg>
            </div>
            <div>
              <h4 class="widget-title">Applications Velocity Graph</h4>
              <span class="widget-subtitle graph-subtitle-text">${this.escapeHtml(content.rangeLabel)}</span>
            </div>
          </div>
          <div class="graph-card-range-pills">
            <button type="button" class="graph-pill-btn ${initialRange === 7 ? 'active' : ''}" data-range="7">Last 7 Days (Week)</button>
            <button type="button" class="graph-pill-btn ${initialRange === 30 ? 'active' : ''}" data-range="30">Last 30 Days (Month)</button>
            <button type="button" class="graph-pill-btn ${initialRange === 'all' ? 'active' : ''}" data-range="all">All Time</button>
          </div>
        </div>

        <div class="graph-card-inner-content">
          ${content.bodyHtml}
        </div>

        <div class="widget-card-footer">
          <button class="btn btn-secondary btn-sm btn-widget-dash" title="Open Applications Dashboard">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
            <span>View Full Dashboard</span>
          </button>
        </div>
      </div>
    `;
  }

  createSearchResultsCardHtml(cardData) {
    const query = cardData?.query || '';
    const results = Array.isArray(cardData?.results) ? cardData.results : [];
    const totalCount = cardData?.totalCount || 0;
    const statusCounts = cardData?.statusCounts || { applied: 0, interviewing: 0, offer: 0, rejected: 0, bookmarked: 0 };

    let resultsListHtml = '';
    if (results.length > 0) {
      resultsListHtml = results.map(app => {
        const coName = app.companyName || 'Unknown Company';
        const role = app.roleTitle || 'Job Title';
        const initial = coName.charAt(0).toUpperCase();
        const status = app.status || 'Applied';
        const statusClass = `status-${status.toLowerCase()}`;

        let skillsHtml = '';
        if (Array.isArray(app.skills) && app.skills.length > 0) {
          const shownSkills = app.skills.slice(0, 4);
          skillsHtml = `
            <div class="search-item-skills">
              ${shownSkills.map(s => `<span class="skill-tag">${this.escapeHtml(s)}</span>`).join('')}
              ${app.skills.length > 4 ? `<span class="skill-tag">+${app.skills.length - 4}</span>` : ''}
            </div>
          `;
        }

        const dateStr = app.appliedDate ? `📅 ${app.appliedDate}` : '';
        const salaryStr = app.salary ? `💵 ${app.salary}` : '';
        const modeStr = app.workMode ? `📍 ${app.workMode}` : '';
        const locStr = app.location ? `${app.location}` : '';

        return `
          <div class="search-result-item" data-job-id="${this.escapeHtml(app.id)}">
            <div class="search-item-top">
              <div class="search-item-brand">
                <div class="search-item-avatar">${initial}</div>
                <div class="search-item-title-group">
                  <span class="search-item-role" title="${this.escapeHtml(role)}">${this.escapeHtml(role)}</span>
                  <span class="search-item-company" title="${this.escapeHtml(coName)}">${this.escapeHtml(coName)}</span>
                </div>
              </div>
              <span class="status-pill ${statusClass}">${this.escapeHtml(status)}</span>
            </div>

            <div class="search-item-meta-chips">
              ${dateStr ? `<span class="meta-chip chip-date">${this.escapeHtml(dateStr)}</span>` : ''}
              ${salaryStr ? `<span class="meta-chip chip-salary">${this.escapeHtml(salaryStr)}</span>` : ''}
              ${modeStr ? `<span class="meta-chip chip-mode">${this.escapeHtml(modeStr)}</span>` : ''}
              ${locStr ? `<span class="meta-chip chip-loc">${this.escapeHtml(locStr)}</span>` : ''}
            </div>

            ${skillsHtml}

            <div class="search-item-actions">
              <button type="button" class="btn btn-secondary btn-sm btn-search-view-job" data-job-id="${this.escapeHtml(app.id)}" title="View and manage in tracker">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                <span>View in Dashboard</span>
              </button>
              ${app.applicationUrl ? `
                <a href="${this.escapeHtml(app.applicationUrl)}" target="_blank" rel="noopener noreferrer" class="link-button link-button-sm">
                  <span>🔗 Apply URL</span>
                </a>
              ` : ''}
              ${app.sourceUrl && app.sourceUrl !== app.applicationUrl ? `
                <a href="${this.escapeHtml(app.sourceUrl)}" target="_blank" rel="noopener noreferrer" class="link-button link-button-sm">
                  <span>🌐 Source</span>
                </a>
              ` : ''}
            </div>
          </div>
        `;
      }).join('');
    } else {
      resultsListHtml = `
        <div class="search-empty-box">
          <div class="search-empty-icon">🔍</div>
          <div class="search-empty-title">No applications matching "${this.escapeHtml(query)}"</div>
          <div class="search-empty-sub">We checked your database of ${totalCount} saved applications. Try another keyword or explore by status:</div>
          <div class="search-quick-suggestions">
            <button type="button" class="suggestion-pill" data-query="Applied">Status: Applied</button>
            <button type="button" class="suggestion-pill" data-query="Interviewing">Status: Interviewing</button>
            <button type="button" class="suggestion-pill" data-query="Remote">Remote</button>
            <button type="button" class="suggestion-pill" data-query="Engineer">Engineer</button>
          </div>
        </div>
      `;
    }

    const titleText = query ? `Search: "${this.escapeHtml(query)}"` : 'Database Applications Vault';
    const subtitleText = query
      ? `${results.length} of ${totalCount} applications match your search`
      : `All ${totalCount} persistent applications stored in database`;

    return `
      <div class="zuno-widget-card zuno-search-card">
        <div class="widget-card-header">
          <div class="widget-header-title">
            <div class="widget-icon widget-icon-search">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </div>
            <div>
              <h4 class="widget-title">${titleText}</h4>
              <span class="widget-subtitle">${subtitleText}</span>
            </div>
          </div>
          <span class="widget-badge ${results.length > 0 ? 'badge-success' : 'badge-neutral'}">
            ${results.length} ${results.length === 1 ? 'Match' : 'Matches'}
          </span>
        </div>

        <div class="search-card-body">
          ${results.length > 0 ? `
            <div class="search-summary-pills">
              <span class="search-summary-pill">Total: <strong>${results.length}</strong></span>
              ${statusCounts.applied > 0 ? `<span class="search-summary-pill">Applied: <strong>${statusCounts.applied}</strong></span>` : ''}
              ${statusCounts.interviewing > 0 ? `<span class="search-summary-pill" style="color: #fbbf24;">Interviewing: <strong>${statusCounts.interviewing}</strong></span>` : ''}
              ${statusCounts.offer > 0 ? `<span class="search-summary-pill" style="color: #34d399;">Offers: <strong>${statusCounts.offer}</strong></span>` : ''}
              ${statusCounts.rejected > 0 ? `<span class="search-summary-pill" style="color: #fb7185;">Rejected: <strong>${statusCounts.rejected}</strong></span>` : ''}
            </div>
          ` : ''}

          <div class="search-results-list">
            ${resultsListHtml}
          </div>
        </div>

        <div class="widget-card-footer">
          <button type="button" class="btn btn-secondary btn-sm btn-filter-dashboard-query" data-query="${this.escapeHtml(query)}" title="Open in Applications Dashboard">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
            <span>Open in Tracker Dashboard</span>
          </button>
          <span class="widget-footer-note">⚡ Type <code>/search &lt;query&gt;</code> anytime to query your database.</span>
        </div>
      </div>
    `;
  }

  buildGraphCardContent(range, appsList = null) {
    const apps = appsList || this.applications || [];
    const dateAppsMap = {};
    for (const a of apps) {
      const dateKey = a.appliedDate || (a.createdAt ? a.createdAt.split('T')[0] : '');
      if (dateKey) {
        if (!dateAppsMap[dateKey]) dateAppsMap[dateKey] = [];
        dateAppsMap[dateKey].push(a);
      }
    }

    const daysData = [];
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    let rangeLabel = 'Last 7 Days (Week)';
    if (range === 'all') {
      rangeLabel = 'All-Time Application Timeline';
      const recordedDates = Object.keys(dateAppsMap).sort();
      let startDate = null;
      const endDate = new Date(now);

      if (recordedDates.length > 0) {
        const parts = recordedDates[0].split('-');
        if (parts.length === 3) {
          startDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        } else {
          startDate = new Date(now);
          startDate.setDate(startDate.getDate() - 13);
        }
      } else {
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 6);
      }

      const dayDiff = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24));
      if (dayDiff > 60) {
        startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 60);
      }

      const cur = new Date(startDate);
      while (cur <= endDate) {
        const dStr = cur.toISOString().split('T')[0];
        const dayApps = dateAppsMap[dStr] || [];
        daysData.push({
          dateStr: dStr,
          label: cur.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          count: dayApps.length,
          apps: dayApps
        });
        cur.setDate(cur.getDate() + 1);
      }
    } else {
      const numDays = parseInt(range, 10) || 7;
      rangeLabel = numDays === 30 ? 'Last 30 Days (Month)' : (numDays === 7 ? 'Last 7 Days (Week)' : `Last ${numDays} Days`);
      for (let i = numDays - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dStr = d.toISOString().split('T')[0];
        const dayApps = dateAppsMap[dStr] || [];
        daysData.push({
          dateStr: dStr,
          label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          count: dayApps.length,
          apps: dayApps
        });
      }
    }

    let peakCount = 0;
    let peakDateLabel = '-';
    let totalInRange = 0;

    daysData.forEach(d => {
      totalInRange += d.count;
      if (d.count > peakCount) {
        peakCount = d.count;
        peakDateLabel = d.label;
      }
    });

    const avgDaily = (totalInRange / (daysData.length || 1)).toFixed(1);
    const mostActiveDay = peakCount > 0 ? `${peakDateLabel} (${peakCount} apps)` : 'None yet';

    // SVG parameters
    const svgW = 700;
    const svgH = 190;
    const padL = 38;
    const padR = 24;
    const padT = 20;
    const padB = 35;
    const chartW = svgW - padL - padR;
    const chartH = svgH - padT - padB;
    const maxVal = Math.max(3, peakCount);

    // Y-Axis Gridlines
    const ySteps = 3;
    let gridHtml = '';
    for (let s = 0; s <= ySteps; s++) {
      const val = Math.round((maxVal / ySteps) * s);
      const yPos = padT + chartH - (val / maxVal) * chartH;
      gridHtml += `
        <line x1="${padL}" y1="${yPos.toFixed(1)}" x2="${(padL + chartW).toFixed(1)}" y2="${yPos.toFixed(1)}" class="graph-gridline" />
        <text x="${(padL - 8).toFixed(1)}" y="${(yPos + 4).toFixed(1)}" text-anchor="end" class="graph-axis-text">${val}</text>
      `;
    }

    // Points Coordinates
    const N = daysData.length;
    const points = daysData.map((d, i) => {
      const x = N === 1 ? padL + chartW / 2 : padL + (i / (N - 1)) * chartW;
      const y = padT + chartH - (d.count / maxVal) * chartH;
      return { x, y, ...d };
    });

    // Spline curve
    let curvePath = '';
    if (points.length === 1) {
      curvePath = `M ${points[0].x} ${points[0].y}`;
    } else {
      curvePath = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
      for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i === 0 ? 0 : i - 1];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[i + 2] || p2;

        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = p1.y + (p2.y - p0.y) / 6;
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = p2.y - (p3.y - p1.y) / 6;

        curvePath += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
      }
    }

    const bottomY = padT + chartH;
    const areaPath = `${curvePath} L ${points[points.length - 1].x.toFixed(1)} ${bottomY} L ${points[0].x.toFixed(1)} ${bottomY} Z`;

    // X-Axis labels
    const stepInterval = N > 20 ? 4 : (N > 10 ? 2 : 1);
    let xLabelsHtml = '';
    points.forEach((p, i) => {
      if (i % stepInterval === 0 || i === N - 1) {
        xLabelsHtml += `
          <text x="${p.x.toFixed(1)}" y="${bottomY + 18}" text-anchor="middle" class="graph-axis-text">
            ${p.label}
          </text>
        `;
      }
    });

    // Dots and hit rectangles
    const colWidth = N > 1 ? chartW / (N - 1) : chartW;
    let interactiveHtml = '';
    points.forEach((p, i) => {
      const colX = Math.max(0, p.x - colWidth / 2);
      const isToday = p.dateStr === todayStr;
      const dotR = p.count > 0 ? (isToday ? 6 : 4.5) : 3;
      const dotFill = p.count > 0 ? '#38bdf8' : 'rgba(255,255,255,0.2)';
      const dotStroke = p.count > 0 ? '#ffffff' : 'rgba(255,255,255,0.4)';

      interactiveHtml += `
        <rect class="graph-col-rect" x="${colX.toFixed(1)}" y="${padT}" width="${colWidth.toFixed(1)}" height="${(chartH + 16).toFixed(1)}" data-idx="${i}" />
        <circle class="graph-dot" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${dotR}" fill="${dotFill}" stroke="${dotStroke}" stroke-width="${p.count > 0 ? 2 : 1}" data-idx="${i}" />
      `;
    });

    const gradId = `graphArea_${Math.random().toString(36).substr(2, 6)}`;
    const lineGradId = `graphLine_${Math.random().toString(36).substr(2, 6)}`;

    const svgInnerHtml = `
      <defs>
        <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.32" />
          <stop offset="60%" stop-color="#6366f1" stop-opacity="0.08" />
          <stop offset="100%" stop-color="#6366f1" stop-opacity="0.0" />
        </linearGradient>
        <linearGradient id="${lineGradId}" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#38bdf8" />
          <stop offset="50%" stop-color="#818cf8" />
          <stop offset="100%" stop-color="#c084fc" />
        </linearGradient>
      </defs>
      ${gridHtml}
      <path d="${areaPath}" fill="url(#${gradId})" />
      <path d="${curvePath}" fill="none" stroke="url(#${lineGradId})" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" />
      ${xLabelsHtml}
      ${interactiveHtml}
    `;

    // Filter applications in this range for display
    const appsInRange = [];
    daysData.forEach(d => {
      d.apps.forEach(a => appsInRange.push(a));
    });
    appsInRange.reverse(); // newest first

    let appsListHtml = '';
    if (appsInRange.length > 0) {
      const shownApps = appsInRange.slice(0, 5);
      const remaining = appsInRange.length - 5;
      appsListHtml = `
        <div class="graph-apps-list-wrap">
          <div class="graph-apps-list-title">Applications in this period (${appsInRange.length}):</div>
          <div class="graph-apps-mini-grid">
            ${shownApps.map(a => `
              <div class="graph-mini-item">
                <span class="graph-mini-co"><strong>${this.escapeHtml(a.companyName || 'Company')}</strong></span>
                <span class="graph-mini-role">${this.escapeHtml(a.roleTitle || 'Role')}</span>
                <span class="graph-mini-date">📅 ${this.escapeHtml(a.appliedDate || 'Recent')}</span>
                <span class="status-pill status-${(a.status || 'applied').toLowerCase()}">${this.escapeHtml(a.status || 'Applied')}</span>
              </div>
            `).join('')}
          </div>
          ${remaining > 0 ? `<div class="graph-more-apps">+ ${remaining} more application${remaining === 1 ? '' : 's'} recorded in this window</div>` : ''}
        </div>
      `;
    } else {
      appsListHtml = `
        <div class="graph-no-apps-note">
          <span>ℹ️ No applications recorded for this timeframe yet.</span>
        </div>
      `;
    }

    const bodyHtml = `
      <div class="graph-metrics-summary">
        <div class="graph-metric-pill">
          <span class="metric-label">📊 Total Applied</span>
          <span class="metric-val graph-total-val">${totalInRange} apps</span>
        </div>
        <div class="graph-metric-pill">
          <span class="metric-label">🔥 Peak Day</span>
          <span class="metric-val graph-peak-val">${peakCount} apps</span>
        </div>
        <div class="graph-metric-pill">
          <span class="metric-label">⚡ Daily Avg</span>
          <span class="metric-val graph-avg-val">${avgDaily} / day</span>
        </div>
        <div class="graph-metric-pill">
          <span class="metric-label">📅 Most Active</span>
          <span class="metric-val graph-most-val">${this.escapeHtml(mostActiveDay)}</span>
        </div>
      </div>

      <div class="graph-chart-wrap">
        <div class="graph-tooltip" style="display: none;"></div>
        <svg class="graph-svg" viewBox="0 0 ${svgW} ${svgH}" preserveAspectRatio="none">
          ${svgInnerHtml}
        </svg>
      </div>

      ${appsListHtml}
    `;

    return {
      rangeLabel,
      bodyHtml,
      points
    };
  }

  bindWidgetCardEvents(msgDiv, specialCard) {
    if (!specialCard) return;

    // Live Time Card ticker
    if (specialCard.type === 'time_date') {
      const liveTimeEl = msgDiv.querySelector('[data-live-time]');
      if (liveTimeEl) {
        const intervalId = setInterval(() => {
          if (!document.body.contains(liveTimeEl)) {
            clearInterval(intervalId);
            return;
          }
          const now = new Date();
          const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
          liveTimeEl.textContent = timeStr;
        }, 1000);
      }
    }

    // Dashboard navigation button on all widget cards
    const dashBtns = msgDiv.querySelectorAll('.btn-widget-dash');
    dashBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.switchView('dashboard');
      });
    });

    // Graph Card range switcher and hover tooltips
    if (specialCard.type === 'graph') {
      const graphCard = msgDiv.querySelector('.zuno-graph-card');
      if (graphCard) {
        const innerContent = graphCard.querySelector('.graph-card-inner-content');
        const subtitleEl = graphCard.querySelector('.graph-subtitle-text');
        const rangeBtns = graphCard.querySelectorAll('.graph-pill-btn');

        const bindSvgTooltips = () => {
          const tooltip = graphCard.querySelector('.graph-tooltip');
          const svg = graphCard.querySelector('.graph-svg');
          if (!tooltip || !svg) return;

          const currentRange = graphCard.getAttribute('data-card-range') || '7';
          const r = currentRange === 'all' ? 'all' : parseInt(currentRange, 10);
          const { points } = this.buildGraphCardContent(r, this.applications);

          const hideTooltip = () => { tooltip.style.display = 'none'; };

          const hitEls = graphCard.querySelectorAll('.graph-col-rect, .graph-dot');
          hitEls.forEach(el => {
            el.addEventListener('mouseenter', () => {
              const idx = parseInt(el.getAttribute('data-idx'), 10);
              const p = points && points[idx];
              if (!p) return;

              let appListStr = '';
              if (p.apps && p.apps.length > 0) {
                const names = p.apps.map(a => `• ${a.companyName || 'Company'} (${a.roleTitle || 'Role'})`).slice(0, 3);
                if (p.apps.length > 3) names.push(`+ ${p.apps.length - 3} more`);
                appListStr = `<div class="tooltip-companies">${names.join('<br>')}</div>`;
              } else {
                appListStr = `<div class="tooltip-empty">0 applications</div>`;
              }

              tooltip.innerHTML = `
                <div class="tooltip-date">${p.label} (${p.dateStr})</div>
                <div class="tooltip-count">${p.count} ${p.count === 1 ? 'application' : 'applications'}</div>
                ${appListStr}
              `;
              tooltip.style.display = 'block';

              const svgRect = svg.getBoundingClientRect();
              const wrapRect = svg.parentElement.getBoundingClientRect();
              const scaleX = svgRect.width / 700;
              const scaleY = svgRect.height / 190;
              const tipX = (p.x * scaleX);
              const tipY = (p.y * scaleY) - 10;

              tooltip.style.left = `${Math.min(wrapRect.width - 160, Math.max(10, tipX))}px`;
              tooltip.style.top = `${Math.max(10, tipY)}px`;
            });
          });

          svg.addEventListener('mouseleave', hideTooltip);
        };

        rangeBtns.forEach(btn => {
          btn.addEventListener('click', () => {
            const rangeVal = btn.getAttribute('data-range');
            rangeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            graphCard.setAttribute('data-card-range', rangeVal);
            const r = rangeVal === 'all' ? 'all' : parseInt(rangeVal, 10);
            const content = this.buildGraphCardContent(r, this.applications);

            if (subtitleEl) subtitleEl.textContent = content.rangeLabel;
            if (innerContent) innerContent.innerHTML = content.bodyHtml;

            bindSvgTooltips();
          });
        });

        bindSvgTooltips();
      }
    }

    // Search Results Card events
    if (specialCard.type === 'search_results') {
      const searchCard = msgDiv.querySelector('.zuno-search-card');
      if (searchCard) {
        // 1. View in Dashboard button for individual job item
        const viewJobBtns = searchCard.querySelectorAll('.btn-search-view-job');
        viewJobBtns.forEach(btn => {
          btn.addEventListener('click', () => {
            const jobId = btn.getAttribute('data-job-id');
            const targetApp = (this.applications || []).find(a => String(a.id) === String(jobId));
            if (targetApp) {
              this.activeApplication = targetApp;
              this.switchView('dashboard');
              if (this.dashSearchInput) {
                this.dashSearchInput.value = targetApp.companyName || '';
                this.searchQuery = (targetApp.companyName || '').toLowerCase().trim();
                this.renderApplicationsGrid();
              }
              this.showToast(`Viewing ${targetApp.companyName || 'application'} in Dashboard`, 'info');
            } else {
              this.switchView('dashboard');
            }
          });
        });

        // 2. Open in Tracker Dashboard filter button
        const filterDashBtn = searchCard.querySelector('.btn-filter-dashboard-query');
        if (filterDashBtn) {
          filterDashBtn.addEventListener('click', () => {
            const query = filterDashBtn.getAttribute('data-query') || '';
            this.switchView('dashboard');
            if (this.dashSearchInput && query) {
              this.dashSearchInput.value = query;
              this.searchQuery = query.toLowerCase().trim();
              this.renderApplicationsGrid();
              this.showToast(`Filtered Tracker by "${query}"`, 'info');
            }
          });
        }

        // 3. Quick suggestion pills
        const suggestionPills = searchCard.querySelectorAll('.suggestion-pill');
        suggestionPills.forEach(pill => {
          pill.addEventListener('click', () => {
            const q = pill.getAttribute('data-query');
            if (q) {
              this.handleSearchCommand(`/search ${q}`);
            }
          });
        });
      }
    }
  }

  isJobStored(data) {
    if (!data) return false;
    if (data.isStored === true) return true;
    if (!this.applications || !this.applications.length) return false;

    // Check by ID
    if (data.id && this.applications.some(a => a.id === data.id)) {
      return true;
    }

    // Check by Company Name and Role Title
    const dataCompany = (data.companyName || '').trim().toLowerCase();
    const dataRole = (data.roleTitle || '').trim().toLowerCase();
    if (dataCompany && dataRole) {
      return this.applications.some(a => {
        const c = (a.companyName || '').trim().toLowerCase();
        const r = (a.roleTitle || '').trim().toLowerCase();
        return c === dataCompany && r === dataRole;
      });
    }
    return false;
  }

  updateChatCardsToStored() {
    if (!this.chatMessagesEl) return;
    const cards = this.chatMessagesEl.querySelectorAll('.ai-extraction-card');
    cards.forEach(card => {
      const draftBadge = card.querySelector('.status-draft-badge');
      if (draftBadge) {
        draftBadge.className = 'status-stored-badge';
        draftBadge.title = 'Stored in Database';
        draftBadge.textContent = '✓ Saved in DB';
      }
      const storeBtn = card.querySelector('.btn-store-job');
      if (storeBtn) {
        storeBtn.className = 'btn btn-secondary btn-sm btn-store-job';
        storeBtn.title = 'Update in database (/store)';
        storeBtn.innerHTML = `
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
          <span>Saved (Update /store)</span>
        `;
      }
    });
  }

  createExtractionCardHtml(data) {
    const isStored = this.isJobStored(data);
    if (isStored) {
      data.isStored = true;
    }
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
            ${isStored ? `
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
          <span class="meta-chip chip-time">🕒 Time: <strong>${this.escapeHtml(data.appliedTime || this.formatTimeOnly(data.createdAt || new Date()))}</strong></span>
        </div>

        ${skillsHtml}

        <div class="card-actions-row">
          <div class="card-external-links">
            ${linksHtml || '<span style="font-size: 0.78rem; color: var(--text-subtle);">No direct URLs detected yet. You can paste them in the chat.</span>'}
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            ${!isStored ? `
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

    // Date filter from Dashboard banner / calendar picker
    if (this.activeSidebarDate) {
      filtered = filtered.filter(a => {
        const appDate = a.appliedDate || (a.createdAt ? a.createdAt.split('T')[0] : '');
        return appDate === this.activeSidebarDate;
      });
    }

    // Status filter
    if (this.currentFilterStatus !== 'all') {
      if (this.currentFilterStatus === 'Calls') {
        filtered = filtered.filter(a => {
          const s = (a.status || '').toLowerCase();
          return s === 'interviewing' || s === 'offer';
        });
      } else {
        filtered = filtered.filter(a => a.status === this.currentFilterStatus);
      }
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
        <span class="badge-days-ago" title="${app.appliedDate || ''}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
          <span>${daysAgoText}</span>
        </span>
        <span class="badge-time" title="Applied Time: ${this.escapeHtml(app.appliedTime || this.formatTimeOnly(app.createdAt))}">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          <span>${this.escapeHtml(app.appliedTime || this.formatTimeOnly(app.createdAt))}</span>
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
      if (this.sidebarBackdrop) this.sidebarBackdrop.classList.remove('active');
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
      if (this.sidebarBackdrop) this.sidebarBackdrop.classList.add('active');
    } else {
      if (this.sidebar) this.sidebar.classList.remove('collapsed');
      const app = document.getElementById('app');
      if (app) app.classList.remove('sidebar-collapsed');
    }
  }

  toggleSidebar() {
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
      if (!this.sidebar) return;
      const isOpen = this.sidebar.classList.toggle('open');
      if (this.sidebarBackdrop) this.sidebarBackdrop.classList.toggle('active', isOpen);
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
    // Auto-clean & migrate: If bio contains a GitHub, LinkedIn, or Portfolio link, move it to its dedicated field
    if (this.userProfile && this.userProfile.bio) {
      let needsSave = false;
      const ghMatch = this.userProfile.bio.match(/https?:\/\/(?:www\.)?github\.com\/[a-zA-Z0-9_\-\.\/]+/i);
      if (ghMatch && (!this.userProfile.githubUrl || this.userProfile.githubUrl.includes('username'))) {
        this.userProfile.githubUrl = ghMatch[0];
        this.userProfile.bio = this.userProfile.bio.replace(/(?:my\s+)?(?:github(?:\s+profile|\s+link|\s+url)?\s*[:=\-]?\s*)?https?:\/\/(?:www\.)?github\.com\/[a-zA-Z0-9_\-\.\/]+/gi, '').trim();
        needsSave = true;
      }
      const liMatch = this.userProfile.bio.match(/https?:\/\/(?:www\.)?linkedin\.com\/[a-zA-Z0-9_\-\.\/]+/i);
      if (liMatch && (!this.userProfile.linkedinUrl || this.userProfile.linkedinUrl.includes('username'))) {
        this.userProfile.linkedinUrl = liMatch[0];
        this.userProfile.bio = this.userProfile.bio.replace(/(?:my\s+)?(?:linkedin(?:\s+profile|\s+link|\s+url)?\s*[:=\-]?\s*)?https?:\/\/(?:www\.)?linkedin\.com\/[a-zA-Z0-9_\-\.\/]+/gi, '').trim();
        needsSave = true;
      }
      if (needsSave) {
        await SupabaseService.saveUserProfile(this.userProfile);
      }
    }
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

  getEffectiveUserProfile() {
    if (!this.userProfile) {
      this.userProfile = Config.getUserProfile();
    }
    const prof = JSON.parse(JSON.stringify(this.userProfile));

    if (this.profFullName && this.profFullName.value !== undefined) prof.fullName = this.profFullName.value.trim();
    if (this.profHeadline && this.profHeadline.value !== undefined) prof.headline = this.profHeadline.value.trim();
    if (this.profBio && this.profBio.value !== undefined) prof.bio = this.profBio.value.trim();
    if (this.profEmail && this.profEmail.value !== undefined) prof.email = this.profEmail.value.trim();
    if (this.profPhone && this.profPhone.value !== undefined) prof.phone = this.profPhone.value.trim();
    if (this.profLocation && this.profLocation.value !== undefined) prof.location = this.profLocation.value.trim();
    if (this.profPortfolio && this.profPortfolio.value !== undefined) prof.portfolioUrl = this.profPortfolio.value.trim();
    if (this.profGithub && this.profGithub.value !== undefined) prof.githubUrl = this.profGithub.value.trim();
    if (this.profLinkedin && this.profLinkedin.value !== undefined) prof.linkedinUrl = this.profLinkedin.value.trim();
    if (this.profAvatarUrl && this.profAvatarUrl.value !== undefined) prof.avatarUrl = this.profAvatarUrl.value.trim();

    prof.education = prof.education || {};
    prof.education.tenth = prof.education.tenth || {};
    if (this.prof10thSchool && this.prof10thSchool.value !== undefined) prof.education.tenth.schoolName = this.prof10thSchool.value.trim();
    if (this.prof10thBoard && this.prof10thBoard.value !== undefined) prof.education.tenth.board = this.prof10thBoard.value.trim();
    if (this.prof10thMarks && this.prof10thMarks.value !== undefined) prof.education.tenth.marks = this.prof10thMarks.value.trim();
    if (this.prof10thYear && this.prof10thYear.value !== undefined) prof.education.tenth.year = this.prof10thYear.value.trim();

    prof.education.twelfth = prof.education.twelfth || {};
    if (this.prof12thSchool && this.prof12thSchool.value !== undefined) prof.education.twelfth.schoolName = this.prof12thSchool.value.trim();
    if (this.prof12thBoard && this.prof12thBoard.value !== undefined) prof.education.twelfth.board = this.prof12thBoard.value.trim();
    if (this.prof12thMarks && this.prof12thMarks.value !== undefined) prof.education.twelfth.marks = this.prof12thMarks.value.trim();
    if (this.prof12thYear && this.prof12thYear.value !== undefined) prof.education.twelfth.year = this.prof12thYear.value.trim();

    prof.education.college = prof.education.college || {};
    if (this.profCollegeName && this.profCollegeName.value !== undefined) prof.education.college.collegeName = this.profCollegeName.value.trim();
    if (this.profCollegeDegree && this.profCollegeDegree.value !== undefined) prof.education.college.degree = this.profCollegeDegree.value.trim();
    if (this.profCollegeBranch && this.profCollegeBranch.value !== undefined) prof.education.college.branch = this.profCollegeBranch.value.trim();
    if (this.profCollegeCgpa && this.profCollegeCgpa.value !== undefined) prof.education.college.overallCgpa = this.profCollegeCgpa.value.trim();
    if (this.profCollegeGradYear && this.profCollegeGradYear.value !== undefined) prof.education.college.graduationYear = this.profCollegeGradYear.value.trim();

    prof.education.college.semesterMarks = prof.education.college.semesterMarks || {};
    for (let i = 1; i <= 8; i++) {
      const semInput = document.getElementById(`profSem${i}`);
      if (semInput && semInput.value !== undefined) {
        prof.education.college.semesterMarks[`sem${i}`] = semInput.value.trim();
      }
    }

    prof.projects = Array.isArray(this.userProfile?.projects) ? this.userProfile.projects : [];
    prof.certifications = Array.isArray(this.userProfile?.certifications) ? this.userProfile.certifications : [];
    prof.skills = Array.isArray(this.userProfile?.skills) ? this.userProfile.skills : [];

    this.userProfile = prof;
    return prof;
  }

  async saveProfileManually() {
    this.getEffectiveUserProfile();
    await SupabaseService.saveUserProfile(this.userProfile);
    this.showToast('Candidate profile and dossier saved successfully!', 'success');
  }

  async applyAiProfileUpdate(update) {
    if (!this.userProfile) {
      this.userProfile = Config.getUserProfile();
    }

    this.userProfile.education = this.userProfile.education || {};
    this.userProfile.education.tenth = this.userProfile.education.tenth || {};
    this.userProfile.education.twelfth = this.userProfile.education.twelfth || {};
    this.userProfile.education.college = this.userProfile.education.college || {};
    this.userProfile.education.college.semesterMarks = this.userProfile.education.college.semesterMarks || {};
    this.userProfile.projects = Array.isArray(this.userProfile.projects) ? this.userProfile.projects : [];
    this.userProfile.certifications = Array.isArray(this.userProfile.certifications) ? this.userProfile.certifications : [];
    this.userProfile.skills = Array.isArray(this.userProfile.skills) ? this.userProfile.skills : [];

    if (update.type === 'update_college') {
      if (update.collegeName !== undefined) this.userProfile.education.college.collegeName = update.collegeName;
      if (update.degree !== undefined) this.userProfile.education.college.degree = update.degree;
      if (update.branch !== undefined) this.userProfile.education.college.branch = update.branch;
      if (update.overallCgpa !== undefined) this.userProfile.education.college.overallCgpa = update.overallCgpa;
      if (update.graduationYear !== undefined) this.userProfile.education.college.graduationYear = update.graduationYear;
    } else if (update.type === 'add_skills' || update.type === 'add_skill') {
      const skillsToAdd = Array.isArray(update.skills) ? update.skills : (update.skill ? [update.skill] : []);
      skillsToAdd.forEach(s => {
        const trimmed = String(s).trim();
        if (trimmed && !this.userProfile.skills.some(existing => existing.toLowerCase() === trimmed.toLowerCase())) {
          this.userProfile.skills.push(trimmed);
        }
      });
    } else if (update.type === 'remove_skill') {
      const targetSkill = String(update.skill || '').toLowerCase().trim();
      this.userProfile.skills = this.userProfile.skills.filter(s => s.toLowerCase().trim() !== targetSkill);
    } else if (update.type === 'set_skills' && Array.isArray(update.skills)) {
      this.userProfile.skills = update.skills.map(s => String(s).trim()).filter(Boolean);
    } else if (update.type === 'add_project' && update.project) {
      const proj = update.project;
      const newProj = {
        id: proj.id || 'proj_' + Date.now(),
        title: proj.title || 'Untitled Project',
        description: proj.description || '',
        techStack: proj.techStack || '',
        projectUrl: proj.projectUrl || '',
        startDate: proj.startDate || '',
        finishDate: proj.finishDate || new Date().toISOString().split('T')[0]
      };
      const existingIdx = this.userProfile.projects.findIndex(p => p.title.toLowerCase().trim() === newProj.title.toLowerCase().trim());
      if (existingIdx !== -1) {
        this.userProfile.projects[existingIdx] = { ...this.userProfile.projects[existingIdx], ...newProj };
      } else {
        this.userProfile.projects.unshift(newProj);
      }
    } else if (update.type === 'edit_project') {
      const target = String(update.targetTitle || update.project?.title || '').toLowerCase().trim();
      const idx = this.userProfile.projects.findIndex(p => p.title.toLowerCase().trim() === target || p.id === update.projectId);
      if (idx !== -1) {
        this.userProfile.projects[idx] = { ...this.userProfile.projects[idx], ...(update.project || {}) };
      } else if (update.project) {
        this.userProfile.projects.unshift({ id: 'proj_' + Date.now(), ...(update.project || {}) });
      }
    } else if (update.type === 'delete_project') {
      const delTitle = String(update.targetTitle || '').toLowerCase().trim();
      this.userProfile.projects = this.userProfile.projects.filter(p => p.title.toLowerCase().trim() !== delTitle && p.id !== update.projectId);
    } else if (update.type === 'add_certification' && update.certification) {
      const cert = update.certification;
      const newCert = {
        id: cert.id || 'cert_' + Date.now(),
        name: cert.name || 'Untitled Certification',
        issuer: cert.issuer || 'Verified Org',
        issueDate: cert.issueDate || new Date().toISOString().split('T')[0],
        credentialUrl: cert.credentialUrl || ''
      };
      const existingCertIdx = this.userProfile.certifications.findIndex(c => c.name.toLowerCase().trim() === newCert.name.toLowerCase().trim());
      if (existingCertIdx !== -1) {
        this.userProfile.certifications[existingCertIdx] = { ...this.userProfile.certifications[existingCertIdx], ...newCert };
      } else {
        this.userProfile.certifications.unshift(newCert);
      }
    } else if (update.type === 'edit_certification') {
      const certTarget = String(update.targetName || update.certification?.name || '').toLowerCase().trim();
      const idx = this.userProfile.certifications.findIndex(c => c.name.toLowerCase().trim() === certTarget || c.id === update.certId);
      if (idx !== -1) {
        this.userProfile.certifications[idx] = { ...this.userProfile.certifications[idx], ...(update.certification || {}) };
      } else if (update.certification) {
        this.userProfile.certifications.unshift({ id: 'cert_' + Date.now(), ...(update.certification || {}) });
      }
    } else if (update.type === 'delete_certification') {
      const delName = String(update.targetName || '').toLowerCase().trim();
      this.userProfile.certifications = this.userProfile.certifications.filter(c => c.name.toLowerCase().trim() !== delName && c.id !== update.certId);
    } else if (update.type === 'update_sem_marks' && update.sem) {
      this.userProfile.education.college.semesterMarks[update.sem] = update.score;
    } else if (update.type === 'update_education_10th') {
      if (update.marks !== undefined) this.userProfile.education.tenth.marks = update.marks;
      if (update.schoolName !== undefined) this.userProfile.education.tenth.schoolName = update.schoolName;
      if (update.board !== undefined) this.userProfile.education.tenth.board = update.board;
      if (update.year !== undefined) this.userProfile.education.tenth.year = update.year;
    } else if (update.type === 'update_education_12th') {
      if (update.marks !== undefined) this.userProfile.education.twelfth.marks = update.marks;
      if (update.schoolName !== undefined) this.userProfile.education.twelfth.schoolName = update.schoolName;
      if (update.board !== undefined) this.userProfile.education.twelfth.board = update.board;
      if (update.year !== undefined) this.userProfile.education.twelfth.year = update.year;
    } else if (update.type === 'update_personal') {
      if (update.fullName !== undefined) this.userProfile.fullName = update.fullName;
      if (update.headline !== undefined) this.userProfile.headline = update.headline;
      if (update.email !== undefined) this.userProfile.email = update.email;
      if (update.phone !== undefined) this.userProfile.phone = update.phone;
      if (update.location !== undefined) this.userProfile.location = update.location;
      if (update.githubUrl !== undefined) this.userProfile.githubUrl = update.githubUrl;
      if (update.linkedinUrl !== undefined) this.userProfile.linkedinUrl = update.linkedinUrl;
      if (update.portfolioUrl !== undefined) this.userProfile.portfolioUrl = update.portfolioUrl;
      if (update.avatarUrl !== undefined) this.userProfile.avatarUrl = update.avatarUrl;

      // Smart auto-routing: If bio contains GitHub / LinkedIn / Portfolio URLs, route them to their proper fields!
      if (update.bio) {
        let cleanBio = update.bio;

        const ghMatch = cleanBio.match(/https?:\/\/(?:www\.)?github\.com\/[a-zA-Z0-9_\-\.\/]+/i);
        if (ghMatch) {
          this.userProfile.githubUrl = ghMatch[0];
          cleanBio = cleanBio.replace(/(?:my\s+)?(?:github(?:\s+profile|\s+link|\s+url)?\s*[:=\-]?\s*)?https?:\/\/(?:www\.)?github\.com\/[a-zA-Z0-9_\-\.\/]+/gi, '').trim();
        }

        const liMatch = cleanBio.match(/https?:\/\/(?:www\.)?linkedin\.com\/[a-zA-Z0-9_\-\.\/]+/i);
        if (liMatch) {
          this.userProfile.linkedinUrl = liMatch[0];
          cleanBio = cleanBio.replace(/(?:my\s+)?(?:linkedin(?:\s+profile|\s+link|\s+url)?\s*[:=\-]?\s*)?https?:\/\/(?:www\.)?linkedin\.com\/[a-zA-Z0-9_\-\.\/]+/gi, '').trim();
        }

        const portMatch = cleanBio.match(/https?:\/\/(?!github\.com|linkedin\.com)[a-zA-Z0-9_\-\.\/]+/i);
        if (portMatch && (cleanBio.toLowerCase().includes('portfolio') || cleanBio.toLowerCase().includes('website'))) {
          this.userProfile.portfolioUrl = portMatch[0];
          cleanBio = cleanBio.replace(/(?:my\s+)?(?:portfolio|website|site)\s*[:=\-]?\s*https?:\/\/[a-zA-Z0-9_\-\.\/]+/gi, '').trim();
        }

        this.userProfile.bio = cleanBio;
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
