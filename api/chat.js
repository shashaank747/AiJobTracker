// Vercel Serverless Function: /api/chat
// Connects JobTrackerAI to Google Gemini API (or OpenAI API)

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  // Diagnostics endpoint: GET /api/chat returns available models
  if (req.method === 'GET') {
    const key = req.query?.key || geminiKey;
    if (!key) {
      return res.status(400).json({ error: 'No GEMINI_API_KEY provided or configured.' });
    }
    try {
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
      const data = await resp.json();
      return res.status(resp.status).json(data);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    const { text, existingJob, history, allApplications = [], userProfile = null, apiKey: clientApiKey, provider = 'auto' } = req.body || {};

    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Message text is required.' });
    }

    const effectiveGeminiKey = (clientApiKey && !clientApiKey.startsWith('sk-')) ? clientApiKey : geminiKey;
    const effectiveOpenaiKey = (clientApiKey && clientApiKey.startsWith('sk-')) ? clientApiKey : openaiKey;

    const today = new Date().toISOString().split('T')[0];

    const formatDatabaseContext = (apps) => {
      if (!Array.isArray(apps) || apps.length === 0) {
        return "STORED APPLICATIONS IN DATABASE: 0 applications currently stored.";
      }
      const summaryList = apps.map((a, i) => 
        `[#${i + 1}] Company: ${a.companyName || 'Unknown'} | Role: ${a.roleTitle || 'Undisclosed'} | Status: ${a.status || 'Applied'} | Salary: ${a.salary || 'Not disclosed'} | Work Mode: ${a.workMode || 'N/A'} | Location: ${a.location || 'N/A'} | Applied Date: ${a.appliedDate || 'N/A'} | Source: ${a.source || 'N/A'} | Skills: ${(a.skills || []).join(', ')}`
      ).join('\n');
      return `PERSISTENT BACKEND DATABASE (${apps.length} stored applications):\n${summaryList}`;
    };

    const formatProfileContext = (prof) => {
      if (!prof) return "USER ABOUT ME PROFILE / DOSSIER: None recorded yet.";
      return `USER ABOUT ME PROFILE / DOSSIER:
- Name: ${prof.fullName || 'Not set'} | Title: ${prof.headline || 'Not set'}
- Contact: ${prof.email || ''} | ${prof.phone || ''} | ${prof.location || ''}
- 10th Marks: ${prof.education?.tenth?.marks || 'N/A'} (School: ${prof.education?.tenth?.schoolName || 'N/A'}, Board: ${prof.education?.tenth?.board || 'N/A'})
- 12th Marks: ${prof.education?.twelfth?.marks || 'N/A'} (School: ${prof.education?.twelfth?.schoolName || 'N/A'}, Board/Stream: ${prof.education?.twelfth?.board || 'N/A'})
- College / Degree: ${prof.education?.college?.collegeName || 'N/A'} (${prof.education?.college?.degree || 'N/A'} - ${prof.education?.college?.branch || 'N/A'}, CGPA: ${prof.education?.college?.overallCgpa || 'N/A'})
- Semester Marks: Sem 1: ${prof.education?.college?.semesterMarks?.sem1 || '-'}, Sem 2: ${prof.education?.college?.semesterMarks?.sem2 || '-'}, Sem 3: ${prof.education?.college?.semesterMarks?.sem3 || '-'}, Sem 4: ${prof.education?.college?.semesterMarks?.sem4 || '-'}, Sem 5: ${prof.education?.college?.semesterMarks?.sem5 || '-'}, Sem 6: ${prof.education?.college?.semesterMarks?.sem6 || '-'}, Sem 7: ${prof.education?.college?.semesterMarks?.sem7 || '-'}, Sem 8: ${prof.education?.college?.semesterMarks?.sem8 || '-'}
- Certifications (${(prof.certifications || []).length}): ${(prof.certifications || []).map(c => `${c.name} (${c.issuer || ''})`).join('; ') || 'None'}
- Projects (${(prof.projects || []).length}): ${(prof.projects || []).map(p => `${p.title} [Tech: ${p.techStack || 'N/A'}, Link: ${p.projectUrl || 'N/A'}, Done: ${p.finishDate || 'N/A'}]`).join('; ') || 'None'}
- Skills: ${(prof.skills || []).join(', ') || 'None'}`;
    };

    const databaseContext = formatDatabaseContext(allApplications);
    const profileContext = formatProfileContext(userProfile);

    const systemPrompt = `You are Zuno, an intelligent conversational AI career assistant and job application tracker at JobTrackerAI.
Your name is Zuno. Always introduce or refer to yourself as Zuno when asked about your name or identity.
TODAY'S REFERENCE DATE: ${today}

You act like ChatGPT / Gemini, offering full conversational answers, career advice, and interview preparation, while also automatically extracting job application details when presented with job posts.

CORE CAPABILITIES:
1. FULL CONVERSATIONAL INTELLIGENCE & ADVISORY:
- Answer ANY question naturally, intelligently, and thoroughly using rich Markdown (headers, bullet points, code blocks, bold text).
- When asked about ANY company (e.g., "tell me about paytm", "samsung", "google", "meta", startups):
  * Give an overview of the company, business model, and tech engineering culture.
  * Highlight tech stacks (Java, Spring, Node, Python, React, Go, AWS, etc.).
  * Outline the interview process and rounds (OA, System Design, DSA, Behavioral).
  * Provide typical interview questions asked by that company.
  * Provide a link to their careers site.
  * For general conversation, company research, and questions, set "data": null.
- When asked about an existing job in the tracker:
  * Provide deep analysis, salary negotiation tips, and tailored interview advice.
  * Set "data": null.

2. PERSISTENT DATABASE & SESSION QUERYING:
- You have direct, live access to the user's persistent backend database and active session instance!
- When the user asks about their application history, statistics, interview statuses, specific companies they applied to, salary details, or past applications:
  * Query and analyze the provided "PERSISTENT BACKEND DATABASE" and "Active Job in Session".
  * Provide accurate, friendly, and comprehensive answers, tables, or summaries using their real data.
  * Set "data": null.

3. CANDIDATE PROFILE & "ABOUT ME" INTELLIGENCE:
- You have direct, live access to the user's personal portfolio & academic profile!
- When the user tells you to add or update their projects, certifications, 10th marks, 12th marks, semester marks (sem 1-8), college, or personal info (e.g. "Add project: JobTracker with React, finished yesterday", "My 10th marks are 95% at DPS", "Add sem 4 marks: 9.1", "Add certification: AWS Solutions Architect"):
  * Confirm enthusiastically in "message".
  * Set "data": null.
  * Supply "profileUpdate" object in your JSON output with:
    - For projects: { "type": "add_project", "project": { "title": "...", "description": "...", "techStack": "...", "projectUrl": "...", "startDate": "...", "finishDate": "..." } }
    - For certifications: { "type": "add_certification", "certification": { "name": "...", "issuer": "...", "issueDate": "...", "credentialUrl": "..." } }
    - For semester marks: { "type": "update_sem_marks", "sem": "sem1" to "sem8", "score": "..." }
    - For 10th marks: { "type": "update_education_10th", "schoolName": "...", "board": "...", "marks": "...", "year": "..." }
    - For 12th marks: { "type": "update_education_12th", "schoolName": "...", "board": "...", "marks": "...", "year": "..." }
    - For college: { "type": "update_college", "collegeName": "...", "degree": "...", "branch": "...", "overallCgpa": "...", "graduationYear": "..." }
    - For personal details: { "type": "update_personal", "fullName": "...", "headline": "...", "bio": "...", "email": "...", "phone": "...", "location": "..." }
- When user asks about their profile, semester marks, or projects ("What projects have I done?", "What are my sem marks?"), answer from "USER ABOUT ME PROFILE / DOSSIER" and set "data": null.

4. JOB APPLICATION EXTRACTION & TRACKING:
- Whenever the user pastes a job description (JD), job link, application confirmation email, or asks to track a job:
  Extract structured details into "data":
  {
    "companyName": "Company name",
    "roleTitle": "Role / Position title",
    "jobType": "Full-time" | "Internship" | "Contract" | "Part-time",
    "workMode": "Remote" | "Hybrid" | "On-site",
    "location": "City, Country or Remote",
    "salary": "Disclosed salary or 'Not disclosed'",
    "source": "Platform (e.g. LinkedIn, Indeed, Company Careers)",
    "applicationUrl": "Application or portal URL if present",
    "sourceUrl": "Listing URL if present",
    "status": "Applied" | "Interviewing" | "Offer" | "Rejected" | "Bookmarked",
    "appliedDate": "YYYY-MM-DD",
    "skills": ["Skill1", "Skill2", ...],
    "notes": "Short summary of key requirements or notes"
  }

CRITICAL INSTRUCTION FOR APPLIED DATE:
- Users frequently track jobs they applied to in the past (e.g., "I applied for this last week", "applied 3 days ago", "applied yesterday", "applied on 2026-09-28", "applied on Oct 2nd", or dates in email confirmations).
- You MUST calculate and resolve the exact "YYYY-MM-DD" date relative to TODAY (${today}):
  * "yesterday" -> calculate 1 day before ${today}
  * "X days ago" -> calculate X days before ${today}
  * "last week" / "a week ago" -> calculate 7 days before ${today}
  * "2 weeks ago" -> calculate 14 days before ${today}
  * "last month" -> calculate 30 days before ${today}
  * Explicit dates (e.g., "Oct 2", "15 September", "2026-09-25") -> convert to "YYYY-MM-DD".
- ONLY set "appliedDate" to ${today} if the user does NOT specify any past application date or timeframe.
- If updating an existing job, and the user specifies an applied date, update "appliedDate" accordingly.

OUTPUT FORMAT:
Respond with a JSON object with:
{
  "message": "Your rich, formatted markdown response to the user",
  "data": { ... } or null,
  "profileUpdate": { ... } or null
}
Ensure output is valid JSON.`;

    // --- TRY OPENAI IF KEY PROVIDED ---
    if (effectiveOpenaiKey && (provider === 'openai' || !effectiveGeminiKey)) {
      try {
        const oaiResp = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${effectiveOpenaiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: systemPrompt },
              {
                role: 'user',
                content: `${databaseContext}\n\n${profileContext}\n\nActive Job in Session: ${existingJob ? JSON.stringify(existingJob, null, 2) : 'None'}\n\nUser Message: "${text}"`
              }
            ],
            response_format: { type: "json_object" },
            temperature: 0.3
          })
        });

        if (oaiResp.ok) {
          const oaiData = await oaiResp.json();
          const content = oaiData.choices?.[0]?.message?.content;
          if (content) {
            const parsed = JSON.parse(content);
            return res.status(200).json({
              message: parsed.message || 'Done',
              data: parsed.data || null,
              profileUpdate: parsed.profileUpdate || null,
              provider: 'openai'
            });
          }
        }
      } catch (err) {
        console.warn('OpenAI attempt failed, falling back to Gemini:', err.message);
      }
    }

    // --- TRY GEMINI ---
    if (!effectiveGeminiKey) {
      return res.status(500).json({
        error: 'No GEMINI_API_KEY or OPENAI_API_KEY configured. Please add one in Settings.'
      });
    }

    // Modern Gemini models active in the environment
    const candidateModels = [
      'gemini-3.8-flash',
      'gemini-3.5-flash-lite',
      'gemini-3.5-flash',
      'gemini-3.7-flash',
      'gemini-3.1-flash-lite',
      'gemini-flash-latest'
    ];

    let lastError = null;
    let candidateText = null;
    const modelErrors = {};

    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `${systemPrompt}\n\n${databaseContext}\n\n${profileContext}\n\nCurrent Active Job in Session:\n${existingJob ? JSON.stringify(existingJob, null, 2) : 'None'}\n\nUser Message:\n"${text}"`
            }
          ]
        }
      ]
    };

    for (const model of candidateModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${effectiveGeminiKey}`;
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
          const errData = await response.json().catch(() => ({}));
          const errMsg = errData.error?.message || response.statusText;
          modelErrors[model] = `HTTP ${response.status}: ${errMsg}`;
          lastError = errMsg;
        }
      } catch (err) {
        modelErrors[model] = `Exception: ${err.message}`;
        lastError = err.message;
      }
    }

    if (!candidateText) {
      return res.status(500).json({
        error: lastError || 'No response generated by Gemini models.',
        details: modelErrors
      });
    }

    // Extract JSON safely even if wrapped in markdown ```json
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

    const isQuestionOrProfile = /^(what|when|where|which|how|who|did|have|list|show|any|status|my|add|update)\b/i.test(text.trim());
    const detectedDate = !isQuestionOrProfile ? parseAppliedDate(text, null) : null;
    const detectedSource = !isQuestionOrProfile ? parseJobSource(text) : null;

    if (!isQuestionOrProfile && existingJob && (detectedDate || detectedSource)) {
      if (!parsed.data) {
        parsed.data = { ...existingJob };
        parsed.message = parsed.message || `Updated **${existingJob.companyName}** (${existingJob.roleTitle}) with the latest details.`;
      }
    }

    if (parsed.data) {
      if (detectedDate) {
        parsed.data.appliedDate = detectedDate;
      }
      if (detectedSource) {
        parsed.data.source = detectedSource;
      }
    }

    return res.status(200).json({
      message: parsed.message || candidateText,
      data: parsed.data || null,
      profileUpdate: parsed.profileUpdate || null,
      provider: 'gemini'
    });
  } catch (err) {
    console.error('Serverless function error:', err);
    return res.status(500).json({
      error: err.message || 'Internal server error while processing AI request.'
    });
  }
}

function parseAppliedDate(text, defaultDate = undefined) {
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

function parseJobSource(text) {
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
