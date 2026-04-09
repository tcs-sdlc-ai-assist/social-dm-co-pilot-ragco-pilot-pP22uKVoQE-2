import { KnowledgeBaseEntry } from "../types";

// ─── Static Knowledge Base Data ──────────────────────────────────────────────

const KNOWLEDGE_BASE: KnowledgeBaseEntry[] = [
  {
    id: "kb-001",
    category: "property",
    title: "Willowdale Community Overview",
    content:
      "Willowdale is a master-planned community in Denham Court, South West Sydney. It features a mix of house and land packages, parklands, schools, and retail amenities. Prices start from $450,000 for land lots.",
    keywords: [
      "willowdale",
      "denham court",
      "community",
      "master-planned",
      "house and land",
      "sydney",
      "prices",
    ],
  },
  {
    id: "kb-002",
    category: "property",
    title: "Aura Community Overview",
    content:
      "Aura is a vibrant community on the Sunshine Coast, Queensland. It offers diverse housing options, green spaces, schools, and a town centre. Land lots start from $320,000.",
    keywords: [
      "aura",
      "sunshine coast",
      "queensland",
      "housing",
      "land",
      "town centre",
    ],
  },
  {
    id: "kb-003",
    category: "faq",
    title: "How to Book a Property Inspection",
    content:
      "You can book a property inspection by visiting our website and selecting the community you are interested in. Alternatively, call our sales team on 1300 STOCKLAND or send us a direct message with your preferred date and time.",
    keywords: [
      "book",
      "inspection",
      "visit",
      "sales",
      "appointment",
      "tour",
    ],
  },
  {
    id: "kb-004",
    category: "faq",
    title: "First Home Buyer Grants and Incentives",
    content:
      "First home buyers may be eligible for government grants and stamp duty concessions. In NSW, the First Home Owner Grant is $10,000 for new homes. In QLD, the grant is $30,000 for new homes. Contact our team for personalised advice.",
    keywords: [
      "first home",
      "grant",
      "stamp duty",
      "incentive",
      "buyer",
      "government",
      "concession",
    ],
  },
  {
    id: "kb-005",
    category: "property",
    title: "Cloverton Community Overview",
    content:
      "Cloverton is a new community in Kalkallo, Melbourne's north. It offers land lots, parks, wetlands, and future schools and shops. Land prices start from $290,000.",
    keywords: [
      "cloverton",
      "kalkallo",
      "melbourne",
      "land",
      "parks",
      "wetlands",
    ],
  },
  {
    id: "kb-006",
    category: "faq",
    title: "Deposit and Payment Process",
    content:
      "A deposit of $1,000 to $5,000 is typically required to secure a lot. The balance of the deposit (usually 10%) is due at contract exchange. Settlement occurs when the land is titled, usually 6-18 months after purchase.",
    keywords: [
      "deposit",
      "payment",
      "contract",
      "settlement",
      "purchase",
      "finance",
      "money",
    ],
  },
  {
    id: "kb-007",
    category: "property",
    title: "Minta Community Overview",
    content:
      "Minta is located in Berwick, Melbourne's south-east. It features premium land lots, established schools, shopping centres, and easy freeway access. Land lots start from $350,000.",
    keywords: [
      "minta",
      "berwick",
      "melbourne",
      "premium",
      "land",
      "schools",
      "shopping",
    ],
  },
  {
    id: "kb-008",
    category: "faq",
    title: "Building Timeframes and Guidelines",
    content:
      "Once your land is titled, you typically have 18-24 months to commence building. Stockland communities have design guidelines to maintain streetscape quality. Approved builders can help you through the process.",
    keywords: [
      "building",
      "timeframe",
      "construction",
      "design",
      "guidelines",
      "builder",
      "commence",
    ],
  },
  {
    id: "kb-009",
    category: "sustainability",
    title: "Stockland Sustainability Commitment",
    content:
      "Stockland is committed to creating sustainable communities with energy-efficient homes, water-sensitive urban design, and green open spaces. Our communities are designed to reduce environmental impact and promote healthy living.",
    keywords: [
      "sustainability",
      "energy",
      "green",
      "environment",
      "water",
      "eco",
      "healthy",
    ],
  },
  {
    id: "kb-010",
    category: "faq",
    title: "Contact and Support Information",
    content:
      "For general enquiries, call 1300 STOCKLAND (1300 786 253) or email info@stockland.com.au. Our sales centres are open 7 days a week. You can also reach us via Facebook or Instagram direct message.",
    keywords: [
      "contact",
      "phone",
      "email",
      "support",
      "enquiry",
      "sales centre",
      "help",
    ],
  },
];

// ─── Utility Functions ───────────────────────────────────────────────────────

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "shall",
  "can",
  "to",
  "of",
  "in",
  "for",
  "on",
  "with",
  "at",
  "by",
  "from",
  "as",
  "into",
  "through",
  "during",
  "before",
  "after",
  "above",
  "below",
  "between",
  "and",
  "but",
  "or",
  "nor",
  "not",
  "so",
  "yet",
  "both",
  "either",
  "neither",
  "each",
  "every",
  "all",
  "any",
  "few",
  "more",
  "most",
  "other",
  "some",
  "such",
  "no",
  "only",
  "own",
  "same",
  "than",
  "too",
  "very",
  "just",
  "because",
  "if",
  "when",
  "where",
  "how",
  "what",
  "which",
  "who",
  "whom",
  "this",
  "that",
  "these",
  "those",
  "it",
  "its",
  "he",
  "she",
  "we",
  "they",
  "me",
  "him",
  "her",
  "us",
  "them",
  "my",
  "your",
  "his",
  "our",
  "their",
  "am",
  "im",
  "ive",
  "id",
  "about",
  "up",
  "out",
  "then",
  "here",
  "there",
]);

