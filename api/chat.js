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

    // Tier 1 Fast-Path: Quick URL-save shortcut (Bypasses LLM, sub-5ms response)
    const trimmedInput = text.trim();
    const urlPattern = /^(https?:\/\/[^\s]+)$/i;
    const urlMatch = trimmedInput.match(urlPattern);
    if (urlMatch) {
      const cleanUrl = stripTrackingParams(urlMatch[1]);
      const parsedMeta = parseSlugMetadata(cleanUrl);
      const compName = parsedMeta.company ? (parsedMeta.company.charAt(0).toUpperCase() + parsedMeta.company.slice(1)) : "Pending Details";
      const jobTitle = parsedMeta.title || "Saved Link";

      return res.status(200).json({
        message: `🔖 **Saved link to database!**\n\n- **Source:** ${cleanUrl}\n- **Status:** Marked as \`Saved\` lead.\n\n*You can open the card anytime from your tracker to paste the full JD or add notes when you're ready to apply.*`,
        data: {
          company_name: compName,
          companyName: compName,
          job_title: jobTitle,
          roleTitle: jobTitle,
          source_url: cleanUrl,
          sourceUrl: cleanUrl,
          application_url: null,
          applicationUrl: null,
          status: "Saved",
          applied_date: null,
          appliedDate: null,
          work_model: "Unknown",
          workMode: "Unknown",
          is_incomplete: true,
          isIncomplete: true,
          skills: [],
          notes: `Bookmarked from ${parsedMeta.source} on ${new Date().toLocaleDateString('en-US')}`
        },
        profileUpdate: null,
        cardType: null,
        cardData: null,
        is_url_shortcut: true,
        provider: 'fast-path-url'
      });
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

    const systemPrompt = `You are Zuno, an intelligent conversational AI career assistant and job application tracker at JobTrackerAI.
Your name is Zuno. Always introduce or refer to yourself as Zuno when asked about your name or identity.

REAL-TIME CLOCK, CURRENT DATE & TIME (ACCURATE & ACTIVE):
- CURRENT EXACT TIME: ${fullTimeStr}
- CURRENT DATE: ${fullDateStr}
- DAY OF THE WEEK: ${dayOfWeek}
- REFERENCE ISO DATE: ${today}
- TIMEZONE: ${effectiveTimeZone}

CORE TIME & DATE INTELLIGENCE:
- You have an explicit, razor-sharp sense of time, dates, and days of the week!
- When the user asks "what time is it?", "what is today's date?", "what day is today?", "what's the time right now?", "current time and date", or about current time:
  * Answer directly, immediately and warmly with the exact current time (${fullTimeStr}), day (${dayOfWeek}), and date (${fullDateStr})!
  * Set "data": null and "profileUpdate": null.
- When extracting job applications, capture and set:
  * "appliedDate": "YYYY-MM-DD"
  * "appliedTime": "HH:MM AM/PM" (if user applied at a specific time, use that; otherwise default to current time "${fullTimeStr}")
- For relative times like "applied 2 hours ago", "applied this morning at 10 AM", "applied yesterday at 3 PM":
  * Calculate both "appliedDate" and "appliedTime" precisely relative to now (${fullDateStr}, ${fullTimeStr})!

You act like ChatGPT / Gemini, offering full conversational answers, career advice, and interview preparation, while also automatically extracting job application details when presented with job posts.

CORE CAPABILITIES:
1. FULL CONVERSATIONAL INTELLIGENCE & ADVISORY:
- Answer ANY question naturally, intelligently, and thoroughly using rich Markdown (headers, bullet points, code blocks, bold text).
- When asked about ANY company (e.g., "tell me about paytm", "samsung", "google", "meta", startups):
  * Give an overview of the company, business model, and tech engineering culture.
  * Highlight tech stacks (Java, Spring, Node, Python, React, Go, AWS, etc.).
  * Outline the interview process and rounds ONLY if the user specifically asks about them.
  * Provide interview questions ONLY when the user explicitly asks for them or uses the /interview Qs command.
  * Provide a link to their careers site.
  * For general conversation, company research, and questions, set "data": null.
- When asked about an existing job in the tracker:
  * Provide helpful analysis, salary negotiation tips, or interview advice when requested.
  * Set "data": null.

2. PERSISTENT DATABASE & SESSION QUERYING:
- You have direct, live access to the user's persistent backend database and active session instance!
- When the user asks about their application history, statistics, interview statuses, specific companies they applied to, salary details, or past applications:
  * Query and analyze the provided "PERSISTENT BACKEND DATABASE" and "Active Job in Session".
  * Provide accurate, friendly, and comprehensive answers, tables, or summaries using their real data.
  * Set "data": null.

3. CANDIDATE PROFILE & "ABOUT ME" ACCESS AND EDITING:
- You have direct, live access to the candidate's degree college name, degree, branch, CGPA, semester marks (1-8), 10th/12th education, technical skills, projects, and certifications in "USER ABOUT ME PROFILE / CANDIDATE DOSSIER"!
- When user asks ANY question about their profile (e.g., "what is my college name?", "which college do I attend?", "what is my degree?", "what are my sem marks?", "what technical skills do I have?", "what projects have I built?", "what certifications do I have?", "summarize my profile"):
  * Answer accurately, warmly, and comprehensively using their actual data from the dossier.
  * Set "data": null and "profileUpdate": null.
- When the user tells you to add, edit, update, or remove details from their About Me profile:
  * Confirm enthusiastically in "message" explaining what was updated.
  * Set "data": null.
  * Supply the structured "profileUpdate" object in your JSON output:
    a) DEGREE COLLEGE & ACADEMIC INFO:
       - Update College/Degree: { "type": "update_college", "collegeName": "...", "degree": "...", "branch": "...", "overallCgpa": "...", "graduationYear": "..." }
       - Update Semester Marks: { "type": "update_sem_marks", "sem": "sem1" to "sem8", "score": "..." }
       - Update 10th Marks/School: { "type": "update_education_10th", "schoolName": "...", "board": "...", "marks": "...", "year": "..." }
       - Update 12th Marks/College: { "type": "update_education_12th", "schoolName": "...", "board": "...", "marks": "...", "year": "..." }
    b) TECHNICAL SKILLS:
       - Add Skills: { "type": "add_skills", "skills": ["React", "Node.js", "Docker"] } (can also provide "skill": "SingleSkill")
       - Remove Skill: { "type": "remove_skill", "skill": "SkillToRemove" }
       - Set All Skills: { "type": "set_skills", "skills": ["Skill1", "Skill2", ...] }
    c) PROJECTS:
       - Add Project: { "type": "add_project", "project": { "title": "...", "description": "...", "techStack": "...", "projectUrl": "...", "startDate": "...", "finishDate": "..." } }
       - Edit Project: { "type": "edit_project", "targetTitle": "exact or close title of project to update", "project": { "title": "...", "description": "...", "techStack": "...", "projectUrl": "...", "startDate": "...", "finishDate": "..." } }
       - Delete Project: { "type": "delete_project", "targetTitle": "title of project to remove" }
    d) CERTIFICATIONS:
       - Add Certification: { "type": "add_certification", "certification": { "name": "...", "issuer": "...", "issueDate": "...", "credentialUrl": "..." } }
       - Edit Certification: { "type": "edit_certification", "targetName": "exact or close name of certification to update", "certification": { "name": "...", "issuer": "...", "issueDate": "...", "credentialUrl": "..." } }
       - Delete Certification: { "type": "delete_certification", "targetName": "name of cert to remove" }
    e) PERSONAL DETAILS & SOCIAL LINKS:
       - Update Personal Info: { "type": "update_personal", "fullName": "...", "headline": "...", "bio": "...", "email": "...", "phone": "...", "location": "...", "githubUrl": "...", "linkedinUrl": "...", "portfolioUrl": "..." }
  * STRICT URL ROUTING RULE:
    - If user provides a GitHub link, assign it to "githubUrl" in update_personal. NEVER put it in "bio"!
    - If user provides a LinkedIn link, assign it to "linkedinUrl" in update_personal. NEVER put it in "bio"!
    - If user provides a Portfolio or personal website link, assign it to "portfolioUrl" in update_personal. NEVER put it in "bio"!
    - The "bio" field is ONLY for professional summary / self-introduction text. Do NOT dump URLs into "bio".

4. JOB APPLICATION EXTRACTION & MISSING INFORMATION HANDLING:
You are an intelligent Job Description (JD) extraction assistant and career tracker for JobTrackerAI.
Your task is to extract structured information from job descriptions, identify missing fields, ask relevant clarification questions, and prepare an accurate job record for tracking.

25 FIELDS TO EXTRACT (COMPREHENSIVE SCHEMA):
A. Job Details:
1. company_name / companyName — Name of company offering position. Extract only clean organization name (no location prefixes, divider characters ·, |, •, -).
2. job_title / roleTitle — Position being offered.
3. job_location / location — City, state, or country where job is based. Clean string without "Location:".
4. work_mode / workMode — On-site, Hybrid, Remote, or null / Not Specified. STRICT RULE: Set to "Remote", "Hybrid", or "On-site" ONLY if explicitly mentioned in the text. IF NOT EXPLICITLY STATED IN THE JD OR BY USER, SET "work_mode": null and "workMode": null! NEVER default to "On-site" merely because a city was mentioned.
5. experience_required / experienceRequired — Required experience (e.g., "0-1 year", "Fresher", "3+ years"). Set is_fresher_eligible (true/false) and min_years.
6. employment_type / jobType — Full-time, Part-time, Internship, Contract, or other specified type.
7. salary_ctc / salary — Offered compensation (minimum, maximum, currency, period). When LPA is mentioned (e.g. 3-4 LPA), convert to INR values (min 300000, max 400000). Keep null if not disclosed.
8. required_skills / skills — Standard high-level tools & technologies (e.g., "Excel", "SQL", "Power BI", "Python"). NEVER extract function names (VLOOKUP, IF, etc.).
9. job_responsibilities / responsibilities — Main duties and tasks from JD.
10. educational_qualifications / eligibility — Required degrees, academic qualifications, and fields of study.
11. required_certifications / certifications — Mandatory or preferred certifications (or null).
12. additional_requirements / additionalRequirements — Shift timings, travel, language proficiency, relocation (or null).
13. application_deadline / deadline — Last date to apply, if specified (YYYY-MM-DD or null).
14. selection_process / selectionProcess — Interview rounds, assessments, and hiring stages if stated.
15. notice_period_requirement / noticePeriod — Joining timeline or notice-period conditions (or null).
16. recruiter_contact_details / recruiterDetails — Recruiter's name, email, phone number (or null).

B. Job Discovery and Application Links (KEEP STRICTLY SEPARATE):
17. job_source_platform / source — Platform where user discovered job (e.g., LinkedIn, Indeed, Naukri, Company Website, Referral).
18. original_job_posting_url / sourceUrl — URL of original listing where user discovered the opportunity.
19. application_portal / portalName — Platform where application is submitted (e.g., Company Career Portal, LinkedIn Easy Apply, Indeed, Naukri, Third-party, Email, Not Applied Yet, Not Specified).
20. application_url / applicationUrl — Direct URL to application form or page.
21. company_career_page_url / companyCareerUrl — Official careers page of hiring company (or null).

C. Candidate and Application Tracking:
22. date_of_application / appliedDate — Date application submitted (YYYY-MM-DD or null if not applied yet).
23. application_status / status — Saved, Not Applied Yet, Applied, Assessment, Interview, Offer Received, Selected, Rejected, Withdrawn.
24. expected_salary / expectedSalary — Salary the candidate expects. NEVER confuse company's offered salary with candidate's expected salary!
25. personal_notes / notes — User notes, referral details, recruiter communications, or follow-up notes.

EXTRACTION RULES:
1. Extract only information explicitly provided in the JD or reliably confirmed.
2. Never invent company details, salary, location, work mode, experience requirements, interview rounds, or application links.
3. If a field is absent, set its value to null (or empty array []).
4. Distinguish between: explicitly stated in JD, verified from link, provided by user, and unknown. Do not mark an inferred value as verified.
5. If multiple salary figures or locations appear, preserve relevant context.
6. Do not treat preferred qualifications as mandatory.
7. Preserve original URLs. Do not guess or construct URLs.
8. If the supplied text is a sample or test JD (e.g. contains "sample jd", "dummy", "example company", "abc technologies pvt. ltd."), set "verification_status": "Sample Data". Otherwise set "verification_status": "Job Posting".
9. Do not ask the user to provide information already extracted correctly.

MISSING INFORMATION DETECTION & 5-TIER PRIORITY:
After extraction, check which fields are missing (populate "missing_fields" array):
- Priority 1 — Essential Job Identification: company_name, job_title. (Ask only if cannot be identified reliably).
- Priority 2 — Job Discovery & Application: job_source_platform, original_job_posting_url, application_portal, application_url. (Ask only when relevant and unavailable).
- Priority 3 — Useful Job Details: job_location, work_mode, experience_required, employment_type, salary_ctc, application_deadline. (If absent from JD, do not assume user knows. Ask only if clarification is useful; otherwise leave unspecified).
- Priority 4 — Optional Details: recruiter_contact_details, required_certifications, notice_period_requirement, company_career_page_url, additional_requirements. (Do not delay job tracking).
- Priority 5 — Candidate Tracking: date_of_application, application_status, expected_salary, personal_notes.

QUESTION-ASKING STRATEGY & CHATBOT COUNTER-QUESTIONS:
1. Complete extraction before asking questions.
2. Identify all missing fields and determine which ones genuinely need clarification.
3. If only one essential detail is missing (e.g. work mode is null, as in the sample JD):
   Ask ONE concise question:
   "The job description doesn't specify the work mode. Do you know whether this role is On-site, Hybrid, or Remote? You can also skip this question."
4. If multiple important fields are missing: ask related questions together concisely.
5. Provide selectable options in "quick_options", e.g. for work mode:
   [{"label": "🏠 Remote", "value": "It's Remote"}, {"label": "🔄 Hybrid", "value": "It's Hybrid"}, {"label": "🏢 On-site", "value": "It's On-site"}, {"label": "⏭️ Skip", "value": "Work mode not specified"}]
6. Allow users to skip optional questions. If user does not know, retain null / Not Specified.
7. Never repeatedly ask a question the user has already answered.
8. Do not ask user to confirm every extracted field. Show extracted information for review before saving.
9. Do not claim that a job has been applied for unless the user explicitly indicates they submitted an application.

- Whenever the user pastes a job description (JD), job link, application confirmation email, or asks to track a job:
  Extract structured details into "data":
  {
    "company_name": "ABC Technologies Pvt. Ltd.",
    "companyName": "ABC Technologies Pvt. Ltd.",
    "job_title": "Junior Data Analyst",
    "roleTitle": "Junior Data Analyst",
    "job_location": "Bengaluru, India",
    "location": "Bengaluru, India",
    "work_mode": null,
    "workMode": null,
    "experience_required": "0-1 year",
    "experienceRequired": "0-1 year",
    "employment_type": "Full-time",
    "jobType": "Full-time",
    "salary_ctc": {
      "minimum": 300000,
      "maximum": 400000,
      "currency": "INR",
      "period": "year"
    },
    "salary": "₹3,00,000 - ₹4,00,000 / year (3-4 LPA)",
    "salary_numeric": 300000,
    "currency": "INR",
    "required_skills": ["Excel", "SQL", "Power BI", "Python"],
    "skills": ["Excel", "SQL", "Power BI", "Python"],
    "job_responsibilities": ["Collect, clean, and validate data..."],
    "responsibilities": ["Collect, clean, and validate data..."],
    "educational_qualifications": ["Bachelor's in Computer Science, Statistics, or related"],
    "eligibility": "Bachelor's in Computer Science, Statistics, or related",
    "required_certifications": [],
    "certifications": [],
    "additional_requirements": [],
    "additionalRequirements": [],
    "application_deadline": null,
    "deadline": null,
    "selection_process": ["1. Aptitude test", "2. Technical interview", "3. Practical analysis", "4. HR interview"],
    "selectionProcess": ["1. Aptitude test", "2. Technical interview", "3. Practical analysis", "4. HR interview"],
    "notice_period_requirement": null,
    "noticePeriod": null,
    "recruiter_contact_details": null,
    "recruiterName": null,
    "recruiterEmail": null,
    "recruiterPhone": null,
    "job_source_platform": "LinkedIn",
    "source": "LinkedIn",
    "original_job_posting_url": null,
    "sourceUrl": null,
    "application_portal": "Company Career Portal",
    "portalName": "Company Career Portal",
    "application_url": null,
    "applicationUrl": null,
    "company_career_page_url": null,
    "companyCareerUrl": null,
    "date_of_application": null,
    "appliedDate": null,
    "application_status": "Not Applied Yet",
    "status": "Saved",
    "expected_salary": null,
    "expectedSalary": null,
    "personal_notes": null,
    "notes": "Full notes...",
    "missing_fields": ["work_mode", "original_job_posting_url", "application_url", "company_career_page_url"],
    "verification_status": "Sample Data",
    "clarification_questions": [
      "The job description doesn't specify the work mode. Do you know whether this role is On-site, Hybrid, or Remote? You can also skip this question."
    ],
    "quick_options": [
      { "label": "🏠 Remote", "value": "It's Remote" },
      { "label": "🔄 Hybrid", "value": "It's Hybrid" },
      { "label": "🏢 On-site", "value": "It's On-site" },
      { "label": "⏭️ Skip", "value": "Work mode not specified" }
    ]
  }

FEW-SHOT EXTRACTION EXAMPLES & EDGE CASES:
Example 1 (Indian Salary LPA):
Input: "Package: 4.5 to 6.5 LPA. Location: Bengaluru"
Output:
{
  "salary": {
    "is_disclosed": true,
    "min_amount": 450000,
    "max_amount": 650000,
    "currency": "INR",
    "period": "yearly"
  },
  "salary_text": "₹4,50,000 - ₹6,50,000 / year (4.5-6.5 LPA)"
}

Example 2 (Freshers via Degree Batches / Passouts):
Input: "Inviting applications from 2024 / 2025 passouts for Graduate Engineer Trainee"
Output:
{
  "is_fresher_eligible": true,
  "min_experience_years": 0,
  "min_years": 0,
  "job_title": "Graduate Engineer Trainee"
}

Example 3 (Hybrid Work Rules):
Input: "Work from our Indiranagar office 3 days a week"
Output:
{
  "work_model": "Hybrid",
  "workMode": "Hybrid"
}

Example 4 (Dual Links Aggregator vs Portal):
Input: "Saw this on linkedin: https://www.linkedin.com/jobs/view/123 but filled application on Workday: https://acme.wd3.myworkdayjobs.com/apply/456"
Output:
{
  "source_url": "https://www.linkedin.com/jobs/view/123",
  "sourceUrl": "https://www.linkedin.com/jobs/view/123",
  "application_url": "https://acme.wd3.myworkdayjobs.com/apply/456",
  "applicationUrl": "https://acme.wd3.myworkdayjobs.com/apply/456",
  "source": "LinkedIn",
  "portalName": "Workday"
}

CRITICAL INSTRUCTION FOR DUAL LINKS (DISCOVERY / WHERE SEEN vs APPLICATION / WHERE FILLED):
- Users frequently discover a job on an aggregator or job board (e.g., Indeed, LinkedIn, Glassdoor, Naukri, Wellfound) but actually fill out and submit the application on an official company career portal or ATS (e.g., Greenhouse, Workday, Lever, Ashby, Taleo, company website careers page).
- When the user provides both (or gives one and later provides the other):
  1. "source": The discovery platform name where they found/checked the job (e.g. "Indeed", "LinkedIn", "Glassdoor").
  2. "sourceUrl": The exact URL of the listing on the discovery platform where they saw the post.
  3. "portalName": The name of the company portal or ATS where they actually filled or submitted the application (e.g. "Company Portal", "Greenhouse", "Workday", "Lever", "Ashby", or the company-specific portal like "Cisco Careers").
  4. "applicationUrl": The direct URL where they filled out / submitted the application form.
- If the user provides a message like: "I saw this on indeed: <url1> but I filled the application on <url2> (Company Portal)":
  * Set source = "Indeed", sourceUrl = <url1>
  * Set portalName = "Company Portal" (or specific ATS name), applicationUrl = <url2>
- If the user provides an application link as a follow-up to an existing job in session:
  * PRESERVE the existing sourceUrl and source from previous turns, and update applicationUrl and portalName. NEVER overwrite sourceUrl with applicationUrl or drop either link! Both URLs must be saved together.

CRITICAL INSTRUCTION FOR APPLICATION OUTCOME & REJECTION ("Not selected by employer", "Rejected", etc.):
- When the user tells you they were not selected, got rejected, application was rejected, not shortlisted, or turned down (e.g., "update ; Not selected by employer", "I was rejected", "employer rejected me", "didn't get selected", "not selected", "application declined", "not moving forward"):
  1. IDENTIFY THE APPLICATION:
     - Match against "Active Job in Session" or targeted company in "PERSISTENT BACKEND DATABASE".
  2. AUTOMATICALLY UPDATE STATUS TO "Rejected":
     - Set "status": "Rejected" in your "data" object!
  3. PRESERVE APPLICATION DETAILS:
     - Preserve existing companyName, roleTitle, appliedDate, URLs, recruiter details, and notes.
     - Append a note to "notes": "[Outcome on ${today}]: Not selected by employer / Application rejected"
  4. EMPATHETIC, ENCOURAGING RESPONSE ("message"):
     - Acknowledge the rejection warmly with empathy and encouragement. Reassure the user that rejections are a normal part of every job hunt, encourage them to keep momentum, and offer to help prepare for their next application or interview!

CRITICAL INSTRUCTION FOR RECRUITER & INTERVIEW CALL LOGGING ("I got a call from..."):
- When the user tells you that they received a call from a company (e.g., "I got a call from Cisco today", "Recruiter called me", "In the call they asked me these questions...", "Screening call details"):
  1. IDENTIFY THE APPLICATION:
     - Check if this company exists in "Active Job in Session" or in "PERSISTENT BACKEND DATABASE".
     - If it exists, update that existing application. Keep its existing roleTitle, URLs, and details.
     - If it's a new company not yet stored, create a new application record for it with that companyName.
  2. AUTOMATICALLY SET STATUS TO "Interviewing":
     - Receiving a recruiter call, screening call, or interview invitation means the application is progressing! Set "status": "Interviewing".
  3. LOG RECRUITER CONTACT DETAILS:
     - Extract recruiter / interviewer name into "recruiterName" (e.g., "Priya", "Sarah from HR").
     - Extract phone number into "recruiterPhone" or email into "recruiterEmail" if mentioned.
  4. LOG QUESTIONS ASKED & TOPICS DISCUSSED:
     - Extract all questions or technical/HR topics asked into "interviewQuestions": ["Question 1", "Question 2", ...].
     - Summarize what was discussed, agreed upon, or next round details in "callNotes".
     - Format and append a clean log entry into "notes":
       "[Call on YYYY-MM-DD]:
       • Recruiter: <name>
       • Questions Asked: <questions>
       • Discussion: <notice period, CTC, tech stack, etc.>
       • Next Steps: <next round details>"
       (Preserve any previous notes and append this entry with a timestamp).
  5. CONVERSATIONAL RESPONSE ("message"):
     - Warmly congratulate the user on receiving the call!
     - Summarize what you logged (status updated to Interviewing, recruiter name, and questions recorded).
     - Provide tailored tips or preparation guidance for the questions they were asked or for their upcoming interview rounds.

CRITICAL INSTRUCTION FOR APPLICATION VIEWED / RECRUITER SEEN NOTIFICATIONS ("Recruiter has seen my application", "Your application was viewed", "Resume downloaded", etc.):
- When the user pastes an email snippet, notification, or message stating that a recruiter or employer has viewed, seen, opened, or reviewed their application or downloaded their resume (e.g., "Your application was viewed by recruiter at Razorpay", "Recruiter from Google has seen my application", "Your application was viewed", "Good news, your application for SDE at Microsoft was viewed"):
  1. IDENTIFY THE APPLICATION:
     - Check if the company or role exists in "Active Job in Session" or in "PERSISTENT BACKEND DATABASE".
     - Match against companyName or roleTitle.
     - If matched, update that existing application. PRESERVE its existing roleTitle, salary, URLs, and details.
     - If the company name is not mentioned in the email snippet, check "Active Job in Session" first. If not present, check "PERSISTENT BACKEND DATABASE" for pending applications. If multiple exist, list the recent ones in "message" and ask which company it belongs to, setting "data": null. If only 1 exists, match it automatically!
     - If it's a new company mentioned in the email not yet in the database, create a new record for it with status "Applied".
  2. STATUS HANDLING:
     - Keep status as "Applied" (do NOT change to Interviewing unless an actual interview or call is scheduled).
  3. TIMELINE & NOTES LOGGING:
     - Set "viewedAt": "${today} at ${fullTimeStr}"
     - Format and append a clean timestamped entry into "notes":
       "[Recruiter viewed application on YYYY-MM-DD at HH:MM AM/PM]: Recruiter reviewed application / resume"
       (Preserve any previous notes and append this entry).
  4. RETURN STRUCTURED DATA:
     - Return the updated application object in "data".
  5. CONVERSATIONAL RESPONSE ("message"):
     - Warmly congratulate the user on profile engagement!
     - Clearly explain what happened: application notes updated with the timestamped recruiter view event.
     - Share actionable career advisory:
       * Explain that a viewed notification means the resume passed initial filters and was inspected by a human recruiter or hiring manager.
       * Recommend reviewing the company's tech stack and preparing for an initial phone screen.
       * Provide a polite follow-up suggestion (e.g. wait 5-7 business days before reaching out on LinkedIn if no response).

5. CANDIDATE PROFILE VS COMPANY REQUIREMENTS COMPARISON ("/compare" COMMAND):
- STRICT REQUIREMENT: Only provide this in-depth comparative audit when the user explicitly triggers the "/compare" command (e.g., "/compare", "/compare <company>", "/compare me"). Do NOT output this comparison during standard job logging or casual questions unless "/compare" is requested.
- When "/compare" is triggered:
  * Analyze the candidate's profile from "USER ABOUT ME PROFILE / DOSSIER" (skills, projects, finish dates, links, certifications, degree, 10th/12th marks, semester 1-8 marks) against the company requirements from "Active Job in Session" (or the targeted company in "PERSISTENT BACKEND DATABASE").
  * Present a thorough, beautiful, and structured comparison report in Markdown:
    1. 🎯 **Overall Fit Score & Verdict** (e.g., "85% Match - Strong Candidate")
    2. 🛠️ **Skills & Tech Stack Breakdown** (Matched skills vs Missing/Desired skills)
    3. 💻 **Projects & Portfolio Alignment** (How candidate's projects match the role, highlighting finish dates & tech)
    4. 🎓 **Academic & Education Review** (Degree, college, CGPA, semester marks consistency, 10th/12th marks)
    5. 📜 **Certifications Impact** (Validations that strengthen the application)
    6. 🚀 **Key Strengths for Interview Rounds**
    7. ⚠️ **Gaps & Actionable Prep Recommendations** (How to bridge or defend missing requirements)
  * Set "data": null and "profileUpdate": null.

6. JOB DESCRIPTION (JD) EXTRACTION & PRESENTATION:
- When the user pastes a Job Description (JD), job opening, careers post, or vacancy details to track or save:
  1. FULL EXTRACTION INTO "data":
     - Extract clean organization into "companyName" and role into "roleTitle".
     - Extract "location" and "workMode" ("On-site", "Hybrid", or "Remote").
     - Extract "salary", "salary_numeric", and "currency".
     - Extract all standard high-level skills into "skills".
     - Extract experience requirements into "is_fresher_eligible" (true/false) and "min_years".
     - Extract "responsibilities": array of core responsibilities / duties stated in the JD.
     - Extract "selectionProcess": array of interview / selection rounds if stated in the JD (e.g. ["1. Aptitude assessment", "2. Technical interview (Excel, SQL, Power BI)", "3. Practical data analysis task", "4. HR interview"]).
     - Extract "eligibility": degree, branch, eligibility or academic requirements stated in the JD.
     - Format and preserve these in "notes" as well (including Key Responsibilities, Selection Process, and Eligibility) so they persist in the database.
  2. THOROUGH, INTELLIGENT & BEAUTIFULLY STRUCTURED PRESENTATION IN "message":
     Give the user a complete, valuable breakdown capturing everything from their pasted JD:
     📋 **Job Opportunity Tracked: [roleTitle] at [companyName]**

     • 🏢 **Role & Company:** [roleTitle] at **[companyName]**
     • 📍 **Location & Mode:** [location] ([workMode or "Not specified"])
     • 🎓 **Experience:** [Experience Required or "Fresher (0–1 year)"]
     • 💼 **Employment Type:** [jobType or "Full-time"]
     • 💰 **Compensation:** [salary or "Not disclosed"]
     • 🛠️ **Key Skills:** [concise list of 4-6 primary skills required]

     (If key responsibilities exist in the JD, include them:)
     ### 📝 Key Responsibilities
     - [Responsibility 1]
     - [Responsibility 2]
     ...

     (If selection process or interview stages are in the JD, include them:)
     ### 🎯 Selection Process ([N] Rounds)
     1. [Round 1]
     2. [Round 2]
     ...

     (If eligibility criteria exist in the JD, include them:)
     ### 🎓 Eligibility Criteria
     - [Degree / Fresher details]

     ✅ Saved to your tracker board as an **Opportunity**.

     (CRITICAL CHATBOT COUNTER-QUESTIONS FOR MISSING PARAMETERS):
     - If any important parameters were NOT mentioned by the user or in the JD (specifically workMode is null/Unknown, applicationUrl is null, deadline is null, or salary is null):
       ALWAYS ask conversational counter-questions to help the user complete their tracking card, just like an attentive personal career chatbot:
       ❓ **A few details weren't specified in this posting:**
       • **Work Mode**: Is this position **On-site**, **Hybrid**, or **Remote**? (ask only if workMode is null/Unknown)
       • **Application Link**: Do you have the careers page link or URL to apply? (ask only if no URL was provided)
       • **Deadline**: Did they mention a deadline to apply? (ask only if deadline is null)
       • **Compensation**: Did they mention any salary or stipend range? (ask only if salary is not disclosed)

       *(Only ask about the fields that are actually missing! Never ask about fields the user or JD already provided.)*
       *(Conclude with: "You can just reply naturally, e.g. 'It's hybrid' or paste the link, and I will update your tracker!")*
  3. REAL SELECTION ROUNDS vs UNSOLICITED CODING QUESTIONS:
     - DO NOT invent generic unsolicited coding problems or random interview questions unless explicitly asked by the user or triggered by /interview Qs.
     - BUT IF the JD explicitly lists actual "Selection Process" or "Interview Rounds" (e.g. Round 1: Aptitude, Round 2: Tech, Round 3: Practical task, Round 4: HR), ALWAYS accurately extract and display those real selection rounds under "🎯 Selection Process"!
  4. CONVERSATIONAL COUNTER-QUESTION REPLIES & DRAFT UPDATING:
     - When the user answers one of your counter-questions (e.g. "It's hybrid", "hybrid", "remote", "onsite", "deadline is 30th Nov", "salary is 6 LPA", "link is https://..."):
       * Identify the active job from "Active Job in Session" or database.
       * Update ONLY that field on the active draft in "data", keeping all previous fields intact!
       * Warmly confirm the update: "✨ **Updated [roleTitle] at [companyName]!** (Added work mode to Hybrid)"
       * If other counter-question fields are still missing, ask for the next one to keep the conversation going!

7. INTERVIEW QUESTIONS COMMAND ("/interview Qs" or EXPLICIT INTERVIEW QUESTIONS REQUEST):
- STRICT REQUIREMENT: Only provide in-depth interview questions when the user explicitly triggers the command "/interview Qs", "/interview questions", or explicitly asks for interview questions for a role/company.
- When "/interview Qs" is triggered:
  * Identify the role and company from "Active Job in Session" or the targeted company in "PERSISTENT BACKEND DATABASE".
  * Generate a focused, high-value set of interview questions tailored specifically to that company and tech stack:
    1. 💻 **Technical & Coding Questions** (3-4 specific technical questions on the required skills and frameworks)
    2. 🏗️ **System Design & Practical Scenarios** (2 real-world scenarios or architecture questions relevant to the role)
    3. 🤝 **Behavioral & Culture Fit (STAR Method)** (2-3 behavioral questions with brief guidance on what interviewers look for)
    4. 💡 **Smart Questions to Ask the Interviewer** (2 sharp reverse questions to ask the hiring team)
  * Set "data": null and "profileUpdate": null.

CRITICAL INSTRUCTION FOR SAVED OPPORTUNITY vs SUBMITTED APPLICATION:
- Users frequently paste job descriptions (JDs), job posts, links, or draft opportunities to save or review without having submitted an application yet (e.g. "save this job", "check out this opening", "track this JD", or simply pasting the JD text/URL).
- DISTINGUISH SAVING A JOB FROM SUBMITTING AN APPLICATION:
  1. IF USER HAS NOT EXPLICITLY APPLIED (merely sharing a JD, asking about a role, saving a draft, or didn't explicitly say they applied):
     * Set "status": "Saved"
     * Set "appliedDate": null
     * Set "appliedTime": null
     * Inform the user in "message" with the simple breakdown above that the opportunity is recorded, and they can mark it as Applied whenever they submit (or type /apply).
  2. IF USER EXPLICITLY STATES THEY APPLIED (e.g. "I applied to...", "Submitted application", "applied today", "applied yesterday", confirmation email):
     * Set "status": "Applied"
     * Calculate and set "appliedDate": "YYYY-MM-DD" relative to today (${today}) or the past date mentioned
     * Set "appliedTime": "HH:MM AM/PM" (or current time "${fullTimeStr}")
  3. IF TRANSITIONING AN EXISTING JOB FROM "Saved" TO "Applied" (e.g. user says "/apply", "I just applied to Cisco", "marked as applied"):
     * Update "status": "Applied"
     * Set "appliedDate": "YYYY-MM-DD" (${today} or specified date)
     * Set "appliedTime": "${fullTimeStr}" (or specified time)

CRITICAL INSTRUCTION FOR APPLIED DATE:
- Users frequently track jobs they applied to in the past (e.g., "I applied for this last week", "applied 3 days ago", "applied yesterday", "applied on 2026-09-28", "applied on Oct 2nd", or dates in email confirmations).
- You MUST calculate and resolve the exact "YYYY-MM-DD" date relative to TODAY (${today}):
  * "yesterday" -> calculate 1 day before ${today}
  * "X days ago" -> calculate X days before ${today}
  * "last week" / "a week ago" -> calculate 7 days before ${today}
  * "2 weeks ago" -> calculate 14 days before ${today}
  * "last month" -> calculate 30 days before ${today}
  * Explicit dates (e.g., "Oct 2", "15 September", "2026-09-25") -> convert to "YYYY-MM-DD".
- ONLY set "appliedDate" to ${today} if the user EXPLICITLY indicates they applied and does NOT specify any past application date or timeframe. Never set appliedDate on a job that is merely saved as an opportunity lead!
- If updating an existing job, and the user specifies an applied date, update "appliedDate" accordingly.

CONVERSATIONAL CONTEXT & NATURAL VARIATIONS (CRITICAL):
- You are a fully conversational AI career companion and MUST maintain conversational continuity using the "CONVERSATION HISTORY" above!
- Users will speak naturally with short phrasing, slang, or follow-ups (e.g. "show all", "list them", "how many", "which ones?", "tell me more", "where did i apply?", "show details", "all of them", "what companies?"):
  * When the previous turn discussed application counts or stats (e.g. "how many applications are there" -> 15 applications), and user follows up with "show all", "list all", "show them", "list them", "show", "tell me", "display them", "all of them", or "which ones":
    UNDERSTAND THIS AS A REQUEST TO LIST OR DISPLAY ALL THEIR STORED APPLICATIONS FROM THE "PERSISTENT BACKEND DATABASE"!
  * NEVER reply with "I didn't detect any job details in that message" to conversational questions or follow-ups!
- GREETINGS & CASUAL HELLOS (CRITICAL):
  * When the user greets you or says "hi", "hello", "hey", "good morning", "sup", etc.:
    - Do NOT provide long lists of features, capabilities, or tutorial bullet points.
    - Respond concisely:
      "👋 **Hello!** I'm **Zuno**, your **JobTrackerAI** assistant.\n\nToday is **${fullDateStr}** and the current time is **${fullTimeStr}**.\nYou have applied to **${(allApplications || []).length} application${(allApplications || []).length === 1 ? '' : 's'}** till today."
    - ALWAYS set "data": null and "profileUpdate": null.
- CASUAL CHAT, AFFIRMATIONS & COMPLIMENTS:
  * When the user gives casual affirmations, compliments, or feedback (e.g. "nice", "nice!", "good", "cool", "looks good", "thanks", "great", "awesome", "perfect", "sweet", "got it", "haha", "you're cool"):
    - Respond warmly, conversationally, and concisely in "message" with contextual awareness of the ongoing chat!
    - For example, if you just presented a list or table of applications and the user says "nice", respond like: "Glad you like the overview! 😊 Feel free to ask about any specific company (e.g. *'Tell me about Stripe'*), filter by interviews, or paste a new job description to track!"
    - ALWAYS set "data": null and "profileUpdate": null for general conversational talk.

OUTPUT FORMAT:
Respond with a JSON object with:
{
  "message": "Your rich, formatted markdown response to the user",
  "data": { ... } or null,
  "profileUpdate": { ... } or null,
  "cardType": "time_date" | "today_count" | "graph" | "search_results" | null,
  "cardData": { ... } or null
}
Special Card rules:
- CRITICAL PRIORITY: If user provides a Job Description (JD), job vacancy, company role details, or email snippet, ALWAYS extract the job details into "data" and set "cardType": null. NEVER set "cardType": "time_date" for job descriptions, even if they mention work hours, employment type (Full-time/Part-time), or application dates!
- ONLY set "cardType": "time_date" when the user is specifically asking for the current clock time, date, or day of the week (e.g., "what time is it?", "today's date", "what day is today"): set "cardType": "time_date", "cardData": { "time": "${fullTimeStr}", "date": "${fullDateStr}", "day": "${dayOfWeek}", "timeZone": "${effectiveTimeZone}", "isoDate": "${today}" }
- If asked how many applications applied today: set "cardType": "today_count", "cardData": { "count": <number applied today>, "date": "${fullDateStr}", "isoDate": "${today}" }
- If asked how many applied last week/month or for a graph/chart: set "cardType": "graph", "cardData": { "range": 7 or 30 }
- If asked to search applications or query /search: set "cardType": "search_results", "cardData": { "query": "<search keyword>", "results": <matching applications from database>, "totalCount": <total applications count> }
STRICT RULE FOR DATA OBJECT STRINGS:
- All string fields inside 'data' (companyName, roleTitle, location, salary, workMode, jobType, skills) MUST BE CLEAN PLAIN TEXT.
- NEVER put Markdown asterisks, bolding, quotes, or markdown tags inside the 'data' JSON values (e.g., write "Analyst L1", NOT "**Analyst L1**"; write "ABC Technologies", NOT "**ABC Technologies**"; write "Bengaluru", NOT "**Bengaluru**").
- You may use Markdown formatting ONLY in the "message" conversational field.

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
                content: existingJob
                  ? `${databaseContext}\n\n${profileContext}\n\n${historyContext}\n\nYou are updating an existing job record in JobTrackerAI.\nCURRENT RECORD:\n${JSON.stringify(existingJob, null, 2)}\n\nUSER'S NEW MESSAGE:\n"${text}"\n\nTASK:\n1. Merge any newly provided details (salary, skills, company, location, status, interview notes).\n2. Retain all existing fields that weren't mentioned in the new message.\n3. If user mentions applying ("applied", "/apply", "applied today"), update status to "Applied" and set appliedDate to "${today}".\n4. Output the complete updated JSON record strictly in the "data" field.`
                  : `${databaseContext}\n\n${profileContext}\n\n${historyContext}\n\nActive Job in Session: None\n\nUser Message: "${text}"`
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
            if (existingJob && parsed.data) {
              const mergedSkills = Array.from(new Set([
                ...(Array.isArray(existingJob.skills) ? existingJob.skills : []),
                ...(Array.isArray(parsed.data.skills) ? parsed.data.skills : [])
              ]));
              const mergedRecord = {
                ...existingJob,
                ...parsed.data,
                id: existingJob.id || parsed.data.id,
                createdAt: existingJob.createdAt || parsed.data.createdAt,
                skills: mergedSkills
              };
              const summary = computeUpdatedSummary(existingJob, mergedRecord);
              mergedRecord.updatedSummary = summary;
              parsed.data = sanitizeBackendData(mergedRecord);
              parsed.data.updatedSummary = summary;
              if (!parsed.message || parsed.message === 'Done' || parsed.message.startsWith('Extracted job:')) {
                parsed.message = `🔄 **Updated draft!**\n\n${summary ? `**${summary}** for **${parsed.data.companyName}** (${parsed.data.roleTitle}).` : `Updated details for **${parsed.data.companyName}**.`}`;
              }
            }
            return res.status(200).json({
              message: parsed.message || 'Done',
              data: parsed.data ? sanitizeBackendData(parsed.data) : null,
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
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-1.5-flash',
      'gemini-1.5-pro'
    ];

    let lastError = null;
    let candidateText = null;
    const modelErrors = {};

    const cleanedText = cleanRawJD(text);

    const structuredResponseSchema = {
      type: "OBJECT",
      properties: {
        message: { type: "STRING" },
        cardType: { type: "STRING", nullable: true },
        cardData: { type: "OBJECT", nullable: true },
        profileUpdate: { type: "OBJECT", nullable: true },
        data: {
          type: "OBJECT",
          nullable: true,
          properties: {
            company_name: { type: "STRING" },
            job_title: { type: "STRING" },
            companyName: { type: "STRING" },
            roleTitle: { type: "STRING" },
            job_location: { type: "STRING", nullable: true },
            location: { type: "STRING", nullable: true },
            work_model: { type: "STRING", enum: ["Remote", "Hybrid", "On-site", "Unknown"] },
            work_mode: { type: "STRING", nullable: true },
            workMode: { type: "STRING", nullable: true },
            experience_required: { type: "STRING", nullable: true },
            employment_type: { type: "STRING", nullable: true },
            jobType: { type: "STRING", nullable: true },
            min_experience_years: { type: "NUMBER", nullable: true },
            max_experience_years: { type: "NUMBER", nullable: true },
            is_fresher_eligible: { type: "BOOLEAN", nullable: true },
            salary_ctc: {
              type: "OBJECT",
              nullable: true,
              properties: {
                minimum: { type: "NUMBER", nullable: true },
                maximum: { type: "NUMBER", nullable: true },
                currency: { type: "STRING", nullable: true },
                period: { type: "STRING", nullable: true }
              }
            },
            salary: {
              type: "OBJECT",
              nullable: true,
              properties: {
                is_disclosed: { type: "BOOLEAN" },
                min_amount: { type: "NUMBER", nullable: true },
                max_amount: { type: "NUMBER", nullable: true },
                currency: { type: "STRING", nullable: true },
                period: { type: "STRING", enum: ["yearly", "monthly", "hourly", "unknown"] }
              },
              required: ["is_disclosed"]
            },
            salary_text: { type: "STRING", nullable: true },
            required_skills: {
              type: "ARRAY",
              items: { type: "STRING" }
            },
            skills: {
              type: "ARRAY",
              items: { type: "STRING" }
            },
            job_responsibilities: {
              type: "ARRAY",
              items: { type: "STRING" }
            },
            responsibilities: {
              type: "ARRAY",
              items: { type: "STRING" }
            },
            educational_qualifications: {
              type: "ARRAY",
              items: { type: "STRING" }
            },
            eligibility: { type: "STRING", nullable: true },
            required_certifications: {
              type: "ARRAY",
              items: { type: "STRING" }
            },
            certifications: {
              type: "ARRAY",
              items: { type: "STRING" }
            },
            additional_requirements: {
              type: "ARRAY",
              items: { type: "STRING" }
            },
            additionalRequirements: {
              type: "ARRAY",
              items: { type: "STRING" }
            },
            application_deadline: { type: "STRING", nullable: true },
            deadline: { type: "STRING", nullable: true },
            selection_process: {
              type: "ARRAY",
              items: { type: "STRING" }
            },
            selectionProcess: {
              type: "ARRAY",
              items: { type: "STRING" }
            },
            notice_period_requirement: { type: "STRING", nullable: true },
            noticePeriod: { type: "STRING", nullable: true },
            recruiter_contact_details: { type: "STRING", nullable: true },
            recruiterName: { type: "STRING", nullable: true },
            recruiterEmail: { type: "STRING", nullable: true },
            recruiterPhone: { type: "STRING", nullable: true },
            job_source_platform: { type: "STRING", nullable: true },
            source: { type: "STRING", nullable: true },
            original_job_posting_url: { type: "STRING", nullable: true },
            source_url: { type: "STRING", nullable: true },
            sourceUrl: { type: "STRING", nullable: true },
            application_portal: { type: "STRING", nullable: true },
            portalName: { type: "STRING", nullable: true },
            application_url: { type: "STRING", nullable: true },
            applicationUrl: { type: "STRING", nullable: true },
            company_career_page_url: { type: "STRING", nullable: true },
            companyCareerUrl: { type: "STRING", nullable: true },
            date_of_application: { type: "STRING", nullable: true },
            appliedDate: { type: "STRING", nullable: true },
            appliedTime: { type: "STRING", nullable: true },
            application_status: { type: "STRING", nullable: true },
            status: { type: "STRING", nullable: true },
            expected_salary: { type: "STRING", nullable: true },
            expectedSalary: { type: "STRING", nullable: true },
            personal_notes: { type: "STRING", nullable: true },
            callNotes: { type: "STRING", nullable: true },
            notes: { type: "STRING", nullable: true },
            missing_fields: {
              type: "ARRAY",
              items: { type: "STRING" }
            },
            verification_status: { type: "STRING", nullable: true },
            clarification_questions: {
              type: "ARRAY",
              items: { type: "STRING" }
            },
            quick_options: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  label: { type: "STRING" },
                  value: { type: "STRING" }
                }
              }
            },
            interviewQuestions: {
              type: "ARRAY",
              items: { type: "STRING" }
            },
            updatedSummary: { type: "STRING", nullable: true }
          }
        }
      },
      required: ["message"]
    };

    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: existingJob
                ? `${systemPrompt}\n\n${databaseContext}\n\n${profileContext}\n\n${historyContext}\n\nYou are updating an existing job record in JobTrackerAI.\nCURRENT RECORD:\n${JSON.stringify(existingJob, null, 2)}\n\nUSER'S NEW MESSAGE:\n"${cleanedText}"\n\nTASK:\n1. Merge any newly provided details (salary, skills, company, location, status, interview notes).\n2. Retain all existing fields that weren't mentioned in the new message.\n3. If the user mentions applying ("applied", "/apply", "applied today"), update status to "Applied" and set appliedDate to "${today}".\n4. Merge new skills with existing skills (do not discard existing skills unless contradicted).\n5. Output the complete updated JSON record strictly in the "data" field.`
                : `${systemPrompt}\n\n${databaseContext}\n\n${profileContext}\n\n${historyContext}\n\nCurrent Active Job in Session: None\n\nUser Message:\n"${cleanedText}"`
            }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: structuredResponseSchema,
        temperature: 0.2
      }
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
    let cleanCandidate = candidateText.trim();
    if (cleanCandidate.startsWith('```')) {
      cleanCandidate = cleanCandidate.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    }
    try {
      parsed = JSON.parse(cleanCandidate);
    } catch {
      const jsonMatch = cleanCandidate.match(/\{[\s\S]*\}/);
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

    // Filter out dummy placeholder data objects
    if (parsed && parsed.data) {
      const co = (parsed.data.companyName || '').trim().toLowerCase();
      const r = (parsed.data.roleTitle || '').trim().toLowerCase();
      const isDummyCo = ['target company', 'company', 'unknown', 'n/a', 'company name', ''].includes(co);
      const isDummyRole = ['professional role', 'job title', 'undisclosed', 'role', 'n/a', ''].includes(r);
      if (isDummyCo && isDummyRole) {
        parsed.data = null;
      }
    }

    const isQuestionOrProfile = /^(what|when|where|which|how|who|did|have|list|show|any)\b/i.test(text.trim());
    const isRejectedSignal = /\b(?:not\s+selected(?:\s+by\s+employer)?|didn'?t\s+get\s+selected|did\s+not\s+get\s+selected|not\s+shortlisted|didn'?t\s+get\s+the\s+job|not\s+hired|turned\s+down|not\s+moving\s+forward|unsuccessful|declined|reject|rejected|rejection|got\s+rejected|was\s+rejected|application\s+rejected)\b/i.test(text);
    const detectedDate = !isQuestionOrProfile ? parseAppliedDate(text, null) : null;
    const detectedSource = !isQuestionOrProfile ? parseJobSource(text) : null;

    if (existingJob) {
      if (parsed.data) {
        const mergedSkills = Array.from(new Set([
          ...(Array.isArray(existingJob.skills) ? existingJob.skills : []),
          ...(Array.isArray(parsed.data.skills) ? parsed.data.skills : [])
        ]));
        const isSalaryExplicitUpdate = Boolean(parsed.data.salary && parsed.data.salary !== 'Not disclosed' && parsed.data.salary !== 'Not specified');
        const isSalaryClarifiedAbsent = parsed.data.salary_status === 'user_confirmed_absent' || parsed.data.salary_status === 'user_does_not_know';

        const mergedSalary = isSalaryExplicitUpdate
          ? parsed.data.salary
          : (isSalaryClarifiedAbsent ? (parsed.data.salary || null) : (existingJob.salary || parsed.data.salary || 'Not disclosed'));

        const mergedSalaryMin = (parsed.data.salary_min !== undefined && parsed.data.salary_min !== null)
          ? parsed.data.salary_min
          : (isSalaryClarifiedAbsent ? null : (existingJob.salary_min ?? null));

        const mergedSalaryMax = (parsed.data.salary_max !== undefined && parsed.data.salary_max !== null)
          ? parsed.data.salary_max
          : (isSalaryClarifiedAbsent ? null : (existingJob.salary_max ?? null));

        const mergedRecord = {
          ...existingJob,
          ...parsed.data,
          id: existingJob.id || parsed.data.id,
          createdAt: existingJob.createdAt || parsed.data.createdAt,
          skills: mergedSkills,
          salary: mergedSalary,
          salary_min: mergedSalaryMin,
          salary_max: mergedSalaryMax,
          salary_status: parsed.data.salary_status || existingJob.salary_status || 'not_specified_in_jd',
          work_mode_status: parsed.data.work_mode_status || existingJob.work_mode_status || 'not_specified_in_jd',
          deadline_status: parsed.data.deadline_status || existingJob.deadline_status || 'not_specified_in_jd',
          application_url_status: parsed.data.application_url_status || existingJob.application_url_status || 'not_specified_in_jd',
          resolved_clarifications: Array.from(new Set([
            ...(existingJob.resolved_clarifications || []),
            ...(parsed.data.resolved_clarifications || [])
          ])),
          experience_required: parsed.data.experience_required || existingJob.experience_required || null,
          employment_type: parsed.data.employment_type || existingJob.employment_type || 'Full-time'
        };
        if (detectedDate) {
          mergedRecord.appliedDate = detectedDate;
          if (mergedRecord.status === 'Saved') mergedRecord.status = 'Applied';
        }
        if (detectedSource) mergedRecord.source = detectedSource;
        if (isRejectedSignal) mergedRecord.status = 'Rejected';

        const summary = computeUpdatedSummary(existingJob, mergedRecord);
        mergedRecord.updatedSummary = summary;
        parsed.data = sanitizeBackendData(mergedRecord);
        parsed.data.updatedSummary = summary;
        if (!parsed.message || parsed.message === 'Done' || parsed.message.startsWith('Extracted job:')) {
          parsed.message = `🔄 **Updated draft!**\n\n${summary ? `**${summary}** for **${parsed.data.companyName}** (${parsed.data.roleTitle}).` : `Updated details for **${parsed.data.companyName}**.`}`;
        }
      } else if (!isQuestionOrProfile && (detectedDate || detectedSource || isRejectedSignal)) {
        const mergedRecord = { ...existingJob };
        if (detectedDate) {
          mergedRecord.appliedDate = detectedDate;
          mergedRecord.status = 'Applied';
        }
        if (detectedSource) mergedRecord.source = detectedSource;
        if (isRejectedSignal) mergedRecord.status = 'Rejected';

        const summary = computeUpdatedSummary(existingJob, mergedRecord);
        mergedRecord.updatedSummary = summary;
        parsed.data = sanitizeBackendData(mergedRecord);
        parsed.data.updatedSummary = summary;
        parsed.message = parsed.message || (isRejectedSignal
          ? `Updated **${existingJob.companyName}** (${existingJob.roleTitle}) status to **Rejected** (Not selected by employer).\n\nJob search rejections are completely normal and part of the journey—don't let it discourage you! You're one step closer to the right opportunity.`
          : `Updated **${existingJob.companyName}** (${existingJob.roleTitle}): ${summary}.`);
      }
    } else if (parsed.data) {
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
      data: parsed.data ? sanitizeBackendData(parsed.data) : null,
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

export function computeUpdatedSummary(previousJob, updatedJob) {
  if (!previousJob || !updatedJob) return null;
  const changes = [];

  // Salary
  const oldSalary = (previousJob.salary || previousJob.salary_text || '').trim();
  const newSalary = (updatedJob.salary || updatedJob.salary_text || '').trim();
  if (newSalary && newSalary !== oldSalary && !/^(?:not\s+disclosed|not\s+specified|n\/?a)$/i.test(newSalary)) {
    changes.push('salary');
  }

  // Skills
  const oldSkills = new Set((previousJob.skills || []).map(s => s.toLowerCase().trim()));
  const newSkills = (updatedJob.skills || []).filter(s => !oldSkills.has(s.toLowerCase().trim()));
  if (newSkills.length > 0) {
    changes.push('skills');
  }

  // Status
  const oldStatus = (previousJob.status || '').toLowerCase().trim();
  const newStatus = (updatedJob.status || '').toLowerCase().trim();
  if (newStatus && newStatus !== oldStatus) {
    if (newStatus === 'applied') changes.push('status to Applied');
    else if (newStatus === 'rejected') changes.push('status to Rejected');
    else changes.push(`status to ${updatedJob.status}`);
  }

  // Applied Date
  if (updatedJob.appliedDate && updatedJob.appliedDate !== previousJob.appliedDate) {
    if (!changes.includes('status to Applied')) {
      changes.push('applied date');
    }
  }

  // Location
  const oldLoc = (previousJob.location || '').trim();
  const newLoc = (updatedJob.location || '').trim();
  if (newLoc && newLoc !== oldLoc && !/^(?:not\s+specified|n\/?a)$/i.test(newLoc)) {
    changes.push('location');
  }

  // Work Mode
  const oldMode = (previousJob.workMode || previousJob.work_model || '').trim();
  const newMode = (updatedJob.workMode || updatedJob.work_model || '').trim();
  if (newMode && newMode !== oldMode && newMode !== 'Unknown') {
    changes.push('work mode');
  }

  // Recruiter / Call notes
  if (
    (updatedJob.callNotes && updatedJob.callNotes !== previousJob.callNotes) ||
    (updatedJob.recruiterName && updatedJob.recruiterName !== previousJob.recruiterName) ||
    (updatedJob.interviewQuestions && updatedJob.interviewQuestions.length > (previousJob.interviewQuestions?.length || 0))
  ) {
    changes.push('interview notes');
  }

  // Links
  if (
    (updatedJob.applicationUrl && updatedJob.applicationUrl !== previousJob.applicationUrl) ||
    (updatedJob.sourceUrl && updatedJob.sourceUrl !== previousJob.sourceUrl)
  ) {
    changes.push('links');
  }

  // Role
  const oldRole = (previousJob.roleTitle || previousJob.job_title || '').trim();
  const newRole = (updatedJob.roleTitle || updatedJob.job_title || '').trim();
  if (newRole && newRole !== oldRole && !['job title', 'saved link', 'opportunity'].includes(oldRole.toLowerCase())) {
    changes.push('role');
  }

  // Company
  const oldCo = (previousJob.companyName || previousJob.company_name || '').trim();
  const newCo = (updatedJob.companyName || updatedJob.company_name || '').trim();
  if (newCo && newCo !== oldCo && !['pending details', 'target company'].includes(oldCo.toLowerCase())) {
    changes.push('company');
  }

  if (changes.length === 0) return 'Updated draft details';
  if (changes.length === 1) return `Added ${changes[0]}`;
  if (changes.length === 2) return `Added ${changes[0]} & ${changes[1]}`;
  return `Added ${changes.slice(0, -1).join(', ')} & ${changes[changes.length - 1]}`;
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

function stripTrackingParams(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  try {
    const cleanRaw = rawUrl.trim().replace(/[.,;!?)]+$/, '');
    const url = new URL(cleanRaw);
    const paramsToStrip = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'trackingId', 'refId', 'midToken', 'trk', 'fbclid', 'gclid', 'msclkid',
      'origin', 'originalSubdomain'
    ];
    paramsToStrip.forEach(p => url.searchParams.delete(p));
    return url.toString();
  } catch {
    return rawUrl.trim().replace(/[.,;!?)]+$/, '');
  }
}

