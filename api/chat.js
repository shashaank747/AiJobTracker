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
    "source": "Discovery platform where user saw the post (e.g. Indeed, LinkedIn, Glassdoor, Naukri, Wellfound)",
    "portalName": "Portal or platform where user filled/applied (e.g. Company Portal, Greenhouse, Workday, Lever, Ashby)",
    "applicationUrl": "Direct portal or ATS URL where application was filled or submitted",
    "sourceUrl": "Listing URL on the discovery platform where job was originally seen",
    "status": "Saved" | "Applied" | "Interviewing" | "Offer" | "Rejected",
    "isBookmarked": false,
    "appliedDate": "YYYY-MM-DD" or null,
    "appliedTime": "HH:MM AM/PM" or null,
    "skills": ["Skill1", "Skill2", ...],
    "recruiterName": "Recruiter or caller name if mentioned (e.g. Priya)",
    "recruiterEmail": "Recruiter email if mentioned",
    "recruiterPhone": "Recruiter phone number if mentioned",
    "interviewQuestions": ["Questions or topics asked in the call"],
    "callNotes": "Summary of discussion, HR details, notice period, and next interview round",
    "notes": "Full notes (including formatted call log with questions and dates)"
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

6. CRITICAL RULE FOR JOB DESCRIPTION (JD) EXTRACTION & PRESENTATION (STRICTLY NO UNSOLICITED INTERVIEW QUESTIONS):
- When the user pastes a Job Description (JD), job opening, careers post, or vacancy details to track or save:
  1. STRICTLY FORBIDDEN: DO NOT GENERATE INTERVIEW QUESTIONS, CODING QUESTIONS, INTERVIEW PROCESS ROUNDS, OR INTERVIEW PREPARATION IN THIS TURN!
     The user did NOT ask for interview questions. Generating unsolicited interview questions when pasting a JD is strictly prohibited.
  2. In "message", present the job in a SIMPLE, CLEAN, ELEGANT BREAKDOWN that is immediately understandable at a glance:
     * A friendly 1-line confirmation: "📋 Here is a simple breakdown of the job details from your JD:"
     * Clean bullet points:
       • 🏢 **Role & Company:** [roleTitle] at **[companyName]**
       • 📍 **Location & Work Mode:** [location] ([workMode])
       • 💰 **Compensation:** [salary]
       • 🛠️ **Key Skills & Tech:** [concise list of 4-6 primary skills required]
     * A short, helpful closing action note:
       "✅ Saved to your tracker board as an **Opportunity**.\n\n💡 *Need interview prep?* Type **/interview Qs** anytime to generate targeted technical and behavioral interview questions for this role, or **/apply** when you submit your application!"
  3. Set "interviewQuestions": [] in "data" unless the user explicitly logs a real recruiter call where questions were asked.

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
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-1.5-flash',
      'gemini-1.5-pro'
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
