// AI Extraction & Career Advisory Engine for JobTrackerAI
// Supports Google Gemini API, OpenAI API, and Offline Smart NLP Heuristic & Career Advisor

import { Config } from './config.js';

/**
 * Smart Date Parser for relative & explicit application dates
 * Handles "yesterday", "X days ago", "last week", "2 weeks ago", "Oct 2nd", "2026-10-02"
 */
export function parseAppliedDate(text, defaultDate = undefined) {
  const now = new Date();
  const lower = (text || '').toLowerCase();

  // "yesterday"
  if (/\b(?:(?:i\s+)?(?:had\s+)?applied\s+)?yesterday\b/i.test(lower)) {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }

  // "X days ago" or "X days back"
  const daysAgoMatch = lower.match(/\b(?:(?:i\s+)?(?:had\s+)?applied\s+)?(\d+)\s*days?\s*(?:ago|back)\b/i);
  if (daysAgoMatch) {
    const days = parseInt(daysAgoMatch[1], 10);
    const d = new Date(now);
    d.setDate(d.getDate() - days);
    return d.toISOString().split('T')[0];
  }

  // "last week" / "a week ago" / "X weeks ago"
  const weeksAgoMatch = lower.match(/\b(?:(?:i\s+)?(?:had\s+)?applied\s+)?(?:(\d+)\s*weeks?\s*(?:ago|back)|last\s*week|a\s*week\s*ago)\b/i);
  if (weeksAgoMatch) {
    const weeks = weeksAgoMatch[1] ? parseInt(weeksAgoMatch[1], 10) : 1;
    const d = new Date(now);
    d.setDate(d.getDate() - (weeks * 7));
    return d.toISOString().split('T')[0];
  }

  // "last month" / "X months ago"
  const monthsAgoMatch = lower.match(/\b(?:(?:i\s+)?(?:had\s+)?applied\s+)?(?:(\d+)\s*months?\s*(?:ago|back)|last\s*month|a\s*month\s*ago)\b/i);
  if (monthsAgoMatch) {
    const months = monthsAgoMatch[1] ? parseInt(monthsAgoMatch[1], 10) : 1;
    const d = new Date(now);
    d.setMonth(d.getMonth() - months);
    return d.toISOString().split('T')[0];
  }

  // Explicit ISO date: "2026-10-02" or "2026/10/02"
  const isoMatch = text.match(/\b(202\d[-/](?:0?[1-9]|1[0-2])[-/](?:0?[1-9]|[12]\d|3[01]))\b/);
  if (isoMatch) {
    return isoMatch[1].replace(/\//g, '-');
  }

  // Explicit DD/MM/YYYY or DD-MM-YYYY: "21/09/2026" or "21-09-2026"
  const ddmmyyyyMatch = text.match(/\b(0?[1-9]|[12]\d|3[01])[-/.](0?[1-9]|1[0-2])[-/.](202\d)\b/);
  if (ddmmyyyyMatch) {
    const day = ddmmyyyyMatch[1].padStart(2, '0');
    const month = ddmmyyyyMatch[2].padStart(2, '0');
    const year = ddmmyyyyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Explicit month names (e.g. "applied on 2nd Oct", "i had applied on 21 sept", "applied Sep 28", "21st sept")
  const monthRegex = /\b(?:(?:i\s+)?(?:had\s+)?applied\s+(?:on\s+)?)?(?:(0?[1-9]|[12]\d|3[01])(?:st|nd|rd|th)?\s+)?(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:\s+(0?[1-9]|[12]\d|3[01])(?:st|nd|rd|th)?)?(?:,?\s+(202\d))?\b/i;
  const monthMatch = lower.match(monthRegex);
  if (monthMatch && (monthMatch[1] || monthMatch[3])) {
    const monthMap = {
      jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
      may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7,
      sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11
    };
    const mStr = monthMatch[2].toLowerCase();
    const month = monthMap[mStr];
    if (month !== undefined) {
      const day = parseInt(monthMatch[1] || monthMatch[3] || '1', 10);
      const year = monthMatch[4] ? parseInt(monthMatch[4], 10) : now.getFullYear();
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dt = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${dt}`;
      }
    }
  }

  return defaultDate !== undefined ? defaultDate : now.toISOString().split('T')[0];
}

/**
 * Smart Source Parser to detect application platform from conversational text
 * Handles "applied through linkedin", "via indeed", "on glassdoor", "company website", etc.
 */
export function parseJobSource(text) {
  const lower = (text || '').toLowerCase();
  
  if (/\b(?:(?:i\s+)?(?:had\s+)?applied\s+(?:on|through|via|from)\s+)?linkedin\b/i.test(lower)) return 'LinkedIn';
  if (/\b(?:(?:i\s+)?(?:had\s+)?applied\s+(?:on|through|via|from)\s+)?indeed\b/i.test(lower)) return 'Indeed';
  if (/\b(?:(?:i\s+)?(?:had\s+)?applied\s+(?:on|through|via|from)\s+)?glassdoor\b/i.test(lower)) return 'Glassdoor';
  if (/\b(?:(?:i\s+)?(?:had\s+)?applied\s+(?:on|through|via|from)\s+)?(?:wellfound|angel(?:\s*list)?)\b/i.test(lower)) return 'Wellfound';
  if (/\b(?:(?:i\s+)?(?:had\s+)?applied\s+(?:on|through|via|from)\s+)?naukri\b/i.test(lower)) return 'Naukri';
  if (/\b(?:(?:i\s+)?(?:had\s+)?applied\s+(?:on|through|via|from)\s+)?instahyre\b/i.test(lower)) return 'Instahyre';
  if (/\b(?:(?:i\s+)?(?:had\s+)?applied\s+(?:on|through|via|from)\s+)?(?:company\s*(?:website|portal|careers?)|careers?\s*(?:site|page)|direct\s*portal)\b/i.test(lower)) return 'Company Career Site';
  if (/\b(?:(?:i\s+)?(?:had\s+)?applied\s+(?:on|through|via|from)\s+)?(?:employee\s+)?referral\b/i.test(lower)) return 'Employee Referral';
  if (/\b(?:(?:i\s+)?(?:had\s+)?applied\s+(?:on|through|via|from)\s+)?(?:direct\s+)?email\b/i.test(lower)) return 'Direct Email';

  return null;
}


// Curated company intelligence database for offline mode
const COMPANY_DATABASE = {
  samsung: {
    name: "Samsung",
    overview: "Samsung is a global technology leader headquartered in Suwon, South Korea, best known for Samsung Electronics, Samsung Semiconductor / Foundry, Samsung MX (Mobile eXperience), and global R&D institutes (e.g., Samsung R&D Institute India - SRI-B/SRI-N, SAIT).",
    divisions: ["Samsung Electronics (Consumer Devices, Displays)", "Samsung Semiconductor (Memory, Foundry, Exynos)", "Samsung MX (Galaxy Smartphones, Wearables, One UI)", "Samsung SDS (Enterprise Cloud & IT Solutions)"],
    roles: ["Software Engineer (C++, Java, Android OS, Embedded)", "AI / Machine Learning Engineer (On-device AI, Vision)", "VLSI / Chip Design Engineer", "Cloud & Backend Engineer", "Firmware & Kernel Developer"],
    interviewProcess: [
      "Online Coding Test: Known for the Samsung Software Competency Test (focuses on DSA: BFS/DFS, Backtracking, Simulation, Graph theory with strict time/memory limits).",
      "Technical Round 1: Core CS fundamentals (Operating Systems, Memory management, Pointers, OOPs, Multithreading, Cache coherence).",
      "Technical Round 2: Domain specialization (Embedded C, Android internals, System Design, or Deep Learning depending on team).",
      "HR & Culture Fit: Behavioral questions, work ethics, team collaboration, and alignment with Samsung's core values."
    ],
    sampleQuestions: [
      "Implement a custom memory allocator or LRU Cache in C++ / Java.",
      "Solve a multi-source shortest path or backtracking grid simulation problem with state constraints.",
      "Explain the difference between process and thread, virtual memory, and page replacement algorithms.",
      "How does inter-process communication (IPC) work, and how would you avoid deadlocks in a multi-threaded system?",
      "How do you profile and optimize battery consumption and memory footprint in resource-constrained devices?"
    ],
    careerUrl: "https://www.samsung.com/global/careers/",
    altCareerUrl: "https://semiconductor.samsung.com/careers/"
  },
  google: {
    name: "Google (Alphabet)",
    overview: "Google is one of the world's leading technology giants, specializing in search engine technology, cloud computing, generative AI (Gemini), software (Android, Chrome), and hardware (Pixel).",
    divisions: ["Core Search & Ads", "Google Cloud Platform (GCP)", "Google DeepMind / AI Research", "Android & Pixel Platforms", "YouTube"],
    roles: ["Software Engineer (SDE I, SDE II, Senior)", "AI / ML Research Scientist", "Site Reliability Engineer (SRE)", "Product Manager", "Cloud Solutions Architect"],
    interviewProcess: [
      "Online Assessment / Phone Screen: 1-2 LeetCode Medium/Hard algorithmic coding questions.",
      "Onsite Technical Rounds (3-4 rounds): Data Structures, Algorithms, Complexity Analysis, Clean Code.",
      "System Design Round: Distributed systems, scalability, caching, load balancing (for L4+ roles).",
      "Googleyness & Leadership: Assessing intellectual humility, collaboration, ethics, and ambiguity navigation."
    ],
    sampleQuestions: [
      "Design a distributed rate limiter or web crawler.",
      "Trie-based autocomplete system with prefix frequency ranking.",
      "Dynamic programming & graph optimization problems.",
      "Tell me about a time you had to make a technical decision without having all the information."
    ],
    careerUrl: "https://careers.google.com/"
  },
  microsoft: {
    name: "Microsoft",
    overview: "Microsoft is a global leader in cloud computing (Azure), enterprise software (Windows, Office 365), developer tools (GitHub, VS Code), gaming (Xbox), and AI integrations (Copilot).",
    divisions: ["Cloud + AI (Azure)", "Experiences & Devices (Windows, Office)", "GitHub & Developer Tools", "Gaming (Xbox)"],
    roles: ["Software Engineer", "Cloud Solution Architect", "Data & Applied Scientist", "Program Manager (PM)"],
    interviewProcess: [
      "Codility / HackerRank Coding Screen: 2-3 algorithmic problems.",
      "Virtual Onsite (4-5 rounds): Data structures, Object-oriented design, System Design, and Hiring Manager round.",
      "The 'As-Appropriate' (AA) Interview: Focuses on high-level problem solving, architecture, and cultural fit."
    ],
    sampleQuestions: [
      "Design a global file synchronization system like OneDrive.",
      "Binary tree serialization and deserialization.",
      "Concurrency handling and microservices resilience in Azure.",
      "Describe a project where you demonstrated growth mindset after failure."
    ],
    careerUrl: "https://careers.microsoft.com/"
  },
  amazon: {
    name: "Amazon (AWS)",
    overview: "Amazon is an e-commerce, cloud computing (AWS), digital streaming, and artificial intelligence powerhouse guided by its 16 Leadership Principles.",
    divisions: ["Amazon Web Services (AWS)", "Retail & Marketplace", "Prime Video & Studios", "Consumer Devices (Alexa, Ring)"],
    roles: ["Software Development Engineer (SDE I/II/III)", "DevOps / Systems Engineer", "Technical Program Manager (TPM)"],
    interviewProcess: [
      "Online Assessment (OA): 2 coding problems + Work Style Assessment.",
      "The 'Loop' (4-5 rounds): Coding, Object-Oriented Design, System Design, and the designated 'Bar Raiser' round.",
      "Every single round dedicates 20-30 minutes to Amazon's 16 Leadership Principles using the STAR method."
    ],
    sampleQuestions: [
      "Design Amazon's shopping cart or real-time package tracking system.",
      "Top K frequent elements in a massive stream of data.",
      "Leadership Principle: Tell me about a time you disagreed with your manager and committed anyway.",
      "Leadership Principle: Give an example of a time you had to dive deep into a technical issue."
    ],
    careerUrl: "https://amazon.jobs/"
  },
  stripe: {
    name: "Stripe",
    overview: "Stripe is a financial infrastructure platform for the internet, powering transactions for millions of businesses from startups to Fortune 500s.",
    divisions: ["Payments & Issuing", "Global Financial Infrastructure", "Billing & Subscriptions", "Connect & Platforms"],
    roles: ["Full Stack Engineer", "Backend / Infrastructure Engineer", "Security Engineer", "Product Engineer"],
    interviewProcess: [
      "Take-home or Live Coding Screen: Practical coding using your own IDE, open book, real-world API building.",
      "Virtual Onsite: Debugging existing production code, System Design, Architecture, and Integration challenge.",
      "Manager & Cultural Alignment: Collaboration, code craft, empathy, and product velocity."
    ],
    sampleQuestions: [
      "Design an idempotent payment processing API with webhooks and retry queues.",
      "Live debugging: Find and fix bugs in a provided codebase under test conditions.",
      "How do you design a database schema for multi-currency automated payouts?",
      "Refactoring legacy payment endpoints with zero downtime."
    ],
    careerUrl: "https://stripe.com/jobs"
  },
  paytm: {
    name: "Paytm (One97 Communications)",
    overview: "Paytm is India's leading digital payments, financial technology, and QR soundbox merchant ecosystem, founded by Vijay Shekhar Sharma. It powers payments, bill utilities, banking, commerce, and cloud solutions for millions of consumers and merchants across India.",
    divisions: ["Payments & UPI Infrastructure", "Merchant Soundbox & POS Hardware Solutions", "Paytm Money (Wealth, Stocks, Mutual Funds)", "Travel, Movie & Event Ticketing Commerce"],
    roles: ["Software Engineer (Backend: Java, Spring Boot, Microservices, Node.js)", "Frontend / Full Stack Engineer (React, Next.js, React Native)", "Data Engineer & Big Data (Kafka, Spark, Hadoop, ClickHouse)", "Cloud DevOps & Site Reliability Engineer (AWS, Kubernetes, Scale)"],
    interviewProcess: [
      "Online Assessment (OA): HackerEarth/Mettl test with 2-3 DSA problems (Arrays, HashMaps, Graphs, Greedy, Dynamic Programming).",
      "Technical Round 1 (Problem Solving & DSA): In-depth algorithmic coding, multithreading, concurrency, and OOPs concepts in Java/C++/Go.",
      "Technical Round 2 (System Design & LLD): Low-Level Design (e.g. Designing a Wallet, Rate Limiter, or Soundbox audio queue) with strict transaction idempotency and zero-loss guarantees.",
      "Techno-Managerial Round: Past production challenges, handling traffic spikes during flash sales, distributed locks, and team culture."
    ],
    sampleQuestions: [
      "Design a distributed, highly available digital wallet system with strict transaction idempotency and ACID guarantees.",
      "How would you architect a real-time event streaming and audio notification pipeline for 10+ million Paytm Soundbox devices?",
      "How do you handle race conditions and concurrency when two simultaneous debit requests hit the same account balance?",
      "Implement a custom in-memory cache with TTL and LRU eviction policy from scratch.",
      "Explain how distributed locks work in high-throughput microservices using Redis (Redlock) or ZooKeeper."
    ],
    careerUrl: "https://paytm.com/careers"
  }
};

export const AiExtractor = {
  /**
   * Main entry point to parse a raw JD or a conversational follow-up
   */
  async processInput(text, existingJob = null, history = [], allApplications = [], userProfile = null) {
    const settings = Config.getSettings();

    const provider = settings.aiProvider || 'gemini';
    let result = null;

    // 1. If user explicitly chose Offline Heuristics
    if (provider === 'heuristic') {
      result = await this.extractWithHeuristics(text, existingJob, allApplications, userProfile);
    } else {
      // 2. Try Vercel Serverless /api/chat with selected provider & persistent DB context
      try {
        const serverRes = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            existingJob,
            history,
            allApplications,
            userProfile,
            provider,
            apiKey: (provider === 'openai' ? settings.openaiKey : settings.geminiKey) || undefined
          })
        });

        if (serverRes.ok) {
          const json = await serverRes.json();
          if (json.message) {
            result = {
              message: json.message,
              data: json.data || null,
              profileUpdate: json.profileUpdate || null,
              provider: json.provider || provider
            };
          }
        }
      } catch (serverErr) {
        console.warn('Serverless endpoint not reachable, trying direct client API:', serverErr);
      }

      // 3. Direct Client Fallback:
      if (!result && provider === 'openai' && settings.openaiKey) {
        try {
          result = await this.extractWithOpenAI(text, existingJob, history, settings, allApplications, userProfile);
        } catch (err) {
          console.warn('Client OpenAI extraction failed:', err);
        }
      } else if (!result && provider === 'gemini' && settings.geminiKey) {
        try {
          result = await this.extractWithGemini(text, existingJob, history, settings, allApplications, userProfile);
        } catch (err) {
          console.warn('Client Gemini extraction failed:', err);
        }
      }

      // 4. Fallback: Offline Smart Career Advisor & Heuristic Extractor
      if (!result) {
        result = await this.extractWithHeuristics(text, existingJob, allApplications, userProfile);
      }
    }

    // Post-processing deterministic guarantee for follow-up edits:
    const isQueryOrQuestion = /^(what|when|where|which|how|who|did|have|list|show|any|status|my|add|update)\b/i.test(text.trim());
    const detectedDate = !isQueryOrQuestion ? parseAppliedDate(text, null) : null;
    const detectedSource = !isQueryOrQuestion ? parseJobSource(text) : null;

    if (!isQueryOrQuestion && existingJob && (detectedDate || detectedSource)) {
      if (!result || !result.data) {
        result = result || {};
        result.data = { ...existingJob };
        result.message = result.message || `Updated **${existingJob.companyName}** (${existingJob.roleTitle}) with the latest details.`;
      }
    }

    if (result && result.data) {
      if (detectedDate) {
        result.data.appliedDate = detectedDate;
      }
      if (detectedSource) {
        result.data.source = detectedSource;
      }
    }

    return result;
  },

  /**
   * Gemini API Extraction & Career Advisory
   */
  async extractWithGemini(text, existingJob, history, settings, allApplications = [], userProfile = null) {
    const model = settings.geminiModel || 'gemini-3.8-flash';
    const apiKey = settings.geminiKey;

    const today = new Date().toISOString().split('T')[0];
    const databaseSummary = Array.isArray(allApplications) && allApplications.length > 0
      ? allApplications.map((a, i) => `#${i+1}: ${a.companyName || 'Unknown'} | Role: ${a.roleTitle || 'Undisclosed'} | Status: ${a.status || 'Applied'} | Salary: ${a.salary || 'N/A'} | Applied Date: ${a.appliedDate || 'N/A'}`).join('\n')
      : '0 applications in database.';

    const profileSummary = userProfile
      ? `Name: ${userProfile.fullName || 'N/A'} | 10th: ${userProfile.education?.tenth?.marks || 'N/A'} | 12th: ${userProfile.education?.twelfth?.marks || 'N/A'} | College: ${userProfile.education?.college?.collegeName || 'N/A'} | Projects: ${(userProfile.projects || []).length} | Certifications: ${(userProfile.certifications || []).length}`
      : 'No profile recorded yet.';

    const systemPrompt = `You are Zuno, an expert AI Job Application Tracker and Career Advisor Assistant at JobTrackerAI.
Your name is Zuno. Always introduce or refer to yourself as Zuno when asked about your identity.
TODAY'S REFERENCE DATE: ${today}

CRITICAL APPLIED DATE RULE:
If the user specifies when they applied (e.g. "applied last week", "applied 3 days ago", "applied yesterday", "applied on 2nd Oct", "confirmation email date"), CALCULATE and return the exact YYYY-MM-DD appliedDate relative to Today (${today})! Only default to ${today} if no past application timeframe was mentioned.

Your capabilities:
1. JOB EXTRACTION: When user pastes a Job Description (JD), link, or status update:
   - Extract companyName, roleTitle, jobType, workMode, location, salary, source, applicationUrl, sourceUrl, status, appliedDate, skills, notes.
   - Return this in the "data" object.
2. PERSISTENT DATABASE & SESSION QUERYING:
   - You have direct access to the user's persistent backend database (${allApplications.length} applications stored) and active session instance!
   - When asked about their applications, history, stats, counts, interviews, offers, or specific companies they applied to:
     * Answer directly, accurately, and thoroughly using the database records.
     * Set "data": null.
3. PROFILE / ABOUT ME INTELLIGENCE & UPDATES:
   - When user tells you to add/update projects, semester marks, certifications, 10th/12th marks, personal details, or social links:
     * Confirm in "message", set "data": null, and provide "profileUpdate" in JSON output:
       - Projects: { "type": "add_project", "project": { "title": "...", "description": "...", "techStack": "...", "projectUrl": "...", "startDate": "...", "finishDate": "..." } }
       - Certifications: { "type": "add_certification", "certification": { "name": "...", "issuer": "...", "issueDate": "...", "credentialUrl": "..." } }
       - Semester marks: { "type": "update_sem_marks", "sem": "sem1" to "sem8", "score": "..." }
       - 10th/12th: { "type": "update_education_10th"|"update_education_12th", "schoolName": "...", "board": "...", "marks": "...", "year": "..." }
       - College: { "type": "update_college", "collegeName": "...", "degree": "...", "branch": "...", "overallCgpa": "...", "graduationYear": "..." }
       - Personal details: { "type": "update_personal", "fullName": "...", "headline": "...", "bio": "...", "email": "...", "phone": "...", "location": "...", "githubUrl": "...", "linkedinUrl": "...", "portfolioUrl": "..." }
     * STRICT URL ROUTING RULE:
       - If user provides a GitHub link, assign it to "githubUrl" in update_personal. NEVER put it in "bio"!
       - If user provides a LinkedIn link, assign it to "linkedinUrl" in update_personal. NEVER put it in "bio"!
       - If user provides a Portfolio or personal website link, assign it to "portfolioUrl" in update_personal. NEVER put it in "bio"!
       - The "bio" field is ONLY for professional summary / self-introduction text. Do NOT dump URLs into "bio".
   - When user asks about their profile, answer using their data.
4. CAREER & COMPANY QUESTIONS: When user asks questions about a company, interview questions, role expectations, or career tips:
   - Provide a comprehensive, structured, and insightful markdown answer in "message".
   - Set "data": null.
5. CANDIDATE PROFILE VS COMPANY REQUIREMENTS COMPARISON ("/compare" COMMAND):
   - ONLY when user explicitly uses "/compare" (or asks to compare their profile against company requirements):
     * Compare candidate's About Me data (education, sem 1-8 marks, projects with tech and finish dates, certs, skills) against company requirements.
     * Format a rich Markdown report with Match Score %, Skills alignment table (matched vs missing), Projects fit, Academic review, Strengths, and Gap preparation.
     * Set "data": null and "profileUpdate": null.

Return ONLY valid JSON matching this schema:
{
  "message": "Your rich, formatted markdown answer to the user",
  "data": { ... } or null,
  "profileUpdate": { ... } or null
}`;

    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `${systemPrompt}\n\nPERSISTENT BACKEND DATABASE:\n${databaseSummary}\n\nUSER PROFILE:\n${profileSummary}\n\nCurrent Active Job in Session (if any):\n${existingJob ? JSON.stringify(existingJob, null, 2) : 'None (Fresh Session)'}\n\nUser Message:\n"${text}"`
            }
          ]
        }
      ]
    };

    const candidateModels = [
      settings.geminiModel,
      'gemini-3.8-flash',
      'gemini-3.5-flash-lite',
      'gemini-3.5-flash',
      'gemini-3.7-flash',
      'gemini-flash-latest'
    ].filter(Boolean);

    let lastError = null;
    let candidateText = null;

    for (const m of candidateModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });

        if (response.ok) {
          const data = await response.json();
          candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (candidateText) break;
        } else {
          const errorData = await response.json().catch(() => ({}));
          lastError = errorData.error?.message || response.statusText;
        }
      } catch (e) {
        lastError = e.message;
      }
    }

    if (!candidateText) {
      throw new Error(lastError || 'No response generated by Gemini');
    }

    let parsed = null;
    try {
      parsed = JSON.parse(candidateText);
    } catch {
      const jsonMatch = candidateText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
        } catch {
          parsed = { message: candidateText, data: null };
        }
      } else {
        parsed = { message: candidateText, data: null };
      }
    }

    return {
      message: parsed.message || candidateText,
      data: parsed.data || null,
      profileUpdate: parsed.profileUpdate || null,
      provider: 'gemini'
    };
  },

  async extractWithOpenAI(text, existingJob, history, settings, allApplications = [], userProfile = null) {
    const apiKey = settings.openaiKey;
    const url = 'https://api.openai.com/v1/chat/completions';

    const databaseSummary = Array.isArray(allApplications) && allApplications.length > 0
      ? allApplications.map((a, i) => `#${i+1}: ${a.companyName || 'Unknown'} | Role: ${a.roleTitle || 'Undisclosed'} | Status: ${a.status || 'Applied'} | Salary: ${a.salary || 'N/A'} | Applied Date: ${a.appliedDate || 'N/A'}`).join('\n')
      : '0 applications in database.';

    const systemPrompt = `You are Zuno, an expert AI Job Application Tracker and Career Advisor Assistant at JobTrackerAI.
Your name is Zuno.
You have direct live access to the user's persistent backend database (${allApplications.length} applications stored) and active session instance!
When user asks about past applications, statistics, interview status, specific applied companies, or advice: provide a comprehensive markdown answer using the database records in "message" and set "data": null.
When user asks you to add projects, certifications, semester marks, or update profile: return structured "profileUpdate" in JSON and set "data": null.
When user asks to compare profile vs company requirements using "/compare": provide a comprehensive comparative analysis (Match score %, skills match vs missing, projects alignment, sem marks & education review, strengths, gap plan) and set "data": null.
When user pastes a job description (JD) or update: extract the job details in "data".
Return JSON with { "message": "...", "data": { ... } or null, "profileUpdate": { ... } or null }.`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: "json_object" },
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `PERSISTENT BACKEND DATABASE:\n${databaseSummary}\n\nUSER PROFILE:\n${userProfile ? JSON.stringify(userProfile) : 'None'}\n\nActive Job in Session: ${existingJob ? JSON.stringify(existingJob) : 'None'}\n\nUser Input: ${text}`
          }
        ],
        temperature: 0.2
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `OpenAI API error ${response.status}`);
    }

    const json = await response.json();
    const content = json.choices?.[0]?.message?.content;
    const parsed = JSON.parse(content);

    return {
      message: parsed.message || 'Processed request successfully.',
      data: parsed.data || null,
      profileUpdate: parsed.profileUpdate || null,
      provider: 'openai'
    };
  },

  /**
   * Smart Offline NLP Heuristic & Career Advisor
   * Handles company research, interview prep, greetings, AND job parsing offline
   */
  extractWithHeuristics(text, existingJob = null, allApplications = [], userProfile = null) {
    const trimmed = text.trim();
    const lower = trimmed.toLowerCase();

    // 0. Check for /compare command
    const isCompareCommand = /^\/(?:compare|cmp)\b/i.test(trimmed) || /^(?:compare\s+(?:me|my\s+profile|profile)\b)/i.test(lower);
    if (isCompareCommand) {
      const queryTarget = trimmed.replace(/^\/(?:compare|cmp)\s*/i, '').replace(/^(?:compare\s+(?:me|my\s+profile|profile)(?:\s+(?:with|to|against))?\s*)/i, '').trim();
      return this.generateProfileJobComparison(userProfile, existingJob, queryTarget, allApplications);
    }

    // 1. Check for greetings
    const isGreeting = /^(hi|hello|hey|hiya|howdy|good\s*(morning|afternoon|evening)|sup|yo|hola)\b[!?. ]*$/i.test(trimmed);
    if (isGreeting) {
      return {
        message: "👋 **Hello!** I'm **Zuno**, your **JobTrackerAI** assistant.\n\nHere is how I can help you:\n- **Track Applications**: Paste any Job Description to extract and track.\n- **About Me Profile**: Tell me your projects (*\"Add project: JobTracker with React, link github.com...\"*), semester marks (*\"Add sem 5 marks: 8.9\"*), or certifications!\n- **Query Applications**: Ask *\"How many jobs have I applied to?\"*, *\"Show my applications\"*, or *\"Did I apply to Stripe?\"*\n- **Ask About Any Company**: e.g. *'Tell me about Samsung'*, *'What does Google expect?'*\n- **Interview Preparation**: Ask for interview questions, preparation tips, or role breakdowns.",
        data: null
      };
    }

    // 2. Check for "Who are you" / "What's your name"
    if (/^(who are you|what is your name|what's your name|your name)\b/i.test(lower)) {
      return {
        message: "👋 I'm **Zuno**, your intelligent AI career assistant and job application tracker at **JobTrackerAI**!\n\nI can help you parse job descriptions, organize your applications, manage your personal profile & project portfolio, and prepare for interviews.",
        data: null
      };
    }

    // 3. Check for "How are you"
    if (/\b(how are you|how's it going|how are you doing)\b/i.test(lower)) {
      return {
        message: "I'm **Zuno**, doing great and fully energized to help you land your dream job! 🚀\n\nYou can:\n- Paste a **Job Description** to extract and track it.\n- Tell me about your **projects, certifications, or semester marks** to update your profile.\n- Ask me about your **saved applications** (*\"Show my applications\"* or *\"How many jobs did I apply to?\"*).\n- Ask me about any company (e.g. **Samsung**, **Google**, **Stripe**).\n- Ask for **interview questions** and preparation advice for any role.\n\nWhat would you like to explore?",
        data: null
      };
    }

    // 4. Check for Help / Capabilities
    const isHelp = /^(help|what can you do|how does this work|commands|instructions)\b/i.test(lower);
    if (isHelp) {
      return {
        message: "💡 **How Zuno & JobTrackerAI Work:**\n\n1. **Track Applications**: Paste raw text from LinkedIn, Indeed, Glassdoor, or careers pages. I will parse company, role, salary, work mode, and URLs.\n2. **Candidate Profile (About Me)**: You can tell me *\"Add project: JobTrackerAI with React & Node, finished yesterday, link https://...\"* or *\"Add sem 4 marks: 8.9\"* and I will automatically update your profile!\n3. **Query Your Database**: Ask me *\"How many applications do I have?\"*, *\"Show all applications\"*, or *\"Did I apply to Stripe?\"* anytime.\n4. **Store in Database**: Type **/store** to permanently save your drafted application to Supabase and your dashboard.\n5. **Company Intelligence**: Ask about any company (e.g., *'Can you tell about Samsung company?'*) for an overview, open roles, culture, and interview rounds.\n6. **Interview Preparation**: Ask *'What interview questions will they ask?'* for customized questions based on your tracked roles.",
        data: null
      };
    }

    // 5. Check for Casual affirmations
    const isCasual = /^(ok|okay|cool|thanks|thank you|great|awesome|understood|got it)\b[!?. ]*$/i.test(trimmed);
    if (isCasual) {
      return {
        message: "You're welcome! Whenever you have another job to track or want to update your projects and profile, feel free to ask.",
        data: null
      };
    }

    // ==========================================
    // Profile & "About Me" Conversational Actions
    // ==========================================

    // A. Add Project
    const addProjectMatch = trimmed.match(/^(?:add\s+project|new\s+project|i\s+built\s+a\s+project|i\s+have\s+done\s+a\s+project|project)\s*[:\-]?\s*(.+)$/i);
    if (addProjectMatch) {
      const projRaw = addProjectMatch[1].trim();
      let projectUrl = '';
      const urlMatch = projRaw.match(/https?:\/\/[^\s]+/i);
      if (urlMatch) projectUrl = urlMatch[0];

      let finishDate = '';
      const dateMatch = projRaw.match(/(?:done|finish(?:ed)?|completed?)\s+(?:on\s+)?(\d{4}[-/]\d{1,2}[-/]\d{1,2}|(?:\d{1,2}(?:st|nd|rd|th)?\s+)?(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*(?:\s+\d{1,4})?|yesterday|last\s+week)/i);
      if (dateMatch) finishDate = parseAppliedDate(dateMatch[0], '') || dateMatch[1];

      let techStack = '';
      const techMatch = projRaw.match(/(?:tech\s*stack|built\s+with|using|in|tech|technologies)\s*[:\-]?\s*([a-zA-Z0-9,\.\+\#\s]+?)(?:,\s*link|,\s*done|,\s*finish|\.|$)/i);
      if (techMatch) techStack = techMatch[1].trim();

      let title = projRaw.split(/,|\swith\s|\susing\s|\sbuilt\s|\slink\s/i)[0].replace(/^project\s*[:\-]?\s*/i, '').trim();
      if (!title) title = 'My Project';

      return {
        message: `### 💻 Project Added to Your Profile!\n\n` +
          `- **Project Name:** **${title}**\n` +
          (techStack ? `- **Tech Stack:** ${techStack}\n` : '') +
          (projectUrl ? `- **Project Link:** [Open Link](${projectUrl})\n` : '') +
          (finishDate ? `- **Finished / Done Date:** ${finishDate}\n` : '') +
          `\n*This project has been added to your **About Me** section and saved to persistent storage.*`,
        profileUpdate: {
          type: 'add_project',
          project: {
            id: 'proj_' + Date.now(),
            title,
            description: projRaw,
            techStack: techStack || 'Full Stack',
            projectUrl: projectUrl,
            startDate: '',
            finishDate: finishDate || new Date().toISOString().split('T')[0]
          }
        },
        data: null
      };
    }

    // B. Add Certification
    const addCertMatch = trimmed.match(/^(?:add\s+cert(?:ification)?|new\s+cert(?:ification)?|certified\s+in|cetrifications?)\s*[:\-]?\s*(.+)$/i);
    if (addCertMatch) {
      const certRaw = addCertMatch[1].trim();
      let link = '';
      const urlMatch = certRaw.match(/https?:\/\/[^\s]+/i);
      if (urlMatch) link = urlMatch[0];

      let issuer = '';
      const issuerMatch = certRaw.match(/(?:from|by|issued\s+by|organization|platform)\s+([a-zA-Z0-9\s]+?)(?:,\s*on|\s+on|\.|$)/i);
      if (issuerMatch) issuer = issuerMatch[1].trim();

      let issueDate = '';
      const dateMatch = certRaw.match(/(?:on|in|date)\s+([a-zA-Z0-9\s,]+?)(?:\.|$)/i);
      if (dateMatch) issueDate = dateMatch[1].trim();

      let name = certRaw.split(/,|\sfrom\s|\sby\s|\sissued\s/i)[0].trim();
      if (!name) name = certRaw;

      return {
        message: `### 📜 Certification Added to Your Profile!\n\n` +
          `- **Certificate:** **${name}**\n` +
          (issuer ? `- **Issuing Organization:** ${issuer}\n` : '') +
          (issueDate ? `- **Date:** ${issueDate}\n` : '') +
          (link ? `- **Credential Link:** [Verify Badge](${link})\n` : '') +
          `\n*Saved to your **About Me** credentials list.*`,
        profileUpdate: {
          type: 'add_certification',
          certification: {
            id: 'cert_' + Date.now(),
            name,
            issuer: issuer || 'Verified Org',
            issueDate: issueDate || new Date().toISOString().split('T')[0],
            credentialUrl: link
          }
        },
        data: null
      };
    }

    // C. Add / Update Semester Marks (Sem 1 to Sem 8)
    const semMarksMatch = lower.match(/\bsem(?:ester)?\s*([1-8])\s*(?:marks?|sgpa|score|cgpa)?\s*(?:is|to|:|=|\s+was|\s+i\s+got|\s+scored)?\s*(\d+(?:\.\d+)?%?)/i);
    if (semMarksMatch) {
      const semNum = semMarksMatch[1];
      const score = semMarksMatch[2];
      return {
        message: `### 📊 Semester Marks Recorded!\n\nUpdated your **Semester ${semNum}** score to **${score}** in your academic dossier.`,
        profileUpdate: {
          type: 'update_sem_marks',
          sem: `sem${semNum}`,
          score: score
        },
        data: null
      };
    }

    // D. 10th Standard Marks & School
    const tenthMarksMatch = lower.match(/\b10th\s*(?:marks?|score|percentage|grade|board)?\s*(?:is|are|was|:|=|\s+i\s+scored)?\s*(\d+(?:\.\d+)?%?)/i);
    if (tenthMarksMatch) {
      const score = tenthMarksMatch[1];
      const schoolMatch = text.match(/(?:from|at|school)\s+([A-Z][a-zA-Z0-9\s\.\,\'\-]+?)(?:,|\.|$)/);
      const school = schoolMatch ? schoolMatch[1].trim() : '';
      return {
        message: `### 🎓 10th Standard Academic Record Updated!\n\n` +
          `- **Score / Percentage:** **${score}**\n` +
          (school ? `- **School:** ${school}\n` : '') +
          `\n*Saved to your **About Me** profile!*`,
        profileUpdate: {
          type: 'update_education_10th',
          marks: score,
          schoolName: school
        },
        data: null
      };
    }

    // E. 12th Standard Marks & College/School
    const twelfthMarksMatch = lower.match(/\b12th\s*(?:marks?|score|percentage|grade|board|puc)?\s*(?:is|are|was|:|=|\s+i\s+scored)?\s*(\d+(?:\.\d+)?%?)/i);
    if (twelfthMarksMatch) {
      const score = twelfthMarksMatch[1];
      const schoolMatch = text.match(/(?:from|at|college|school)\s+([A-Z][a-zA-Z0-9\s\.\,\'\-]+?)(?:,|\.|$)/);
      const school = schoolMatch ? schoolMatch[1].trim() : '';
      return {
        message: `### 🎓 12th Standard Academic Record Updated!\n\n` +
          `- **Score / Percentage:** **${score}**\n` +
          (school ? `- **College / School:** ${school}\n` : '') +
          `\n*Saved to your **About Me** profile!*`,
        profileUpdate: {
          type: 'update_education_12th',
          marks: score,
          schoolName: school
        },
        data: null
      };
    }

    // F. College Name & Degree
    const collegeMatch = lower.match(/(?:my\s+)?college\s+(?:is|name\s+is)\s+([a-zA-Z0-9\s\.\,\'\-]+?)(?:,|\.|$)/i);
    if (collegeMatch) {
      const colName = collegeMatch[1].trim();
      return {
        message: `### 🏛️ College Updated!\n\nRecorded **${colName}** as your college in your academic profile.`,
        profileUpdate: {
          type: 'update_college',
          collegeName: colName
        },
        data: null
      };
    }

    // G. Name Update via Zuno
    const nameMatch = trimmed.match(/^my\s+name\s+is\s+([a-zA-Z\s\.\'\-]+?)(?:[!\.]|$)/i);
    if (nameMatch) {
      const newName = nameMatch[1].trim();
      return {
        message: `Nice to meet you, **${newName}**! I have updated your name on your **About Me** profile card.`,
        profileUpdate: {
          type: 'update_personal',
          fullName: newName
        },
        data: null
      };
    }

    // H. GitHub Profile Link
    const ghMatch = trimmed.match(/(?:(?:my\s+)?github(?:\s+(?:link|profile|url|account))?\s*(?:is|:|=)?\s*)?(https?:\/\/(?:www\.)?github\.com\/[a-zA-Z0-9_\-]+(?:\/[a-zA-Z0-9_\-]+)?)/i);
    if (ghMatch || (trimmed.toLowerCase().includes('github.com') && /https?:\/\//i.test(trimmed))) {
      const ghUrl = ghMatch ? ghMatch[1] : trimmed.match(/https?:\/\/[^\s]+/)[0];
      return {
        message: `### 🐙 GitHub Profile Updated!\n\nLinked **${ghUrl}** directly to your **GitHub Profile** field in your About Me dossier.`,
        profileUpdate: {
          type: 'update_personal',
          githubUrl: ghUrl
        },
        data: null
      };
    }

    // I. LinkedIn Profile Link
    const liMatch = trimmed.match(/(?:(?:my\s+)?linkedin(?:\s+(?:link|profile|url))?\s*(?:is|:|=)?\s*)?(https?:\/\/(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9_\-]+)/i);
    if (liMatch || (trimmed.toLowerCase().includes('linkedin.com/in') && /https?:\/\//i.test(trimmed))) {
      const liUrl = liMatch ? liMatch[1] : trimmed.match(/https?:\/\/[^\s]+/)[0];
      return {
        message: `### 💼 LinkedIn Profile Updated!\n\nLinked **${liUrl}** to your **LinkedIn Profile** field in your About Me dossier.`,
        profileUpdate: {
          type: 'update_personal',
          linkedinUrl: liUrl
        },
        data: null
      };
    }

    // J. Portfolio Link
    const portMatch = trimmed.match(/(?:my\s+)?(?:portfolio|personal\s+site|website)\s*(?:is|:|=)?\s*(https?:\/\/[^\s]+)/i);
    if (portMatch) {
      const portUrl = portMatch[1];
      return {
        message: `### 🌐 Portfolio Link Updated!\n\nLinked **${portUrl}** to your **Portfolio Link** field in your About Me dossier.`,
        profileUpdate: {
          type: 'update_personal',
          portfolioUrl: portUrl
        },
        data: null
      };
    }

    // K. Querying Profile Information (Semester Marks, Projects, Summary)
    const isProfileQuery = /\b(what\s+are\s+my\s+sem\s+marks|show\s+my\s+sem\s+marks|my\s+semester\s+marks|what\s+projects\s+(?:have\s+i|did\s+i)\s+(?:done|built|make)|show\s+my\s+projects|list\s+my\s+projects|show\s+(?:my\s+)?profile|what\s+is\s+my\s+profile|tell\s+me\s+about\s+my\s+profile|my\s+education|my\s+certifications?)\b/i.test(lower);
    if (isProfileQuery) {
      const prof = userProfile || Config.getUserProfile();
      if (/\b(?:sem|semester)\b/i.test(lower)) {
        const s = prof.education?.college?.semesterMarks || {};
        return {
          message: `### 📊 Your Semester Marks (Sem 1 to 8):\n\n` +
            `| Semester | SGPA / Marks |\n` +
            `|---|---|\n` +
            `| **Sem 1** | ${s.sem1 || 'Not set'} |\n` +
            `| **Sem 2** | ${s.sem2 || 'Not set'} |\n` +
            `| **Sem 3** | ${s.sem3 || 'Not set'} |\n` +
            `| **Sem 4** | ${s.sem4 || 'Not set'} |\n` +
            `| **Sem 5** | ${s.sem5 || 'Not set'} |\n` +
            `| **Sem 6** | ${s.sem6 || 'Not set'} |\n` +
            `| **Sem 7** | ${s.sem7 || 'Not set'} |\n` +
            `| **Sem 8** | ${s.sem8 || 'Not set'} |\n\n` +
            `*College: **${prof.education?.college?.collegeName || 'N/A'}** (${prof.education?.college?.degree || 'N/A'})*`,
          data: null
        };
      } else if (/\bprojects?\b/i.test(lower)) {
        const projs = prof.projects || [];
        if (projs.length === 0) {
          return {
            message: "You don't have any projects saved in your **About Me** profile yet. You can say *\"Add project: [title] [tech] [link]\"* or add them on your About Me page!",
            data: null
          };
        }
        let msg = `### 💻 Your Portfolio Projects (${projs.length}):\n\n`;
        projs.forEach((p, idx) => {
          msg += `${idx + 1}. **${p.title}**\n` +
            `   - **Tech Stack:** ${p.techStack || 'N/A'}\n` +
            (p.projectUrl ? `   - **Link:** [Open Project](${p.projectUrl})\n` : '') +
            (p.finishDate ? `   - **Completed:** ${p.finishDate}\n` : '') + '\n';
        });
        return { message: msg, data: null };
      } else {
        // Overall profile summary
        return {
          message: `### 👤 Candidate Dossier Summary:\n\n` +
            `- **Name:** **${prof.fullName || 'Not specified'}**\n` +
            `- **Headline:** ${prof.headline || 'Not specified'}\n` +
            `- **10th Standard:** ${prof.education?.tenth?.marks || 'N/A'} (${prof.education?.tenth?.schoolName || 'N/A'})\n` +
            `- **12th Standard:** ${prof.education?.twelfth?.marks || 'N/A'} (${prof.education?.twelfth?.schoolName || 'N/A'})\n` +
            `- **Degree College:** ${prof.education?.college?.collegeName || 'N/A'} (${prof.education?.college?.degree || 'N/A'} - ${prof.education?.college?.branch || 'N/A'})\n` +
            `- **Projects Tracked:** **${(prof.projects || []).length}** projects\n` +
            `- **Certifications:** **${(prof.certifications || []).length}** credentials\n\n` +
            `*You can view and edit everything on the **About Me** tab in the top bar!*`,
          data: null
        };
      }
    }

    // 6. Check for Current Active Application / Session Instance
    const isCurrentInstanceQuery = /\b(current\s+(?:instance|job|application|draft)|active\s+(?:application|job|instance)|what\s+job\s+am\s+i\s+(?:looking\s+at|working\s+on|viewing)|what\s+is\s+(?:the\s+)?(?:current|active)\s*(?:job|application)?)\b/i.test(lower);
    if (isCurrentInstanceQuery) {
      if (existingJob && (existingJob.companyName || existingJob.roleTitle)) {
        return {
          message: `### 📌 Current Active Application in Session:\n\n` +
            `- **Company:** **${existingJob.companyName || 'Not specified'}**\n` +
            `- **Role:** ${existingJob.roleTitle || 'Not specified'}\n` +
            `- **Status:** \`${existingJob.status || 'Applied'}\`\n` +
            `- **Salary / CTC:** ${existingJob.salary || 'Not specified'}\n` +
            `- **Applied Date:** ${existingJob.appliedDate || 'Not specified'}\n` +
            `- **Work Mode & Location:** ${existingJob.workMode || 'N/A'} • ${existingJob.location || 'N/A'}\n` +
            `- **Source / Portal:** ${existingJob.source || 'Direct'}\n` +
            (existingJob.jobLink ? `- **Job Link:** [Open Application Link](${existingJob.jobLink})\n` : '') +
            (existingJob.skills && existingJob.skills.length > 0 ? `- **Skills:** ${existingJob.skills.join(', ')}\n` : '') +
            (existingJob.notes ? `- **Notes:** ${existingJob.notes}\n` : '') +
            `\n*You can modify any field by chatting with me, or type **/store** to persist it to your database!*`,
          data: null
        };
      } else {
        return {
          message: "There is currently no active draft or selected application in this session. You can paste a job description or select an existing application from your tracker to activate it!",
          data: null
        };
      }
    }

    // 7. Check for Database Application Statistics & Counts
    const isStatsQuery = /\b(how\s+many\s+(?:jobs|applications)|application\s+stats|stats|summary\s+of\s+(?:my\s+)?applications|overview\s+of\s+(?:my\s+)?applications|how\s+is\s+my\s+job\s+search\s+going)\b/i.test(lower) || lower === '/stats';
    if (isStatsQuery) {
      if (!allApplications || allApplications.length === 0) {
        return {
          message: "📊 **Your Application Stats:**\n\nYou currently have **0 stored applications** in your persistent database.\nPaste a job description to track your first application!",
          data: null
        };
      }
      const total = allApplications.length;
      const appliedCount = allApplications.filter(a => (a.status || '').toLowerCase() === 'applied').length;
      const interviewingCount = allApplications.filter(a => (a.status || '').toLowerCase() === 'interviewing').length;
      const offerCount = allApplications.filter(a => (a.status || '').toLowerCase() === 'offer').length;
      const rejectedCount = allApplications.filter(a => (a.status || '').toLowerCase() === 'rejected').length;

      return {
        message: `### 📊 Your Persistent Job Tracker Stats:\n\n` +
          `- **Total Tracked Applications:** **${total}**\n` +
          `- 📝 **Applied / Pending:** **${appliedCount}**\n` +
          `- 🎙️ **Interviewing:** **${interviewingCount}**\n` +
          `- 🎉 **Offers Received:** **${offerCount}**\n` +
          `- ❌ **Rejected:** **${rejectedCount}**\n\n` +
          `*Type **"Show all applications"** or ask about any company (e.g. *"Did I apply to Stripe?"*) to inspect details.*`,
        data: null
      };
    }

    // 8. Check for "Show all applications" / "List applications"
    const isListQuery = /\b(?:show|list|display|view|get)\s+(?:all\s+)?(?:past\s+|stored\s+|my\s+)?(?:jobs|applications)\b/i.test(lower) ||
                        /\bwhat\s+(?:jobs|applications)\s+(?:did\s+i|have\s+i)\s+(?:apply|applied|stored|saved)\b/i.test(lower) ||
                        lower === '/list';
    if (isListQuery) {
      if (!allApplications || allApplications.length === 0) {
        return {
          message: "You don't have any applications stored in your persistent database yet. Paste a job description to add one!",
          data: null
        };
      }

      let markdown = `### 📋 Stored Applications in Your Database (${allApplications.length}):\n\n`;
      markdown += `| # | Company | Role | Status | Salary | Applied Date |\n`;
      markdown += `|---|---|---|---|---|---|\n`;
      allApplications.forEach((app, idx) => {
        const co = app.companyName || 'Unknown';
        const role = app.roleTitle || 'Role';
        const st = app.status || 'Applied';
        const sal = app.salary || '-';
        const dt = app.appliedDate || '-';
        markdown += `| ${idx + 1} | **${co}** | ${role} | \`${st}\` | ${sal} | ${dt} |\n`;
      });
      markdown += `\n*Ask me about any specific company or type **"Any interviews?"** to filter!*`;

      return {
        message: markdown,
        data: null
      };
    }

    // 9. Status-Specific Filter Queries (Interviewing / Offers / Rejected)
    const isInterviewFilter = /\b(?:interviews?|interviewing)\b/i.test(lower) && /\b(?:which|what|show|list|any|my|do\s+i\s+have)\b/i.test(lower);
    if (isInterviewFilter) {
      const matches = (allApplications || []).filter(a => (a.status || '').toLowerCase() === 'interviewing');
      if (matches.length === 0) {
        return {
          message: "🎙️ You currently have **0 applications** in the **Interviewing** stage. Keep pushing forward!",
          data: null
        };
      }
      let msg = `### 🎙️ Applications in Interviewing Stage (${matches.length}):\n\n`;
      matches.forEach((m, idx) => {
        msg += `${idx + 1}. **${m.companyName}** — *${m.roleTitle}* (Applied: ${m.appliedDate || 'N/A'})\n`;
      });
      return { message: msg, data: null };
    }

    const isOfferFilter = /\b(?:offers?)\b/i.test(lower) && /\b(?:which|what|show|list|any|my|do\s+i\s+have|got)\b/i.test(lower);
    if (isOfferFilter) {
      const matches = (allApplications || []).filter(a => (a.status || '').toLowerCase() === 'offer');
      if (matches.length === 0) {
        return {
          message: "🎉 You don't have any recorded offers yet. Keep interviewing, you're getting closer!",
          data: null
        };
      }
      let msg = `### 🎉 Job Offers Recorded (${matches.length}):\n\n`;
      matches.forEach((m, idx) => {
        msg += `${idx + 1}. **${m.companyName}** — *${m.roleTitle}* (Salary: ${m.salary || 'N/A'})\n`;
      });
      return { message: msg, data: null };
    }

    // 10. Specific Company Lookup in Past Applications
    const companyLookupMatch = lower.match(/\b(?:did\s+i\s+apply\s+(?:to|at)|have\s+i\s+applied\s+(?:to|at)|status\s+(?:of|for)|salary\s+(?:for|at)|when\s+did\s+i\s+apply\s+(?:to|at)|details\s+(?:of|for))\s+([a-zA-Z0-9.\- ]+?)(?:\?|$|\s+company|\s+job)/i);
    if (companyLookupMatch) {
      const searchTarget = companyLookupMatch[1].trim().toLowerCase();
      const foundInDb = (allApplications || []).find(a => 
        (a.companyName && a.companyName.toLowerCase().includes(searchTarget)) ||
        searchTarget.includes((a.companyName || '').toLowerCase())
      );

      if (foundInDb) {
        return {
          message: `### 🔍 Stored Record for **${foundInDb.companyName}**:\n\n` +
            `- **Role:** ${foundInDb.roleTitle || 'N/A'}\n` +
            `- **Status:** \`${foundInDb.status || 'Applied'}\`\n` +
            `- **Applied Date:** ${foundInDb.appliedDate || 'N/A'}\n` +
            `- **Salary / CTC:** ${foundInDb.salary || 'Not specified'}\n` +
            `- **Applied Via:** ${foundInDb.source || 'Direct'}\n` +
            (foundInDb.location ? `- **Location:** ${foundInDb.location}\n` : '') +
            (foundInDb.jobLink ? `- **Job Link:** [Open Link](${foundInDb.jobLink})\n` : '') +
            (foundInDb.notes ? `- **Notes:** ${foundInDb.notes}\n` : '') +
            `\n*This record is stored in your persistent backend database.*`,
          data: null
        };
      } else if (allApplications && allApplications.length > 0) {
        return {
          message: `🔍 I searched your database of **${allApplications.length} saved applications**, but could not find a record for **"${companyLookupMatch[1].trim()}"**.\n\nType **"Show all applications"** to view your active tracker list!`,
          data: null
        };
      }
    }

    // 5. Check for Company Information / Career Inquiries
    // Matches "tell me about paytm", "info on paytm", "about google", "questions for samsung", or just the company name alone "samsung"
    const companyQueryMatch = lower.match(/(?:t?ell\s+(?:me\s+)?about|info\s+(?:on|about)|details\s+about|what\s+about|know\s+about|overview\s+of|interview\s+questions?\s+for)\s+([a-zA-Z0-9.\- ]+?)(?:\s+company|\s+careers?|\s+jobs?|[?!.]*$)/i) ||
                             lower.match(/^(?:about|t?ell)\s+([a-zA-Z0-9.\- ]+)/i);

    const hasStrongJobIndicators = /\b(?:salary|ctc|lpa|stipend|\$|₹|requirements|responsibilities|apply\s+url|job\s+portal|job\s+link|full-time|part-time|remote|hybrid|on-site)\b/i.test(text) ||
                                  (/\b(?:applied|interviewing|offer|rejected)\b/i.test(lower) && /\b(?:to|at|for|as|on)\b/i.test(lower)) ||
                                  (text.includes('\n') && text.length > 40);

    // Only treat as company inquiry if not clearly a job description / application log
    if (!hasStrongJobIndicators) {
      let targetedCompanyKey = null;

      // If user directly asked about the company or the entire input is just the company name
      for (const key of Object.keys(COMPANY_DATABASE)) {
        const isStandaloneCompany = new RegExp(`^${key}[.?! ]*$`, 'i').test(trimmed);
        const matchesQuery = companyQueryMatch && new RegExp(`\\b${key}\\b`, 'i').test(lower);
        const asksAboutCompany = new RegExp(`\\b(?:about|overview|info|interview questions for|rounds in)\\s+${key}\\b`, 'i').test(lower);

        if (isStandaloneCompany || matchesQuery || asksAboutCompany) {
          targetedCompanyKey = key;
          break;
        }
      }

      if (targetedCompanyKey && COMPANY_DATABASE[targetedCompanyKey]) {
        const info = COMPANY_DATABASE[targetedCompanyKey];
        return {
          message: `### 🏢 Company Overview: **${info.name}**\n\n` +
            `**About the Company:**\n${info.overview}\n\n` +
            `**Key Divisions & Product Lines:**\n` +
            info.divisions.map(d => `- ${d}`).join('\n') + `\n\n` +
            `**Roles They Regularly Hire For:**\n` +
            info.roles.map(r => `- **${r}**`).join('\n') + `\n\n` +
            `**🎯 Interview Process & Expectations:**\n` +
            info.interviewProcess.map(s => `- ${s}`).join('\n') + `\n\n` +
            `**Sample Interview Questions for ${info.name}:**\n` +
            info.sampleQuestions.map((q, idx) => `${idx + 1}. *${q}*`).join('\n') + `\n\n` +
            `🔗 **Official Career Portal:** [Explore ${info.name} Open Positions](${info.careerUrl})\n\n` +
            `*(If you find a specific job listing you want to track, simply copy the job description and paste it here!)*`,
          data: null
        };
      }

      // If company inquiry for a company not in our hardcoded dictionary
      if (companyQueryMatch && !existingJob) {
        const companyCandidate = companyQueryMatch[1].replace(/company|corporation|inc|ltd/gi, '').trim();
        const capCompany = companyCandidate.charAt(0).toUpperCase() + companyCandidate.slice(1);
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(capCompany + ' careers jobs open roles')}`;

        return {
          message: `### 🏢 Company Advisory: **${capCompany}**\n\n` +
            `**Hiring & Role Expectations:**\n` +
            `- **Core Engineering**: Companies like **${capCompany}** typically look for solid fundamentals in Data Structures & Algorithms, Clean Architecture, and hands-on system building.\n` +
            `- **Key Competencies**: Proficiency in modern tech stacks, scalable system design, API development, and cross-functional collaboration.\n` +
            `- **Typical Interview Rounds**:\n` +
            `  1. Initial Recruiter Screening (Resume & background walk-through)\n` +
            `  2. Online Coding Assessment (Algorithms & Problem Solving)\n` +
            `  3. Technical In-depth Round (System Design & Code Craft)\n` +
            `  4. Cultural Fit & Behavioral Leadership (STAR method)\n\n` +
            `🔍 **Career Portal & Open Roles:** [Search ${capCompany} Career Portal & Job Openings](${searchUrl})\n\n` +
            `💡 **Next Step:** Copy any job description for **${capCompany}** and paste it here to automatically extract the role, salary, location, and track your application!`,
          data: null
        };
      }
    }

    // 6. Check for Interview Prep inquiries on the ACTIVE job
    if (existingJob && /\b(interview|questions?|prepare|expecting|advice|tips|role details)\b/i.test(lower)) {
      const skillsList = (existingJob.skills && existingJob.skills.length > 0)
        ? existingJob.skills.join(', ')
        : 'Data Structures, Algorithms, System Design';

      return {
        message: `### 🎯 Interview Preparation Guide for **${existingJob.roleTitle}** at **${existingJob.companyName}**\n\n` +
          `**What the Company is Expecting:**\n` +
          `- Demonstrated proficiency in core tech stack: **${skillsList}**.\n` +
          `- Strong problem-solving skills, writing clean, maintainable, and well-tested code.\n` +
          `- Understanding of production trade-offs (latency, scalability, fault tolerance).\n\n` +
          `**Recommended Technical Questions to Prepare:**\n` +
          `1. *How would you architect a scalable system using ${existingJob.skills?.[0] || 'your core stack'} with high availability?*\n` +
          `2. *Explain how you debug and isolate performance bottlenecks or memory leaks in production.*\n` +
          `3. *Walk me through a complex architectural challenge you solved in a past project.*\n` +
          `4. *How do you handle database concurrency, caching, and state management in ${existingJob.workMode} environments?*\n` +
          `5. *Tell me about a time you had to deliver a critical feature under tight deadlines.*\n\n` +
          `💡 **Tip:** Need to update the status of this application? You can say *"Update status to Interviewing"* or click the status badge!`,
        data: null
      };
    }

    // ==========================================
    // 7. Job Extraction Flow
    // ==========================================
    const today = new Date().toISOString().split('T')[0];
    const detectedDate = parseAppliedDate(text, null);

    const data = existingJob ? { ...existingJob } : {
      companyName: '',
      roleTitle: '',
      jobType: 'Full-time',
      workMode: 'On-site',
      location: 'Not specified',
      salary: 'Not disclosed',
      source: 'Direct Portal',
      applicationUrl: '',
      sourceUrl: '',
      status: 'Applied',
      appliedDate: detectedDate || today,
      skills: [],
      notes: ''
    };

    const detectedSource = parseJobSource(text);

    if (existingJob && detectedDate) {
      data.appliedDate = detectedDate;
    }
    if (detectedSource) {
      data.source = detectedSource;
    }

    let summaryNotes = [];
    if (detectedDate) {
      summaryNotes.push(`Applied date set to ${detectedDate}.`);
    }
    if (detectedSource) {
      summaryNotes.push(`Application source set to ${detectedSource}.`);
    }

    // Detect URLs
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const foundUrls = text.match(urlRegex) || [];
    
    if (foundUrls.length > 0) {
      for (const u of foundUrls) {
        const cleanUrl = u.replace(/[.,;!?)]+$/, '');
        const lowerUrl = cleanUrl.toLowerCase();
        
        if (lowerUrl.includes('linkedin.com')) {
          data.source = 'LinkedIn';
          data.sourceUrl = data.sourceUrl || cleanUrl;
        } else if (lowerUrl.includes('indeed.com')) {
          data.source = 'Indeed';
          data.sourceUrl = data.sourceUrl || cleanUrl;
        } else if (lowerUrl.includes('glassdoor.com')) {
          data.source = 'Glassdoor';
          data.sourceUrl = data.sourceUrl || cleanUrl;
        } else if (lowerUrl.includes('wellfound.com') || lowerUrl.includes('angel.co')) {
          data.source = 'Wellfound';
          data.sourceUrl = data.sourceUrl || cleanUrl;
        } else if (lowerUrl.includes('greenhouse.io') || lowerUrl.includes('lever.co') || lowerUrl.includes('workday') || lowerUrl.includes('myworkdayjobs')) {
          data.applicationUrl = cleanUrl;
          if (!data.source || data.source === 'Direct Portal') data.source = 'Company Career Site';
        } else {
          if (!data.applicationUrl) {
            data.applicationUrl = cleanUrl;
          } else if (!data.sourceUrl) {
            data.sourceUrl = cleanUrl;
          }
        }
      }
      summaryNotes.push(`Extracted ${foundUrls.length} web link(s).`);
    }

    // Check for explicit follow-up phrases
    const appLinkMatch = text.match(/(?:application|apply|careers?)\s*(?:link|url|portal)?[:\s]+(https?:\/\/[^\s]+)/i);
    if (appLinkMatch) {
      data.applicationUrl = appLinkMatch[1].replace(/[.,;!?)]+$/, '');
      summaryNotes.push('Updated application URL.');
    }

    // Status updates
    if (/(?:offer|offered)/i.test(text) && !text.includes('offer letter requirements')) {
      data.status = 'Offer';
      summaryNotes.push('Updated status to Offer.');
    } else if (/(?:interview|interviewing|round \d|screening)/i.test(text) && text.length < 100) {
      data.status = 'Interviewing';
      summaryNotes.push('Updated status to Interviewing.');
    } else if (/(?:reject|rejected|rejection)/i.test(text) && text.length < 100) {
      data.status = 'Rejected';
      summaryNotes.push('Updated status to Rejected.');
    }

    // Work Mode detection
    if (/\bremote\b|\bwork from home\b|\bwfh\b/i.test(text)) {
      data.workMode = 'Remote';
    } else if (/\bhybrid\b/i.test(text)) {
      data.workMode = 'Hybrid';
    } else if (/\bon-?site\b|\bin-?office\b|\bin-?person\b/i.test(text)) {
      data.workMode = 'On-site';
    }

    // Job Type detection
    if (/\bintern\b|\binternship\b/i.test(text)) {
      data.jobType = 'Internship';
    } else if (/\bcontract\b|\bfreelance\b/i.test(text)) {
      data.jobType = 'Contract';
    } else if (/\bpart-?time\b/i.test(text)) {
      data.jobType = 'Part-time';
    } else if (/\bfull-?time\b|\bpermanent\b/i.test(text)) {
      data.jobType = 'Full-time';
    }

    // Salary extraction
    const salaryRegex = /(?:(\$|€|£|₹|INR|USD|CAD|EUR|GBP)\s*[\d,]+(?:\.\d+)?\s*(?:k|lpa|k\/yr|per year|\/yr|\/year|\/mo|\/hr|\/month|-|\s*to\s*|\s*–\s*)+[\d,]*\s*(?:k|lpa|per year|\/yr|\/year|\/hr|\/month)?)|(?:\b[\d,]+(?:\.\d+)?\s*(?:LPA|k\/year|k per year|USD|EUR)\b)/i;
    const salaryMatch = text.match(salaryRegex);
    if (salaryMatch) {
      data.salary = salaryMatch[0].trim();
      summaryNotes.push(`Captured salary compensation: ${data.salary}`);
    }

    // Company Name extraction
    if (!data.companyName) {
      const companyMatch = text.match(/(?:Company|Organization|Employer)\s*[:\-]\s*([A-Za-z0-9&.\- ]{2,35})/i) ||
                           text.match(/(?:Join|About|Welcome to)\s+([A-Z][A-Za-z0-9&.\- ]{1,25})/);
      if (companyMatch) {
        data.companyName = companyMatch[1].trim();
      } else {
        const atSplit = text.match(/([A-Za-z0-9 &.'\-/]{2,60})\s+at\s+([^,\n;]{2,50})/i);
        const dashSplit = text.match(/([A-Za-z0-9 &.'\-]{2,35})\s*[-|–]\s*([A-Za-z0-9 &.'\-]{2,35})/);
        if (atSplit) {
          data.roleTitle = data.roleTitle || atSplit[1].trim();
          data.companyName = atSplit[2].trim();
        } else if (dashSplit) {
          data.companyName = dashSplit[1].trim();
          data.roleTitle = data.roleTitle || dashSplit[2].trim();
        }
      }
    }

    // Role Title extraction
    if (!data.roleTitle) {
      const roleMatch = text.match(/(?:Role|Title|Position|Job Title)\s*[:\-]\s*([A-Za-z0-9&.\- /]{2,45})/i) ||
                        text.match(/\b(Software Engineer|Frontend Engineer|Backend Engineer|Full Stack Developer|Data Scientist|Product Manager|DevOps Engineer|UI\/UX Designer|Machine Learning Engineer|AI Engineer|QA Engineer|Systems Architect|Solutions Architect|Cloud Engineer|Intern)\b/i);
      if (roleMatch) {
        data.roleTitle = roleMatch[1].trim();
      }
    }



    // If no concrete job signals found and creating new job, do NOT create a dummy record
    if (!existingJob && !data.companyName && !data.roleTitle && foundUrls.length === 0 && !salaryMatch) {
      // If it looks like a question or conversational prompt
      if (/[?]|^(what|how|why|can|could|tell|explain|give|describe|advice|tips|guide|suggest|prepare|interview|resume|portfolio|salary)/i.test(trimmed)) {
        return {
          message: `### 🤖 Career Advisor & Interview Assistant\n\nI'm here to help with your career questions and job search!\n\nHere are key recommendations regarding your query:\n- **Strategic Preparation**: Focus on high-frequency interview patterns (System Design, DSA, and behavioral STAR stories).\n- **Application Tracking**: Whenever you apply to a role or find an open vacancy, paste the **Job Description** or URL here to automatically track it on your board with interview status updates.\n- **Company Intelligence**: Ask about any company (e.g., *'Tell me about Paytm'*, *'Tell me about Samsung'*, *'Google'*) for detailed tech stacks and interview breakdowns.\n\n💡 *Tip: You can also connect your own Gemini API key or OpenAI key in **Settings (⚙️)** for unlimited live AI conversations!`,
          data: null
        };
      }

      return {
        message: "I didn't detect any job details in that message.\n\nTo track a job, simply paste a **Job Description**, an application email, or a job link. You can also ask me about any company (e.g. *'Tell me about Paytm'*, *'Tell me about Samsung'*) or ask for interview preparation tips!",
        data: null
      };
    }

    // Fallbacks if only partial info
    if (!data.companyName) {
      data.companyName = existingJob?.companyName || 'Target Company';
    }
    if (!data.roleTitle) {
      data.roleTitle = existingJob?.roleTitle || 'Software Professional';
    }

    // Location extraction
    if (!data.location || data.location === 'Not specified') {
      const locMatch = text.match(/(?:Location|Place|Office|Based in)\s*[:\-]\s*([A-Za-z0-9,.\- ]{2,35})/i);
      if (locMatch) {
        data.location = locMatch[1].trim();
      } else if (data.workMode === 'Remote') {
        data.location = 'Remote / Anywhere';
      }
    }

    // Skills extraction
    const techDictionary = [
      'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 'Go', 'Rust', 'PHP', 'Ruby', 'Swift', 'Kotlin',
      'React', 'Next.js', 'Vue', 'Angular', 'Node.js', 'Express', 'Django', 'FastAPI', 'Spring Boot',
      'SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'Supabase', 'Firebase', 'Redis',
      'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'Git', 'GraphQL', 'REST API', 'Tailwind', 'CSS', 'HTML'
    ];
    const foundSkills = new Set(data.skills || []);
    for (const tech of techDictionary) {
      const escaped = tech.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(?:^|[^a-zA-Z0-9_+#])${escaped}(?=[^a-zA-Z0-9_+#]|$)`, 'i');
      if (regex.test(text)) {
        foundSkills.add(tech);
      }
    }
    data.skills = Array.from(foundSkills).slice(0, 8);

    // Friendly commentary message
    let message = existingJob
      ? `Updated **${data.companyName}** (${data.roleTitle}) with the latest details.`
      : `Successfully extracted job details for **${data.roleTitle}** at **${data.companyName}**!`;

    if (summaryNotes.length > 0) {
      message += ` ` + summaryNotes.join(' ');
    }

    return {
      message,
      data,
      provider: 'heuristic'
    };
  },

  /**
   * Generates a comprehensive, deep comparison between candidate's About Me dossier
   * and the company's job requirements.
   */
  generateProfileJobComparison(prof, targetJob = null, targetQuery = '', allApplications = []) {
    if (!targetJob && (!allApplications || allApplications.length === 0)) {
      return {
        message: `⚠️ **No Job Application Found to Compare**\n\n` +
          `To compare your **About Me** profile against company requirements:\n` +
          `1. Paste a **Job Description (JD)** in the chat or select an application from your **Applications Tracker**.\n` +
          `2. Type **/compare** to generate your full candidacy match audit!`,
        data: null
      };
    }

    // Resolve target job
    let job = targetJob;
    if ((!job || (!job.companyName && !job.roleTitle)) && allApplications && allApplications.length > 0) {
      if (targetQuery) {
        const q = targetQuery.toLowerCase();
        job = allApplications.find(a => 
          (a.companyName && a.companyName.toLowerCase().includes(q)) ||
          (a.roleTitle && a.roleTitle.toLowerCase().includes(q))
        ) || allApplications[0];
      } else {
        job = allApplications[0];
      }
    }

    if (!job || (!job.companyName && !job.roleTitle)) {
      return {
        message: `⚠️ **No Job Application Found to Compare**\n\nPlease select an application or paste a JD first, then type **/compare**.`,
        data: null
      };
    }

    const p = prof || Config.getUserProfile() || {};
    const education = p.education || {};
    const college = education.college || {};
    const semMarks = college.semesterMarks || {};
    const projects = p.projects || [];
    const certs = p.certifications || [];
    const candidateSkills = Array.isArray(p.skills) ? [...p.skills] : [];

    // Extract job skills
    let jobSkills = Array.isArray(job.skills) && job.skills.length > 0 ? [...job.skills] : [];
    if (jobSkills.length === 0 && (job.notes || job.jobDescription)) {
      const textSource = `${job.notes || ''} ${job.jobDescription || ''}`.toLowerCase();
      const rawTokens = [
        'JavaScript', 'TypeScript', 'Python', 'Java', 'Go', 'Golang', 'C++', 'C#',
        'React', 'Next.js', 'Vue', 'Angular', 'Node.js', 'Express', 'Django', 'FastAPI', 'Spring Boot',
        'SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'Supabase', 'Redis',
        'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'System Design', 'REST API', 'GraphQL', 'Microservices'
      ];
      jobSkills = rawTokens.filter(t => textSource.includes(t.toLowerCase()));
    }
    if (jobSkills.length === 0) {
      jobSkills = ['Core Engineering', 'Problem Solving', 'System Design', 'Communication'];
    }

    // Aggregate candidate skill tokens from skills, project tech stacks, certs
    const candidateSkillPool = new Set(candidateSkills.map(s => s.toLowerCase().trim()));
    projects.forEach(pr => {
      if (pr.techStack) {
        pr.techStack.split(/[,/|]/).forEach(t => candidateSkillPool.add(t.toLowerCase().trim()));
      }
    });
    certs.forEach(c => {
      if (c.name) {
        c.name.split(/[\s,]/).forEach(t => {
          if (t.length > 2) candidateSkillPool.add(t.toLowerCase().trim());
        });
      }
    });

    // Calculate matched vs missing skills
    const matchedSkills = [];
    const missingSkills = [];

    jobSkills.forEach(reqSkill => {
      const reqLower = reqSkill.toLowerCase().trim();
      let isMatched = false;
      for (const candSkill of candidateSkillPool) {
        if (candSkill.includes(reqLower) || reqLower.includes(candSkill)) {
          isMatched = true;
          break;
        }
      }
      if (isMatched) {
        matchedSkills.push(reqSkill);
      } else {
        missingSkills.push(reqSkill);
      }
    });

    // Calculate match scores
    const skillRatio = jobSkills.length > 0 ? (matchedSkills.length / jobSkills.length) : 0.8;
    const projectBonus = Math.min(projects.length * 8, 25);
    const certBonus = Math.min(certs.length * 5, 15);
    
    // Semester marks analysis
    const semValues = Object.values(semMarks).map(v => parseFloat(v)).filter(v => !isNaN(v) && v > 0);
    const avgSemGpa = semValues.length > 0 
      ? (semValues.reduce((a, b) => a + b, 0) / semValues.length).toFixed(2)
      : (college.overallCgpa || null);
    const academicBonus = avgSemGpa ? (parseFloat(avgSemGpa) >= 8.0 ? 20 : 15) : 10;

    let overallScore = Math.round((skillRatio * 40) + projectBonus + certBonus + academicBonus);
    if (overallScore > 96) overallScore = 96;
    if (overallScore < 45) overallScore = 45;

    let verdict = 'Strong Candidate Match';
    let badgeColor = '🟢';
    if (overallScore >= 85) {
      verdict = 'High Priority Match — Ready for Immediate Interviewing';
      badgeColor = '🌟';
    } else if (overallScore >= 70) {
      verdict = 'Competitive Match — Good Foundation with Quick Prep Needed';
      badgeColor = '🟢';
    } else {
      verdict = 'Developing Match — Requires Addressing Core Skill Gaps';
      badgeColor = '🟡';
    }

    // Identify relevant projects
    const relevantProjects = projects.filter(pr => {
      const text = `${pr.title} ${pr.techStack || ''} ${pr.description || ''}`.toLowerCase();
      return jobSkills.some(js => text.includes(js.toLowerCase())) || 
             (job.roleTitle && text.includes(job.roleTitle.toLowerCase().split(' ')[0]));
    });

    // Compose report
    let report = `## ⚖️ Candidate vs Requirements Comparison\n\n`;
    report += `### **${job.companyName || 'Target Company'}** — *${job.roleTitle || 'Open Position'}*\n\n`;
    report += `> ${badgeColor} **Match Score: ${overallScore}%** — **${verdict}**\n\n`;

    // Section 1: Candidate & Role Snapshot
    report += `### 1. 📌 Overview & Candidate Dossier\n`;
    report += `- **Candidate:** **${p.fullName || 'You'}** ${p.headline ? `(*${p.headline}*)` : ''}\n`;
    report += `- **Target Role:** **${job.roleTitle || 'N/A'}** at **${job.companyName || 'N/A'}**\n`;
    report += `- **Work Mode & Location:** ${job.workMode || 'N/A'} (${job.location || 'N/A'})\n`;
    if (job.salary) report += `- **Target Compensation:** ${job.salary}\n`;
    report += `\n`;

    // Section 2: Skills Alignment
    report += `### 2. 🛠️ Skills & Tech Stack Alignment\n\n`;
    report += `| Metric | Details |\n`;
    report += `|---|---|\n`;
    report += `| **Direct Matches (${matchedSkills.length})** | ${matchedSkills.length > 0 ? matchedSkills.map(s => `\`${s}\``).join(', ') : '*None identified yet*'} |\n`;
    report += `| **Missing / Unlisted (${missingSkills.length})** | ${missingSkills.length > 0 ? missingSkills.map(s => `\`${s}\``).join(', ') : '*(None — full coverage!)*'} |\n`;
    report += `| **Skills Coverage** | **${Math.round(skillRatio * 100)}%** of mandatory requirements met |\n\n`;

    // Section 3: Projects Alignment
    report += `### 3. 💻 Projects & Hands-On Portfolio Fit\n`;
    if (projects.length === 0) {
      report += `- ⚠️ *No projects recorded in your **About Me** profile.* Add projects with tech stacks and finish dates to boost your match score!\n`;
    } else {
      report += `You have **${projects.length}** project(s) in your portfolio. `;
      if (relevantProjects.length > 0) {
        report += `**${relevantProjects.length}** project(s) directly demonstrate key requirements for **${job.companyName}**:\n\n`;
        relevantProjects.forEach((pr, i) => {
          report += `${i + 1}. **${pr.title}**\n`;
          if (pr.techStack) report += `   - **Tech Stack:** ${pr.techStack}\n`;
          if (pr.finishDate) report += `   - **Completed Date:** ${pr.finishDate}\n`;
          if (pr.projectUrl) report += `   - **Repository / Demo:** [${pr.projectUrl}](${pr.projectUrl})\n`;
        });
      } else {
        report += `Here are your recent projects:\n\n`;
        projects.slice(0, 3).forEach((pr, i) => {
          report += `${i + 1}. **${pr.title}** (${pr.techStack || 'Full Stack'})${pr.finishDate ? ` — Done: ${pr.finishDate}` : ''}\n`;
        });
      }
    }
    report += `\n`;

    // Section 4: Education & Academic Track Record
    report += `### 4. 🎓 Academic & Semester Marks Audit\n`;
    report += `- **Degree & Institution:** ${college.degree || 'Degree'} in ${college.branch || 'Engineering'}, **${college.collegeName || 'University'}** (Class of ${college.graduationYear || '2026'})\n`;
    if (avgSemGpa) {
      report += `- **Semester SGPA Performance:** Average **${avgSemGpa} / 10** across ${semValues.length > 0 ? `${semValues.length} recorded semesters` : 'college coursework'}\n`;
      if (semValues.length > 0) {
        const semRows = Object.entries(semMarks)
          .filter(([k, v]) => v)
          .map(([k, v]) => `${k.toUpperCase().replace('SEM', 'Sem ')}: **${v}**`)
          .join(' | ');
        report += `  *Detailed: ${semRows}*\n`;
      }
    }
    if (education.tenth?.marks || education.twelfth?.marks) {
      report += `- **Schooling Foundation:** 10th Standard: **${education.tenth?.marks || 'N/A'}** (${education.tenth?.schoolName || 'N/A'}) | 12th Standard: **${education.twelfth?.marks || 'N/A'}** (${education.twelfth?.schoolName || 'N/A'})\n`;
    }
    report += `\n`;

    // Section 5: Certifications
    if (certs.length > 0) {
      report += `### 5. 📜 Verified Certifications & Credentials\n`;
      certs.forEach((c, idx) => {
        report += `- **${c.name}** — *${c.issuer || 'Verified Platform'}* (${c.issueDate || 'Completed'})\n`;
      });
      report += `\n`;
    }

    // Section 6: Strengths & Talking Points
    report += `### 6. 🚀 Top 3 High-Impact Interview Talking Points\n`;
    if (relevantProjects.length > 0) {
      report += `1. **Anchor on Hands-On Delivery:** Pitch your work on **${relevantProjects[0].title}** to prove real-world proficiency with \`${matchedSkills[0] || 'core technologies'}\`.\n`;
    } else if (projects.length > 0) {
      report += `1. **Anchor on System Building:** Discuss how you architected **${projects[0].title}** from inception to completion.\n`;
    } else {
      report += `1. **Technical Breadth:** Highlight your fundamental strengths in computer science and software principles.\n`;
    }
    if (avgSemGpa && parseFloat(avgSemGpa) >= 8.5) {
      report += `2. **Academic Rigor:** Highlight your top-tier academic consistency (**${avgSemGpa} CGPA**) at **${college.collegeName || 'your university'}** as proof of fast learning speed.\n`;
    } else {
      report += `2. **Adaptability & Speed:** Share examples of how quickly you master new technologies.\n`;
    }
    if (certs.length > 0) {
      report += `3. **Industry-Recognized Verification:** Mention your **${certs[0].name}** certification as proof of proactive industry readiness.\n`;
    } else {
      report += `3. **Targeted Motivation:** Articulate why you are specifically passionate about engineering at **${job.companyName || 'this company'}**.\n`;
    }
    report += `\n`;

    // Section 7: Gaps & Actionable Advice
    report += `### 7. ⚠️ Gaps to Defend & Action Plan\n`;
    if (missingSkills.length > 0) {
      report += `- **Unlisted Requirements (${missingSkills.join(', ')}):** If you already know these, add them to your **About Me** skills section. If not, spend 2-3 hours reviewing key design patterns and terminology before technical rounds.\n`;
    } else {
      report += `- **Full Skill Coverage:** You cover all primary technical requirements! Focus your prep on behavioral STAR stories and mock system design.\n`;
    }
    report += `- **Next Action:** Type **/interview** to get custom mock interview questions for **${job.companyName}**, or update any new projects in your profile!\n`;

    return {
      message: report,
      data: null
    };
  }
};
