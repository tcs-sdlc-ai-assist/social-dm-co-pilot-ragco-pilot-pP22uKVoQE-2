import { AzureOpenAI } from "openai";
import type { KnowledgeBaseEntry } from "../types";
import { config } from "../lib/config";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DraftResponse {
  text: string;
  confidenceScore: number;
}

// ─── PII Sanitization ────────────────────────────────────────────────────────

const PII_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  {
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    replacement: "[EMAIL_REDACTED]",
  },
  {
    pattern: /(?:\+?61|0)[\s-]?(?:\d[\s-]?){8,9}\d/g,
    replacement: "[PHONE_REDACTED]",
  },
  {
    pattern: /\b\d{3}[\s-]?\d{3}[\s-]?\d{3}\b/g,
    replacement: "[TFN_REDACTED]",
  },
  {
    pattern: /\b(?:\d{4}[\s-]?){3}\d{4}\b/g,
    replacement: "[CARD_REDACTED]",
  },
];

function sanitizePII(text: string): string {
  let sanitized = text;
  for (const { pattern, replacement } of PII_PATTERNS) {
    sanitized = sanitized.replace(pattern, replacement);
  }
  return sanitized;
}

// ─── Confidence Scoring ──────────────────────────────────────────────────────

function computeConfidenceScore(
  dmContent: string,
  contextEntries: KnowledgeBaseEntry[]
): number {
  if (contextEntries.length === 0) {
    return 0.3;
  }

  const dmTokens = dmContent
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);

  if (dmTokens.length === 0) {
    return 0.35;
  }

  let totalKeywordMatches = 0;
  let totalKeywords = 0;

  for (const entry of contextEntries) {
    const entryKeywords = entry.keywords.map((k) => k.toLowerCase());
    totalKeywords += entryKeywords.length;

    for (const keyword of entryKeywords) {
      const keywordTokens = keyword.toLowerCase().split(/\s+/);
      const matched = keywordTokens.some((kt) =>
        dmTokens.some((dt) => dt.includes(kt) || kt.includes(dt))
      );
      if (matched) {
        totalKeywordMatches++;
      }
    }
  }

  const keywordMatchRatio =
    totalKeywords > 0 ? totalKeywordMatches / totalKeywords : 0;

  // Base score from number of context entries (more context = higher base)
  const entryCountScore = Math.min(contextEntries.length / 5, 1.0);

  // Weighted combination
  const rawScore = entryCountScore * 0.4 + keywordMatchRatio * 0.6;

  // Scale to a reasonable confidence range [0.3, 0.95]
  const scaledScore = 0.3 + rawScore * 0.65;

  return Math.round(Math.min(Math.max(scaledScore, 0.3), 0.95) * 100) / 100;
}

// ─── Prompt Construction ─────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  return `You are a professional customer service assistant for Stockland, a leading Australian property developer. Your role is to draft helpful, friendly, and accurate responses to direct messages from prospective buyers and community members.

Guidelines:
- Be warm, professional, and concise
- Reference specific Stockland communities, pricing, and features when relevant
- Encourage the sender to book a consultation or visit a display village
- Do not include any personal information (emails, phone numbers, addresses) in your response
- Do not make promises about pricing or availability — always suggest contacting the sales team for the latest information
- Keep responses under 300 words
- Use Australian English spelling and conventions`;
}

function buildContextBlock(contextEntries: KnowledgeBaseEntry[]): string {
  if (contextEntries.length === 0) {
    return "No specific knowledge base context available for this message.";
  }

  const blocks = contextEntries.map((entry, index) => {
    return `[${index + 1}] ${entry.title} (${entry.category})\n${entry.content}`;
  });

  return blocks.join("\n\n");
}

function buildUserPrompt(
  sanitizedContent: string,
  senderName: string,
  contextBlock: string
): string {
  const safeSenderName = sanitizePII(senderName);

  return `A customer named "${safeSenderName}" sent the following direct message:

---
${sanitizedContent}
---

Relevant knowledge base context:
${contextBlock}

Please draft a professional and helpful reply to this message. Address the customer by their first name if available. Reference the knowledge base context where relevant. Do not include any personal contact information in your response.`;
}

// ─── Fallback Response ───────────────────────────────────────────────────────

function generateFallbackResponse(senderName: string): DraftResponse {
  const firstName = senderName.split(" ")[0] || "there";
  const safeName = sanitizePII(firstName);

  return {
    text: `Hi ${safeName}! Thank you for reaching out to Stockland. We appreciate your interest and would love to help you further. One of our sales consultants will be in touch with you shortly to discuss your enquiry in detail. In the meantime, feel free to explore our communities at stockland.com.au or call us on 13 52 63 to book a consultation. We look forward to helping you find your perfect home!`,
    confidenceScore: 0.35,
  };
}

// ─── Azure OpenAI Client ─────────────────────────────────────────────────────

function createClient(): AzureOpenAI | null {
  const { apiKey, endpoint, apiVersion } = config.azureOpenAI;

  if (!apiKey || apiKey.length === 0) {
    return null;
  }

  if (!endpoint || endpoint.includes("localhost")) {
    return null;
  }

  try {
    const client = new AzureOpenAI({
      apiKey,
      endpoint,
      apiVersion,
    });
    return client;
  } catch {
    return null;
  }
}

// ─── Main Export ─────────────────────────────────────────────────────────────

/**
 * Generates a draft response for a DM using Azure OpenAI GPT with RAG context.
 * Sanitizes PII from prompts, computes confidence based on context quality,
 * and falls back to a template response if the API call fails.
 */
export async function generateDraftResponse(
  dmContent: string,
  context: KnowledgeBaseEntry[],
  senderName: string
): Promise<DraftResponse> {
  // Sanitize DM content to remove PII before sending to LLM
  const sanitizedContent = sanitizePII(dmContent);

  // Compute confidence score based on context match quality
  const confidenceScore = computeConfidenceScore(dmContent, context);

  // Attempt to create Azure OpenAI client
  const client = createClient();

  if (!client) {
    // No valid client configuration — return fallback
    const fallback = generateFallbackResponse(senderName);
    return {
      text: fallback.text,
      confidenceScore: Math.min(confidenceScore, fallback.confidenceScore),
    };
  }

  const systemPrompt = buildSystemPrompt();
  const contextBlock = buildContextBlock(context);
  const userPrompt = buildUserPrompt(sanitizedContent, senderName, contextBlock);

  const maxRetries = 2;
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const completion = await client.chat.completions.create({
        model: config.azureOpenAI.deployment,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 500,
        temperature: 0.7,
        top_p: 0.9,
      });

      const responseText =
        completion.choices?.[0]?.message?.content?.trim() ?? null;

      if (!responseText || responseText.length === 0) {
        lastError = new Error("Empty response from Azure OpenAI");
        continue;
      }

      // Sanitize the response to ensure no PII leaked through
      const sanitizedResponse = sanitizePII(responseText);

      return {
        text: sanitizedResponse,
        confidenceScore,
      };
    } catch (err: unknown) {
      lastError = err;

      // If this is not the last attempt, wait before retrying with exponential backoff
      if (attempt < maxRetries) {
        const delayMs = Math.pow(2, attempt) * 500;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  // All retries exhausted — log error and return fallback
  if (lastError instanceof Error) {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "error",
        message: "Azure OpenAI draft generation failed after retries",
        error: lastError.message,
      })
    );
  }

  return generateFallbackResponse(senderName);
}