function parseSlugMetadata(cleanUrl) {
  if (!cleanUrl || typeof cleanUrl !== 'string') {
    return { source: 'Web Link', title: 'Saved Opportunity', company: null };
  }
  try {
    const urlObj = new URL(cleanUrl);
    const host = urlObj.hostname.toLowerCase();
    const path = urlObj.pathname;

    // LinkedIn Jobs
    if (host.includes("linkedin.com")) {
      const jobId = path.match(/\/jobs\/view\/(\d+)/)?.[1] || "";
      const slugRole = path.match(/\/jobs\/view\/([a-z0-9-]+?)(?:-(\d+))?$/i);
      let derivedTitle = jobId ? `LinkedIn Opportunity (#${jobId})` : "LinkedIn Opportunity";
      let derivedCo = null;
      if (slugRole && slugRole[1]) {
        const parts = slugRole[1].split('-');
        const atIdx = parts.indexOf('at');
        if (atIdx > 0 && atIdx < parts.length - 1) {
          derivedTitle = parts.slice(0, atIdx).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
          derivedCo = parts.slice(atIdx + 1).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        }
      }
      return {
        source: "LinkedIn",
        title: derivedTitle,
        company: derivedCo
      };
    }

    // Naukri Jobs (e.g., /job-listings-data-analyst-abc-technologies-bangalore-12345)
    if (host.includes("naukri.com")) {
      const slugMatch = path.match(/\/job-listings-([a-z0-9-]+)/i);
      if (slugMatch) {
        const words = slugMatch[1].split("-").filter(w => !/^\d+$/.test(w));
        return {
          source: "Naukri",
          title: words.slice(0, 3).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
          company: null
        };
      }
      return { source: "Naukri", title: "Naukri Lead", company: null };
    }

    // Greenhouse ATS (boards.greenhouse.io/{company}/jobs/{id})
    if (host.includes("greenhouse.io")) {
      const parts = path.split('/').filter(Boolean);
      const company = parts[0] && parts[0] !== 'embed' ? parts[0] : (parts[1] || null);
      return {
        source: "Greenhouse",
        title: "Greenhouse Opportunity",
        company: company ? (company.charAt(0).toUpperCase() + company.slice(1)) : null
      };
    }

    // Lever ATS (jobs.lever.co/{company}/{id})
    if (host.includes("lever.co")) {
      const parts = path.split('/').filter(Boolean);
      const company = parts[0] || null;
      return {
        source: "Lever",
        title: "Lever Opportunity",
        company: company ? (company.charAt(0).toUpperCase() + company.slice(1)) : null
      };
    }

    // Ashby ATS (jobs.ashbyhq.com/{company}/{id})
    if (host.includes("ashbyhq.com")) {
      const parts = path.split('/').filter(Boolean);
      const company = parts[0] || null;
      return {
        source: "Ashby",
        title: "Ashby Opportunity",
        company: company ? (company.charAt(0).toUpperCase() + company.slice(1)) : null
      };
    }

    // Indeed
    if (host.includes("indeed.com")) {
      return {
        source: "Indeed",
        title: "Indeed Opportunity",
        company: null
      };
    }

    // Generic link
    return {
      source: host.replace(/^www\./i, ""),
      title: "Saved Opportunity",
      company: null
    };
  } catch {
    return {
      source: "Web Link",
      title: "Saved Opportunity",
      company: null
    };
  }
}