function removeStopWords(tokens: string[]): string[] {
  return tokens.filter((token) => !STOP_WORDS.has(token));
}

/**
 * Computes inverse document frequency for a term across the knowledge base.
 * IDF = log(N / (1 + df)) where df is the number of entries containing the term.
 */
function computeIDF(term: string, entries: KnowledgeBaseEntry[]): number {
  const n = entries.length;
  let df = 0;
  for (const entry of entries) {
    const entryTokens = new Set([
      ...tokenize(entry.content),
      ...tokenize(entry.title),
      ...entry.keywords.map((k) => k.toLowerCase()),
    ]);
    if (entryTokens.has(term)) {
      df++;
    }
  }
  return Math.log((n + 1) / (1 + df));
}

/**
 * Computes a TF-IDF-like relevance score for an entry against a set of query tokens.
 */
function computeRelevanceScore(
  entry: KnowledgeBaseEntry,
  queryTokens: string[],
  entries: KnowledgeBaseEntry[]
): number {
  if (queryTokens.length === 0) {
    return 0;
  }

  const entryKeywords = entry.keywords.map((k) => k.toLowerCase());
  const entryContentTokens = tokenize(entry.content);
  const entryTitleTokens = tokenize(entry.title);

  // Build a combined token list with weights
  // Keywords get a 3x boost, title tokens get 2x, content tokens get 1x
  const tokenCounts = new Map<string, number>();

  for (const kw of entryKeywords) {
    const kwTokens = tokenize(kw);
    for (const t of kwTokens) {
      tokenCounts.set(t, (tokenCounts.get(t) || 0) + 3);
    }
  }

  for (const t of entryTitleTokens) {
    tokenCounts.set(t, (tokenCounts.get(t) || 0) + 2);
  }

  for (const t of entryContentTokens) {
    tokenCounts.set(t, (tokenCounts.get(t) || 0) + 1);
  }

  const totalTokens = entryKeywords.length * 3 + entryTitleTokens.length * 2 + entryContentTokens.length;

  let score = 0;
  for (const queryToken of queryTokens) {
    const tf = totalTokens > 0 ? (tokenCounts.get(queryToken) || 0) / totalTokens : 0;
    const idf = computeIDF(queryToken, entries);
    score += tf * idf;
  }

  return score;
}

// ─── Exported Functions ──────────────────────────────────────────────────────

/**
 * Loads the full knowledge base.
 */
export function loadKnowledgeBase(): KnowledgeBaseEntry[] {
  return [...KNOWLEDGE_BASE];
}

/**
 * Searches the knowledge base by matching any of the provided keywords.
 * Returns entries sorted by number of matching keywords (descending).
 */
export function searchByKeywords(keywords: string[]): KnowledgeBaseEntry[] {
  if (keywords.length === 0) {
    return [];
  }

  const normalizedKeywords = keywords.map((k) => k.toLowerCase().trim());

  const scored: Array<{ entry: KnowledgeBaseEntry; matchCount: number }> = [];

  for (const entry of KNOWLEDGE_BASE) {
    let matchCount = 0;
    const entryKeywordsLower = entry.keywords.map((k) => k.toLowerCase());
    const entryContentLower = entry.content.toLowerCase();
    const entryTitleLower = entry.title.toLowerCase();

    for (const keyword of normalizedKeywords) {
      const keywordMatch = entryKeywordsLower.some(
        (ek) => ek.includes(keyword) || keyword.includes(ek)
      );
      const contentMatch = entryContentLower.includes(keyword);
      const titleMatch = entryTitleLower.includes(keyword);

      if (keywordMatch || contentMatch || titleMatch) {
        matchCount++;
      }
    }

    if (matchCount > 0) {
      scored.push({ entry, matchCount });
    }
  }

  scored.sort((a, b) => b.matchCount - a.matchCount);

  return scored.map((s) => s.entry);
}

/**
 * Searches the knowledge base by category (case-insensitive).
 */
export function searchByCategory(category: string): KnowledgeBaseEntry[] {
  const normalizedCategory = category.toLowerCase().trim();
  return KNOWLEDGE_BASE.filter(
    (entry) => entry.category.toLowerCase() === normalizedCategory
  );
}

/**
 * Retrieves a single knowledge base entry by ID.
 * Returns null if not found.
 */
export function getEntryById(id: string): KnowledgeBaseEntry | null {
  return KNOWLEDGE_BASE.find((entry) => entry.id === id) || null;
}

/**
 * Finds relevant knowledge base entries for a given DM content string.
 * Uses tokenization, stop-word removal, and TF-IDF-like scoring for relevance ranking.
 * Returns the top entries sorted by relevance score (descending).
 */
export function findRelevantContext(
  dmContent: string
): KnowledgeBaseEntry[] {
  if (!dmContent || dmContent.trim().length === 0) {
    return [];
  }

  const tokens = tokenize(dmContent);
  const meaningfulTokens = removeStopWords(tokens);

  if (meaningfulTokens.length === 0) {
    return [];
  }

  const scored: Array<{ entry: KnowledgeBaseEntry; score: number }> = [];

  for (const entry of KNOWLEDGE_BASE) {
    const score = computeRelevanceScore(entry, meaningfulTokens, KNOWLEDGE_BASE);
    if (score > 0) {
      scored.push({ entry, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);

  // Return top 5 most relevant entries
  const MAX_RESULTS = 5;
  return scored.slice(0, MAX_RESULTS).map((s) => s.entry);
}