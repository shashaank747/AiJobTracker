// AI Extraction & Career Advisory Engine for JobTrackerAI
// Supports Google Gemini API, OpenAI API, and Offline Smart NLP Heuristic & Career Advisor

import { Config } from './config.js';

/**
 * Pre-clean raw pasted JD text (removes noise, UI buttons, tracking pixels)
 */
export function cleanRawJD(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    // Normalize line breaks
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Remove repeated blank lines
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

/**
 * Strip common advertising/tracking query parameters from job URLs
 */
export function stripTrackingParams(rawUrl) {
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

/**
 * Parse metadata (company, title, source) from URL domain & slug
 */
export function parseSlugMetadata(cleanUrl) {
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

/**
 * Tier 1 Fast-Path: Intercept prompt when input is strictly a job posting URL
 */
export function handleUrlOnlyInput(input) {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();

  // Check if input is strictly a URL
  const urlPattern = /^(https?:\/\/[^\s]+)$/i;
  const match = trimmed.match(urlPattern);

  if (!match) return null; // Pass down to LLM / normal extraction

  const cleanUrl = stripTrackingParams(match[1]);
  const parsedMeta = parseSlugMetadata(cleanUrl);

  const compName = parsedMeta.company ? (parsedMeta.company.charAt(0).toUpperCase() + parsedMeta.company.slice(1)) : "Pending Details";
  const jobTitle = parsedMeta.title || "Saved Link";

  return {
    is_url_shortcut: true,
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
      notes: `Bookmarked from ${parsedMeta.source} on ${new Date().toLocaleDateString()}`
    }
  };
}

/**
 * Smart Date Parser for relative & explicit application dates
 * Handles "yesterday", "X days ago", "last week", "2 weeks ago", "Oct 2nd", "2026-10-02"
 */
export function parseAppliedDate(text, defaultDate = undefined) {
  const now = new Date();
  const raw = text || '';
  const lower = raw.toLowerCase();

  // Strip job listing publication dates like "reposted 3 days ago", "posted yesterday", "listed 2 days ago"
  const cleanLower = lower.replace(/\b(?:reposted|posted|listed|active|published|updated)\s+(?:\d+\s*days?\s*ago|yesterday|today|\d+\s*weeks?\s*ago|\d+\s*months?\s*ago)\b/gi, '');

  // "yesterday" (including common typos)
  if (/\b(?:(?:i\s+)?(?:have\s+|had\s+)?applied|submitted|sent\s+application)?\s*(?:yesterday|yesturday|yesteday|yestday|yesterdy)\b/i.test(cleanLower)) {
    // Only match if "yesterday" wasn't stripped as a posting date
    if (/\b(?:yesterday|yesturday|yesteday|yestday|yesterdy)\b/i.test(cleanLower)) {
      const d = new Date(now);
      d.setDate(d.getDate() - 1);
      return d.toISOString().split('T')[0];
    }
  }

  // "today" - only if explicitly stating application or submission
  if (/\b(?:(?:i\s+)?(?:have\s+|had\s+)?applied|submitted|sent\s+application)\s+(?:on\s+)?today\b/i.test(cleanLower) ||
      /^(?:applied|submitted)\s+today\b/i.test(cleanLower.trim())) {
    return now.toISOString().split('T')[0];
  }

  // "X days ago" or "X days back" (only if application context or in clean text)
  const daysAgoMatch = cleanLower.match(/\b(?:(?:i\s+)?(?:had\s+)?applied\s+)?(\d+)\s*days?\s*(?:ago|back)\b/i);
  if (daysAgoMatch) {
    const days = parseInt(daysAgoMatch[1], 10);
    const d = new Date(now);
    d.setDate(d.getDate() - days);
    return d.toISOString().split('T')[0];
  }

  // "last week" / "a week ago" / "X weeks ago"
  const weeksAgoMatch = cleanLower.match(/\b(?:(?:i\s+)?(?:had\s+)?applied\s+)?(?:(\d+)\s*weeks?\s*(?:ago|back)|last\s*week|a\s*week\s*ago)\b/i);
  if (weeksAgoMatch) {
    const weeks = weeksAgoMatch[1] ? parseInt(weeksAgoMatch[1], 10) : 1;
    const d = new Date(now);
    d.setDate(d.getDate() - (weeks * 7));
    return d.toISOString().split('T')[0];
  }

  // "last month" / "X months ago"
  const monthsAgoMatch = cleanLower.match(/\b(?:(?:i\s+)?(?:had\s+)?applied\s+)?(?:(\d+)\s*months?\s*(?:ago|back)|last\s*month|a\s*month\s*ago)\b/i);
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
  const monthMatch = cleanLower.match(monthRegex);
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

/**
 * Smart Portal Name Parser to detect where the application was filled/submitted
 * Handles ATS systems (Greenhouse, Workday, Lever, Ashby, etc.) or company career portals
 */
export function parsePortalName(text, url = '') {
  const t = (text || '').toLowerCase();
  const u = (url || '').toLowerCase();

  // 1. URL-based ATS detection
  if (u.includes('greenhouse.io')) return 'Greenhouse';
  if (u.includes('lever.co')) return 'Lever';
  if (u.includes('workday') || u.includes('myworkdayjobs')) return 'Workday';
  if (u.includes('ashbyhq.com')) return 'Ashby';
  if (u.includes('taleo.net')) return 'Taleo';
  if (u.includes('icims.com')) return 'iCIMS';
  if (u.includes('smartrecruiters.com')) return 'SmartRecruiters';
  if (u.includes('jobvite.com')) return 'Jobvite';
  if (u.includes('successfactors.com')) return 'SAP SuccessFactors';
  if (u.includes('bamboohr.com')) return 'BambooHR';

  const isDateOrTimeOrSource = (str) => {
    if (!str) return true;
    const lower = str.toLowerCase().trim();
    if (/\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|today|yesterday|yesturday|tomorrow|mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?|\d{1,2}(?:st|nd|rd|th)?|\d{1,2}:\d{2}|am|pm|days?\s+(?:ago|back)|weeks?\s+(?:ago|back)|months?\s+(?:ago|back))\b/i.test(lower)) {
      return true;
    }
    if (/\b(?:indeed|linkedin|naukri|glassdoor|wellfound|instahyre|internshala|angellist)\b/i.test(lower)) {
      return true;
    }
    if (/\b(?:rejected|reject|not\s+selected|applied|interviewing|offer)\b/i.test(lower)) {
      return true;
    }
    if (/^\d+$/.test(lower) || lower.length < 3) {
      return true;
    }
    return false;
  };

  // 2. Explicit phrase: "filled (the application) on/at/in [Company Portal / Cisco Career Portal / etc.]"
  const filledOnMatch = text && text.match(/(?:filled|applied|submitted)(?:\s+the\s+application)?\s+(?:on|in|at)\s+([^:,\n\r]+)/i);
  if (filledOnMatch && filledOnMatch[1].trim()) {
    const val = filledOnMatch[1].trim().replace(/\s+(?:link|url|here)$/i, '');
    if (val.length > 2 && val.length < 50 && !val.startsWith('http') && !val.includes('://') && !isDateOrTimeOrSource(val)) {
      return val;
    }
  }

  // 3. Explicit label: "portal name: <name>" or "portal: <name>"
  const explicitPortalMatch = text && text.match(/(?:portal\s*(?:name|type)?|platform)\s*[:\-]\s*([a-zA-Z0-9\s\-]+)/i);
  if (explicitPortalMatch && explicitPortalMatch[1].trim()) {
    const val = explicitPortalMatch[1].trim();
    if (val.length > 2 && val.length < 40 && !val.startsWith('http') && !val.includes('://') && !isDateOrTimeOrSource(val)) {
      return val;
    }
  }

  // 4. ATS or portal keywords in text
  if (/\bgreenhouse\b/i.test(t)) return 'Greenhouse';
  if (/\bworkday\b/i.test(t)) return 'Workday';
  if (/\blever\b/i.test(t)) return 'Lever';
  if (/\bashby\b/i.test(t)) return 'Ashby';
  if (/\btaleo\b/i.test(t)) return 'Taleo';
  if (/\bicims\b/i.test(t)) return 'iCIMS';
  if (/\b(?:company\s*(?:career[s]?\s*)?portal|careers?\s*(?:page|site)|direct\s*portal|company\s*site)\b/i.test(t)) return 'Company Portal';

  return null;
}

const EXTRACTION_BLACKLIST = new Set([
  'full', 'time', 'part', 'job', 'role', 'title', 'location', 'work', 'work location',
  'in person', 'remote', 'on-site', 'hybrid', 'full-time', 'part-time', 'contract', 'internship',
  'key responsibilities', 'full job description', 'job details', 'required skills',
  'application question', 'application questions', 'provident fund', 'benefits',
  'pay', 'salary', 'ctc', 'package', 'stipend', 'bengaluru', 'karnataka', 'india',
  'target company', 'software professional', 'professional role', 'company', 'job title',
  'qualification', 'qualifications', 'experience', 'responsibilities', 'about us', 'about the job',
  'about the role', 'what you will do', 'what you\'ll do', 'who you are', 'overview', 'description',
  'requirements', 'preferred qualifications', 'basic qualifications', 'skills required',
  'equal opportunity employer', 'we are hiring', 'we are looking for', 'apply now', 'apply',
  'job summary', 'position summary', 'duties', 'what you need', 'must have'
]);

export function isSentence(str) {
  if (!str) return false;
  const trimmed = str.trim();
  const s = trimmed.toLowerCase();
  const isAbbrEnd = /\b(?:ltd|inc|corp|co|pvt|llc)\.$/i.test(trimmed);
  return /\b(?:is|are|was|were|we|our|you|your|they|their|will|have|has|had|must|should|can|could|looking\s+for|seeking|join\s+our|welcome|excited\s+to|build|building|provide|providing|delivering|experience\s+with|proficient\s+in|responsible\s+for)\b/i.test(s) ||
    (!isAbbrEnd && /[.!?]$/.test(trimmed)) ||
    s.split(/\s+/).length > 7;
}

export function extractCompanyFromUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const path = u.pathname;

    const capitalizeSlug = (slug) => {
      if (!slug) return null;
      return slug.split(/[-_]/)
        .filter(w => !['jobs', 'careers', 'apply', 'view', 'embed', 'gh', 'co', 'io'].includes(w.toLowerCase()))
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
    };

    if (host.includes('greenhouse.io')) {
      const parts = path.split('/').filter(Boolean);
      if (parts.length > 0 && parts[0] !== 'embed' && parts[0] !== 'jobs') return capitalizeSlug(parts[0]);
      if (parts[0] === 'embed' && parts[1] === 'job' && parts[2]) return capitalizeSlug(parts[2]);
    }

    if (host.includes('lever.co')) {
      const parts = path.split('/').filter(Boolean);
      if (parts.length > 0) return capitalizeSlug(parts[0]);
    }

    if (host.includes('ashbyhq.com')) {
      const parts = path.split('/').filter(Boolean);
      if (parts.length > 0) return capitalizeSlug(parts[0]);
    }

    if (host.includes('myworkdayjobs.com')) {
      const sub = host.split('.')[0];
      if (sub && sub !== 'www') return capitalizeSlug(sub);
    }

    if (host.includes('smartrecruiters.com')) {
      const parts = path.split('/').filter(Boolean);
      if (parts.length > 0) return capitalizeSlug(parts[0]);
    }

    if (host.includes('bamboohr.com')) {
      const sub = host.split('.')[0];
      if (sub && sub !== 'www') return capitalizeSlug(sub);
    }

    if (host.startsWith('careers.')) {
      const domain = host.replace('careers.', '').split('.')[0];
      if (domain && domain.length > 2) return capitalizeSlug(domain);
    }
  } catch (e) {}
  return null;
}

export function extractSalary(text) {
  if (!text) return null;

  // 1. Explicit labeled line: Pay:, Salary:, Compensation:, CTC:, Stipend:
  const labeledMatch = text.match(/(?:Pay|Salary|Compensation|CTC|Stipend|Package)\s*[:\-]\s*([^\n\r;]+)/i);
  if (labeledMatch) {
    const raw = labeledMatch[1].trim();
    if (/[\$€£₹]|(?:INR|USD|CAD|EUR|GBP|LPA)\b|\d+[,.\d]*/i.test(raw)) {
      const cleaned = raw.replace(/[.]+$/, '').trim();
      if (cleaned.length > 2 && cleaned.length < 60) {
        return cleaned;
      }
    }
  }

  // 2. Comprehensive Currency Range Match:
  const currSymbols = '[$€£₹]|(?:INR|USD|CAD|EUR|GBP|AUD)';
  const numPattern = '\\d{1,3}(?:,\\d{2,3})*(?:\\.\\d+)?|\\d+(?:\\.\\d+)?';
  const unitPattern = '(?:k|lpa|lac|lacs|lakh|lakhs)?';
  const periodPattern = '(?:\\s*(?:per\\s+(?:month|year|annum|hr|hour|day|week)|a\\s+(?:month|year|hr|hour|day|week)|\\/(?:mo|month|yr|year|hr|hour|day|wk)|p\\.a\\.|p\\.m\\.))?';
  const rangeSeparator = '\\s*(?:-|–|—|to)\\s*';

  const rangeRegex = new RegExp(
    `(${currSymbols})\\s*(${numPattern})\\s*${unitPattern}${rangeSeparator}(?:(${currSymbols})\\s*)?(${numPattern})\\s*${unitPattern}${periodPattern}`,
    'i'
  );
  const rangeMatch = text.match(rangeRegex);
  if (rangeMatch) {
    return rangeMatch[0].trim().replace(/[\s\-–—:]+$/, '');
  }

  const lpaRegex = /\b(\d+(?:\.\d+)?)\s*(?:-|–|—|to)\s*(\d+(?:\.\d+)?)\s*LPA\b/i;
  const lpaMatch = text.match(lpaRegex);
  if (lpaMatch) return lpaMatch[0].trim();

  const singleLpa = /\b(\d+(?:\.\d+)?)\s*LPA\b/i;
  const singleLpaMatch = text.match(singleLpa);
  if (singleLpaMatch) return singleLpaMatch[0].trim();

  const singleCurrRegex = new RegExp(
    `(${currSymbols})\\s*(${numPattern})\\s*${unitPattern}${periodPattern}`,
    'i'
  );
  const singleMatch = text.match(singleCurrRegex);
  if (singleMatch) {
    return singleMatch[0].trim().replace(/[\s\-–—:]+$/, '');
  }

  return null;
}

export function parseSalaryDetails(rawSalary) {
  if (!rawSalary) return { salary: null, salary_numeric: null, currency: null };
  const lpaMatch = rawSalary.match(/\b(\d+(?:\.\d+)?)\s*(?:-|–|—|to)?\s*(\d+(?:\.\d+)?)?\s*LPA\b/i);
  if (lpaMatch) {
    const minLpa = parseFloat(lpaMatch[1]);
    const maxLpa = lpaMatch[2] ? parseFloat(lpaMatch[2]) : minLpa;
    const minAnnual = Math.round(minLpa * 100000);
    const maxAnnual = Math.round(maxLpa * 100000);
    const formatted = minLpa === maxLpa
      ? `₹${minAnnual.toLocaleString('en-IN')} / year (${minLpa} LPA)`
      : `₹${minAnnual.toLocaleString('en-IN')} - ₹${maxAnnual.toLocaleString('en-IN')} / year (${minLpa}-${maxLpa} LPA)`;
    return {
      salary: formatted,
      salary_numeric: minAnnual,
      currency: 'INR'
    };
  }
  return {
    salary: rawSalary,
    salary_numeric: null,
    currency: null
  };
}

export function extractExperience(text) {
  if (!text) return { is_fresher_eligible: null, min_years: null };
  const lower = text.toLowerCase();
  // Rule 3: if terms like "Fresher", "Graduate", or "0 years" appear, set "is_fresher_eligible": true and "min_years": 0
  if (/\b(?:fresher|freshers|graduate|graduates|college\s+grad(?:uate)?|0\s*(?:-|to)?\s*1?\s*years?|0\+?\s*years?|no\s+experience\s+required|entry\s+level)\b/i.test(lower)) {
    return { is_fresher_eligible: true, min_years: 0 };
  }
  const expMatch = text.match(/\b(\d+)(?:\+)?\s*(?:-|to)?\s*(\d+)?\s*years?(?:\s+of)?(?:\s+relevant)?\s+experience\b/i);
  if (expMatch) {
    const min = parseInt(expMatch[1], 10);
    return {
      is_fresher_eligible: min === 0,
      min_years: min
    };
  }
  return { is_fresher_eligible: null, min_years: null };
}

