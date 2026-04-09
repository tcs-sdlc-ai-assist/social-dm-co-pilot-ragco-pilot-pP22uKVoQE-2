import type { DM, CandidateLead, LeadPriority } from "../types";

// ─── Regex Patterns ──────────────────────────────────────────────────────────

const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_PATTERN =
  /(?:\+?61|0)[\s-]?(?:\d[\s-]?){8,9}\d|(?:\(0\d\))[\s-]?\d{4}[\s-]?\d{4}/g;
const BUDGET_PATTERN =
  /\$\s?[\d,]+(?:\.\d{1,2})?|\b(\d{3,})[\s]?[kK]\b|\b(\d{1,3}(?:,\d{3})+)\b/g;
const CURRENCY_CLEAN_PATTERN = /[$,\s]/g;

// ─── Intent Keywords ─────────────────────────────────────────────────────────

const INTENT_KEYWORDS: Record<string, string[]> = {
  buy: [
    "buy",
    "purchase",
    "buying",
    "looking to buy",
    "want to buy",
    "interested in buying",
    "home buyer",
    "first home",
    "investment property",
    "settle",
    "settlement",
  ],
  rent: [
    "rent",
    "renting",
    "lease",
    "leasing",
    "looking to rent",
    "tenant",
    "rental",
  ],
  tour: [
    "tour",
    "visit",
    "inspection",
    "open home",
    "open house",
    "display",
    "walk through",
    "walkthrough",
    "come see",
    "viewing",
    "book a tour",
    "schedule a visit",
  ],
  info: [
    "info",
    "information",
    "details",
    "brochure",
    "price list",
    "pricing",
    "floor plan",
    "floorplan",
    "availability",
    "available",
    "enquiry",
    "inquiry",
    "question",
    "tell me more",
    "more info",
    "interested",
  ],
};

// ─── Known Locations ─────────────────────────────────────────────────────────

const KNOWN_LOCATIONS: string[] = [
  "Elara",
  "Marsden Park",
  "Box Hill",
  "Schofields",
  "Austral",
  "Leppington",
  "Oran Park",
  "Gregory Hills",
  "Cobbitty",
  "Spring Farm",
  "Camden",
  "Narellan",
  "Kellyville",
  "Rouse Hill",
  "The Ponds",
  "Tallawong",
  "Riverstone",
  "Vineyard",
  "Jordan Springs",
  "Penrith",
  "Blacktown",
  "Liverpool",
  "Campbelltown",
  "Parramatta",
  "Sydney",
  "Melbourne",
  "Brisbane",
  "Perth",
  "Adelaide",
  "Gold Coast",
  "Canberra",
  "Hobart",
];

// ─── Field Confidence ────────────────────────────────────────────────────────

interface FieldConfidence {
  name: number;
  contact: number;
  budget: number;
  location: number;
  intent: number;
}

// ─── Extraction Helpers ──────────────────────────────────────────────────────

function extractEmail(content: string): string | null {
  const matches = content.match(EMAIL_PATTERN);
  return matches && matches.length > 0 ? matches[0] : null;
}

function extractPhone(content: string): string | null {
  const matches = content.match(PHONE_PATTERN);
  return matches && matches.length > 0 ? matches[0].replace(/\s+/g, "") : null;
}

function extractContact(content: string): { contact: string | null; confidence: number } {
  const email = extractEmail(content);
  if (email) {
    return { contact: email, confidence: 0.95 };
  }
  const phone = extractPhone(content);
  if (phone) {
    return { contact: phone, confidence: 0.85 };
  }
  return { contact: null, confidence: 0 };
}

function extractBudget(content: string): { budget: string | null; confidence: number } {
  const matches = [...content.matchAll(BUDGET_PATTERN)];
  if (matches.length === 0) {
    return { budget: null, confidence: 0 };
  }

  for (const match of matches) {
    const raw = match[0];

    // Handle "500k" or "850K" format
    if (/\d+\s?[kK]/.test(raw)) {
      const numStr = raw.replace(/[kK\s]/g, "");
      const num = parseInt(numStr, 10);
      if (!isNaN(num) && num > 0) {
        return { budget: String(num * 1000), confidence: 0.8 };
      }
    }

    // Handle "$850,000" or "$850000" format
    if (raw.startsWith("$")) {
      const numStr = raw.replace(CURRENCY_CLEAN_PATTERN, "");
      const num = parseFloat(numStr);
      if (!isNaN(num) && num > 0) {
        return { budget: String(Math.round(num)), confidence: 0.9 };
      }
    }

    // Handle plain comma-separated numbers like "850,000"
    const plainNumStr = raw.replace(CURRENCY_CLEAN_PATTERN, "");
    const plainNum = parseInt(plainNumStr, 10);
    if (!isNaN(plainNum) && plainNum >= 1000) {
      return { budget: String(plainNum), confidence: 0.6 };
    }
  }

  return { budget: null, confidence: 0 };
}

