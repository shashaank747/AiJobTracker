// Vercel Serverless Function: /api/chat
// Connects JobTrackerAI directly to Google Gemini API using process.env.GEMINI_API_KEY

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    const { text, existingJob, history, apiKey: clientApiKey } = req.body || {};

    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Message text is required.' });
    }

    const apiKey = clientApiKey || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: 'GEMINI_API_KEY not configured on server or in settings.'
      });
    }

    const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const systemPrompt = `You are JobTrackerAI, an intelligent conversational AI career assistant and job application tracker powered by Gemini.

You have two core capabilities:

1. FULL CONVERSATIONAL INTELLIGENCE & CAREER ADVISORY:
- Act like ChatGPT / Gemini. Converse warmly, intelligently, and helpfully on ANY topic.
- Answer user questions thoroughly with rich, beautiful Markdown formatting (headings, bullet points, links, bold text).
- When asked about ANY company (e.g. "tell me about paytm", "samsung", "google", "meta", startups):
  * Provide a detailed overview of the company, its business model, and engineering culture.
  * Explain key engineering & tech stacks (e.g. Java, Spring, Microservices, React, Node, Python, Cloud).
  * Break down typical interview rounds (Coding OA, System Design, Tech Deep-Dive, HR/Behavioral).
  * Provide 3-5 real interview questions asked by that company.
  * Include a link to their career portal.
  * For all advice, research, and conversational questions, set "data": null in your response.
- If asked about an active job loaded in the session (e.g. "what is this role expecting?", "give me questions"):
  * Analyze that specific role, company, and tech stack in detail.
  * Set "data": null.

2. AUTOMATED JOB APPLICATION EXTRACTION & TRACKING:
- Whenever the user pastes a Job Description (JD), an application confirmation email, an application link, or asks to update status/salary of an applied job:
  Extract all information and return the "data" object:
  {
    "companyName": "Company name",
    "roleTitle": "Role title",
    "jobType": "Full-time" | "Internship" | "Contract" | "Part-time",
    "workMode": "Remote" | "Hybrid" | "On-site",
    "location": "City, Country or Remote",
    "salary": "Disclosed salary or 'Not disclosed'",
    "source": "Platform name (e.g., LinkedIn, Indeed, Company Careers)",
    "applicationUrl": "Direct application URL if present",
    "sourceUrl": "Listing portal URL if present",
    "status": "Applied" | "Interviewing" | "Offer" | "Rejected" | "Bookmarked",
    "appliedDate": "YYYY-MM-DD",
    "skills": ["Skill1", "Skill2", ...],
    "notes": "Short summary of key requirements or notes"
  }
- If an existing job is provided, merge and update fields that changed.

OUTPUT FORMAT:
Return ONLY a valid JSON object matching:
{
  "message": "Your complete, formatted markdown response to the user",
  "data": { ... } or null
}`;

    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `${systemPrompt}

Current Active Job in Session (if any):
${existingJob ? JSON.stringify(existingJob, null, 2) : 'None (Fresh Session)'}

User Message:
"${text}"`
            }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.2
      }
    };

    const candidateModels = [
      process.env.GEMINI_MODEL,
      'gemini-2.0-flash',
      'gemini-1.5-flash-latest',
      'gemini-1.5-pro-latest',
      'gemini-pro'
    ].filter(Boolean);

    let lastError = null;
    let candidateText = null;

    for (const model of candidateModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
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
          lastError = errData.error?.message || response.statusText;
        }
      } catch (err) {
        lastError = err.message;
      }
    }

    if (!candidateText) {
      return res.status(500).json({ error: lastError || 'No response generated by Gemini.' });
    }

    const parsed = JSON.parse(candidateText);
    return res.status(200).json({
      message: parsed.message || 'Processed successfully.',
      data: parsed.data || null,
      provider: 'gemini'
    });
  } catch (err) {
    console.error('Serverless function error:', err);
    return res.status(500).json({
      error: err.message || 'Internal server error while processing AI request.'
    });
  }
}
