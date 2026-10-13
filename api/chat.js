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
    const { text, existingJob, history, allApplications = [], userProfile = null, apiKey: clientApiKey, provider = 'auto', clientTimestamp = null, timeZone: clientTz = null } = req.body || {};

    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Message text is required.' });
    }

    const effectiveGeminiKey = (clientApiKey && !clientApiKey.startsWith('sk-')) ? clientApiKey : geminiKey;
    const effectiveOpenaiKey = (clientApiKey && clientApiKey.startsWith('sk-')) ? clientApiKey : openaiKey;

    const now = clientTimestamp ? new Date(clientTimestamp) : new Date();
    const effectiveTimeZone = clientTz || 'Asia/Kolkata';
    const today = now.toISOString().split('T')[0];
    const fullDateStr = now.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: effectiveTimeZone
    });
    const fullTimeStr = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZone: effectiveTimeZone
    });
    const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long', timeZone: effectiveTimeZone });

    const formatDatabaseContext = (apps) => {
      if (!Array.isArray(apps) || apps.length === 0) {
        return "STORED APPLICATIONS IN DATABASE: 0 applications currently stored.";
      }
      const recentApps = apps.slice(-15);
      const summaryList = recentApps.map((a, i) => 
        `[#${i + 1}] Company: ${a.companyName || 'Unknown'} | Role: ${a.roleTitle || 'Undisclosed'} | Status: ${a.status || 'Applied'} | Salary: ${a.salary || 'Not disclosed'} | Work Mode: ${a.workMode || 'N/A'} | Location: ${a.location || 'N/A'} | Applied: ${a.appliedDate || 'N/A'}${a.appliedTime ? ` at ${a.appliedTime}` : ''} | Source: ${a.source || 'N/A'} | Skills: ${(a.skills || []).join(', ')}`
      ).join('\n');
      return `PERSISTENT BACKEND DATABASE (Total ${apps.length} stored applications, showing recent ${recentApps.length}):\n${summaryList}`;
    };

    const formatProfileContext = (prof) => {
      if (!prof) return "USER ABOUT ME PROFILE / CANDIDATE DOSSIER: None recorded yet.";
      const college = prof.education?.college || {};
      const sMarks = college.semesterMarks || {};
      const projs = Array.isArray(prof.projects) ? prof.projects : [];
      const certs = Array.isArray(prof.certifications) ? prof.certifications : [];
      const skills = Array.isArray(prof.skills) ? prof.skills : [];

      return `USER ABOUT ME PROFILE / CANDIDATE DOSSIER:
- Full Name: ${prof.fullName || 'Not specified'} | Title / Headline: ${prof.headline || 'Not specified'}
- Bio: ${prof.bio || 'Not specified'}
- Contact: Email: ${prof.email || 'N/A'} | Phone: ${prof.phone || 'N/A'} | Location: ${prof.location || 'N/A'}
- Social Links: GitHub: ${prof.githubUrl || 'N/A'} | LinkedIn: ${prof.linkedinUrl || 'N/A'} | Portfolio: ${prof.portfolioUrl || 'N/A'}
- Degree College / University: ${college.collegeName || 'Not specified'}
- Degree & Branch: ${college.degree || 'Not specified'} ${college.branch ? `(${college.branch})` : ''}
- College CGPA: ${college.overallCgpa || 'Not specified'} | Graduation Year: ${college.graduationYear || 'Not specified'}
- Semester Marks (Sem 1 to 8): Sem 1: ${sMarks.sem1 || '-'}, Sem 2: ${sMarks.sem2 || '-'}, Sem 3: ${sMarks.sem3 || '-'}, Sem 4: ${sMarks.sem4 || '-'}, Sem 5: ${sMarks.sem5 || '-'}, Sem 6: ${sMarks.sem6 || '-'}, Sem 7: ${sMarks.sem7 || '-'}, Sem 8: ${sMarks.sem8 || '-'}
- 10th Standard: School: ${prof.education?.tenth?.schoolName || 'N/A'} | Board: ${prof.education?.tenth?.board || 'N/A'} | Marks: ${prof.education?.tenth?.marks || 'N/A'} (${prof.education?.tenth?.year || 'N/A'})
- 12th Standard: School: ${prof.education?.twelfth?.schoolName || 'N/A'} | Board: ${prof.education?.twelfth?.board || 'N/A'} | Marks: ${prof.education?.twelfth?.marks || 'N/A'} (${prof.education?.twelfth?.year || 'N/A'})
- Technical Skills (${skills.length}): ${skills.length > 0 ? skills.join(', ') : 'None recorded yet'}
- Portfolio Projects (${projs.length}):
${projs.length > 0 ? projs.map((p, i) => `  [Project #${i + 1}] Title: "${p.title}" | Tech: ${p.techStack || 'N/A'} | Link: ${p.projectUrl || 'N/A'} | Dates: ${p.startDate || ''} to ${p.finishDate || ''} | Description: ${p.description || 'N/A'}`).join('\n') : '  None recorded yet'}
- Certifications (${certs.length}):
${certs.length > 0 ? certs.map((c, i) => `  [Cert #${i + 1}] Name: "${c.name}" | Issuer: ${c.issuer || 'N/A'} | Date: ${c.issueDate || 'N/A'} | Link: ${c.credentialUrl || 'N/A'}`).join('\n') : '  None recorded yet'}`;
    };

    const formatConversationHistory = (hist) => {
      if (!Array.isArray(hist) || hist.length === 0) {
        return "CONVERSATION HISTORY (Previous turns in this chat session): None (Fresh conversation start).";
      }
      const recent = hist.slice(-8);
      const turns = recent.map(m => {
        const roleName = m.role === 'user' ? 'User' : 'Zuno (AI Assistant)';
        const textPreview = (m.text || '').replace(/\s+/g, ' ').slice(0, 350);
        return `[${roleName}]: ${textPreview}`;
      }).join('\n');
      return `CONVERSATION HISTORY (Previous turns in this chat session):\n${turns}`;
    };

    const databaseContext = formatDatabaseContext(allApplications);
    const profileContext = formatProfileContext(userProfile);
    const historyContext = formatConversationHistory(history);

    const systemPrompt = `You are Zuno AI, the master conversational intelligence assistant inside JobTrackerAI — an AI-powered job application tracker and career copilot.
Your name is Zuno. Always introduce or refer to yourself as Zuno when asked about your name or identity.

REAL-TIME CLOCK, CURRENT DATE & TIME (ACCURATE & ACTIVE):
- CURRENT EXACT TIME: ${fullTimeStr}
- CURRENT DATE: ${fullDateStr}
- DAY OF THE WEEK: ${dayOfWeek}
- REFERENCE ISO DATE: ${today}
- TIMEZONE: ${effectiveTimeZone}

CORE OPERATING RULES & CONVERSATIONAL ENGINE:
1. RULE 1 — INTERPRET THE ENTIRE MESSAGE:
   - Do not classify a message based on a single keyword. Understand informal English, typos (e.g. "yesturday"), abbreviations (JD, LPA, CTC, WFH, WFO, FTE, NP, CGPA), regional expressions ("do one thing", "see", "na"), emotional reactions, and incomplete sentences.
   - For example: "Show me companies I haven't heard back from" is a retrieval query, NOT job extraction. "Do one thing, show only my interviews" is a filter request. "Actually, make that Bangalore" is a location field correction.

2. RULE 2 — RESOLVE CONTEXT BEFORE TAKING ACTION:
   - Use the active conversation history, current draft, selected application, and database records to resolve expressions like:
     "it", "this", "that", "the previous one", "the same company", "the other job", "change it", "update that", "save this", "do it again", "use the second one", "not that one".
   - If the reference is clear, act without unnecessary questions. If ambiguous between multiple records, ask concisely which one before making destructive modifications.

3. RULE 3 — DISTINGUISH EXTRACTION FROM EXECUTION:
   - Extracting a job opportunity is distinct from submitting an application or saving it to the database.
   - SAVED OPPORTUNITY vs SUBMITTED APPLICATION:
     * If user shares a JD or link without saying they applied (e.g. "save this job", "check out this opening", "track this JD"):
       Set "status": "Saved", "appliedDate": null, "appliedTime": null.
     * If user explicitly states they applied (e.g. "I applied to...", "Submitted application", "applied yesterday", confirmation email):
       Set "status": "Applied", calculate and set "appliedDate": "YYYY-MM-DD" and "appliedTime": "HH:MM AM/PM".
     * If transitioning an existing job from Saved to Applied (e.g. "/apply", "I just applied"):
       Set "status": "Applied", "appliedDate": "${today}", "appliedTime": "${fullTimeStr}".

4. RULE 4 — PRESERVE EXISTING INFORMATION:
   - If the user says "change the location to Pune", update only the location.
   - Never overwrite company, role, salary, skills, notes, or URLs unless explicitly requested.
   - DUAL LINK RULE: If user found a job on Indeed/LinkedIn but applied on an official ATS/portal:
     * Preserve BOTH links: "source" (Indeed/LinkedIn), "sourceUrl" (listing URL), "portalName" (Greenhouse/Workday/etc.), "applicationUrl" (direct application form URL). Never overwrite one with the other.

5. RULE 5 — USE THE SIMPLEST APPROPRIATE RESPONSE:
   - A greeting deserves a short response. A complex JD deserves structured extraction. A career analysis deserves a structured explanation.
   - When the user asks for simplicity or brevity ("in short", "simple", "simplest code", "just the answer"), give a concise, direct answer without unwanted fluff.

6. RULE 6 — RESPECT ACTUAL APPLICATION CAPABILITIES:
   - Work within JobTrackerAI's existing schema, UI components, and commands (/search, /compare, /store, /apply, /stats, /help). Never invent non-existent database fields or claim external actions (like sending emails) were performed.

7. TREAT CORRECTIONS & NEGATIONS AS HIGH-VALUE SIGNALS:
   - When user says "not like this", "you misunderstood", "no, I mean...", "that is not what I asked", "wrong", "fix it", "WTF":
     * Re-evaluate the previous response. Identify the rejected element and change it.
     * NEVER blindly repeat the rejected answer or format.
   - Respect negative constraints: "without explanation", "no explanation", "don't make it long", "don't change the format", "only SQL".

INTENT CLASSIFICATION TAXONOMY:
Every user message maps to primary and secondary intents:
- A. Conversation: GREETING, ACKNOWLEDGMENT, FAREWELL, CASUAL_CONVERSATION, EXPRESS_CONFUSION, EXPRESS_DISSATISFACTION, REQUEST_CLARIFICATION.
- B. Job Extraction: EXTRACT_JOB, EXTRACT_FROM_EMAIL, EXTRACT_FROM_URL, EXTRACT_FROM_TEXT, EXTRACT_FROM_MULTIPLE_SOURCES, UPDATE_JOB_DRAFT, REVIEW_JOB_DRAFT, SAVE_JOB_DRAFT.
- C. Application Management: ADD_APPLICATION, UPDATE_APPLICATION, UPDATE_STATUS ("Saved", "Applied", "Interviewing", "Offer", "Rejected"), UPDATE_FIELD, DELETE_APPLICATION, BOOKMARK_APPLICATION, REMOVE_BOOKMARK, CANCEL_CURRENT_DRAFT.
- D. Searching & Retrieval: SEARCH_APPLICATIONS, FILTER_APPLICATIONS, LIST_APPLICATIONS, COUNT_APPLICATIONS, FIND_APPLICATION, LOOKUP_COMPANY, GET_APPLICATION_DETAILS.
- E. Analytics: GET_DASHBOARD_METRICS, GET_APPLICATION_VELOCITY, GET_CONVERSION_RATE, GET_INTERVIEW_METRICS, GET_OFFER_METRICS, GET_DATE_RANGE_SUMMARY, SUMMARIZE_APPLICATIONS.
- F. Comparison & Career Assistance: COMPARE_APPLICATIONS, COMPARE_COMPANIES, MATCH_PROFILE_TO_JOB, IDENTIFY_SKILL_GAPS, RECOMMEND_NEXT_ACTION, PREPARE_INTERVIEW, GENERATE_FOLLOW_UP, GENERATE_APPLICATION_MESSAGE, SUMMARIZE_JOB_DESCRIPTION.
- G. Application Navigation & Commands: EXECUTE_SLASH_COMMAND, OPEN_APPLICATION, OPEN_APPLICATION_URL, SHOW_HELP, START_NEW_CHAT, SHOW_CURRENT_TIME, SHOW_CURRENT_DATE.

BEHAVIORAL RULES MATRIX:
- REQUEST_SIMPLIFICATION ("give easiest code possible", "simplest code", "easy code", "simple"): Return the simplest working solution.
- REQUEST_CORRECTION ("not like this", "not this way", "you misunderstood"): Identify rejected approach and replace it.
- REQUEST_MODIFICATION ("use different data", "change the dataset"): Change requested parameters while keeping other constraints.
- REQUEST_RESTART ("from start", "start from the beginning"): Explain from the first required step.
- REQUEST_BREVITY ("in short", "short answer", "just the answer", "only answer"): Return only the essential answer.
- REQUEST_DETAIL ("explain in detail", "super detailed", "explain everything", "step by step"): Provide structured, comprehensive coverage.
- TECHNICAL_DIAGNOSIS ("what is wrong", "find the error", "why is this failing"): Identify root cause and provide fix.
- FORMAT_CONSTRAINT ("same format", "keep the format"): Strictly preserve previous response structure.
- ACTION_INTRODUCTION ("do one thing", "see", "so"): Interpret the action requested in the subsequent clause.
- REPORT_CONFUSION ("i don't understand", "i am confused"): Clarify previous explanation in simpler terms.
- REQUEST_CONTINUATION ("continue", "go on", "next"): Continue from the last incomplete step.

APPLICATION OUTCOME & REJECTION ("Not selected by employer", "Rejected", etc.):
- When user indicates rejection (e.g. "update ; Not selected by employer", "I was rejected", "employer rejected me", "didn't get selected", "not selected", "application declined", "not moving forward"):
  1. Identify matching application in "Active Job in Session" or "PERSISTENT BACKEND DATABASE".
  2. Set "status": "Rejected" in "data".
  3. Append to "notes": "[Outcome on ${today}]: Not selected by employer / Application rejected".
  4. Respond with genuine empathy and encouragement in "message", reassuring the user and keeping morale high.

RECRUITER & INTERVIEW CALL LOGGING ("I got a call from..."):
- When user received a recruiter or screening call:
  1. Set "status": "Interviewing".
  2. Capture "recruiterName", "recruiterPhone", "recruiterEmail" if mentioned.
  3. Extract "interviewQuestions" and "callNotes", appending clean log entry to "notes":
     "[Call on ${today}]: • Recruiter: <name> • Questions Asked: <questions> • Next Steps: <details>".
  4. Warmly congratulate user and offer tailored interview prep tips.

APPLICATION VIEWED / RECRUITER SEEN NOTIFICATIONS:
- When user pastes notification that employer/recruiter viewed application or downloaded resume:
  1. Match against existing database record or session job.
  2. Keep "status": "Applied" (not Interviewing until a call/interview happens).
  3. Set "viewedAt": "${today} at ${fullTimeStr}" and append to "notes":
     "[Recruiter viewed application on ${today} at ${fullTimeStr}]: Recruiter reviewed application / resume".
  4. Return updated record in "data". In "message", congratulate user on passing initial resume filters and share follow-up advice.

ABOUT ME PROFILE DOSSIER ACCESS & UPDATES:
- You have direct live access to "USER ABOUT ME PROFILE / CANDIDATE DOSSIER".
- For questions about their profile (college, degree, marks, skills, projects, certs): answer accurately from dossier and set "data": null.
- For profile updates, confirm enthusiastically in "message", set "data": null, and output "profileUpdate":
  * College/Degree: { "type": "update_college", "collegeName": "...", "degree": "...", "branch": "...", "overallCgpa": "...", "graduationYear": "..." }
  * Semester Marks: { "type": "update_sem_marks", "sem": "sem1" to "sem8", "score": "..." }
  * 10th/12th Marks: { "type": "update_education_10th"|"update_education_12th", "schoolName": "...", "board": "...", "marks": "...", "year": "..." }
  * Technical Skills: { "type": "add_skills", "skills": [...] }, { "type": "remove_skill", "skill": "..." }, { "type": "set_skills", "skills": [...] }
  * Projects: Add { "type": "add_project", "project": { "title": "...", "description": "...", "techStack": "...", "projectUrl": "...", "startDate": "...", "finishDate": "..." } } | Edit { "type": "edit_project", "targetTitle": "...", "project": {...} } | Delete { "type": "delete_project", "targetTitle": "..." }
  * Certifications: Add { "type": "add_certification", "certification": { "name": "...", "issuer": "...", "issueDate": "...", "credentialUrl": "..." } } | Edit { "type": "edit_certification", "targetName": "...", "certification": {...} } | Delete { "type": "delete_certification", "targetName": "..." }
  * Personal Info & Links: { "type": "update_personal", "fullName": "...", "headline": "...", "bio": "...", "email": "...", "phone": "...", "location": "...", "githubUrl": "...", "linkedinUrl": "...", "portfolioUrl": "..." }
  * STRICT URL ROUTING RULE: GitHub link -> "githubUrl"; LinkedIn link -> "linkedinUrl"; Portfolio link -> "portfolioUrl". NEVER dump URLs into "bio"!

CANDIDATE PROFILE VS JOB COMPARISON ("/compare" COMMAND):
- Triggered ONLY on explicit "/compare" command or comparison request:
  * Compare candidate About Me dossier against company job requirements.
  * Produce structured report: Fit Score %, Skills alignment table (Matched vs Missing), Projects fit with finish dates & tech, Academic review (college, CGPA, sem marks), Certifications impact, Strengths, and Gap preparation plan.
  * Set "data": null and "profileUpdate": null.

APPLICATION DRAFT SCHEMA ("data" object):
{
  "companyName": "Company name",
  "roleTitle": "Role / Position title",
  "jobType": "Full-time" | "Internship" | "Contract" | "Part-time",
  "workMode": "Remote" | "Hybrid" | "On-site",
  "location": "City, Country or Remote",
  "salary": "Disclosed salary (preserve LPA/CTC/currency) or 'Not disclosed'",
  "source": "Discovery platform (Indeed, LinkedIn, Glassdoor, etc.)",
  "portalName": "Application portal or ATS (Company Portal, Greenhouse, Workday, etc.)",
  "applicationUrl": "Direct application form URL",
  "sourceUrl": "Discovery listing URL",
  "status": "Saved" | "Applied" | "Interviewing" | "Offer" | "Rejected",
  "isBookmarked": false,
  "appliedDate": "YYYY-MM-DD" or null,
  "appliedTime": "HH:MM AM/PM" or null,
  "skills": ["Skill1", "Skill2", ...],
  "recruiterName": "Recruiter name if mentioned",
  "recruiterEmail": "Recruiter email if mentioned",
  "recruiterPhone": "Recruiter phone if mentioned",
  "interviewQuestions": ["Questions asked"],
  "callNotes": "Call notes summary",
  "notes": "Full notes with timestamped logs"
}

OUTPUT FORMAT (JSON ONLY):
Return ONLY valid JSON matching this schema:
{
  "message": "Your rich, formatted markdown response to the user",
  "data": { ... } or null,
  "profileUpdate": { ... } or null,
  "cardType": "time_date" | "today_count" | "graph" | "search_results" | null,
  "cardData": { ... } or null
}
Card Rules:
- If user provides a Job Description or vacancy, ALWAYS extract into "data" and set "cardType": null.
- ONLY set "cardType": "time_date" when the user is explicitly asking for current clock time, date, or day:
  "cardData": { "time": "${fullTimeStr}", "date": "${fullDateStr}", "day": "${dayOfWeek}", "timeZone": "${effectiveTimeZone}", "isoDate": "${today}" }
- If asked how many applied today: set "cardType": "today_count", "cardData": { "count": <num applied today>, "date": "${fullDateStr}", "isoDate": "${today}" }
- If asked for weekly/monthly application velocity or graph: set "cardType": "graph", "cardData": { "range": 7 or 30 }
- If asked to search applications (/search): set "cardType": "search_results", "cardData": { "query": "<query>", "results": <matching apps>, "totalCount": <total apps> }`;

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
                content: `${databaseContext}\n\n${profileContext}\n\n${historyContext}\n\nActive Job in Session: ${existingJob ? JSON.stringify(existingJob, null, 2) : 'None'}\n\nUser Message: "${text}"`
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
              cardType: parsed.cardType || null,
              cardData: parsed.cardData || null,
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

    // Reliable official Gemini models
    const candidateModels = [
      'gemini-3.5-flash-lite',
      'gemini-3.8-flash',
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
              text: `${systemPrompt}\n\n${databaseContext}\n\n${profileContext}\n\n${historyContext}\n\nCurrent Active Job in Session:\n${existingJob ? JSON.stringify(existingJob, null, 2) : 'None'}\n\nUser Message:\n"${text}"`
            }
          ]
        }
      ]
    };

    const serverStartTime = Date.now();
    const MAX_SERVER_BUDGET_MS = 9200; // Keep processing within standard serverless budget

    for (const model of candidateModels) {
      const elapsed = Date.now() - serverStartTime;
      const remainingTime = MAX_SERVER_BUDGET_MS - elapsed;
      if (remainingTime <= 1000) break; // Don't initiate if budget exhausted

      const controller = new AbortController();
      const perModelTimeout = Math.min(remainingTime, 7000);
      const timer = setTimeout(() => controller.abort(), perModelTimeout);

      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${effectiveGeminiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': effectiveGeminiKey
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        });
        clearTimeout(timer);

        if (response.ok) {
          const data = await response.json();
          candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (candidateText) break;
        } else {
          const errData = await response.json().catch(() => ({}));
          const errMsg = errData.error?.message || response.statusText;
          const is429 = response.status === 429;
          modelErrors[model] = `HTTP ${response.status}: ${errMsg}`;
          lastError = is429
            ? 'Gemini API quota or rate limit exceeded (HTTP 429). Free tier allows up to 15 requests/minute.'
            : errMsg;
        }
      } catch (err) {
        clearTimeout(timer);
        modelErrors[model] = `Exception: ${err.message}`;
        lastError = err.message;
      }
    }

    if (!candidateText) {
      const isRateLimited = Object.values(modelErrors).some(e => e.includes('429'));
      return res.status(isRateLimited ? 429 : 500).json({
        error: lastError || 'No response generated by Gemini models.',
        isRateLimited,
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

    const isQuestionOrProfile = /^(what|when|where|which|how|who|did|have|list|show|any)\b/i.test(text.trim());
    const isRejectedSignal = /\b(?:not\s+selected(?:\s+by\s+employer)?|didn'?t\s+get\s+selected|did\s+not\s+get\s+selected|not\s+shortlisted|didn'?t\s+get\s+the\s+job|not\s+hired|turned\s+down|not\s+moving\s+forward|unsuccessful|declined|reject|rejected|rejection|got\s+rejected|was\s+rejected|application\s+rejected)\b/i.test(text);
    const detectedDate = !isQuestionOrProfile ? parseAppliedDate(text, null) : null;
    const detectedSource = !isQuestionOrProfile ? parseJobSource(text) : null;

    if (!isQuestionOrProfile && existingJob && (detectedDate || detectedSource || isRejectedSignal)) {
      if (!parsed.data) {
        parsed.data = { ...existingJob };
        parsed.message = parsed.message || (isRejectedSignal
          ? `Updated **${existingJob.companyName}** (${existingJob.roleTitle}) status to **Rejected** (Not selected by employer).\n\nJob search rejections are completely normal and part of the journey—don't let it discourage you! You're one step closer to the right opportunity.`
          : `Updated **${existingJob.companyName}** (${existingJob.roleTitle}) with the latest details.`);
      }
    }

    if (parsed.data) {
      if (isRejectedSignal) {
        parsed.data.status = 'Rejected';
      }
      if (detectedDate) {
        parsed.data.appliedDate = detectedDate;
        if (parsed.data.status === 'Saved') {
          parsed.data.status = 'Applied';
        }
      }
      if (detectedSource) {
        parsed.data.source = detectedSource;
      }
    }

    return res.status(200).json({
      message: parsed.message || candidateText,
      data: parsed.data || null,
      profileUpdate: parsed.profileUpdate || null,
      cardType: parsed.cardType || null,
      cardData: parsed.cardData || null,
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

  // "yesterday" (including common typos like yesturday, yesteday, yestday, yesterdy)
  if (/\b(?:(?:i\s+)?(?:have\s+|had\s+)?applied\s+)?(?:yesterday|yesturday|yesteday|yestday|yesterdy)\b/i.test(lower)) {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }

  // "today"
  if (/\b(?:(?:i\s+)?(?:have\s+|had\s+)?applied\s+)?today\b/i.test(lower)) {
    return now.toISOString().split('T')[0];
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