function extractLocation(content: string): { location: string | null; confidence: number } {
  const contentLower = content.toLowerCase();

  for (const loc of KNOWN_LOCATIONS) {
    const locLower = loc.toLowerCase();
    // Use word boundary matching to avoid partial matches
    const regex = new RegExp(`\\b${escapeRegex(locLower)}\\b`, "i");
    if (regex.test(contentLower)) {
      return { location: loc, confidence: 0.85 };
    }
  }

  return { location: null, confidence: 0 };
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractIntent(content: string): { intent: string; confidence: number } {
  const contentLower = content.toLowerCase();
  const scores: Record<string, number> = {};

  for (const [intentKey, keywords] of Object.entries(INTENT_KEYWORDS)) {
    let matchCount = 0;
    for (const keyword of keywords) {
      if (contentLower.includes(keyword.toLowerCase())) {
        matchCount++;
      }
    }
    if (matchCount > 0) {
      scores[intentKey] = matchCount;
    }
  }

  const entries = Object.entries(scores);
  if (entries.length === 0) {
    return { intent: "general inquiry", confidence: 0.3 };
  }

  entries.sort((a, b) => b[1] - a[1]);
  const [topIntent, topScore] = entries[0];

  const intentLabels: Record<string, string> = {
    buy: "Interested in purchasing property",
    rent: "Interested in renting property",
    tour: "Requesting property tour or inspection",
    info: "Requesting property information",
  };

  const confidence = Math.min(0.5 + topScore * 0.15, 0.95);

  return {
    intent: intentLabels[topIntent] ?? "general inquiry",
    confidence,
  };
}

function extractName(dm: DM): { name: string; confidence: number } {
  // Primary: use senderName from DM metadata
  if (dm.senderName && dm.senderName.trim().length > 0) {
    const name = dm.senderName.trim();
    // Check if it looks like a real name (at least 2 chars, not just a handle)
    if (name.length >= 2 && !name.startsWith("@")) {
      return { name, confidence: 0.9 };
    }
  }

  // Fallback: try to extract a name from content using common patterns
  const namePatterns = [
    /(?:my name is|i'm|i am|this is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
    /(?:^|\n)\s*([A-Z][a-z]+\s+[A-Z][a-z]+)\s*(?:here|$)/i,
  ];

  for (const pattern of namePatterns) {
    const match = dm.content.match(pattern);
    if (match && match[1]) {
      return { name: match[1].trim(), confidence: 0.7 };
    }
  }

  // Last resort: use senderHandle
  if (dm.senderHandle && dm.senderHandle.trim().length > 0) {
    const handle = dm.senderHandle.replace(/^@/, "").trim();
    if (handle.length > 0) {
      return { name: handle, confidence: 0.4 };
    }
  }

  return { name: "Unknown", confidence: 0.1 };
}

function computeOverallConfidence(fieldConfidence: FieldConfidence): number {
  const weights = {
    name: 0.15,
    contact: 0.25,
    budget: 0.2,
    location: 0.15,
    intent: 0.25,
  };

  const score =
    fieldConfidence.name * weights.name +
    fieldConfidence.contact * weights.contact +
    fieldConfidence.budget * weights.budget +
    fieldConfidence.location * weights.location +
    fieldConfidence.intent * weights.intent;

  return Math.round(score * 100) / 100;
}

function determinePriority(
  overallConfidence: number,
  intent: string,
  budget: string | null,
): LeadPriority {
  // High priority: high confidence + buying intent + has budget
  if (
    overallConfidence >= 0.7 &&
    intent.toLowerCase().includes("purchasing") &&
    budget !== null
  ) {
    return "high";
  }

  // High priority: tour request with budget
  if (intent.toLowerCase().includes("tour") && budget !== null) {
    return "high";
  }

  // Medium priority: has contact and some intent
  if (overallConfidence >= 0.5) {
    return "medium";
  }

  return "low";
}

// ─── Main Export ─────────────────────────────────────────────────────────────

export function extractLeadData(dm: DM): CandidateLead {
  const { name, confidence: nameConfidence } = extractName(dm);
  const { contact, confidence: contactConfidence } = extractContact(dm.content);
  const { budget, confidence: budgetConfidence } = extractBudget(dm.content);
  const { location, confidence: locationConfidence } = extractLocation(dm.content);
  const { intent, confidence: intentConfidence } = extractIntent(dm.content);

  const fieldConfidence: FieldConfidence = {
    name: nameConfidence,
    contact: contactConfidence,
    budget: budgetConfidence,
    location: locationConfidence,
    intent: intentConfidence,
  };

  const overallConfidence = computeOverallConfidence(fieldConfidence);
  const priority = determinePriority(overallConfidence, intent, budget);

  const candidateLead: CandidateLead = {
    dmId: dm.id,
    name,
    contact: contact ?? dm.senderHandle,
    budget,
    location,
    intent,
    priority,
  };

  return candidateLead;
}