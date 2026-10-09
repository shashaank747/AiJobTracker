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
  async processInput(text, existingJob = null, history = []) {
    const settings = Config.getSettings();

    const provider = settings.aiProvider || 'gemini';
    let result = null;

    // 1. If user explicitly chose Offline Heuristics
    if (provider === 'heuristic') {
      result = await this.extractWithHeuristics(text, existingJob);
    } else {
      // 2. Try Vercel Serverless /api/chat with selected provider
      try {
        const serverRes = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            existingJob,
            history,
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
          result = await this.extractWithOpenAI(text, existingJob, history, settings);
        } catch (err) {
          console.warn('Client OpenAI extraction failed:', err);
        }
      } else if (!result && provider === 'gemini' && settings.geminiKey) {
        try {
          result = await this.extractWithGemini(text, existingJob, history, settings);
        } catch (err) {
          console.warn('Client Gemini extraction failed:', err);
        }
      }

      // 4. Fallback: Offline Smart Career Advisor & Heuristic Extractor
      if (!result) {
        result = await this.extractWithHeuristics(text, existingJob);
      }
    }

    // Post-processing deterministic guarantee for follow-up edits:
    const detectedDate = parseAppliedDate(text, null);
    const detectedSource = parseJobSource(text);

    if (existingJob && (detectedDate || detectedSource)) {
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
  async extractWithGemini(text, existingJob, history, settings) {
    const model = settings.geminiModel || 'gemini-3.8-flash';
    const apiKey = settings.geminiKey;

    const today = new Date().toISOString().split('T')[0];
    const systemPrompt = `You are Zuno, an expert AI Job Application Tracker and Career Advisor Assistant at JobTrackerAI.
Your name is Zuno. Always introduce or refer to yourself as Zuno when asked about your identity.
TODAY'S REFERENCE DATE: ${today}

CRITICAL APPLIED DATE RULE:
If the user specifies when they applied (e.g. "applied last week", "applied 3 days ago", "applied yesterday", "applied on 2nd Oct", "confirmation email date"), CALCULATE and return the exact YYYY-MM-DD appliedDate relative to Today (${today})! Only default to ${today} if no past application timeframe was mentioned.

Your capabilities:
1. JOB EXTRACTION: When user pastes a Job Description (JD), link, or status update:
   - Extract companyName, roleTitle, jobType, workMode, location, salary, source, applicationUrl, sourceUrl, status, appliedDate, skills, notes.
   - Return this in the "data" object.
2. CAREER & COMPANY QUESTIONS: When user asks questions about a company (e.g. "tell about samsung company", "tell me about paytm"), interview questions, role expectations, or career tips:
   - Provide a comprehensive, structured, and insightful markdown answer in "message" covering:
     * Company overview, culture, and core divisions
     * What technical roles and skills they hire for
     * The typical interview process, technical rounds, and sample interview questions
     * Direct link to their careers portal
   - Set "data": null.
3. ACTIVE JOB ADVICE: If an existing job is currently loaded in context and user asks about it:
   - Analyze the active job's role, company, and tech stack in detail.
   - Set "data": null.
4. GENERAL CONVERSATION: If user asks ANY question, chats, or inquires:
   - Act like ChatGPT / Gemini, converse intelligently, helpfully, and thoroughly.
   - Set "data": null.

Return ONLY valid JSON matching this schema:
{
  "message": "Your rich, formatted markdown answer to the user",
  "data": { ... } or null
}`;

    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `${systemPrompt}\n\nCurrent Active Job in Session (if any):\n${existingJob ? JSON.stringify(existingJob, null, 2) : 'None (Fresh Session)'}\n\nUser Message:\n"${text}"`
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
      provider: 'gemini'
    };
  },

  async extractWithOpenAI(text, existingJob, history, settings) {
    const apiKey = settings.openaiKey;
    const url = 'https://api.openai.com/v1/chat/completions';

    const systemPrompt = `You are Zuno, an expert AI Job Application Tracker and Career Advisor Assistant at JobTrackerAI.
Your name is Zuno.
When user asks questions about a company, interview questions, or casual chat: provide a comprehensive markdown answer in "message" and set "data": null.
When user pastes a job description (JD) or update: extract the job details in "data".
Return JSON with { "message": "...", "data": { ... } or null }.`;

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
            content: `Active Job: ${existingJob ? JSON.stringify(existingJob) : 'None'}\n\nUser Input: ${text}`
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
      data: parsed.data,
      provider: 'openai'
    };
  },

  /**
   * Smart Offline NLP Heuristic & Career Advisor
   * Handles company research, interview prep, greetings, AND job parsing offline
   */
  extractWithHeuristics(text, existingJob = null) {
    const trimmed = text.trim();
    const lower = trimmed.toLowerCase();

    // 1. Check for greetings
    const isGreeting = /^(hi|hello|hey|hiya|howdy|good\s*(morning|afternoon|evening)|sup|yo|hola)\b[!?. ]*$/i.test(trimmed);
    if (isGreeting) {
      return {
        message: "👋 **Hello!** I'm **Zuno**, your **JobTrackerAI** assistant.\n\nHere is how I can help you:\n- **Paste a Job Description**: I will extract company, role, salary, work mode, and application link.\n- **Refine Details**: Tell me dates or platforms (*\"applied on 21 sept\"*, *\"applied through LinkedIn\"*).\n- **Save to Database**: Type **/store** whenever you want to save to your tracker board!\n- **Ask About Any Company**: e.g. *'Tell me about Samsung'*, *'What does Google expect?'*\n- **Interview Preparation**: Ask for interview questions, preparation tips, or role breakdowns.",
        data: null
      };
    }

    // 2. Check for "Who are you" / "What's your name"
    if (/^(who are you|what is your name|what's your name|your name)\b/i.test(lower)) {
      return {
        message: "👋 I'm **Zuno**, your intelligent AI career assistant and job application tracker at **JobTrackerAI**!\n\nI can help you parse job descriptions, research companies, prepare for technical rounds, and track your applications.",
        data: null
      };
    }

    // 3. Check for "How are you"
    if (/\b(how are you|how's it going|how are you doing)\b/i.test(lower)) {
      return {
        message: "I'm **Zuno**, doing great and fully energized to help you land your dream job! 🚀\n\nYou can:\n- Paste a **Job Description** to extract and track it.\n- Refine application dates or source links.\n- Type **/store** to save to your database.\n- Ask me about any company (e.g. **Samsung**, **Google**, **Stripe**).\n- Ask for **interview questions** and preparation advice for any role.\n\nWhat would you like to explore?",
        data: null
      };
    }

    // 4. Check for Help / Capabilities
    const isHelp = /^(help|what can you do|how does this work|commands|instructions)\b/i.test(lower);
    if (isHelp) {
      return {
        message: "💡 **How Zuno & JobTrackerAI Work:**\n\n1. **Track Applications**: Paste raw text from LinkedIn, Indeed, Glassdoor, or careers pages. I will parse company, role, salary, work mode, and URLs.\n2. **Conversational Refinements**: Forgot something? Just say *\"applied on 21 sept\"* or *\"applied through LinkedIn\"* and I will update your card.\n3. **Store in Database**: Type **/store** to permanently save your drafted application to Supabase and your dashboard.\n4. **Company Intelligence**: Ask about any company (e.g., *'Can you tell about Samsung company?'*) for an overview, open roles, culture, and interview rounds.\n5. **Interview Preparation**: Ask *'What interview questions will they ask?'* for customized questions based on your tracked roles.",
        data: null
      };
    }

    // 4. Check for Casual affirmations
    const isCasual = /^(ok|okay|cool|thanks|thank you|great|awesome|understood|got it)\b[!?. ]*$/i.test(trimmed);
    if (isCasual) {
      return {
        message: "You're welcome! Whenever you have another job to track or a question about a company, feel free to ask.",
        data: null
      };
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
  }
};