function cleanRawJD(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    // Remove repeated whitespace and blank lines
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    // Remove common copy-paste UI artifacts & job board buttons
    .replace(/\b(?:Show more|Show less|Easy Apply|Report this job|Save job|Apply on company site|Apply now|Apply externally|Promoted by employer|Job alert created|Be an early applicant|Directly through employer|See more jobs like this)\b/gi, '')
    // Strip URLs that are tracking beacons/images rather than links
    .replace(/https?:\/\/[^\s]+\.(?:png|jpg|jpeg|gif|svg|webp|ico)(?:\?[^\s]*)?/gi, '')
    // Normalize unicode spaces and quotes
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim();
}

const CANONICAL_SKILLS = {
  "ms excel": "Excel",
  "microsoft excel": "Excel",
  "advanced excel": "Excel",
  "excel": "Excel",
  "powerbi": "Power BI",
  "power bi": "Power BI",
  "power bi desktop": "Power BI",
  "postgres": "PostgreSQL",
  "postgresql": "PostgreSQL",
  "py": "Python",
  "python": "Python",
  "python3": "Python",
  "manual qa": "Manual Testing",
  "qa testing": "Manual Testing",
  "software testing": "Manual Testing",
  "automation testing": "Automation Testing",
  "react": "React",
  "reactjs": "React",
  "react.js": "React",
  "node": "Node.js",
  "nodejs": "Node.js",
  "node.js": "Node.js",
  "mongo": "MongoDB",
  "mongodb": "MongoDB",
  "k8s": "Kubernetes",
  "kubernetes": "Kubernetes",
  "docker": "Docker",
  "aws": "AWS",
  "amazon web services": "AWS",
  "gcp": "Google Cloud (GCP)",
  "google cloud": "Google Cloud (GCP)",
  "azure": "Azure",
  "golang": "Go",
  "go": "Go",
  "cpp": "C++",
  "c++": "C++",
  "c#": "C#",
  "csharp": "C#",
  "sql": "SQL",
  "git": "Git",
  "github": "GitHub",
  "ts": "TypeScript",
  "typescript": "TypeScript",
  "js": "JavaScript",
  "javascript": "JavaScript",
  "spring": "Spring Boot",
  "springboot": "Spring Boot",
  "spring boot": "Spring Boot"
};

