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
    const { text, existingJob, history, apiKey: clientApiKey, provider = 'auto' } = req.body || {};

    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Message text is required.' });
    }

    const effectiveGeminiKey = (clientApiKey && !clientApiKey.startsWith('sk-')) ? clientApiKey : geminiKey;
    const effectiveOpenaiKey = (clientApiKey && clientApiKey.startsWith('sk-')) ? clientApiKey : openaiKey;

    const systemPrompt = `You are JobTrackerAI, an intelligent conversational AI career assistant and job application tracker.
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

2. JOB APPLICATION EXTRACTION & TRACKING:
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
- If updating an existing job, preserve existing values and update only newly provided fields.

OUTPUT FORMAT:
Respond with a JSON object with:
{
  "message": "Your rich, formatted markdown response to the user",
  "data": { ... } or null
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
                content: `Active Job in Session: ${existingJob ? JSON.stringify(existingJob) : 'None'}\n\nUser Message: "${text}"`
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
              text: `${systemPrompt}\n\nCurrent Active Job in Session:\n${existingJob ? JSON.stringify(existingJob, null, 2) : 'None'}\n\nUser Message:\n"${text}"`
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

    return res.status(200).json({
      message: parsed.message || candidateText,
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