export function extractCompany(text) {
  if (!text) return null;

  // 1. Explicit labeled company
  const labeled = text.match(/(?:Company(?:\s*Name)?|Employer|Organization|Hiring\s+Company|Hiring\s+Firm)\s*[:\-]\s*([^\n\r,;|]+)/i);
  if (labeled) {
    const val = labeled[1].trim();
    if (!EXTRACTION_BLACKLIST.has(val.toLowerCase()) && !isSentence(val) && val.length >= 2 && val.length <= 50) return val;
  }

  // 2. URL-based ATS extraction (Greenhouse, Lever, Ashby, Workday, BambooHR)
  const urlMatch = text.match(/https?:\/\/[^\s]+/i);
  if (urlMatch) {
    const urlCo = extractCompanyFromUrl(urlMatch[0]);
    if (urlCo && !EXTRACTION_BLACKLIST.has(urlCo.toLowerCase())) {
      return urlCo;
    }
  }

  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  // 3. LinkedIn format with middle dot delimiter (· or • or |)
  // e.g. "Uber · Bengaluru, Karnataka, India · Reposted 2 days ago"
  // e.g. "Razorpay · Bengaluru, Karnataka · 45 applicants"
  for (const line of lines.slice(0, 8)) {
    if (line.includes('·') || line.includes('•')) {
      const parts = line.split(/[·•]/).map(p => p.trim()).filter(Boolean);
      if (parts.length >= 2) {
        const cand = parts[0];
        const isNotCompany = /^\d+[\d,]*\+?\s*employees/i.test(cand) ||
                             /^(?:full-time|part-time|contract|internship|remote|hybrid|on-site)$/i.test(cand) ||
                             /^(?:mid-senior|entry|associate|director|executive)\s+level/i.test(cand) ||
                             EXTRACTION_BLACKLIST.has(cand.toLowerCase()) ||
                             isSentence(cand);
        if (!isNotCompany && cand.length >= 2 && cand.length <= 40) {
          return cand;
        }
      }
    }
  }

  // 4. "Role at Company" pattern
  // e.g. "Frontend Engineer at Swiggy", "Junior Data Analyst at ABC Technologies Pvt. Ltd., Bengaluru"
  const atMatch = text.match(/\b(?:engineer|developer|architect|designer|manager|analyst|intern|sde|swe|specialist|consultant|lead|scientist|technician|role|position|job)\b[^\n\r,.]*?\s+(?:at|with|@)\s+([A-Z][A-Za-z0-9&.'\- ]{1,45}?)(?=\s*[,;\n\r]|\s+(?:in|for|on|as)\b|$)/i);
  if (atMatch) {
    const co = atMatch[1].trim();
    if (!EXTRACTION_BLACKLIST.has(co.toLowerCase()) && !isSentence(co) && co.length >= 2) {
      return co;
    }
  }

  // 5. "About <Company>" or "At <Company>, we..."
  // e.g. "About Stripe", "At Uber, we reimagine...", "About Razorpay\n"
  const introMatch = text.match(/(?:^|\n)\s*(?:about|at)\s+([A-Z][A-Za-z0-9&.,'()\- ]{1,30})(?:,|\s+we\b|\s+is\b|\s+are\b|\s+powers\b|\s+builds\b|\s+helps\b|\s*\n)/i);
  if (introMatch) {
    const cand = introMatch[1].trim().replace(/\s+(?:we|is|are|company|corporation|inc|ltd)$/i, '');
    if (!EXTRACTION_BLACKLIST.has(cand.toLowerCase()) && !isSentence(cand) && cand.length >= 2 && cand.length <= 40) {
      return cand;
    }
  }

  // 6. Header inspection in structured job descriptions (Lines 0 to 3)
  // If line 0 is Role Title, line 1 is often Company Name (e.g. "Google", "Stripe")
  if (lines.length >= 2) {
    for (let i = 0; i < Math.min(lines.length - 1, 3); i++) {
      const cur = lines[i];
      const next = lines[i + 1];

      const isLocationNext = /^[A-Z][a-zA-Z\s]{2,25},\s*[A-Z][a-zA-Z\s]{2,25}/.test(next) ||
                             /\b(?:Bengaluru|Bangalore|Hyderabad|Pune|Mumbai|Delhi|Noida|Gurgaon|Gurugram|Chennai|Seattle|San Francisco|New York|London|Remote)\b/i.test(next);

      if (isLocationNext && !isSentence(cur) && cur.length >= 2 && cur.length <= 40) {
        const isRole = /\b(?:engineer|developer|architect|designer|manager|analyst|intern|sde|swe|specialist|lead)\b/i.test(cur);
        if (!isRole && !EXTRACTION_BLACKLIST.has(cur.toLowerCase())) {
          return cur;
        }
      }
    }
  }

  // 7. Corporate Entity Legal Suffix match (STRICT: must NOT be a sentence)
  const legalEntityRegex = /\b([A-Z][A-Za-z0-9&.'\- ]{1,45}\s+(?:PVT\.?\s*LTD\.?|PRIVATE\s+LIMITED|LTD\.?|LIMITED|INC\.?|INCORPORATED|LLC|CORP\.?|CORPORATION|LLP|GMBH))\b/i;
  for (const line of lines) {
    if (!isSentence(line)) {
      const match = line.match(legalEntityRegex);
      if (match) {
        const clean = match[1].trim().replace(/^(?:Company|Employer|At)\s*[:\-]?\s*/i, '');
        if (clean.length >= 3 && clean.length <= 50 && !EXTRACTION_BLACKLIST.has(clean.toLowerCase())) {
          return clean;
        }
      }
    }
  }

  return null;
}

export function extractRoleTitle(text) {
  if (!text) return null;

  // 1. Explicit Role label
  const labeled = text.match(/(?:Role(?:\s*Title)?|Job\s*Title|Position(?:\s*Title)?|Title|Designation|Post)\s*[:\-]\s*([^\n\r,;|]+)/i);
  if (labeled) {
    let val = labeled[1].trim()
      .replace(/^(?:In person|Remote|On-site|Hybrid|Applied for|Position of|Role of)\s+/i, '')
      .replace(/\s*\([^)]*\)$/, '')
      .trim();
    if (!EXTRACTION_BLACKLIST.has(val.toLowerCase()) && !isSentence(val) && val.length > 2 && val.length < 50) {
      return val;
    }
  }

  // 2. "Applied for [Role] at [Company]" pattern
  const appliedForMatch = text.match(/(?:applied|applying|interview(?:ing)?|offer|role|job)?\s*(?:for|as)\s+(?:the\s+)?([A-Za-z0-9&/.\- ]{2,35})\s+(?:at|with)\s+([A-Z][A-Za-z0-9&.'\-]{1,30})/i);
  if (appliedForMatch) {
    let r = appliedForMatch[1].trim()
      .replace(/^(?:applied|interviewing|offer)\s+(?:for|as)?\s+/i, '')
      .replace(/^(?:the|a|an)\s+/i, '')
      .trim();
    if (!EXTRACTION_BLACKLIST.has(r.toLowerCase()) && !isSentence(r) && r.length > 2 && r.length < 45) {
      return r;
    }
  }

  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  // 3. First line inspection (LinkedIn / Indeed / Naukri formats)
  if (lines.length > 0) {
    const firstLine = lines[0]
      .replace(/^(?:Job Details|About the job|Full Job Description)\s*[:\-]?\s*/i, '')
      .replace(/\s*\(\d+[-–]\d+\s*(?:yrs|years)\)/i, '')
      .trim();

    const roleKeywords = /\b(?:Technician|Engineer|Developer|Architect|Analyst|Specialist|Manager|Lead|Director|Designer|Administrator|Consultant|Associate|Executive|Officer|Coordinator|Mechanic|Operator|Intern|Scientist|SDE|SWE)\b/i;
    if (roleKeywords.test(firstLine) && !isSentence(firstLine) && firstLine.length >= 3 && firstLine.length <= 60 && !EXTRACTION_BLACKLIST.has(firstLine.toLowerCase())) {
      return firstLine.replace(/^(?:In person|Remote|On-site|Hybrid)\s+/i, '').trim();
    }
  }

  // 4. Canonical Tech Titles (SDE 1, Full Stack Developer, Data Scientist, etc.)
  const techMatch = text.match(/\b(SDE[- ]?(?:[123]|I{1,3})|SWE[- ]?(?:[123]|I{1,3})?|Full Stack Developer|Frontend Developer|Backend Developer|Data Scientist|Product Manager|UI\/UX Designer|DevOps Engineer|Cloud Architect)\b/i);
  if (techMatch) return techMatch[1].trim();

  // 5. Bounded professional role pattern
  const boundedRoleRegex = /\b((?:Senior|Sr\.?|Junior|Jr\.?|Lead|Principal|Staff|Chief|Associate)?\s*(?:Software|Full\s*Stack|Frontend|Front-end|Backend|Back-end|DevOps|Cloud|Data|AI|ML|Machine\s+Learning|Mobile|iOS|Android|System|Systems|Platform|Infrastructure|Security|QA|Automation|Web|Product|UI\/UX)?\s*(?:Engineer|Developer|Architect|Manager|Analyst|Scientist|Designer|Specialist|Consultant|Administrator|Coordinator|Lead|Intern|Technician)(?:[- ]?(?:[123]|I{1,3}|IV))?)\b/i;
  for (const line of lines.slice(0, 10)) {
    if (!isSentence(line)) {
      const match = line.match(boundedRoleRegex);
      if (match && !EXTRACTION_BLACKLIST.has(match[1].toLowerCase().trim())) {
        return match[1].trim();
      }
    }
  }

  // 6. Direct role match in input text
  const directMatch = text.match(boundedRoleRegex);
  if (directMatch && !EXTRACTION_BLACKLIST.has(directMatch[1].toLowerCase().trim())) {
    return directMatch[1].trim();
  }

  return null;
}

export function extractLocation(text) {
  if (!text) return 'Not specified';

  // 1. Explicit Location label
  const locMatch = text.match(/(?:Location|Work\s+Location|Job\s+Location|Place|Office|Based\s+in)\s*[:\-]\s*([^\n\r,;|]+)/i);
  if (locMatch) {
    let raw = locMatch[1].trim();
    raw = raw.replace(/\b(?:In\s*person|Remote|On-site|Hybrid)\b/gi, '').trim();
    if (raw.length > 2 && raw.length < 50) return raw;
  }

  // 2. LinkedIn middle dot line (e.g. "Razorpay · Bengaluru, Karnataka, India · 3 days ago")
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  for (const line of lines.slice(0, 8)) {
    if (line.includes('·') || line.includes('•')) {
      const parts = line.split(/[·•]/).map(p => p.trim()).filter(Boolean);
      for (const p of parts) {
        if (/^[A-Z][a-zA-Z\s]{2,25},\s*[A-Z][a-zA-Z\s]{2,25}/.test(p) ||
            /\b(?:Bengaluru|Bangalore|Hyderabad|Pune|Mumbai|Delhi|Noida|Gurgaon|Gurugram|Chennai|Seattle|San Francisco|New York|London|Remote|India|United States|USA)\b/i.test(p)) {
          if (!p.includes('employees') && !p.includes('applicants') && !p.includes('ago')) {
            return p;
          }
        }
      }
    }
  }

  // 3. Remote / Hybrid / On-site with region (e.g. "Remote, US", "Remote, India", "Remote - US")
  const remoteRegionMatch = text.match(/\b(Remote\s*,\s*[A-Z]{2,20}|Remote\s*[-–]\s*[A-Za-z\s]+|Remote\s*\([^)]*\))\b/i);
  if (remoteRegionMatch) return remoteRegionMatch[1].trim();

  // 4. Standalone City, State line (e.g. Bengaluru, Karnataka)
  for (const line of lines) {
    if (/^[A-Z][a-zA-Z\s]{2,20},\s*[A-Z][a-zA-Z\s]{2,20}$/.test(line)) {
      return line;
    }
  }

  // 5. Known cities list
  const cityMatch = text.match(/\b(Bengaluru|Bangalore|Hyderabad|Pune|Mumbai|Delhi|Noida|Gurgaon|Gurugram|Chennai|Kolkata|Ahmedabad|Jaipur|Kochi|Chandigarh|New York|San Francisco|San Jose|Seattle|Austin|Boston|Chicago|Denver|London|Berlin|Toronto|Singapore|Amsterdam|Dublin)\b/i);
  if (cityMatch) return cityMatch[1];

  if (/\bremote\b/i.test(text)) return 'Remote';

  return 'Not specified';
}

export const CANONICAL_SKILLS = {
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

export const SKILL_CANONICAL_MAP = CANONICAL_SKILLS;

export function canonicalizeSkillName(name) {
  if (!name || typeof name !== 'string') return '';
  const clean = name.trim();
  const lower = clean.toLowerCase();
  return CANONICAL_SKILLS[lower] || clean;
}

// Clean up messy company strings and deduplicate location
export function cleanCompanyAndLocation(company, location) {
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

// Map sub-skills/formulas back to high-level parent tools and exclude formula noise
export const EXCLUDE_FORMULAS = new Set([
  'if', 'sumifs', 'sumif', 'vlookup', 'xlookup', 'hlookup', 'index match', 'index-match',
  'pivottables', 'pivot tables', 'pivot table', 'select', 'where', 'joins', 'join',
  'group by', 'order by', 'power query', 'dax', 'countif', 'countifs', 'average',
  'formula', 'formulas'
]);

export function normalizeSkillList(skillsArray) {
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

export function normalizeSkills(skillsArray) {
  return normalizeSkillList(skillsArray);
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

// Quick local extraction rules for Tier 3
export function extractCoreFieldsLocally(rawText) {
  if (!rawText) return { isFresher: false, salaryMin: null, salaryMax: null, sourceUrl: null, appUrl: null, workModel: 'On-site' };

  // 1. Detect Fresher status
  const isFresher = /\b(fresher|freshers|entry[- ]level|0\s*[-–to]\s*[012]?\s*years?|college grad(?:uate)?|passouts?|batch\s+of\s+202[34567]|graduates?\s+welcome)\b/i.test(rawText);

  // 2. Extract LPA compensation
  let salaryMin = null, salaryMax = null;
  const lpaMatch = rawText.match(/(\d+(?:\.\d+)?)\s*(?:-|–|—|to)\s*(\d+(?:\.\d+)?)\s*LPA/i);
  if (lpaMatch) {
    salaryMin = parseFloat(lpaMatch[1]) * 100000;
    salaryMax = parseFloat(lpaMatch[2]) * 100000;
  } else {
    const singleLpa = rawText.match(/\b(\d+(?:\.\d+)?)\s*LPA\b/i);
    if (singleLpa) {
      salaryMin = parseFloat(singleLpa[1]) * 100000;
      salaryMax = salaryMin;
    }
  }

  // 3. Work model detection (e.g. "office 3 days a week")
  let workModel = 'On-site';
  if (/\bremote\b|\bwork from home\b|\bwfh\b/i.test(rawText)) {
    workModel = 'Remote';
  } else if (/\bhybrid\b|(\d+\s*days?\s*(?:in|at|from)\s*(?:the\s+)?office|office\s*\d+\s*days?)/i.test(rawText)) {
    workModel = 'Hybrid';
  }

  // 4. Extract links
  const links = rawText.match(/https?:\/\/[^\s]+/g) || [];
  const cleanLinks = links.map(u => u.replace(/[.,;!?)]+$/, ''));
  const sourceUrl = cleanLinks.find(url => /(linkedin|naukri|indeed|glassdoor|wellfound)\.com/i.test(url)) || null;
  const appUrl = cleanLinks.find(url => /(greenhouse|lever|myworkdayjobs|smartrecruiters|ashby|careers)/i.test(url)) || 
    (cleanLinks.find(u => u !== sourceUrl) || cleanLinks[0] || null);

  return {
    isFresher,
    salaryMin,
    salaryMax,
    sourceUrl,
    appUrl,
    workModel
  };
}

export function extractSkills(text) {
  const skills = [];
  // 1. Explicit Required Skills line
  const skillsLineMatch = text.match(/(?:Required\s+Skills|Key\s+Skills|Skills(?:\s+Required)?|Technical\s+Skills|Core\s+Skills|Must\s+Have\s+Skills|Tech\s+Stack)\s*[:\-]\s*([^\n\r]+)/i);
  if (skillsLineMatch) {
    const raw = skillsLineMatch[1].trim();
    const split = raw.split(/[,;•|]+/).map(s => s.trim().replace(/[.]+$/, '')).filter(s => s.length > 1 && s.length < 40);
    skills.push(...split);
  }

  // 2. Comprehensive Tech dictionary matching
  const techDictionary = [
    'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 'Go', 'Rust', 'PHP', 'Ruby', 'Swift', 'Kotlin',
    'React', 'Next.js', 'Vue', 'Angular', 'Node.js', 'Express', 'Django', 'FastAPI', 'Spring Boot', 'Spring', 'Flask',
    'SQL', 'PostgreSQL', 'Postgres', 'MySQL', 'MongoDB', 'Supabase', 'Firebase', 'Redis', 'Kafka', 'RabbitMQ',
    'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'Git', 'GraphQL', 'REST API', 'Microservices', 'Tailwind', 'CSS', 'HTML', 'Linux', 'CI/CD',
    'Excel', 'MS Excel', 'Microsoft Excel', 'Power BI', 'PowerBI'
  ];
  for (const tech of techDictionary) {
    const escaped = tech.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?:^|[^a-zA-Z0-9_+#])${escaped}(?=[^a-zA-Z0-9_+#]|$)`, 'i');
    if (regex.test(text)) {
      skills.push(tech);
    }
  }

  return normalizeSkills(skills).slice(0, 10);
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
  handleUrlOnlyInput(input) {
    return handleUrlOnlyInput(input);
  },
  stripTrackingParams(rawUrl) {
    return stripTrackingParams(rawUrl);
  },
  parseSlugMetadata(cleanUrl) {
    return parseSlugMetadata(cleanUrl);
  },

  /**
   * Detect if an incoming user prompt is a Job Description or Job Posting
   */
  isJobDescription(text) {
    if (!text || typeof text !== 'string') return false;
    const trimmed = text.trim();
    const lower = trimmed.toLowerCase();

    // 1. Explicit job markers
    const explicitMarkers = [
      /\b(?:job\s+description|about\s+the\s+(?:role|job)|role\s+overview|job\s+summary|position\s+summary)\b/i,
      /\b(?:responsibilities|key\s+responsibilities|duties|what\s+you(?:'ll|\s+will)\s+do)\b/i,
      /\b(?:requirements|qualifications|basic\s+qualifications|preferred\s+qualifications|what\s+you\s+need|must\s+have)\b/i,
      /\b(?:years\s+of\s+experience|yoe|\d+\+?\s*years?\s+(?:of\s+)?exp)\b/i,
      /\b(?:employment\s+type|work\s+mode|workplace\s+type|job\s+type)\s*[:\-]/i,
      /\b(?:role|position|job\s+title)\s*[:\-]/i,
      /\b(?:apply\s+(?:here|now|before|link|url)|how\s+to\s+apply)\b/i,
      /\b(?:salary|compensation|benefits|stipend|ctc|package)\s*[:\-]/i,
      /\b(?:here\s+is\s+(?:the\s+|a\s+)?jd|analyze\s+this\s+jd|parse\s+this\s+jd|track\s+this\s+job|save\s+this\s+job)\b/i,
      /\b(?:applied\s+(?:for|to|as)|track\s+(?:this\s+)?(?:application|role|opening))\b/i
    ];

    if (explicitMarkers.some(re => re.test(text))) {
      return true;
    }

    // 2. Direct Job Portal or ATS Links
    if (/(?:linkedin\.com\/jobs|indeed\.com\/(?:viewjob|job)|glassdoor\.com\/job|boards\.greenhouse\.io|jobs\.lever\.co|jobs\.ashbyhq\.com|myworkdayjobs\.com|naukri\.com|smartrecruiters\.com|bamboohr\.com)/i.test(text)) {
      return true;
    }

    // 3. Multi-line job postings with structural indicators
    const lines = trimmed.split('\n').filter(l => l.trim().length > 0);
    if (lines.length >= 2) {
      const hasRoleKeyword = /\b(?:software|developer|engineer|designer|manager|analyst|architect|specialist|intern|sde|swe|lead|consultant)\b/i.test(lower);
      const hasJobContext = /\b(?:full-time|part-time|remote|hybrid|on-site|salary|lpa|ctc|skills|experience|technologies|apply|company|requirements|location|bengaluru|bangalore|pune|hyderabad|mumbai|delhi)\b/i.test(lower);
      if (hasRoleKeyword && hasJobContext) {
        return true;
      }
    }

    if (lines.length >= 3 && trimmed.length > 100) {
      const jobSignals = /\b(software|developer|engineer|designer|manager|analyst|full-time|part-time|remote|hybrid|on-site|skills|experience|technologies|apply|company)\b/i;
      if (jobSignals.test(lower)) {
        return true;
      }
    }

    return false;
  },

  /**
   * Accurately detect if the user message is an email or status update about a recruiter viewing/seeing an application
   */
  isApplicationNotification(text) {
    if (!text || typeof text !== 'string') return false;
    const lower = text.toLowerCase();
    return /(?:recruiter|hiring\s+team|employer|company)?\s*(?:has\s+)?(?:seen|viewed|reviewed|opened|checked|looked\s+at)\s+(?:your|my)\s+application/i.test(lower) ||
      /(?:your|my)\s+application\s+(?:was|has\s+been|is)\s+(?:viewed|reviewed|seen|opened|checked)/i.test(lower) ||
      /(?:recruiter|employer)\s+(?:downloaded|viewed|seen|opened)\s+(?:your|my)\s+resume/i.test(lower) ||
      /(?:your|my)?\s*resume\s+(?:was\s+)?(?:downloaded|viewed|seen|opened|reviewed)/i.test(lower) ||
      /\b(?:application\s+(?:viewed|seen|reviewed|opened)|resume\s+(?:viewed|downloaded))\b/i.test(lower) ||
      /(?:status\s+update|good\s+news|update\s+on\s+your\s+application).*?(?:viewed|seen|reviewed|opened)/i.test(lower) ||
      /\b(?:recruiter\s+(?:has\s+)?seen|recruiter\s+viewed|application\s+was\s+viewed|employer\s+viewed)\b/i.test(lower);
  },

  /**
   * Accurately detect if the user is asking for current time or date
   */
  checkTimeOrDateQuery(text) {
    if (!text || typeof text !== 'string') return { isTime: false, isDate: false };
    const trimmed = text.trim();
    // A time or date question is NEVER a long text or a job description
    if (trimmed.length > 100 || trimmed.includes('\n\n') || this.isJobDescription(trimmed)) {
      return { isTime: false, isDate: false };
    }

    const clean = trimmed.toLowerCase()
      .replace(/^[!?. ,;]+|[!?. ,;]+$/g, '')
      .replace(/\s+/g, ' ');

    const timePatterns = [
      /^(?:what(?:'s|\s+is)\s+(?:the\s+)?time(?:\s+now|\s+right\s+now)?)$/i,
      /^(?:what\s+time\s+is\s+it(?:\s+now|\s+right\s+now)?)$/i,
      /^(?:(?:can\s+you\s+|please\s+)?tell\s+me\s+(?:the\s+)?time)$/i,
      /^(?:current\s+time)$/i,
      /^(?:time\s+now)$/i,
      /^(?:what\s+is\s+time)$/i,
      /^time$/i
    ];

    const datePatterns = [
      /^(?:what(?:'s|\s+is)\s+today(?:'s)?\s+date)$/i,
      /^(?:what(?:'s|\s+is)\s+the\s+date(?:\s+today)?)$/i,
      /^(?:today(?:'s)?\s+date)$/i,
      /^(?:current\s+date)$/i,
      /^(?:what\s+day\s+is\s+(?:it|today))$/i,
      /^(?:which\s+day\s+is\s+(?:it|today))$/i,
      /^(?:date\s+today)$/i,
      /^(?:today\s+date)$/i,
      /^(?:what\s+is\s+(?:the\s+)?date)$/i,
      /^date$/i,
      /^(?:what\s+(?:is\s+)?(?:the\s+)?(?:time\s+and\s+date|date\s+and\s+time))$/i,
      /^(?:time\s+and\s+date|date\s+and\s+time)$/i
    ];

    return {
      isTime: timePatterns.some(re => re.test(clean)),
      isDate: datePatterns.some(re => re.test(clean))
    };
  },

  /**
   * Accurately detect if the user is asking for today's application count
   */
  checkTodayCountQuery(text) {
    if (!text || typeof text !== 'string') return false;
    const trimmed = text.trim();
    if (trimmed.length > 100 || trimmed.includes('\n\n') || this.isJobDescription(trimmed)) {
      return false;
    }
    const clean = trimmed.toLowerCase()
      .replace(/^[!?. ,;]+|[!?. ,;]+$/g, '')
      .replace(/\s+/g, ' ');

    return /^(?:how\s+many\s+(?:applications?|jobs?|roles?)?(?:\s+(?:did\s+i\s+apply(?:\s+to)?|applied))?\s+today|today(?:'s)?\s+(?:applications?|jobs?|count)|(?:applied|applications?|jobs?)\s+today|count\s+today)$/i.test(clean) ||
      /^(?:applied\s+today|today\s+applied|today\s+count|jobs\s+today|applications\s+today)\??$/i.test(trimmed);
  },

  /**
   * Accurately detect if the user is asking for a graph/velocity chart
   */
  checkGraphQuery(text) {
    if (!text || typeof text !== 'string') return false;
    const trimmed = text.trim();
    if (trimmed.length > 100 || trimmed.includes('\n\n') || this.isJobDescription(trimmed)) {
      return false;
    }
    const lower = trimmed.toLowerCase();
    const isGraphWord = /\b(?:graph|chart|velocity|visualiz(?:e|ation)|trend|curve)\b/i.test(lower);
    const isWeekOrMonth = /\b(?:(?:last|past)\s+(?:week|month|7\s*days|30\s*days)|this\s+(?:week|month))\b/i.test(lower);
    const isAppQuery = /\b(?:applications?|jobs?|applied|how\s+many)\b/i.test(lower);

    return (isGraphWord && (isAppQuery || trimmed.length < 30)) ||
      (isWeekOrMonth && isAppQuery && /\b(?:graph|chart|velocity|trend|curve|show|list)\b/i.test(lower)) ||
      /^\/(?:graph|chart|velocity)\b/i.test(trimmed);
  },

  /**
   * Main entry point to parse a raw JD or a conversational follow-up
   */
  async processInput(text, existingJob = null, history = [], allApplications = [], userProfile = null) {
    const cleanedInput = cleanRawJD(text);
    if (cleanedInput) {
      text = cleanedInput;
    }
    const settings = Config.getSettings();

    const provider = settings.aiProvider || 'gemini';
    let result = null;

    const trimmed = text.trim();
    const lower = trimmed.toLowerCase();

    const isJD = this.isJobDescription(text);

    // Tier 1 Fast-path 0: Quick URL-save shortcut -> INSTANT (< 5ms)
    const quickLead = handleUrlOnlyInput(text);
    if (quickLead) {
      return {
        message: `🔖 **Saved link to database!**\n\n- **Source:** ${quickLead.data.source_url}\n- **Status:** Marked as \`Saved\` lead.\n\n*You can open the card anytime from your tracker to paste the full JD or add notes when you're ready to apply.*`,
        data: {
          ...quickLead.data,
          companyName: quickLead.data.company_name,
          roleTitle: quickLead.data.job_title,
          sourceUrl: quickLead.data.source_url,
          applicationUrl: quickLead.data.application_url,
          workMode: quickLead.data.work_model,
          isStored: true,
          is_incomplete: true,
          isIncomplete: true
        },
        is_url_shortcut: true,
        provider: 'fast-path-url'
      };
    }

    // Fast-path 1: Real-time Clock / Date Queries -> INSTANT (< 5ms)
    const { isTime: isTimeQuery, isDate: isDateQuery } = !isJD ? this.checkTimeOrDateQuery(text) : { isTime: false, isDate: false };

    // Fast-path 1b: Today applications count query -> INSTANT (< 5ms)
    const isTodayCountQuery = !isJD && this.checkTodayCountQuery(text);

    // Fast-path 1c: Graph / Last week / Last month velocity queries -> INSTANT (< 5ms)
    const isGraphQuery = !isJD && this.checkGraphQuery(text);

    // Fast-path 1d: Search query in applications database (/search or search keywords) -> INSTANT (< 5ms)
    const isSearchCmd = !isJD && (/^\/(?:search|find)\b/i.test(trimmed) ||
      /\b(?:search(?:\s+(?:for|in|all))?|find(?:\s+(?:my|all))?|lookup)\s+(?:applications?|jobs?|in\s+database|database)\b/i.test(lower));

    // Fast-path 2: Direct Greetings & Simple Identity -> INSTANT (< 5ms)
    const isGreeting = !isJD && /^(?:hi|hello|hey|hiya|howdy|good\s*(?:morning|afternoon|evening)|sup|yo|hola)(?:\s+zuno)?\b[!?. ]*$/i.test(trimmed);
    const isIdentity = !isJD && /^(who are you|what is your name|what's your name|your name)\b[!?. ]*$/i.test(lower);
    const isHowAreYou = !isJD && /^(how are you|how's it going|how are you doing)\b[!?. ]*$/i.test(lower);
    const isSmallTalkOrAffirmation = !isJD && (
      /^(?:nice(?:\s+(?:one|work|job|table|list))?|cool(?:\s+(?:thanks|one))?|great(?:\s+(?:job|work))?|awesome|sweet|super|superb|amazing|neat|wonderful|fantastic|brilliant|perfect|good(?:\s+(?:job|work|one))?|very\s+good|looks\s+good|sounds\s+good|love\s+it|loved\s+it|wow|woah|appreciated|much\s+appreciated|thanks(?:\s+a\s+lot|\s+so\s+much|\s+zuno)?|thank\s+you(?:\s+so\s+much|\s+very\s+much|\s+zuno)?|thx|ty|tysm|ok|okay|alright|all\s+right|fine|fair\s+enough|understood|got\s+it|gotcha|noted|makes\s+sense|i\s+see|clear|yep|yeah|yes|sure|definitely|absolutely|yup|haha|lol|lmao|hehe|good\s+bot|you('re|\s+are)\s+(?:awesome|great|cool|the\s+best))\b[!?. ]*$/i.test(trimmed) ||
      /^(?:bye|goodbye|see\s+you|cya|take\s+care|good\s*night)\b[!?. ]*$/i.test(trimmed) ||
      /^(?:tell\s+me\s+a\s+joke|joke|make\s+me\s+laugh)\b/i.test(lower) ||
      /^(?:what\s+(?:should|can)\s+(?:we|i)\s+do(?:\s+next)?|what\s+next|next\s+step[s]?)\b/i.test(lower)
    );

    // Fast-path 3: Direct Profile commands (e.g. "add skill: ...", "add project: ...", "add sem 5 marks: ...") -> INSTANT (< 5ms)
    const isDirectProfileCmd = !isJD && /^(?:add\s+project|new\s+project|project\s*:|add\s+cert|add\s+certification|add\s+skill|add\s+technical\s+skill|remove\s+skill|add\s+sem\s+[1-8]\s+marks|update\s+college|my\s+college\s+is)\b/i.test(lower);
    const isSimpleCountQuery = !isJD && (
      /^(?:how\s+many\s+(?:jobs|applications|interviews|offers|did\s+i\s+apply)|show\s+(?:my\s+|all\s+)?applications|list\s+(?:my\s+|all\s+)?applications|show\s+all|list\s+all|show\s+them|list\s+them|view\s+all|display\s+all|all\s+applications)\b/i.test(lower) ||
      lower === 'show all' || lower === 'list all' || lower === 'show them' || lower === 'list them' || lower === '/list' || lower === '/stats'
    );

    // If matches fast-path OR provider is explicitly set to offline heuristic
    if (provider === 'heuristic' || isTimeQuery || isDateQuery || isTodayCountQuery || isGraphQuery || isSearchCmd || isGreeting || isIdentity || isHowAreYou || isSmallTalkOrAffirmation || isDirectProfileCmd || isSimpleCountQuery) {
      result = await this.extractWithHeuristics(text, existingJob, allApplications, userProfile, history);
    } else {
      // 2. Try Vercel Serverless /api/chat with 12-second budget
      const requestStart = Date.now();
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout guarantee

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
            clientTimestamp: Date.now(),
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata',
            apiKey: (provider === 'openai' ? settings.openaiKey : settings.geminiKey) || undefined
          }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (serverRes.ok) {
          const json = await serverRes.json();
          if (json.message) {
            result = {
              message: json.message,
              data: json.data || null,
              profileUpdate: json.profileUpdate || null,
              cardType: json.cardType || null,
              cardData: json.cardData || null,
              provider: json.provider || provider
            };
          }
        }
      } catch (serverErr) {
        console.warn('Serverless endpoint exceeded budget (4.2s) or failed, switching instantly to heuristics:', serverErr.name || serverErr.message);
      }

      // Fallback: If serverless failed, try direct client-side AI if user configured API keys in Settings
      if (!result) {
        if (provider === 'gemini' && settings.geminiKey) {
          try {
            result = await this.extractWithGemini(text, existingJob, history, settings, allApplications, userProfile);
          } catch (e) {
            console.warn('Client-side Gemini extraction fallback failed, switching to heuristics:', e.message);
          }
        } else if (provider === 'openai' && settings.openaiKey) {
          try {
            result = await this.extractWithOpenAI(text, existingJob, history, settings, allApplications, userProfile);
          } catch (e) {
            console.warn('Client-side OpenAI extraction fallback failed, switching to heuristics:', e.message);
          }
        }
      }

      // 3. Fallback: Ultra-fast offline Smart Career Advisor & Heuristic Extractor (< 5ms)
      if (!result) {
        result = await this.extractWithHeuristics(text, existingJob, allApplications, userProfile, history);
      }
    }

    if (result && !result.data && !result.cardType) {
      if (isTimeQuery || isDateQuery || isTodayCountQuery || isGraphQuery) {
        const widgetRes = this.extractWithHeuristics(text, existingJob, allApplications, userProfile);
        if (widgetRes && widgetRes.cardType) {
          result.cardType = widgetRes.cardType;
          result.cardData = widgetRes.cardData;
        }
      }
    }

    // Post-processing deterministic guarantee for follow-up edits:
    const isQueryOrQuestion = /^(what|when|where|which|how|who|did|have|list|show|any)\b/i.test(text.trim());
    const isRejectedSignal = /\b(?:not\s+selected(?:\s+by\s+employer)?|didn'?t\s+get\s+selected|did\s+not\s+get\s+selected|not\s+shortlisted|didn'?t\s+get\s+the\s+job|not\s+hired|turned\s+down|not\s+moving\s+forward|unsuccessful|declined|reject|rejected|rejection|got\s+rejected|was\s+rejected|application\s+rejected)\b/i.test(text);
    const detectedDate = !isQueryOrQuestion ? parseAppliedDate(text, null) : null;
    const detectedSource = !isQueryOrQuestion ? parseJobSource(text) : null;

    if (!isQueryOrQuestion && existingJob && (detectedDate || detectedSource || isRejectedSignal)) {
      if (!result || !result.data) {
        result = result || {};
        result.data = { ...existingJob };
        result.message = result.message || (isRejectedSignal
          ? `Updated **${existingJob.companyName}** (${existingJob.roleTitle}) status to **Rejected** (Not selected by employer).\n\nJob search rejections are completely normal and part of the journey—don't let it discourage you! You're one step closer to the right opportunity.`
          : `Updated **${existingJob.companyName}** (${existingJob.roleTitle}) with the latest details.`);
      }
    }

    if (result && result.data) {
      if (isRejectedSignal) {
        result.data.status = 'Rejected';
      }
      if (detectedDate) {
        result.data.appliedDate = detectedDate;
        if (result.data.status === 'Saved') {
          result.data.status = 'Applied';
        }
      }
      if (detectedSource) {
        result.data.source = detectedSource;
      }
      if (!result.data.appliedTime && result.data.appliedDate) {
        result.data.appliedTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      }
    }

    return result;
  },

  /**
   * Gemini API Extraction & Career Advisory
   */
  async extractWithGemini(text, existingJob, history, settings, allApplications = [], userProfile = null) {
    const model = settings.geminiModel || 'gemini-2.5-flash';
    const apiKey = settings.geminiKey;

    const now = new Date();
    const effectiveTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';

    let fullTimeStr = '';
    let fullDateStr = '';
    let dayOfWeek = '';
    let today = '';

    try {
      fullTimeStr = now.toLocaleTimeString('en-US', {
        timeZone: effectiveTimeZone,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
      fullDateStr = now.toLocaleDateString('en-US', {
        timeZone: effectiveTimeZone,
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      dayOfWeek = now.toLocaleDateString('en-US', {
        timeZone: effectiveTimeZone,
        weekday: 'long'
      });
      const dateParts = new Intl.DateTimeFormat('en-CA', {
        timeZone: effectiveTimeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(now);
      today = dateParts;
    } catch (e) {
      fullTimeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      fullDateStr = now.toDateString();
      dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()];
      today = now.toISOString().split('T')[0];
    }

    const databaseSummary = Array.isArray(allApplications) && allApplications.length > 0
      ? allApplications.map((a, i) => `#${i+1}: ${a.companyName || 'Unknown'} | Role: ${a.roleTitle || 'Undisclosed'} | Status: ${a.status || 'Applied'} | Salary: ${a.salary || 'N/A'} | Applied: ${a.appliedDate || 'N/A'}${a.appliedTime ? ' ' + a.appliedTime : ''}`).join('\n')
      : '0 applications in database.';

    const formatFullProfileDossier = (prof) => {
      if (!prof) return 'USER ABOUT ME PROFILE / CANDIDATE DOSSIER: None recorded yet.';
      const col = prof.education?.college || {};
      const sMarks = col.semesterMarks || {};
      const projs = Array.isArray(prof.projects) ? prof.projects : [];
      const certs = Array.isArray(prof.certifications) ? prof.certifications : [];
      const skills = Array.isArray(prof.skills) ? prof.skills : [];

      return `USER ABOUT ME PROFILE / CANDIDATE DOSSIER:
- Name: ${prof.fullName || 'Not specified'} | Title: ${prof.headline || 'Not specified'}
- Bio: ${prof.bio || 'Not specified'}
- Contact: Email: ${prof.email || 'N/A'} | Phone: ${prof.phone || 'N/A'} | Location: ${prof.location || 'N/A'}
- Social Links: GitHub: ${prof.githubUrl || 'N/A'} | LinkedIn: ${prof.linkedinUrl || 'N/A'} | Portfolio: ${prof.portfolioUrl || 'N/A'}
- Degree College / University: ${col.collegeName || 'Not specified'}
- Degree & Branch: ${col.degree || 'Not specified'} ${col.branch ? `(${col.branch})` : ''}
- College CGPA: ${col.overallCgpa || 'Not specified'} | Graduation Year: ${col.graduationYear || 'Not specified'}
- Semester Marks (Sem 1 to 8): Sem 1: ${sMarks.sem1 || '-'}, Sem 2: ${sMarks.sem2 || '-'}, Sem 3: ${sMarks.sem3 || '-'}, Sem 4: ${sMarks.sem4 || '-'}, Sem 5: ${sMarks.sem5 || '-'}, Sem 6: ${sMarks.sem6 || '-'}, Sem 7: ${sMarks.sem7 || '-'}, Sem 8: ${sMarks.sem8 || '-'}
- 10th Standard: School: ${prof.education?.tenth?.schoolName || 'N/A'} | Marks: ${prof.education?.tenth?.marks || 'N/A'}
- 12th Standard: School: ${prof.education?.twelfth?.schoolName || 'N/A'} | Marks: ${prof.education?.twelfth?.marks || 'N/A'}
- Technical Skills (${skills.length}): ${skills.length > 0 ? skills.join(', ') : 'None recorded yet'}
- Portfolio Projects (${projs.length}):
${projs.length > 0 ? projs.map((p, i) => `  [Project #${i + 1}] Title: "${p.title}" | Tech: ${p.techStack || 'N/A'} | Link: ${p.projectUrl || 'N/A'} | Dates: ${p.startDate || ''} to ${p.finishDate || ''} | Description: ${p.description || 'N/A'}`).join('\n') : '  None recorded yet'}
- Certifications (${certs.length}):
${certs.length > 0 ? certs.map((c, i) => `  [Cert #${i + 1}] Name: "${c.name}" | Issuer: ${c.issuer || 'N/A'} | Date: ${c.issueDate || 'N/A'} | Link: ${c.credentialUrl || 'N/A'}`).join('\n') : '  None recorded yet'}`;
    };

    const profileSummary = formatFullProfileDossier(userProfile);

    const systemPrompt = `You are Zuno, an expert AI Job Application Tracker and Career Advisor Assistant at JobTrackerAI.
Your name is Zuno. Always introduce or refer to yourself as Zuno when asked about your identity.

REAL-TIME CLOCK, CURRENT DATE & TIME (ACCURATE RIGHT NOW):
- Current Live Time: ${fullTimeStr} (${effectiveTimeZone})
- Today's Date: ${fullDateStr}
- Day of the Week: ${dayOfWeek}
- ISO Date Reference: ${today}

CORE TIME & DATE INTELLIGENCE:
1. You are 100% aware of the current exact time, day, and date.
2. If the user asks about the time ("what time is it?", "current time"), day ("what day is today?"), date ("what is today's date?"), or any time calculation, answer them directly, accurately, and naturally based on the Live Time and Date above!
3. If the user specifies when an application was submitted (e.g. "applied yesterday", "applied 2 hours ago", "applied last Friday", "applied on 3rd Oct at 4 PM"), compute the exact appliedDate and appliedTime relative to right now (${fullTimeStr}, ${today}).

CRITICAL APPLIED DATE & TIME RULE:
If the user specifies when they applied (e.g. "applied last week", "applied 3 days ago", "applied yesterday", "applied on 2nd Oct", "applied at 2:30 PM", "confirmation email date"), CALCULATE and return the exact YYYY-MM-DD appliedDate and appliedTime relative to right now (${today}, ${fullTimeStr})! Only default appliedDate to ${today} and appliedTime to "${fullTimeStr.replace(/:\d{2}\s/, ' ')}" if no past application timeframe was mentioned.

Your capabilities:
1. JOB EXTRACTION (STRICTLY NO UNSOLICITED INTERVIEW QUESTIONS): When user pastes a Job Description (JD), link, or status update:
   - Extract companyName, roleTitle, jobType, workMode, location, salary, source, portalName, applicationUrl, sourceUrl, status, appliedDate, appliedTime, skills, notes.
   - STRICT REQUIREMENT: DO NOT generate interview questions, interview rounds, or prep advice in "message". The user did NOT ask for interview questions!
   - In "message", present a simple, clean JD breakdown: Role, Company, Location, Compensation, Key Skills, and state that it is tracked. Inform the user they can type /interview Qs for targeted interview questions or /apply when submitted.
   - DUAL LINK RULE: If user found/saw the job on Indeed, LinkedIn, or a job board, but applied/filled the form on an official company portal or ATS (Greenhouse, Workday, Lever, etc.):
     * Set "source" to discovery platform (e.g. Indeed, LinkedIn) and "sourceUrl" to the listing URL.
     * Set "portalName" to portal name (e.g. Company Portal, Greenhouse, Workday) and "applicationUrl" to the form/portal URL.
     * Never drop or overwrite either URL! Preserve both.
   - Return this in the "data" object.
2. PERSISTENT DATABASE & SESSION QUERYING:
   - You have direct access to the user's persistent backend database (${allApplications.length} applications stored) and active session instance!
   - When asked about their applications, history, stats, counts, interviews, offers, or specific companies they applied to:
     * Answer directly, accurately, and thoroughly using the database records.
     * Set "data": null.
3. PROFILE / ABOUT ME INTELLIGENCE & ACCESS / EDITING:
   - You have direct, live access to the candidate's degree college name, degree, branch, CGPA, semester marks (1-8), 10th/12th education, technical skills, projects, and certifications in "USER PROFILE"!
   - When user asks ANY question about their profile (e.g., "what is my college name?", "which college do I attend?", "what is my degree?", "what are my sem marks?", "what technical skills do I have?", "what projects have I built?", "what certifications do I have?"):
     * Answer accurately, warmly, and comprehensively using their actual data from the dossier.
     * Set "data": null and "profileUpdate": null.
   - When user tells you to add, edit, update, or remove details from their About Me profile:
     * Confirm enthusiastically in "message", set "data": null, and provide "profileUpdate" in JSON output:
       - Degree College / Academics: { "type": "update_college", "collegeName": "...", "degree": "...", "branch": "...", "overallCgpa": "...", "graduationYear": "..." }
       - Technical Skills: { "type": "add_skills", "skills": ["..."] } (or single "skill": "..."), { "type": "remove_skill", "skill": "..." }, { "type": "set_skills", "skills": ["..."] }
       - Projects:
         * Add: { "type": "add_project", "project": { "title": "...", "description": "...", "techStack": "...", "projectUrl": "...", "startDate": "...", "finishDate": "..." } }
         * Edit: { "type": "edit_project", "targetTitle": "...", "project": { "title": "...", "description": "...", "techStack": "...", "projectUrl": "...", "startDate": "...", "finishDate": "..." } }
         * Delete: { "type": "delete_project", "targetTitle": "..." }
       - Certifications:
         * Add: { "type": "add_certification", "certification": { "name": "...", "issuer": "...", "issueDate": "...", "credentialUrl": "..." } }
         * Edit: { "type": "edit_certification", "targetName": "...", "certification": { "name": "...", "issuer": "...", "issueDate": "...", "credentialUrl": "..." } }
         * Delete: { "type": "delete_certification", "targetName": "..." }
       - Semester marks: { "type": "update_sem_marks", "sem": "sem1" to "sem8", "score": "..." }
       - 10th/12th: { "type": "update_education_10th"|"update_education_12th", "schoolName": "...", "board": "...", "marks": "...", "year": "..." }
       - Personal details: { "type": "update_personal", "fullName": "...", "headline": "...", "bio": "...", "email": "...", "phone": "...", "location": "...", "githubUrl": "...", "linkedinUrl": "...", "portfolioUrl": "..." }
     * STRICT URL ROUTING RULE:
       - If user provides a GitHub link, assign it to "githubUrl" in update_personal. NEVER put it in "bio"!
       - If user provides a LinkedIn link, assign it to "linkedinUrl" in update_personal. NEVER put it in "bio"!
       - If user provides a Portfolio or personal website link, assign it to "portfolioUrl" in update_personal. NEVER put it in "bio"!
       - The "bio" field is ONLY for professional summary / self-introduction text. Do NOT dump URLs into "bio".
4. CAREER & COMPANY QUESTIONS: When user asks questions about a company, interview questions, role expectations, or career tips:
   - Provide a comprehensive, structured, and insightful markdown answer in "message".
   - Set "data": null.
5. CANDIDATE PROFILE VS COMPANY REQUIREMENTS COMPARISON ("/compare" COMMAND):
   - ONLY when user explicitly uses "/compare" (or asks to compare their profile against company requirements):
     * Compare candidate's About Me data (education, sem 1-8 marks, projects with tech and finish dates, certs, skills) against company requirements.
     * Format a rich Markdown report with Match Score %, Skills alignment table (matched vs missing), Projects fit, Academic review, Strengths, and Gap preparation.
     * Set "data": null and "profileUpdate": null.
6. INTERVIEW QUESTIONS COMMAND ("/interview Qs" COMMAND):
   - ONLY when user explicitly types "/interview Qs", "/interview questions", or asks for interview questions for a role/company:
     * Provide focused, high-value interview questions: Technical questions on role stack, System design / practical scenarios, Behavioral questions (STAR format), and reverse questions for the interviewer.
     * Set "data": null and "profileUpdate": null.
7. APPLICATION VIEWED / RECRUITER SEEN NOTIFICATIONS ("Recruiter has seen my application", "Your application was viewed", "Resume downloaded", etc.):
   - When user pastes an email snippet or update that a recruiter or employer viewed or saw their application:
     * Match with "Current Active Job in Session" or "PERSISTENT BACKEND DATABASE" (matching companyName or roleTitle).
     * If matched or company is extracted, update that application, keep status as "Applied", set "viewedAt": "${today} at ${fullTimeStr}", and append "[Recruiter viewed application on ${today} at ${fullTimeStr}]: Recruiter reviewed application" to "notes". Return this application in "data".
     * If no company was mentioned and multiple applications exist, list the recent applications and ask which company it belongs to, setting "data": null.
     * In "message", congratulate them on engagement, explain the screening milestone, and provide proactive advice.

7. CONVERSATION CONTINUITY & CONTEXTUAL FOLLOW-UPS:
   - Always maintain conversational continuity using CONVERSATION HISTORY.
   - If the user sends follow-up requests (e.g. "show all", "list them", "show them", "where did i apply", "what are they", "yes", "tell me more"), understand their intent in context with prior messages!
   - For example, if you or the user previously discussed total application counts/stats and the user follows up with "show all", list their stored applications from the database in a clean markdown table.

8. GREETINGS & CASUAL HELLOS:
   - When the user sends a greeting (e.g., "hi", "hello", "hey", "good morning"):
     * Do NOT output long feature bullet lists or tutorials.
     * Respond concisely:
       "👋 **Hello!** I'm **Zuno**, your **JobTrackerAI** assistant.\n\nToday is **${fullDateStr}** and the current time is **${fullTimeStr}**.\nYou have applied to **${(allApplications || []).length} application${(allApplications || []).length === 1 ? '' : 's'}** till today."
     * Set "data": null and "profileUpdate": null.

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

Return ONLY valid JSON matching this schema:
{
  "message": "Your rich, formatted markdown answer to the user",
  "data": { ... } or null,
  "profileUpdate": { ... } or null
}`;

    const recentHistory = Array.isArray(history) ? history.slice(-8) : [];
    const historyContext = recentHistory.length > 0
      ? `CONVERSATION HISTORY (Last ${recentHistory.length} turns):\n` +
        recentHistory.map(m => `${m.role === 'user' ? 'User' : 'Zuno'}: ${m.text || m.content || ''}`).join('\n')
      : 'CONVERSATION HISTORY: (None - start of conversation)';

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
            work_model: { type: "STRING", enum: ["Remote", "Hybrid", "On-site", "Unknown"] },
            workMode: { type: "STRING" },
            jobType: { type: "STRING" },
            location: { type: "STRING", nullable: true },
            min_experience_years: { type: "NUMBER", nullable: true },
            max_experience_years: { type: "NUMBER", nullable: true },
            is_fresher_eligible: { type: "BOOLEAN", nullable: true },
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
            skills: {
              type: "ARRAY",
              items: { type: "STRING" }
            },
            application_url: { type: "STRING", nullable: true },
            source_url: { type: "STRING", nullable: true },
            portalName: { type: "STRING", nullable: true },
            source: { type: "STRING", nullable: true },
            status: { type: "STRING", nullable: true },
            appliedDate: { type: "STRING", nullable: true },
            appliedTime: { type: "STRING", nullable: true },
            deadline: { type: "STRING", nullable: true },
            recruiterName: { type: "STRING", nullable: true },
            interviewQuestions: {
              type: "ARRAY",
              items: { type: "STRING" }
            },
            callNotes: { type: "STRING", nullable: true },
            notes: { type: "STRING", nullable: true }
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
              text: `${systemPrompt}\n\n${historyContext}\n\nPERSISTENT BACKEND DATABASE:\n${databaseSummary}\n\nUSER PROFILE:\n${profileSummary}\n\nCurrent Active Job in Session (if any):\n${existingJob ? JSON.stringify(existingJob, null, 2) : 'None (Fresh Session)'}\n\nUser Message:\n"${cleanedText}"`
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

    const candidateModels = [
      settings.geminiModel,
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-1.5-flash'
    ].filter(Boolean);

    let lastError = null;
    let candidateText = null;

    const startTime = Date.now();
    for (const m of candidateModels) {
      if (Date.now() - startTime > 20000) break;
      const controller = new AbortController();
      const perModelTimer = setTimeout(() => controller.abort(), 12000);

      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        });
        clearTimeout(perModelTimer);

        if (response.ok) {
          const data = await response.json();
          candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (candidateText) break;
        } else {
          const errorData = await response.json().catch(() => ({}));
          lastError = errorData.error?.message || response.statusText;
        }
      } catch (e) {
        clearTimeout(perModelTimer);
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

    const now = new Date();
    const effectiveTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
    const fullTimeStr = now.toLocaleTimeString('en-US', { timeZone: effectiveTimeZone, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    const fullDateStr = now.toLocaleDateString('en-US', { timeZone: effectiveTimeZone, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const dayOfWeek = now.toLocaleDateString('en-US', { timeZone: effectiveTimeZone, weekday: 'long' });
    let today = '';
    try {
      today = new Intl.DateTimeFormat('en-CA', { timeZone: effectiveTimeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    } catch {
      today = now.toISOString().split('T')[0];
    }

    const databaseSummary = Array.isArray(allApplications) && allApplications.length > 0
      ? allApplications.map((a, i) => `#${i+1}: ${a.companyName || 'Unknown'} | Role: ${a.roleTitle || 'Undisclosed'} | Status: ${a.status || 'Applied'} | Salary: ${a.salary || 'N/A'} | Applied: ${a.appliedDate || 'N/A'}${a.appliedTime ? ' ' + a.appliedTime : ''}`).join('\n')
      : '0 applications in database.';

    const systemPrompt = `You are Zuno, an expert AI Job Application Tracker and Career Advisor Assistant at JobTrackerAI.
Your name is Zuno.

REAL-TIME CLOCK, CURRENT DATE & TIME (ACCURATE RIGHT NOW):
- Current Live Time: ${fullTimeStr} (${effectiveTimeZone})
- Today's Date: ${fullDateStr}
- Day of the Week: ${dayOfWeek}
- ISO Date Reference: ${today}

CORE TIME & DATE INTELLIGENCE:
1. You are 100% aware of the current exact time, day, and date.
2. If the user asks about the time ("what time is it?", "current time"), day ("what day is today?"), date ("what is today's date?"), or any time calculation, answer them directly, accurately, and naturally based on the Live Time and Date above!
3. If the user specifies when an application was submitted, compute the exact appliedDate and appliedTime relative to right now (${fullTimeStr}, ${today}).

You have direct live access to the user's persistent backend database (${allApplications.length} applications stored) and active session instance!
When user asks about past applications, statistics, interview status, specific applied companies, or advice: provide a comprehensive markdown answer using the database records in "message" and set "data": null.
When user asks you to add projects, certifications, semester marks, or update profile: return structured "profileUpdate" in JSON and set "data": null.
When user asks to compare profile vs company requirements using "/compare": provide a comprehensive comparative analysis (Match score %, skills match vs missing, projects alignment, sem marks & education review, strengths, gap plan) and set "data": null.
When user pastes a job description (JD) or update: extract the job details in "data" including companyName, roleTitle, jobType, workMode, location, salary, source, portalName, applicationUrl, sourceUrl, status, appliedDate, appliedTime, skills, notes. (If user saw on Indeed/LinkedIn but applied on company portal, capture discovery link in sourceUrl and form link in applicationUrl and portal name in portalName).
When user greets or says hi/hello: respond concisely with "👋 **Hello!** I'm **Zuno**, your **JobTrackerAI** assistant.\n\nToday is **${fullDateStr}** and the current time is **${fullTimeStr}**.\nYou have applied to **${(allApplications || []).length} application${(allApplications || []).length === 1 ? '' : 's'}** till today." and set data: null without verbose bullet lists.
Maintain conversational continuity using CONVERSATION HISTORY. If user gives follow-up instructions (e.g. "show all", "list them", "where did i apply"), understand context from previous turns and list applications from PERSISTENT BACKEND DATABASE.
Return JSON with { "message": "...", "data": { ... } or null, "profileUpdate": { ... } or null }.`;

    const recentHistory = Array.isArray(history) ? history.slice(-8) : [];
    const historyContext = recentHistory.length > 0
      ? `CONVERSATION HISTORY (Last ${recentHistory.length} turns):\n` +
        recentHistory.map(m => `${m.role === 'user' ? 'User' : 'Zuno'}: ${m.text || m.content || ''}`).join('\n')
      : 'CONVERSATION HISTORY: (None - start of conversation)';

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
            content: `${historyContext}\n\nPERSISTENT BACKEND DATABASE:\n${databaseSummary}\n\nUSER PROFILE:\n${userProfile ? JSON.stringify(userProfile) : 'None'}\n\nActive Job in Session: ${existingJob ? JSON.stringify(existingJob) : 'None'}\n\nUser Input: ${text}`
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
  extractWithHeuristics(text, existingJob = null, allApplications = [], userProfile = null, history = []) {
    const trimmed = text.trim();
    const lower = trimmed.toLowerCase();
    const isJD = this.isJobDescription(text);
    const isViewedNotification = this.isApplicationNotification(text);
    const isFollowUpToViewed = Array.isArray(history) && history.length > 0 &&
      history.slice(-2).some(m => m.role === 'assistant' && /(?:recruiter\s+(?:viewed|seen)\s+notification|which\s+of\s+your\s+(?:recent\s+|tracked\s+)?applications\s+was\s+this\s+for)/i.test(m.text || ''));

    // If NOT a job description AND not an application viewed notification, check for conversational shortcuts, greetings, and utility widgets
    if (!isJD && !isViewedNotification && !isFollowUpToViewed) {
      // 0. Check for /compare command
      const isCompareCommand = /^\/(?:compare|cmp)\b/i.test(trimmed) || /^(?:compare\s+(?:me|my\s+profile|profile)\b)/i.test(lower);
      if (isCompareCommand) {
        const queryTarget = trimmed.replace(/^\/(?:compare|cmp)\s*/i, '').replace(/^(?:compare\s+(?:me|my\s+profile|profile)(?:\s+(?:with|to|against))?\s*)/i, '').trim();
        return this.generateProfileJobComparison(userProfile, existingJob, queryTarget, allApplications);
      }

      // 0b. Check for /interview Qs command
      const isInterviewQsCmd = /^\/(?:interview[\s_-]?qs?|interview\s*questions|questions)\b/i.test(trimmed) ||
        /^(?:interview\s+questions?|give\s+(?:me\s+)?interview\s+questions?|practice\s+questions?)\b/i.test(lower);
      if (isInterviewQsCmd) {
        const queryTarget = trimmed
          .replace(/^\/(?:interview[\s_-]?qs?|interview\s*questions|questions)\s*/i, '')
          .replace(/^(?:interview\s+questions?|give\s+(?:me\s+)?interview\s+questions?|practice\s+questions?)(?:\s+(?:for|at|on))?\s*/i, '')
          .trim();
        return this.generateInterviewQuestions(existingJob, queryTarget, allApplications, userProfile);
      }

      // 1. Check for greetings
      const isGreeting = /^(?:hi|hello|hey|hiya|howdy|good\s*(?:morning|afternoon|evening)|sup|yo|hola)(?:\s+zuno)?\b[!?. ]*$/i.test(trimmed);
      if (isGreeting) {
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        const appsList = (Array.isArray(allApplications) && allApplications.length > 0)
          ? allApplications
          : (typeof window !== 'undefined' && Array.isArray(window.app?.applications) ? window.app.applications : []);
        const totalApps = appsList.length;

        const countText = totalApps === 0
          ? "You haven't applied to any applications yet."
          : `You have applied to **${totalApps} application${totalApps === 1 ? '' : 's'}** till today.`;

        return {
          message: `👋 **Hello!** I'm **Zuno**, your **JobTrackerAI** assistant.\n\nToday is **${dateStr}** and the current time is **${timeStr}**.\n${countText}`,
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
          message: "I'm **Zuno**, doing great and ready to help you track your applications and prep for interviews! 🚀 How can I help you today?",
          data: null
        };
      }

      // 3b. Real-Time Clock & Date Queries
      const { isTime: isTimeQuery, isDate: isDateQuery } = this.checkTimeOrDateQuery(text);

      if (isTimeQuery || isDateQuery) {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
        const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const dayStr = now.toLocaleDateString('en-US', { weekday: 'long' });
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
        const isoDateStr = new Intl.DateTimeFormat('en-CA').format(now);

        return {
          message: `🕒 **Real-Time Clock & Date**:\n\n` +
            `- **Current Time**: **${timeStr}** (${tz})\n` +
            `- **Today's Date**: **${dateStr}**\n` +
            `- **Day of the Week**: **${dayStr}**\n\n` +
            `*Real-time active clock synchronized for accurate job application tracking, deadlines, and relative dates.*`,
          data: null,
          cardType: 'time_date',
          cardData: {
            time: timeStr,
            date: dateStr,
            day: dayStr,
            timeZone: tz,
            isoDate: isoDateStr,
            timestamp: now.toISOString()
          }
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

      // 5. Check for Casual affirmations, compliments & small talk
      const isAffirmation = /^(?:nice(?:\s+(?:one|work|job|table|list))?|cool(?:\s+(?:thanks|one))?|great(?:\s+(?:job|work))?|awesome|sweet|super|superb|amazing|neat|wonderful|fantastic|brilliant|perfect|good(?:\s+(?:job|work|one))?|very\s+good|looks\s+good|sounds\s+good|love\s+it|loved\s+it|wow|woah|appreciated|much\s+appreciated|thanks(?:\s+a\s+lot|\s+so\s+much|\s+zuno)?|thank\s+you(?:\s+so\s+much|\s+very\s+much|\s+zuno)?|thx|ty|tysm|ok|okay|alright|all\s+right|fine|fair\s+enough|understood|got\s+it|gotcha|noted|makes\s+sense|i\s+see|clear|yep|yeah|yes|sure|definitely|absolutely|yup|haha|lol|lmao|hehe|good\s+bot|you('re|\s+are)\s+(?:awesome|great|cool|the\s+best))\b[!?. ]*$/i.test(trimmed);

      if (isAffirmation) {
        const lastAssistantMsg = Array.isArray(history) && history.length > 0
          ? (history.filter(m => m.role === 'assistant').slice(-1)[0]?.text || '')
          : '';

        const justShowedList = /(?:Stored Applications in Your Database|applications? in your (?:database|tracker)|Company.*Role.*Status)/i.test(lastAssistantMsg);
        const justShowedStats = /(?:Your Persistent Job Tracker Stats|Total Tracked Applications)/i.test(lastAssistantMsg);
        const justUpdatedProfile = /(?:Project Added|Academic Record|Semester Marks|Candidate Dossier)/i.test(lastAssistantMsg);
        const justExtractedJob = /(?:Successfully extracted job details|Updated \*\*)/i.test(lastAssistantMsg);

        let replyMsg = "Glad to help! 😊 Feel free to paste a Job Description to track, ask me about any company (*'Tell me about Samsung'*), or let me know what you'd like to do next.";

        if (justShowedList) {
          replyMsg = "Glad you liked the list! 🚀 Whenever you're ready, you can paste another Job Description to track it, ask about any specific company (*'Tell me about Stripe'*), or filter by interviews.";
        } else if (justShowedStats) {
          replyMsg = "Awesome! You're making steady progress in your job search. Type **'Show all'** to see the full list of roles, or let me know if you want interview tips!";
        } else if (justUpdatedProfile) {
          replyMsg = "You're very welcome! Your About Me profile is updated and ready. Let me know whenever you want to add more projects, certifications, or marks.";
        } else if (justExtractedJob) {
          replyMsg = "Glad to help! You can type **/store** to permanently save this application to your database, or paste another job description!";
        }

        return {
          message: replyMsg,
          data: null
        };
      }

      // 5b. Jokes
      if (/^(?:tell\s+me\s+a\s+joke|joke|make\s+me\s+laugh)\b/i.test(lower)) {
        const jokes = [
          "Why do programmers prefer dark mode? Because light attracts bugs! 🐛😄\n\nWhenever you're ready, paste a JD or ask about any company!",
          "Why did the developer quit their job? Because they didn't get arrays! 😂\n\nLet me know if you want to track an application or prepare for interview rounds!",
          "There are 10 types of people in the world: those who understand binary, and those who don't! 💻\n\nHow can I help with your job search today?"
        ];
        return {
          message: jokes[Math.floor(Math.random() * jokes.length)],
          data: null
        };
      }

      // 5c. What next / guidance
      if (/^(?:what\s+(?:should|can)\s+(?:we|i)\s+do(?:\s+next)?|what\s+next|next\s+step[s]?)\b/i.test(lower)) {
        return {
          message: "Here are great next steps we can take:\n\n1. **Track a Job**: Paste any job description or application email.\n2. **Inspect Applications**: Ask *'Show all applications'* or *'Did I apply to Stripe?'*.\n3. **Interview Preparation**: Ask *'What interview questions will they ask for [Company]?'*.\n4. **Update Profile**: Tell me your latest project, certification, or semester marks.\n\nWhat would you like to do?",
          data: null
        };
      }

      // 5d. Friendly sign-offs
      if (/^(?:bye|goodbye|see\s+you|cya|take\s+care|good\s*night)\b[!?. ]*$/i.test(trimmed)) {
        return {
          message: "Goodbye for now! 👋 Best of luck with your job hunt and interview preparation. I'll be here whenever you need me!",
          data: null
        };
      }
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

    // F. College Name & Degree / Branch / CGPA
    const collegeMatch = trimmed.match(/(?:(?:my\s+)?(?:degree\s+)?college(?:\s+name)?|i\s+(?:study|studied|went)\s+(?:at|to)|degree\s+at|university(?:\s+name)?)\s*(?:is|:|=|\s+to)?\s*([a-zA-Z0-9\s\.\,\'\-]+?)(?:,|\.|$)/i)
      || trimmed.match(/^(?:set|update|change|add)?\s*(?:degree\s+)?college(?:\s+name)?\s*[:\-=]\s*(.+)$/i);
    if (collegeMatch) {
      const colName = collegeMatch[1].replace(/^(?:to|is)\s+/i, '').replace(/^[:\-=]\s*/, '').trim();
      return {
        message: `### 🏛️ Degree College Updated!\n\nRecorded **${colName}** as your degree college in your **About Me** academic dossier.`,
        profileUpdate: {
          type: 'update_college',
          collegeName: colName
        },
        data: null
      };
    }

    // F2. Technical Skills Add / Update
    const addSkillsMatch = trimmed.match(/^(?:add\s+(?:technical\s+|tech\s+)?skills?|my\s+(?:technical\s+|tech\s+)?skills?\s+(?:are|is|include)|skills?)\s*[:\-=]?\s*(.+)$/i);
    if (addSkillsMatch) {
      const raw = addSkillsMatch[1].replace(/^[:\-=]\s*/, '').trim();
      const skillsArr = raw.split(/[,;\n]+/).map(s => s.trim().replace(/^and\s+/i, '')).filter(Boolean);
      return {
        message: `### 🛠️ Technical Skills Updated!\n\nAdded **${skillsArr.join(', ')}** to your technical skills in your **About Me** profile.`,
        profileUpdate: {
          type: 'add_skills',
          skills: skillsArr
        },
        data: null
      };
    }

    // F3. Remove Technical Skill
    const removeSkillMatch = trimmed.match(/^(?:remove|delete)\s+(?:skill|technical\s+skill)\s*[:\-]?\s*(.+)$/i);
    if (removeSkillMatch) {
      const skillName = removeSkillMatch[1].trim();
      return {
        message: `### 🗑️ Technical Skill Removed!\n\nRemoved **${skillName}** from your technical skills in your About Me profile.`,
        profileUpdate: {
          type: 'remove_skill',
          skill: skillName
        },
        data: null
      };
    }

    // F4. Delete Project
    const deleteProjMatch = trimmed.match(/^(?:delete|remove)\s+project\s*[:\-]?\s*(.+)$/i);
    if (deleteProjMatch) {
      const projTitle = deleteProjMatch[1].trim();
      return {
        message: `### 🗑️ Project Removed!\n\nRemoved project **"${projTitle}"** from your portfolio.`,
        profileUpdate: {
          type: 'delete_project',
          targetTitle: projTitle
        },
        data: null
      };
    }

    // F5. Delete Certification
    const deleteCertMatch = trimmed.match(/^(?:delete|remove)\s+cert(?:ification)?\s*[:\-]?\s*(.+)$/i);
    if (deleteCertMatch) {
      const certName = deleteCertMatch[1].trim();
      return {
        message: `### 🗑️ Certification Removed!\n\nRemoved certification **"${certName}"** from your profile.`,
        profileUpdate: {
          type: 'delete_certification',
          targetName: certName
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

    // K. Querying Profile Information (College, Skills, Projects, Certifications, Marks)
    const isCollegeQuery = /\b(what(?:\s+is)?\s+my\s+(?:degree\s+)?college|which\s+(?:degree\s+)?college|my\s+college\s+name|what\s+is\s+my\s+degree|what\s+degree\s+do\s+i|where\s+did\s+i\s+(?:study|graduate)|my\s+university)\b/i.test(lower);
    const isSkillsQuery = /\b(what(?:\s+are)?\s+my\s+(?:technical\s+|tech\s+)?skills|show\s+my\s+skills|list\s+my\s+skills|my\s+tech\s+stack|what\s+skills\s+do\s+i\s+have|my\s+skills)\b/i.test(lower);
    const isCertQuery = /\b(what(?:\s+are)?\s+my\s+certifications?|show\s+my\s+certifications?|list\s+my\s+certifications?|my\s+certificates?|my\s+certs)\b/i.test(lower);
    const isProjectQuery = /\b(what\s+projects\s+(?:have\s+i|did\s+i)\s+(?:done|built|make)|show\s+my\s+projects|list\s+my\s+projects|my\s+projects|portfolio\s+projects)\b/i.test(lower);
    const isSemQuery = /\b(what\s+are\s+my\s+sem\s+marks|show\s+my\s+sem\s+marks|my\s+semester\s+marks|sem\s+marks|sgpa)\b/i.test(lower);
    const isGeneralProfileQuery = /\b(show\s+(?:my\s+)?profile|what\s+is\s+my\s+profile|tell\s+me\s+about\s+my\s+profile|my\s+education|summarize\s+my\s+profile|my\s+dossier)\b/i.test(lower);

    if (isCollegeQuery || isSkillsQuery || isCertQuery || isProjectQuery || isSemQuery || isGeneralProfileQuery) {
      const prof = userProfile || Config.getUserProfile();
      const col = prof.education?.college || {};

      if (isCollegeQuery) {
        return {
          message: `### 🏛️ Your Degree College & Academics:\n\n` +
            `- **College / University:** **${col.collegeName || 'Not recorded yet'}**\n` +
            `- **Degree:** ${col.degree || 'Not recorded yet'}\n` +
            `- **Branch / Specialization:** ${col.branch || 'Not recorded yet'}\n` +
            `- **Overall CGPA:** ${col.overallCgpa || 'Not recorded yet'}\n` +
            `- **Graduation Year:** ${col.graduationYear || 'Not recorded yet'}\n\n` +
            `*You can update this on your **About Me** page or tell me: "My college is [College Name]"*`,
          data: null
        };
      } else if (isSkillsQuery) {
        const skills = Array.isArray(prof.skills) ? prof.skills : [];
        if (skills.length === 0) {
          return {
            message: `You don't have any technical skills listed in your **About Me** profile yet. You can say *\"Add skills: React, TypeScript, Python, Node.js\"* or add them directly in the About Me tab!`,
            data: null
          };
        }
        return {
          message: `### 🛠️ Your Technical Skills (${skills.length}):\n\n` +
            skills.map(s => `- \`${s}\``).join('\n') + `\n\n` +
            `*To add more, say: "Add skills: Docker, AWS" or edit on the About Me tab.*`,
          data: null
        };
      } else if (isCertQuery) {
        const certs = Array.isArray(prof.certifications) ? prof.certifications : [];
        if (certs.length === 0) {
          return {
            message: `You don't have any certifications recorded in your **About Me** profile yet. You can say *\"Add certification: AWS Solutions Architect by Amazon\"* or add one in the About Me tab!`,
            data: null
          };
        }
        let msg = `### 📜 Your Certifications (${certs.length}):\n\n`;
        certs.forEach((c, idx) => {
          msg += `${idx + 1}. **${c.name}**\n` +
            `   - **Issuer:** ${c.issuer || 'Verified Org'}\n` +
            (c.issueDate ? `   - **Date:** ${c.issueDate}\n` : '') +
            (c.credentialUrl ? `   - **Credential Link:** [Verify Badge](${c.credentialUrl})\n` : '') + '\n';
        });
        return { message: msg, data: null };
      } else if (isProjectQuery) {
        const projs = Array.isArray(prof.projects) ? prof.projects : [];
        if (projs.length === 0) {
          return {
            message: `You don't have any projects saved in your **About Me** profile yet. You can say *\"Add project: JobTrackerAI with React and Node\"* or add them in the About Me tab!`,
            data: null
          };
        }
        let msg = `### 💻 Your Portfolio Projects (${projs.length}):\n\n`;
        projs.forEach((p, idx) => {
          msg += `${idx + 1}. **${p.title}**\n` +
            `   - **Tech Stack:** ${p.techStack || 'N/A'}\n` +
            (p.projectUrl ? `   - **Link:** [Open Project](${p.projectUrl})\n` : '') +
            (p.finishDate ? `   - **Completed:** ${p.finishDate}\n` : '') +
            (p.description ? `   - **Description:** ${p.description}\n` : '') + '\n';
        });
        return { message: msg, data: null };
      } else if (isSemQuery) {
        const s = col.semesterMarks || {};
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
            `*College: **${col.collegeName || 'N/A'}** (${col.degree || 'N/A'})*`,
          data: null
        };
      } else {
        // Overall profile summary
        const skillsCount = (prof.skills || []).length;
        const projsCount = (prof.projects || []).length;
        const certsCount = (prof.certifications || []).length;
        return {
          message: `### 👤 Candidate Dossier Summary:\n\n` +
            `- **Name:** **${prof.fullName || 'Not specified'}**\n` +
            `- **Headline:** ${prof.headline || 'Not specified'}\n` +
            `- **Degree College:** **${col.collegeName || 'Not specified'}** (${col.degree || 'N/A'} - ${col.branch || 'N/A'})\n` +
            `- **CGPA:** ${col.overallCgpa || 'N/A'} (Grad Year: ${col.graduationYear || 'N/A'})\n` +
            `- **10th Standard:** ${prof.education?.tenth?.marks || 'N/A'} (${prof.education?.tenth?.schoolName || 'N/A'})\n` +
            `- **12th Standard:** ${prof.education?.twelfth?.marks || 'N/A'} (${prof.education?.twelfth?.schoolName || 'N/A'})\n` +
            `- **Technical Skills:** **${skillsCount}** skills tracked\n` +
            `- **Projects Tracked:** **${projsCount}** projects\n` +
            `- **Certifications:** **${certsCount}** credentials\n\n` +
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

    // 7a. Check for Applications Applied Today -> Card Format
    const isTodayCountQuery = !isJD && this.checkTodayCountQuery(text);

    if (isTodayCountQuery) {
      const now = new Date();
      const localTodayStr = new Intl.DateTimeFormat('en-CA').format(now);
      const utcTodayStr = now.toISOString().split('T')[0];
      const todayFormatted = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

      const todayApps = (allApplications || []).filter(a => {
        const d = a.appliedDate || (a.createdAt ? a.createdAt.split('T')[0] : '');
        return d === localTodayStr || d === utcTodayStr;
      });

      const count = todayApps.length;
      const countMsg = count === 0
        ? `You have **not applied to any jobs today** (${todayFormatted}).`
        : `You applied to **${count} job${count === 1 ? '' : 's'} today** (${todayFormatted}).`;

      return {
        message: countMsg,
        data: null,
        cardType: 'today_count',
        cardData: {
          count: count,
          date: todayFormatted,
          isoDate: localTodayStr,
          applications: todayApps.map(a => ({
            id: a.id,
            companyName: a.companyName || 'Unknown Company',
            roleTitle: a.roleTitle || 'Job Title',
            status: a.status || 'Applied',
            salary: a.salary || null,
            workMode: a.workMode || null,
            location: a.location || null,
            appliedTime: a.appliedTime || (a.createdAt ? new Date(a.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : null)
          }))
        }
      };
    }

    // 7b. Check for Applications Graph & Weekly / Monthly Velocity -> Graph Card
    const isGraphQuery = !isJD && this.checkGraphQuery(text);

    if (isGraphQuery) {
      const isMonthWord = /\b(?:(?:last|past)\s+(?:month|30\s*days)|30\s*days|this\s+month)\b/i.test(lower);
      const isMonth = isMonthWord;
      const range = isMonth ? 30 : 7;
      const rangeLabel = isMonth ? 'Last 30 Days (Month)' : 'Last 7 Days (Week)';

      return {
        message: `Here is your **Applications Velocity Graph** for **${rangeLabel}**:`,
        data: null,
        cardType: 'graph',
        cardData: {
          range: range,
          rangeLabel: rangeLabel,
          allApplications: allApplications || []
        }
      };
    }

    // 7c. Check for Database Search (/search or natural search in applications)
    const isSearchExplicit = /^\/(?:search|find)\b/i.test(trimmed);
    const isSearchNatural = !isJD && /\b(?:search(?:\s+(?:for|in|all))?|find(?:\s+(?:my|all))?|lookup)\s+(?:applications?|jobs?|in\s+database|database)\b/i.test(lower);
    if (isSearchExplicit || isSearchNatural) {
      const searchArg = trimmed.replace(/^\/(?:search|find)\s*/i, '')
        .replace(/^(?:search(?:\s+(?:for|in|all))?|find(?:\s+(?:my|all))?|lookup)\s+(?:applications?|jobs?|in\s+database|database)\s*(?:for|about|with)?\s*/i, '')
        .trim();

      const qLower = searchArg.toLowerCase();
      const qTerms = qLower.split(/\s+/).filter(Boolean);

      const allApps = allApplications || [];
      const matched = !searchArg ? [...allApps] : allApps.filter(app => {
        const co = (app.companyName || '').toLowerCase();
        const role = (app.roleTitle || '').toLowerCase();
        const status = (app.status || '').toLowerCase();
        const loc = (app.location || '').toLowerCase();
        const mode = (app.workMode || '').toLowerCase();
        const sal = (app.salary || '').toLowerCase();
        const date = (app.appliedDate || '').toLowerCase();
        const skills = Array.isArray(app.skills) ? app.skills.map(s => String(s).toLowerCase()).join(' ') : '';
        const source = (app.source || '').toLowerCase();
        const notes = (app.notes || app.description || '').toLowerCase();
        const full = `${co} ${role} ${status} ${loc} ${mode} ${sal} ${date} ${skills} ${source} ${notes}`;
        return qTerms.every(t => full.includes(t));
      });

      const statusCounts = { applied: 0, interviewing: 0, offer: 0, rejected: 0, bookmarked: 0 };
      matched.forEach(a => {
        const s = (a.status || 'applied').toLowerCase();
        if (s.includes('interview')) statusCounts.interviewing++;
        else if (s.includes('offer')) statusCounts.offer++;
        else if (s.includes('reject')) statusCounts.rejected++;
        else statusCounts.applied++;
        if (a.isBookmarked || s.includes('bookmark')) statusCounts.bookmarked++;
      });

      return {
        message: searchArg
          ? `Found **${matched.length}** application${matched.length === 1 ? '' : 's'} matching **"${searchArg}"** in your database:`
          : `Showing all **${allApps.length}** applications in your database:`,
        data: null,
        cardType: 'search_results',
        cardData: {
          query: searchArg,
          results: matched,
          totalCount: allApps.length,
          statusCounts
        }
      };
    }

    // 7d. Check for Database Application Statistics & Counts
    const isStatsQuery = !isJD && (
      /\b(?:how\s+many\s+(?:jobs|applications|interviews|offers|did\s+i\s+apply)|application\s+stats|total\s+(?:applications?|jobs?)|job\s+stats|stats|summary\s+of\s+(?:my\s+)?applications?|overview\s+of\s+(?:my\s+)?applications?|how\s+is\s+my\s+job\s+search\s+going)\b/i.test(lower) ||
      lower === '/stats'
    );
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
    const lastAssistantMsg = Array.isArray(history) && history.length > 0 ?
      (history.filter(m => m.role === 'assistant').slice(-1)[0]?.text || '') : '';
    const isFollowUpToStats = /(?:Your Persistent Job Tracker Stats|Total Tracked Applications|Show all applications)/i.test(lastAssistantMsg);

    const isListQuery = !isJD && (
      (isFollowUpToStats && /^(?:show\s+all|list\s+all|show\s+them|list\s+them|show|list|yes|yes\s+please|all|view\s+all|view\s+them|all\s+of\s+them|give\s+me\s+the\s+list)\b/i.test(lower)) ||
      /\b(?:show|list|display|view|get|see)\s+(?:all\s+)?(?:past\s+|stored\s+|my\s+|the\s+)?(?:jobs?|applications?)\b/i.test(lower) ||
      /\b(?:show\s+all|list\s+all|show\s+them|list\s+them|view\s+all|display\s+all)\b/i.test(lower) ||
      /\bwhat\s+(?:jobs|applications)\s+(?:did\s+i|have\s+i)\s+(?:apply|applied|stored|saved)\b/i.test(lower) ||
      /\b(?:where\s+did\s+i\s+apply|what\s+did\s+i\s+apply\s+to|what\s+companies\s+did\s+i\s+apply\s+to|companies\s+i\s+applied\s+to)\b/i.test(lower) ||
      lower === '/list' || lower === 'show all' || lower === 'list all' || lower === 'show them' || lower === 'list them'
    );
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
    const isInterviewFilter = !isJD && (/\b(?:interviews?|interviewing)\b/i.test(lower) && /\b(?:which|what|show|list|any|my|do\s+i\s+have)\b/i.test(lower));
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

    const isOfferFilter = !isJD && (/\b(?:offers?)\b/i.test(lower) && /\b(?:which|what|show|list|any|my|do\s+i\s+have|got)\b/i.test(lower));
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
    // 6b. Recruiter Viewed / Seen Application Notification Flow
    // ==========================================
    if (isViewedNotification || isFollowUpToViewed) {
      const today = new Date().toISOString().split('T')[0];
      const currentTimeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

      // 1. Try to find company name in text
      let targetApp = null;
      let extractedCompany = '';
      let extractedRole = '';

      // Check against allApplications first (direct match of companyName within user text)
      if (Array.isArray(allApplications) && allApplications.length > 0) {
        for (const app of allApplications) {
          const co = (app.companyName || '').trim();
          if (co.length >= 2) {
            const coRegex = new RegExp(`\\b${co.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
            if (coRegex.test(text)) {
              targetApp = app;
              extractedCompany = co;
              break;
            }
          }
        }
      }

      // Check regex patterns for company name in notification text
      if (!targetApp) {
        const prepMatch = text.match(/\b(?:at|from|by|with)\s+([A-Z][a-zA-Z0-9&.\-]*)/);
        const subjectMatch = text.match(/\b([A-Z][a-zA-Z0-9&.\-]*)\s+(?:has\s+)?(?:viewed|reviewed|seen|opened)\s+(?:your|my)\s+application/);
        const appToMatch = text.match(/\b(?:application\s+(?:to|at|for))\s+([A-Z][a-zA-Z0-9&.\-]*)/);

        const cand = (prepMatch && prepMatch[1]) || (subjectMatch && subjectMatch[1]) || (appToMatch && appToMatch[1]);
        if (cand) {
          const stopWords = ['the', 'this', 'a', 'an', 'my', 'your', 'recruiter', 'employer', 'hiring', 'team', 'linkedin', 'indeed', 'glassdoor', 'naukri', 'wellfound'];
          if (cand.length >= 2 && !stopWords.includes(cand.toLowerCase())) {
            extractedCompany = cand.trim();
            if (Array.isArray(allApplications)) {
              targetApp = allApplications.find(a =>
                (a.companyName || '').toLowerCase().includes(extractedCompany.toLowerCase()) ||
                extractedCompany.toLowerCase().includes((a.companyName || '').toLowerCase())
              ) || null;
            }
          }
        }
      }

      // If user is directly answering the follow-up prompt with a company name
      if (!targetApp && isFollowUpToViewed && Array.isArray(allApplications)) {
        const cleanReply = trimmed.toLowerCase().replace(/^(?:it\s+is\s+|it's\s+|for\s+|at\s+)/i, '').trim();
        targetApp = allApplications.find(a =>
          cleanReply.includes((a.companyName || '').toLowerCase()) ||
          (a.companyName || '').toLowerCase().includes(cleanReply)
        ) || null;
      }

      // Extract potential role title if mentioned (e.g. "for Software Engineer at Google")
      const roleMatch = text.match(/(?:for\s+(?:the\s+)?([A-Za-z0-9&.\- /]{2,40})\s+(?:role|position)?\s+at)/i) ||
                        text.match(/\b(Software Engineer|Frontend Engineer|Backend Engineer|Full Stack Developer|Data Scientist|Product Manager|DevOps Engineer|UI\/UX Designer|Machine Learning Engineer|AI Engineer|QA Engineer|Systems Architect|Solutions Architect|Cloud Engineer|Intern)\b/i);
      if (roleMatch) {
        extractedRole = roleMatch[1].trim();
      }

      // If still no targetApp, check if there is an active session job
      if (!targetApp && existingJob && (existingJob.companyName || existingJob.roleTitle)) {
        targetApp = existingJob;
      }

      // If still no targetApp and allApplications has exactly 1 application
      if (!targetApp && Array.isArray(allApplications) && allApplications.length === 1 && !extractedCompany) {
        targetApp = allApplications[0];
      }

      // If still no targetApp:
      if (!targetApp) {
        if (!extractedCompany) {
          if (!Array.isArray(allApplications) || allApplications.length === 0) {
            return {
              message: `### 👀 Recruiter Viewed Notification Detected!\n\nI noticed a recruiter has seen your application!\n\nHowever, you don't have any applications stored in your database yet, and no company name was mentioned in your message.\n\nTo track this, tell me the company name (e.g. *"Recruiter viewed my application for Google"*) or paste the Job Description!`,
              data: null
            };
          } else {
            const recentList = allApplications.slice(-5).reverse().map((a, i) => `${i + 1}. **${a.companyName}** — *${a.roleTitle}* (Applied: ${a.appliedDate || 'N/A'})`).join('\n');
            return {
              message: `### 👀 Recruiter Viewed Notification Detected!\n\nGreat news! A recruiter or hiring team has opened and viewed your application.\n\nHowever, the notification snippet didn't specify the company name. **Which of your recent applications was this for?**\n\n${recentList}\n\n*Simply reply with the company name (e.g. \"${allApplications[allApplications.length - 1].companyName}\") to log this event!*`,
              data: null
            };
          }
        } else {
          // Company was extracted from notification, but not in allApplications -> create new application!
          targetApp = {
            companyName: extractedCompany,
            roleTitle: extractedRole || 'Software Professional',
            jobType: 'Full-time',
            workMode: 'On-site',
            location: 'Not specified',
            salary: 'Not disclosed',
            source: parseJobSource(text) || 'Portal',
            portalName: parsePortalName(text) || '',
            applicationUrl: '',
            sourceUrl: '',
            status: 'Applied',
            appliedDate: parseAppliedDate(text, null) || today,
            appliedTime: currentTimeStr,
            skills: [],
            notes: ''
          };
        }
      }

      // Prepare updated targetData
      const targetData = { ...targetApp };
      targetData.status = targetData.status || 'Applied';
      targetData.viewedAt = `${today} at ${currentTimeStr}`;

      const viewLogEntry = `[Recruiter viewed application on ${today} at ${currentTimeStr}]`;
      if (!targetData.notes || !targetData.notes.includes(`[Recruiter viewed application on ${today}`)) {
        targetData.notes = targetData.notes ? `${targetData.notes}\n${viewLogEntry}` : viewLogEntry;
      }

      const isExistingDbRecord = Array.isArray(allApplications) && allApplications.some(a => a.id === targetData.id);
      const coName = targetData.companyName || 'Target Company';
      const rTitle = targetData.roleTitle || 'Role';

      const respMsg = `### 👀 Application Viewed by Recruiter: **${coName}** (${rTitle})\n\n` +
        `🎉 **Great news!** A recruiter or hiring team has opened and reviewed your application for **${coName}**.\n\n` +
        `📌 **Tracker Updates:**\n` +
        `- **Status:** Kept as \`${targetData.status}\` (Application Viewed)\n` +
        `- **Timeline Log:** Added \`${viewLogEntry}\` to notes\n` +
        `- **Database:** ${isExistingDbRecord ? 'Synced with your existing database record' : 'Drafted new tracked application in session'}\n\n` +
        `💡 **What This Means & Proactive Next Steps:**\n` +
        `- **Resume Passed Initial Screening:** A recruiter opening your application means your profile successfully surfaced through initial screening or ATS filters.\n` +
        `- **Prepare for Initial Contact:** Keep your phone, email, and LinkedIn active. Review the key requirements for **${coName}** in case they reach out for an initial phone screen.\n` +
        `- **Follow-up Window:** If you don't hear back within **5 to 7 business days**, consider sending a brief, polite follow-up message to a recruiter or hiring manager at **${coName}** on LinkedIn!`;

      return {
        message: respMsg,
        data: targetData,
        provider: 'heuristic'
      };
    }

    // ==========================================
    // 7. Job Extraction Flow
    // ==========================================
    const today = new Date().toISOString().split('T')[0];
    const currentTimeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    const detectedDate = parseAppliedDate(text, null);
    const detectedPortal = parsePortalName(text);
    const detectedSource = parseJobSource(text);

    const extractedCompany = extractCompany(text);
    const extractedRole = extractRoleTitle(text);
    const extractedSalary = extractSalary(text);
    const extractedLocation = extractLocation(text);
    const extractedSkills = extractSkills(text);

    // Determine if this is a brand new application draft or updating an existing job
    const isNewJobCommand = /^(https?:\/\/|\/new|job description:|role:)/i.test(text.trim());
    const isDifferentCompany = Boolean(
      existingJob && extractedCompany &&
      existingJob.companyName &&
      existingJob.companyName.trim().toLowerCase() !== extractedCompany.trim().toLowerCase() &&
      !['full', 'target company'].includes(existingJob.companyName.trim().toLowerCase())
    );

    const isNewJob = !existingJob || (isNewJobCommand && (isDifferentCompany || isJD)) || (isDifferentCompany && isJD);

    let summaryNotes = [];

    // Distinguish between submitting an application vs saving an open job opportunity
    const hasAppliedSignal = /\b(?:(?:i\s+)?(?:have\s+|had\s+)?applied|applied\s+(?:on|via|through|today|yesterday|\d)|submitted|submission|sent\s+application|already\s+applied)\b/i.test(text);
    const initialStatus = hasAppliedSignal ? 'Applied' : (detectedDate ? 'Applied' : 'Saved');
    const initialAppliedDate = (hasAppliedSignal || detectedDate) ? (detectedDate || today) : null;

    const data = isNewJob ? {
      companyName: extractedCompany || '',
      roleTitle: extractedRole || '',
      jobType: 'Full-time',
      workMode: 'On-site',
      location: (extractedLocation && extractedLocation !== 'Not specified') ? extractedLocation : 'Not specified',
      salary: extractedSalary || 'Not disclosed',
      source: detectedSource || 'Portal',
      portalName: detectedPortal || '',
      applicationUrl: '',
      sourceUrl: '',
      status: initialStatus,
      appliedDate: initialAppliedDate,
      appliedTime: initialAppliedDate ? currentTimeStr : '',
      skills: extractedSkills || [],
      notes: ''
    } : {
      ...existingJob,
      companyName: extractedCompany || existingJob.companyName || '',
      roleTitle: extractedRole || existingJob.roleTitle || '',
      salary: extractedSalary || existingJob.salary || 'Not disclosed',
      location: (extractedLocation && extractedLocation !== 'Not specified') ? extractedLocation : (existingJob.location || 'Not specified'),
      skills: (extractedSkills && extractedSkills.length > 0)
        ? Array.from(new Set([...(existingJob.skills || []), ...extractedSkills])).slice(0, 10)
        : (existingJob.skills || [])
    };

    if (existingJob && !isNewJob) {
      if (hasAppliedSignal && (!data.status || data.status === 'Saved')) {
        data.status = 'Applied';
        summaryNotes.push('Updated status to Applied.');
      }
      if (detectedDate) {
        data.appliedDate = detectedDate;
        data.status = 'Applied';
      }
      if (detectedSource) data.source = detectedSource;
      if (detectedPortal) data.portalName = detectedPortal;
      if (!data.appliedTime && data.appliedDate) data.appliedTime = currentTimeStr;
    }

    const cleanPortalName = (p) => {
      if (!p) return '';
      const isDateOrTime = /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|today|yesterday|yesturday|tomorrow|\d{1,2}(?:st|nd|rd|th)?|\d{1,2}:\d{2}|am|pm)\b/i.test(p);
      const isSource = /\b(?:indeed|linkedin|naukri|glassdoor|wellfound)\b/i.test(p);
      const isStatus = /\b(?:rejected|not\s+selected|applied|interviewing|offer)\b/i.test(p);
      return (isDateOrTime || isSource || isStatus) ? '' : p;
    };
    if (data.portalName) data.portalName = cleanPortalName(data.portalName);

    if (detectedDate) {
      summaryNotes.push(`Applied date set to ${detectedDate}.`);
    }
    if (detectedSource) {
      summaryNotes.push(`Discovery source set to ${detectedSource}.`);
    }
    if (detectedPortal && cleanPortalName(detectedPortal)) {
      summaryNotes.push(`Application portal set to ${detectedPortal}.`);
    }

    // Detect URLs
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const foundUrls = text.match(urlRegex) || [];
    
    // Explicit pattern matching for discovery link vs application link
    const sourceLinkMatch = text.match(/(?:saw|found|seen|discovered|checked|source|listing|post|posting|job\s*board|indeed|linkedin|glassdoor|naukri)\s*(?:on|in|at|link|url|via)?[:\s]+(https?:\/\/[^\s]+)/i);
    const appLinkMatch = text.match(/(?:filled|applied|application|submit|submitted|company\s*portal|portal|careers?)\s*(?:on|at|in|here|link|url|via)?[:\s]+(https?:\/\/[^\s]+)/i);

    if (sourceLinkMatch) {
      data.sourceUrl = sourceLinkMatch[1].replace(/[.,;!?)]+$/, '');
      const srcName = parseJobSource(data.sourceUrl) || parseJobSource(text);
      if (srcName) data.source = srcName;
      summaryNotes.push('Identified discovery job listing URL.');
    }

    if (appLinkMatch) {
      data.applicationUrl = appLinkMatch[1].replace(/[.,;!?)]+$/, '');
      const portal = parsePortalName(text, data.applicationUrl);
      if (portal && cleanPortalName(portal)) data.portalName = portal;
      summaryNotes.push('Identified application portal URL.');
    }

    // Process general found URLs
    if (foundUrls.length > 0) {
      for (const u of foundUrls) {
        const cleanUrl = u.replace(/[.,;!?)]+$/, '');
        const lowerUrl = cleanUrl.toLowerCase();
        
        const isAggregator = lowerUrl.includes('indeed.com') || lowerUrl.includes('linkedin.com') || lowerUrl.includes('glassdoor.com') || lowerUrl.includes('wellfound.com') || lowerUrl.includes('angel.co') || lowerUrl.includes('naukri.com') || lowerUrl.includes('instahyre.com');
        const isAtsPortal = lowerUrl.includes('greenhouse.io') || lowerUrl.includes('lever.co') || lowerUrl.includes('workday') || lowerUrl.includes('myworkdayjobs') || lowerUrl.includes('ashbyhq.com') || lowerUrl.includes('taleo.net') || lowerUrl.includes('icims.com') || lowerUrl.includes('smartrecruiters.com') || lowerUrl.includes('jobvite.com') || lowerUrl.includes('successfactors.com') || lowerUrl.includes('/apply') || lowerUrl.includes('/careers') || lowerUrl.includes('jobs.');

        if (isAggregator) {
          data.sourceUrl = cleanUrl;
          if (lowerUrl.includes('linkedin.com')) data.source = 'LinkedIn';
          else if (lowerUrl.includes('indeed.com')) data.source = 'Indeed';
          else if (lowerUrl.includes('glassdoor.com')) data.source = 'Glassdoor';
          else if (lowerUrl.includes('wellfound.com') || lowerUrl.includes('angel.co')) data.source = 'Wellfound';
          else if (lowerUrl.includes('naukri.com')) data.source = 'Naukri';
          else if (lowerUrl.includes('instahyre.com')) data.source = 'Instahyre';
        } else if (isAtsPortal) {
          data.applicationUrl = cleanUrl;
          const detectedAts = parsePortalName('', cleanUrl);
          if (detectedAts && cleanPortalName(detectedAts)) data.portalName = detectedAts;
          else if (!data.portalName) data.portalName = 'Company Portal';
        } else {
          if (!data.applicationUrl) {
            data.applicationUrl = cleanUrl;
            if (!data.portalName) data.portalName = parsePortalName(text, cleanUrl) || 'Company Portal';
          } else if (!data.sourceUrl && cleanUrl !== data.applicationUrl) {
            data.sourceUrl = cleanUrl;
          }
        }
      }
      summaryNotes.push(`Processed ${foundUrls.length} web link(s).`);
    }

    // Preserve existing URLs if not overwritten (only when updating existing job)
    if (existingJob && !isNewJob) {
      if (!data.sourceUrl && existingJob.sourceUrl) data.sourceUrl = existingJob.sourceUrl;
      if (!data.applicationUrl && existingJob.applicationUrl) data.applicationUrl = existingJob.applicationUrl;
      if (!data.portalName && existingJob.portalName) data.portalName = cleanPortalName(existingJob.portalName);
      if ((!data.source || data.source === 'Portal' || data.source === 'Direct Portal') && existingJob.source) {
        data.source = existingJob.source;
      }
    }

    // Rejection / Not Selected detection
    const isRejectedSignal = /\b(?:not\s+selected(?:\s+by\s+employer)?|didn'?t\s+get\s+selected|did\s+not\s+get\s+selected|not\s+shortlisted|didn'?t\s+get\s+the\s+job|did\s+not\s+get\s+the\s+job|not\s+hired|turned\s+down|not\s+moving\s+forward|unsuccessful|declined|reject|rejected|rejection|got\s+rejected|was\s+rejected|application\s+rejected|application\s+declined)\b/i.test(text);

    const isOfferSignal = /\b(?:got\s+(?:an?\s+)?offer|received\s+(?:an?\s+)?offer|job\s+offer|offered(?:\s+the\s+role)?)\b/i.test(text) && !text.includes('offer letter requirements') && !isRejectedSignal;

    const isInterviewSignal = /\b(?:interview|interviewing|round\s*\d|technical\s+round|managerial\s+round|hr\s+round|assessment|screening|scheduled\s+an?\s+interview)\b/i.test(text) && !isRejectedSignal;

    // Recruiter Call & Status updates
    const isCallEvent = /(?:got\s+a\s+call|received\s+a\s+call|call\s+from|recruiter\s+called|had\s+a\s+call|screening\s+call|phone\s+screen|interview\s+call|called\s+me)/i.test(text) && !isRejectedSignal;

    if (isRejectedSignal) {
      data.status = 'Rejected';
      summaryNotes.push('Updated status to Rejected (Not selected by employer).');
      const rejLogEntry = `[Status Update on ${today}]: Application marked as Rejected (Not selected by employer).`;
      if (!data.notes || !data.notes.includes(rejLogEntry)) {
        data.notes = data.notes ? `${data.notes}\n${rejLogEntry}` : rejLogEntry;
      }
    } else if (isOfferSignal) {
      data.status = 'Offer';
      summaryNotes.push('Updated status to Offer! 🎉');
    } else if (isCallEvent) {
      data.status = 'Interviewing';
      summaryNotes.push('Updated status to Interviewing based on recruiter call.');

      // Recruiter name detection
      const recMatch = text.match(/(?:recruiter|interviewer|caller|hr|person|called\s+by)\s*(?:named|is|was|called)?\s+([A-Z][a-z]+)/i);
      if (recMatch && recMatch[1] && !['the', 'this', 'a', 'an', 'my', 'some'].includes(recMatch[1].toLowerCase())) {
        data.recruiterName = recMatch[1];
        summaryNotes.push(`Logged recruiter: ${data.recruiterName}.`);
      }

      // Question/topics extraction
      const qMatch = text.match(/(?:asked|inquired|wanted to know|questions?|topics?)\s*(?:about|me|were)?\s*[:\-]?\s*(.+?)(?=(?:\n|\r|\.\s+[A-Z]|$))/i);
      if (qMatch && qMatch[1].trim()) {
        const rawTopics = qMatch[1].trim().replace(/^about\s+/i, '').replace(/[.]+$/, '');
        data.callNotes = rawTopics;
        const qList = rawTopics.split(/,|;|\band\b/i).map(s => s.trim()).filter(s => s.length > 2);
        if (qList.length > 0) {
          data.interviewQuestions = qList;
        }
        summaryNotes.push('Documented questions asked during the call.');
      }

      // Format clean call log entry in notes
      const recStr = data.recruiterName ? `Recruiter: ${data.recruiterName}` : '';
      const qStr = data.callNotes ? `Topics/Questions: ${data.callNotes}` : '';
      const callLogEntry = `[Call on ${today}]: ${[recStr, qStr].filter(Boolean).join(' | ')}`;
      if (!data.notes || !data.notes.includes(callLogEntry)) {
        data.notes = data.notes ? `${data.notes}\n${callLogEntry}` : callLogEntry;
      }
    } else if (isInterviewSignal) {
      data.status = 'Interviewing';
      summaryNotes.push('Updated status to Interviewing.');
    }

    // Separate bookmark flag detection
    if (/\b(?:bookmark|star)\b/i.test(text) && !/\bremove\s+bookmark\b|\bunbookmark\b|\bunstar\b/i.test(text)) {
      data.isBookmarked = true;
      summaryNotes.push('Bookmarked application.');
    } else if (/\bremove\s+bookmark\b|\bunbookmark\b|\bunstar\b/i.test(text)) {
      data.isBookmarked = false;
      summaryNotes.push('Removed bookmark flag.');
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

    // Salary compensation notes
    if (extractedSalary) {
      data.salary = extractedSalary;
      summaryNotes.push(`Captured salary compensation: ${data.salary}`);
    }

    // Benefits extraction
    let bText = '';
    const benefitsInline = text.match(/Benefits\s*[:\-]\s*([^\n\r]+)/i);
    if (benefitsInline && benefitsInline[1].trim()) {
      bText = benefitsInline[1].trim();
    } else if (/Benefits\s*[:\-]?/i.test(text)) {
      const afterBenefits = text.split(/Benefits\s*[:\-]?/i)[1] || '';
      const firstLine = afterBenefits.split(/\r?\n/).map(l => l.trim()).filter(Boolean)[0] || '';
      if (firstLine && !/^(?:Application|Work|Location|Key|Required|Pay|Company)/i.test(firstLine)) {
        bText = firstLine;
      }
    }
    if (bText) {
      const bLog = `[Benefits]: ${bText}`;
      if (!data.notes || !data.notes.includes(bLog)) {
        data.notes = data.notes ? `${data.notes}\n${bLog}` : bLog;
      }
      summaryNotes.push(`Logged benefits (${bText}).`);
    }

    // Application screening questions
    const appQuestionsMatch = text.match(/Application\s+Question\(s\)?\s*[:\-]?\s*([\s\S]+?)(?=(?:\n\s*(?:Work\s+Location|HYDRO|Required|Key|Pay|Benefits|Company)|\n\s*\n\s*[A-Z]|$))/i);
    if (appQuestionsMatch && appQuestionsMatch[1].trim()) {
      const qLines = appQuestionsMatch[1].split(/\r?\n/)
        .map(l => l.trim().replace(/^[•\-\d.)\s]+/, '').replace(/[.]+$/, ''))
        .filter(l => l.length > 5 && (l.includes('?') || /^(?:what|how|why|where|do|can|are|years)/i.test(l)));
      if (qLines.length > 0) {
        data.interviewQuestions = Array.from(new Set([...(data.interviewQuestions || []), ...qLines]));
        summaryNotes.push(`Captured ${qLines.length} screening question(s).`);
      }
    }

    // If creating a new job, attempt URL company extraction if companyName is not yet set
    if (isNewJob && !data.companyName) {
      const urlCo = extractCompanyFromUrl(data.applicationUrl || data.sourceUrl);
      if (urlCo && !EXTRACTION_BLACKLIST.has(urlCo.toLowerCase())) {
        data.companyName = urlCo;
      }
    }

    const hasCompany = Boolean(
      data.companyName && !['target company', 'company', 'unknown', 'n/a', 'company name', ''].includes(data.companyName.trim().toLowerCase())
    );
    const hasRole = Boolean(
      data.roleTitle && !['professional role', 'job title', 'undisclosed', 'role', 'n/a', ''].includes(data.roleTitle.trim().toLowerCase())
    );

    // If no identifiable company AND no identifiable role, NEVER create a dummy record
    if (isNewJob && !hasCompany && !hasRole) {
      // If it looks like a question or conversational prompt
      if (/[?]|^(what|how|why|can|could|tell|explain|give|describe|advice|tips|guide|suggest|prepare|interview|resume|portfolio|salary)/i.test(trimmed)) {
        return {
          message: `### 🤖 Career Advisor & Interview Assistant\n\nI'm here to help with your career questions and job search!\n\nHere are key recommendations regarding your query:\n- **Strategic Preparation**: Focus on high-frequency interview patterns (System Design, DSA, and behavioral STAR stories).\n- **Application Tracking**: Whenever you apply to a role or find an open vacancy, paste the **Job Description** or URL here to automatically track it on your board with interview status updates.\n- **Company Intelligence**: Ask about any company (e.g., *'Tell me about Paytm'*, *'Tell me about Samsung'*, *'Google'*) for detailed tech stacks and interview breakdowns.\n\n💡 *Tip: You can also connect your own Gemini API key in **Settings (⚙️)** for unlimited live AI conversations!`,
          data: null
        };
      }

      if (foundUrls.length > 0) {
        return {
          message: `🔗 I detected the job link (${foundUrls[0]}), but couldn't identify the **Company Name** and **Role Title** from the URL alone.\n\nPlease reply with the company and role (e.g. *"Company: Stripe, Role: Backend Engineer"*) so I can track it on your board!`,
          data: null
        };
      }

      // Check if it's general casual talk or conversational remarks
      const isShortChitChat = trimmed.length < 90 && !/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(trimmed) && !/https?:\/\//i.test(trimmed);
      if (isShortChitChat) {
        return {
          message: "I'm with you! 😊 Let me know how I can help with your job search—you can paste a **Job Description** to extract and track it, ask about any company (*'Tell me about Samsung'*), update your **About Me** profile, or type **/stats** to inspect your applications.",
          data: null
        };
      }

      return {
        message: "I didn't detect sufficient job details (Company Name or Role Title) in that message.\n\nTo track an application, simply paste a **Job Description**, an application email, or a job link (e.g. *\"SDE 1 at Razorpay\"*). You can also ask me about any company or type **/stats** to inspect your applications!",
        data: null
      };
    }

    // Resolve partial information gracefully without dummy "Target Company"
    if (!data.companyName) {
      if (existingJob?.companyName) {
        data.companyName = existingJob.companyName;
      } else {
        // If role is known but company is completely absent, ask the user
        return {
          message: `I recognized the position **${data.roleTitle}**, but couldn't detect the company name.\n\nWhich company is this role with (e.g. *"Company: Google"* or *"at Microsoft"*)?`,
          data: null
        };
      }
    }

    if (!data.roleTitle) {
      data.roleTitle = existingJob?.roleTitle || 'Software Professional';
    }

    // Rules 3, 4, 5, 6 compliance & Tier 3 Local Core Extraction:
    const coreLocal = extractCoreFieldsLocally(text);

    // URLs (both snake_case and camelCase):
    if (!data.sourceUrl && coreLocal.sourceUrl) {
      data.sourceUrl = coreLocal.sourceUrl;
    }
    if (!data.applicationUrl && coreLocal.appUrl) {
      data.applicationUrl = coreLocal.appUrl;
    }
    data.source_url = data.sourceUrl || null;
    data.application_url = data.applicationUrl || null;

    // Work model detection from coreLocal if not already set or refined
    if (coreLocal.workModel && (!data.workMode || data.workMode === 'On-site')) {
      data.workMode = coreLocal.workModel;
      data.work_model = coreLocal.workModel;
    }
    
    // Experience (Rule 3 & Fresher detection):
    const exp = extractExperience(text);
    if (exp.is_fresher_eligible !== null) {
      data.is_fresher_eligible = exp.is_fresher_eligible;
      data.isFresherEligible = exp.is_fresher_eligible;
      data.min_years = exp.min_years;
      data.minYears = exp.min_years;
    } else if (coreLocal.isFresher) {
      data.is_fresher_eligible = true;
      data.isFresherEligible = true;
      data.min_years = 0;
      data.minYears = 0;
    } else {
      data.is_fresher_eligible = null;
      data.isFresherEligible = null;
      data.min_years = null;
      data.minYears = null;
    }

    // Salary (Rule 5 & 6):
    const salDetails = parseSalaryDetails(extractedSalary);
    data.salary = salDetails.salary;
    data.salary_numeric = salDetails.salary_numeric;
    data.currency = salDetails.currency;

    if (coreLocal.salaryMin !== null && (!data.salary_numeric || data.salary === 'Not disclosed')) {
      data.salary_numeric = coreLocal.salaryMin;
      data.currency = 'INR';
      if (!data.salary || data.salary === 'Not disclosed') {
        data.salary = coreLocal.salaryMin === coreLocal.salaryMax
          ? `₹${(coreLocal.salaryMin / 100000).toFixed(1)} LPA`
          : `₹${(coreLocal.salaryMin / 100000).toFixed(1)} - ₹${(coreLocal.salaryMax / 100000).toFixed(1)} LPA`;
      }
    }

    // Deadline (Rule 6: Never invent information, if not mentioned set to null)
    const deadlineMatch = text.match(/(?:deadline|apply\s+by|last\s+date|closing\s+date)\s*[:\-]?\s*([A-Za-z0-9, -]+)/i);
    data.deadline = deadlineMatch ? deadlineMatch[1].trim() : null;

    // Strict entity separation & skill normalization
    const { cleanComp, cleanLoc } = cleanCompanyAndLocation(data.companyName, data.location);
    data.companyName = cleanComp;
    data.company_name = cleanComp;
    data.location = cleanLoc;

    if (data.skills && Array.isArray(data.skills)) {
      data.skills = normalizeSkillList(data.skills);
      summaryNotes.push(`Identified ${data.skills.length} skill(s).`);
    }

    // Extract Responsibilities
    const respMatch = text.match(/(?:key\s+responsibilities|responsibilities|what\s+you(?:'ll|\s+will)\s+do|duties|role\s+responsibilities)\s*[:\-]?\s*\n([\s\S]*?)(?=\n\s*(?:required\s+skills|skills|eligibility|requirements|qualifications|selection\s+process|about\s+us|benefits|salary|$))/i);
    let responsibilities = [];
    if (respMatch) {
      responsibilities = respMatch[1]
        .split('\n')
        .map(l => l.replace(/^[•\-\*\d.]+\s*/, '').trim())
        .filter(l => l.length > 5 && !/^(?:key\s+responsibilities|responsibilities)$/i.test(l))
        .slice(0, 8);
    }
    data.responsibilities = responsibilities;

    // Extract Selection Process / Rounds
    const processMatch = text.match(/(?:selection\s+process|interview\s+process|hiring\s+process|interview\s+rounds|evaluation\s+rounds)\s*[:\-]?\s*\n([\s\S]+)/i);
    let selectionProcess = [];
    if (processMatch) {
      const block = processMatch[1].split(/\n\s*(?:required\s+skills|skills|eligibility|requirements|qualifications|about\s+us|benefits|salary|key\s+responsibilities)/i)[0];
      selectionProcess = block
        .split('\n')
        .map(l => l.replace(/^[•\-\*]+\s*/, '').trim())
        .filter(l => l.length > 3 && !/^(?:selection\s+process|interview\s+process)$/i.test(l))
        .slice(0, 8);
    }
    data.selectionProcess = selectionProcess;

    // Extract Eligibility
    const eligMatch = text.match(/(?:eligibility|qualifications|minimum\s+qualifications|education|requirements)\s*[:\-]?\s*\n([\s\S]*?)(?=\n\s*(?:selection\s+process|interview\s+process|responsibilities|about\s+us|benefits|salary|$))/i);
    let eligibility = '';
    if (eligMatch) {
      eligibility = eligMatch[1]
        .split('\n')
        .map(l => l.replace(/^[•\-\*]+\s*/, '').trim())
        .filter(l => l.length > 5)
        .slice(0, 3)
        .join(' · ');
    }
    data.eligibility = eligibility || null;

    // Preserve in notes
    if (responsibilities.length > 0 && (!data.notes || !data.notes.includes('[Key Responsibilities]'))) {
      data.notes = (data.notes ? `${data.notes}\n\n` : '') + `[Key Responsibilities]:\n` + responsibilities.map(r => `• ${r}`).join('\n');
    }
    if (selectionProcess.length > 0 && (!data.notes || !data.notes.includes('[Selection Process]'))) {
      data.notes = (data.notes ? `${data.notes}\n\n` : '') + `[Selection Process]:\n` + selectionProcess.map((p, idx) => `${idx + 1}. ${p.replace(/^\d+\.\s*/, '')}`).join('\n');
    }
    if (eligibility && (!data.notes || !data.notes.includes('[Eligibility]'))) {
      data.notes = (data.notes ? `${data.notes}\n\n` : '') + `[Eligibility]: ${eligibility}`;
    }

    const cleanSkillsSummary = data.skills && data.skills.length > 0 ? data.skills.slice(0, 6).join(', ') : 'Not specified';
    const expLabel = data.is_fresher_eligible ? 'Fresher (0–1 year)' : (data.min_years ? `${data.min_years}+ years` : (data.jobType || 'Full-time'));
    
    let respSection = '';
    if (responsibilities.length > 0) {
      respSection = `\n\n### 📝 Key Responsibilities\n` + responsibilities.map(r => `- ${r}`).join('\n');
    }
    let processSection = '';
    if (selectionProcess.length > 0) {
      processSection = `\n\n### 🎯 Selection Process (${selectionProcess.length} Rounds)\n` + selectionProcess.map((p, idx) => `${idx + 1}. ${p.replace(/^\d+\.\s*/, '')}`).join('\n');
    }
    let eligSection = '';
    if (eligibility) {
      eligSection = `\n\n### 🎓 Eligibility Criteria\n- ${eligibility}`;
    }

    let message;
    if (!isNewJob && data.status === 'Rejected') {
      message = `📋 **Application Status Updated: ${data.roleTitle} at ${data.companyName}**\n\n` +
        `• 🏢 **Role & Company:** ${data.roleTitle} at **${data.companyName}**\n` +
        `• 📍 **Location & Mode:** ${data.location || 'Not specified'} (${data.workMode || 'On-site'})\n` +
        `• 💰 **Compensation:** ${data.salary || 'Not disclosed'}\n` +
        `• 🛠️ **Key Skills:** ${cleanSkillsSummary}\n\n` +
        `❌ Marked as **Rejected** (Not selected by employer).`;
    } else {
      const titlePrefix = data.status === 'Applied'
        ? `📋 **Application Recorded: ${data.roleTitle} at ${data.companyName}**`
        : `📋 **Job Opportunity Tracked: ${data.roleTitle} at ${data.companyName}**`;
      const statusSuffix = data.status === 'Applied'
        ? `✅ Marked as **Applied**${data.appliedDate ? ` on ${data.appliedDate}` : ''}.`
        : `✅ Saved to your tracker board as an **Opportunity**.\n\n💡 *Ready to apply or prepare?* When you submit your application, type **/apply** to mark it as Applied today, or type **/interview Qs** anytime to generate targeted practice questions for this role!`;

      message = `${titlePrefix}\n\n` +
        `• 🏢 **Role & Company:** ${data.roleTitle} at **${data.companyName}**\n` +
        `• 📍 **Location & Mode:** ${data.location || 'Not specified'} (${data.workMode || 'On-site'})\n` +
        `• 💼 **Experience & Type:** ${data.jobType || 'Full-time'} · ${expLabel}\n` +
        `• 💰 **Compensation:** ${data.salary || 'Not disclosed'}\n` +
        `• 🛠️ **Key Skills:** ${cleanSkillsSummary}` +
        respSection +
        processSection +
        eligSection +
        `\n\n${statusSuffix}`;
    }

    if (!isNewJob && existingJob && !data.updatedSummary) {
      data.updatedSummary = computeUpdatedSummary(existingJob, data);
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
    report += `- **Next Action:** Type **/interview Qs** to get custom mock interview questions for **${job.companyName}**, or update any new projects in your profile!\n`;

    return {
      message: report,
      data: null
    };
  },

  /**
   * Generates targeted technical, system design, and behavioral interview questions
   * specifically for the target job/company.
   */
  generateInterviewQuestions(targetJob = null, targetQuery = '', allApplications = [], userProfile = null) {
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
        message: `⚠️ **No Job Application Found**\n\n` +
          `To generate targeted interview questions:\n` +
          `1. Paste a **Job Description (JD)** in the chat or select an application from your **Applications Tracker**.\n` +
          `2. Type **/interview Qs** (or \`/interview Qs [company]\`) to get targeted technical, system design, and behavioral questions!`,
        data: null
      };
    }

    const company = job.companyName || 'Target Company';
    const role = job.roleTitle || 'Software Engineer';
    const rawSkills = Array.isArray(job.skills) && job.skills.length > 0 ? job.skills : ['Core Engineering', 'Data Structures', 'System Architecture', 'Problem Solving'];
    const skills = rawSkills.slice(0, 6);
    const primarySkill = skills[0] || 'Software Engineering';
    const secondarySkill = skills[1] || 'System Architecture';

    const msg = `🎯 **Targeted Interview Questions: ${role} at ${company}**\n\n` +
      `Here is a targeted interview question set designed specifically for this role based on required skills (\`${skills.join('`, `')}\`):\n\n` +
      `### 1. 💻 Core Technical & Engineering Questions\n` +
      `1. **${primarySkill} Deep-Dive:** Can you explain how you design and optimize high-throughput components using **${primarySkill}**, and how you handle concurrency, state management, or edge failure conditions?\n` +
      `2. **Architecture & Reliability (${secondarySkill}):** In your past projects, how did you integrate **${secondarySkill}** into the overall application architecture? What trade-offs did you evaluate?\n` +
      `3. **Database & Query Optimization:** How would you design a caching strategy (e.g. Redis / materialized views) to reduce database read bottlenecks during high traffic spikes?\n` +
      `4. **Error Handling & Observability:** How do you set up telemetry, distributed tracing, and automated alerting to catch silent failures before users report them?\n\n` +
      `### 2. 🏗️ System Design & Scenario-Based Challenges\n` +
      `1. **Scalability:** Design a real-time event ingestion or tracking service for **${company}** that handles 50,000 requests/sec with minimal latency and high fault tolerance.\n` +
      `2. **Trade-off Analysis:** If a primary downstream dependency or third-party API starts timing out or throwing 500 errors, how do you implement circuit breaking and graceful degradation?\n\n` +
      `### 3. 🤝 Behavioral & Culture Fit (STAR Method)\n` +
      `1. **Technical Disagreement:** Describe a time you disagreed with a senior engineer or product manager on an architectural decision. How did you present your case and resolve it?\n` +
      `2. **Production Incident:** Walk through the most complex bug or production outage you diagnosed. What was the root cause and how did you prevent regression?\n` +
      `3. **Rapid Learning:** Tell me about a time you had to deliver a critical project using a technology or stack you had never worked with before.\n\n` +
      `### 4. 💡 Smart Reverse Questions to Ask the Interviewer\n` +
      `• *"What does the deployment and on-call rotation look like for this specific engineering team at ${company}?"*\n` +
      `• *"What is the most pressing technical challenge or legacy migration this team is tackling over the next 6 months?"*\n\n` +
      `*Pro tip: Use the STAR method (Situation, Task, Action, Result) for behavioral answers and keep technical explanations grounded in real systems you've built!*`;

    return {
      message: msg,
      data: null
    };
  }
};

export default AiExtractor;