function cleanCompanyAndLocation(company, location) {
  let cleanComp = (company || 'Unknown Company').trim();
  let cleanLoc = (location || '').trim();

  // Strip prefix "Location:" from location itself
  cleanLoc = cleanLoc
    .replace(/^Location:\s*/i, '')
    .replace(/[·|•-]\s*$/, '')
    .trim();

  // Strip trailing "Location: ...", separators, or bullets from company
  cleanComp = cleanComp
    .replace(/[·|•-]\s*Location.*$/i, '')
    .replace(/^Company:\s*/i, '')
    .replace(/[·|•-]\s*$/, '')
    .trim();

  // Remove location from company name if it leaked inside
  if (cleanLoc && cleanComp.toLowerCase().includes(cleanLoc.toLowerCase())) {
    cleanComp = cleanComp.replace(new RegExp(`[·|•,-]?\\s*${cleanLoc.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}`, 'gi'), '').trim();
    cleanComp = cleanComp.replace(/[·|•,-]\s*$/, '').trim();
  }

  if (!cleanComp) cleanComp = 'Unknown Company';
  return { cleanComp, cleanLoc };
}

const EXCLUDE_FORMULAS = new Set([
  'if', 'sumifs', 'sumif', 'vlookup', 'xlookup', 'hlookup', 'index match', 'index-match',
  'pivottables', 'pivot tables', 'pivot table', 'select', 'where', 'joins', 'join',
  'group by', 'order by', 'power query', 'dax', 'countif', 'countifs', 'average',
  'formula', 'formulas'
]);

function normalizeSkillList(skillsArray) {
  if (!Array.isArray(skillsArray)) return [];
  const normalized = new Set();

  skillsArray.forEach(raw => {
    if (!raw || typeof raw !== 'string') return;
    let clean = raw
      .replace(/[*_#`~]+/g, '')
      .replace(/^(?:basic\s+knowledge\s+of|good\s+knowledge\s+of|working\s+knowledge\s+of|knowledge\s+of|experience\s+with|experience\s+in|hands-on\s+experience\s+with|proficiency\s+in|proficient\s+in|familiarity\s+with|understanding\s+of|strong\s+understanding\s+of|skills?\s*(?:in|with)?)\s+/i, '')
      .trim();

    const lower = clean.toLowerCase();

    // Skip formula and syntax fragments
    if (EXCLUDE_FORMULAS.has(lower)) return;
    if (/^(?:if|sumifs|vlookup|xlookup|select|where|joins?|dax|power\s*query)$/i.test(lower)) return;

    // Deduplicate & Strip Prefixes: Clean items like "Microsoft Excel: VLOOKUP" down to just "Excel"
    if (/excel/i.test(clean)) clean = 'Excel';
    else if (/power\s*bi/i.test(clean)) clean = 'Power BI';
    else if (/^sql/i.test(clean) || /\bsql\b/i.test(clean)) clean = 'SQL';
    else if (/python/i.test(clean)) clean = 'Python';
    else if (/jira/i.test(clean)) clean = 'Jira';
    else if (/manual\s*testing/i.test(clean) || /\bqa\s*testing\b/i.test(clean)) clean = 'Manual Testing';
    else if (/postgres/i.test(clean)) clean = 'PostgreSQL';
    else if (/docker/i.test(clean)) clean = 'Docker';
    else if (/figma/i.test(clean)) clean = 'Figma';
    else if (/tableau/i.test(clean)) clean = 'Tableau';
    else {
      clean = CANONICAL_SKILLS[lower] || clean;
    }

    if (clean && clean.length > 1 && !/^(?:etc|and|or|plus)$/i.test(clean)) {
      normalized.add(clean);
    }
  });

  return Array.from(normalized);
}

function normalizeSkills(skillsArray) {
  return normalizeSkillList(skillsArray);
}

function sanitizeBackendData(data) {
  if (!data || typeof data !== 'object') return data;
  const strip = (s) => {
    if (!s || typeof s !== 'string') return s;
    return s
      .replace(/[*_#`~]+/g, '')
      .replace(/^[\s•\-\u2022\u25E6\u25AA\u25BA\u2192:]+/, '')
      .replace(/[\s:]+$/, '')
      .trim();
  };

  const cleaned = { ...data };

  // Map snake_case / schema properties to camelCase
  if (cleaned.company_name && !cleaned.companyName) cleaned.companyName = cleaned.company_name;
  if (cleaned.companyName && !cleaned.company_name) cleaned.company_name = cleaned.companyName;
  if (cleaned.job_title && !cleaned.roleTitle) cleaned.roleTitle = cleaned.job_title;
  if (cleaned.roleTitle && !cleaned.job_title) cleaned.job_title = cleaned.roleTitle;
  if (cleaned.job_location && !cleaned.location) cleaned.location = cleaned.job_location;
  if (cleaned.location && !cleaned.job_location) cleaned.job_location = cleaned.location;

  // Work mode handling: strictly null if unspecified or unknown
  if (cleaned.work_mode && !cleaned.workMode) cleaned.workMode = cleaned.work_mode;
  if (cleaned.work_model && !cleaned.workMode) cleaned.workMode = cleaned.work_model;
  if (cleaned.workMode && /^(?:unknown|not\s+specified|n\/?a|-)$/i.test(cleaned.workMode)) {
    cleaned.workMode = null;
  }
  cleaned.work_mode = cleaned.workMode || null;
  cleaned.work_model = cleaned.workMode || 'Unknown';

  if (cleaned.experience_required && !cleaned.experienceRequired) cleaned.experienceRequired = cleaned.experience_required;
  if (cleaned.experienceRequired && !cleaned.experience_required) cleaned.experience_required = cleaned.experienceRequired;
  if (cleaned.employment_type && !cleaned.jobType) cleaned.jobType = cleaned.employment_type;
  if (cleaned.jobType && !cleaned.employment_type) cleaned.employment_type = cleaned.jobType;

  if (cleaned.min_experience_years !== undefined && cleaned.min_years === undefined) {
    cleaned.min_years = cleaned.min_experience_years;
    cleaned.minYears = cleaned.min_experience_years;
  }

  // Strict entity separation (prevent company / location bleed)
  const { cleanComp, cleanLoc } = cleanCompanyAndLocation(cleaned.company_name || cleaned.companyName, cleaned.location);
  cleaned.companyName = strip(cleanComp);
  cleaned.company_name = strip(cleanComp);
  cleaned.location = strip(cleanLoc);
  cleaned.job_location = strip(cleanLoc);

  if (cleaned.roleTitle) cleaned.roleTitle = strip(cleaned.roleTitle);
  if (cleaned.jobType) cleaned.jobType = strip(cleaned.jobType);
  if (cleaned.source) cleaned.source = strip(cleaned.source);
  cleaned.job_source_platform = cleaned.source || null;
  if (cleaned.portalName) cleaned.portalName = strip(cleaned.portalName);
  cleaned.application_portal = cleaned.portalName || null;
  if (cleaned.status) cleaned.status = strip(cleaned.status);
  cleaned.application_status = cleaned.status || 'Saved';
  if (cleaned.recruiterName) cleaned.recruiterName = strip(cleaned.recruiterName);
  if (cleaned.deadline) cleaned.application_deadline = cleaned.deadline;
  if (cleaned.appliedDate) cleaned.date_of_application = cleaned.appliedDate;
  if (cleaned.expectedSalary) cleaned.expected_salary = cleaned.expectedSalary;
  if (cleaned.noticePeriod) cleaned.notice_period_requirement = cleaned.noticePeriod;
  if (cleaned.companyCareerUrl) cleaned.company_career_page_url = cleaned.companyCareerUrl;

  // Map URLs both ways
  const finalSourceUrl = cleaned.source_url || cleaned.sourceUrl || cleaned.original_job_posting_url || null;
  const finalAppUrl = cleaned.application_url || cleaned.applicationUrl || null;
  cleaned.source_url = finalSourceUrl;
  cleaned.sourceUrl = finalSourceUrl;
  cleaned.original_job_posting_url = finalSourceUrl;
  cleaned.application_url = finalAppUrl;
  cleaned.applicationUrl = finalAppUrl;

  // Structured salary handling
  if (cleaned.salary_ctc && typeof cleaned.salary_ctc === 'object' && !cleaned.salary) {
    const s = cleaned.salary_ctc;
    if (s.minimum && s.maximum) {
      const minLpa = (s.minimum / 100000).toFixed(1).replace(/\.0$/, '');
      const maxLpa = (s.maximum / 100000).toFixed(1).replace(/\.0$/, '');
      cleaned.salary = (minLpa === maxLpa)
        ? `₹${s.minimum.toLocaleString('en-IN')} / year (${minLpa} LPA)`
        : `₹${s.minimum.toLocaleString('en-IN')} - ₹${s.maximum.toLocaleString('en-IN')} / year (${minLpa}-${maxLpa} LPA)`;
      cleaned.salary_numeric = s.minimum;
      cleaned.currency = s.currency || 'INR';
    }
  } else if (cleaned.salary && typeof cleaned.salary === 'object') {
    const sObj = cleaned.salary;
    if (sObj.is_disclosed) {
      cleaned.salary_numeric = sObj.min_amount || null;
      cleaned.currency = sObj.currency || 'INR';
      if (sObj.min_amount) {
        if (sObj.currency === 'INR') {
          const minLpa = (sObj.min_amount / 100000).toFixed(1).replace(/\.0$/, '');
          const maxLpa = sObj.max_amount ? (sObj.max_amount / 100000).toFixed(1).replace(/\.0$/, '') : minLpa;
          cleaned.salary = (minLpa === maxLpa)
            ? `₹${sObj.min_amount.toLocaleString('en-IN')} / year (${minLpa} LPA)`
            : `₹${sObj.min_amount.toLocaleString('en-IN')} - ₹${(sObj.max_amount || sObj.min_amount).toLocaleString('en-IN')} / year (${minLpa}-${maxLpa} LPA)`;
        } else {
          cleaned.salary = `${sObj.currency || '$'}${sObj.min_amount.toLocaleString()} / ${sObj.period || 'year'}`;
        }
      } else {
        cleaned.salary = cleaned.salary_text || 'Disclosed';
      }
      cleaned.salary_ctc = {
        minimum: sObj.min_amount || null,
        maximum: sObj.max_amount || sObj.min_amount || null,
        currency: sObj.currency || 'INR',
        period: sObj.period || 'year'
      };
    } else {
      cleaned.salary = null;
      cleaned.salary_numeric = null;
      cleaned.salary_ctc = null;
    }
  } else if (cleaned.salary && typeof cleaned.salary === 'string') {
    cleaned.salary = strip(cleaned.salary);
    const lpaMatch = cleaned.salary.match(/\b(\d+(?:\.\d+)?)\s*(?:-|to)?\s*(\d+(?:\.\d+)?)?\s*LPA\b/i);
    if (lpaMatch) {
      const minLpa = parseFloat(lpaMatch[1]);
      const maxLpa = lpaMatch[2] ? parseFloat(lpaMatch[2]) : minLpa;
      const minAnnual = Math.round(minLpa * 100000);
      const maxAnnual = Math.round(maxLpa * 100000);
      cleaned.salary_numeric = minAnnual;
      cleaned.currency = 'INR';
      cleaned.salary_ctc = {
        minimum: minAnnual,
        maximum: maxAnnual,
        currency: 'INR',
        period: 'year'
      };
      if (minLpa === maxLpa) {
        cleaned.salary = `₹${minAnnual.toLocaleString('en-IN')} / year (${minLpa} LPA)`;
      } else {
        cleaned.salary = `₹${minAnnual.toLocaleString('en-IN')} - ₹${maxAnnual.toLocaleString('en-IN')} / year (${minLpa}-${maxLpa} LPA)`;
      }
    }
  } else if (!cleaned.salary) {
    cleaned.salary = null;
    cleaned.salary_numeric = null;
    cleaned.salary_ctc = null;
  }

  // Normalize skills
  const skillsToNormalize = cleaned.skills || cleaned.required_skills || [];
  if (Array.isArray(skillsToNormalize)) {
    cleaned.skills = normalizeSkills(skillsToNormalize);
    cleaned.required_skills = cleaned.skills;
  }

  // Responsibilities & process
  if (Array.isArray(cleaned.responsibilities)) cleaned.job_responsibilities = cleaned.responsibilities;
  if (Array.isArray(cleaned.job_responsibilities)) cleaned.responsibilities = cleaned.job_responsibilities;
  if (Array.isArray(cleaned.selectionProcess)) cleaned.selection_process = cleaned.selectionProcess;
  if (Array.isArray(cleaned.selection_process)) cleaned.selectionProcess = cleaned.selection_process;

  // Experience & Fresher handling
  if (cleaned.is_fresher_eligible !== undefined) {
    cleaned.isFresherEligible = Boolean(cleaned.is_fresher_eligible);
  }
  if (cleaned.min_years !== undefined) {
    cleaned.minYears = cleaned.min_years;
  }

  // Preserve Responsibilities, Selection Process & Eligibility in notes
  if (Array.isArray(cleaned.responsibilities) && cleaned.responsibilities.length > 0) {
    const respText = cleaned.responsibilities.map(r => `• ${strip(r)}`).join('\n');
    if (!cleaned.notes || !cleaned.notes.includes('[Key Responsibilities]')) {
      cleaned.notes = (cleaned.notes ? `${cleaned.notes}\n\n` : '') + `[Key Responsibilities]:\n${respText}`;
    }
  }
  if (Array.isArray(cleaned.selectionProcess) && cleaned.selectionProcess.length > 0) {
    const processText = cleaned.selectionProcess.map((p, idx) => `${idx + 1}. ${strip(p)}`).join('\n');
    if (!cleaned.notes || !cleaned.notes.includes('[Selection Process]')) {
      cleaned.notes = (cleaned.notes ? `${cleaned.notes}\n\n` : '') + `[Selection Process]:\n${processText}`;
    }
  }
  if (cleaned.eligibility) {
    const eligText = strip(cleaned.eligibility);
    if (!cleaned.notes || !cleaned.notes.includes('[Eligibility]')) {
      cleaned.notes = (cleaned.notes ? `${cleaned.notes}\n\n` : '') + `[Eligibility]: ${eligText}`;
    }
  }

  // Missing fields detection according to priority
  const missing = [];
  if (!cleaned.company_name) missing.push('company_name');
  if (!cleaned.job_title) missing.push('job_title');
  if (!cleaned.job_location || cleaned.job_location === 'Not specified') missing.push('job_location');
  if (!cleaned.work_mode) missing.push('work_mode');
  if (!cleaned.original_job_posting_url) missing.push('original_job_posting_url');
  if (!cleaned.application_url) missing.push('application_url');
  if (!cleaned.application_portal) missing.push('application_portal');
  if (!cleaned.job_source_platform || /^(?:portal|direct\s+portal)$/i.test(cleaned.job_source_platform)) missing.push('job_source_platform');
  if (!cleaned.company_career_page_url) missing.push('company_career_page_url');
  if (!cleaned.salary_ctc && (!cleaned.salary || /^(?:not\s+disclosed|undisclosed)$/i.test(cleaned.salary))) missing.push('salary_ctc');
  if (!cleaned.application_deadline) missing.push('application_deadline');
  if (!cleaned.notice_period_requirement) missing.push('notice_period_requirement');
  if (!cleaned.recruiter_contact_details && !cleaned.recruiterName && !cleaned.recruiterEmail && !cleaned.recruiterPhone) missing.push('recruiter_contact_details');
  cleaned.missing_fields = Array.isArray(cleaned.missing_fields) && cleaned.missing_fields.length > 0 ? cleaned.missing_fields : missing;

  // Verification status (detect sample data)
  if (!cleaned.verification_status) {
    const textToCheck = `${cleaned.companyName || ''} ${cleaned.roleTitle || ''} ${cleaned.notes || ''}`;
    const isSample = /\b(?:sample\s+jd|test\s+jd|dummy\s+jd|sample\s+job|example\s+company|abc\s+technologies)\b/i.test(textToCheck);
    cleaned.verification_status = isSample ? 'Sample Data' : 'Job Posting';
  }

  const resolved = Array.isArray(cleaned.resolved_clarifications) ? cleaned.resolved_clarifications : [];
  cleaned.resolved_clarifications = resolved;

  // Generate clarification questions & quick options if work_mode is missing and unresolved
  if (!cleaned.work_mode && !resolved.includes('work_mode') && (!cleaned.clarification_questions || cleaned.clarification_questions.length === 0)) {
    cleaned.clarification_questions = [
      "The job description doesn't specify the work mode. Do you know whether this role is On-site, Hybrid, or Remote? You can also skip this question."
    ];
  }
  if (!cleaned.work_mode && !resolved.includes('work_mode') && (!cleaned.quick_options || cleaned.quick_options.length === 0)) {
    cleaned.quick_options = [
      { label: '🏠 Remote', value: "It's Remote" },
      { label: '🔄 Hybrid', value: "It's Hybrid" },
      { label: '🏢 On-site', value: "It's On-site" },
      { label: '⏭️ Skip', value: "Work mode not specified" }
    ];
  }

  return cleaned;
}
