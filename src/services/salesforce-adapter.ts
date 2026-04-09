import { v4 as uuidv4 } from "uuid";
import type { Lead } from "../types";
import { logAction } from "./audit-logger";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SalesforceLeadResponse {
  salesforceId: string;
  success: boolean;
}

export interface SalesforceUpdateResponse {
  success: boolean;
}

export interface SalesforceConnectionStatus {
  connected: boolean;
  instanceUrl: string;
  timestamp: string;
}

interface SalesforceApiError {
  code: string;
  message: string;
  isTransient: boolean;
}

// ─── Configuration ───────────────────────────────────────────────────────────

const SALESFORCE_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 200,
  maxDelayMs: 2000,
  simulatedLatencyMs: 150,
  connectionTimeoutMs: 5000,
} as const;

// ─── Circuit Breaker State ───────────────────────────────────────────────────

interface CircuitBreakerState {
  failures: number;
  lastFailureAt: number | null;
  isOpen: boolean;
}

const circuitBreaker: CircuitBreakerState = {
  failures: 0,
  lastFailureAt: null,
  isOpen: false,
};

const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_RESET_MS = 60_000; // 1 minute

function checkCircuitBreaker(): boolean {
  if (!circuitBreaker.isOpen) {
    return true;
  }

  // Check if enough time has passed to attempt a reset
  if (
    circuitBreaker.lastFailureAt !== null &&
    Date.now() - circuitBreaker.lastFailureAt >= CIRCUIT_BREAKER_RESET_MS
  ) {
    circuitBreaker.isOpen = false;
    circuitBreaker.failures = 0;
    circuitBreaker.lastFailureAt = null;
    return true;
  }

  return false;
}

function recordSuccess(): void {
  circuitBreaker.failures = 0;
  circuitBreaker.isOpen = false;
  circuitBreaker.lastFailureAt = null;
}

function recordFailure(): void {
  circuitBreaker.failures += 1;
  circuitBreaker.lastFailureAt = Date.now();

  if (circuitBreaker.failures >= CIRCUIT_BREAKER_THRESHOLD) {
    circuitBreaker.isOpen = true;
  }
}

// ─── Simulated Delay ─────────────────────────────────────────────────────────

function simulateLatency(baseMs: number): Promise<void> {
  // Add jitter: ±30% of base latency
  const jitter = baseMs * 0.3 * (Math.random() * 2 - 1);
  const delay = Math.max(10, Math.round(baseMs + jitter));
  return new Promise((resolve) => setTimeout(resolve, delay));
}

// ─── Retry Logic ─────────────────────────────────────────────────────────────

async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  maxRetries: number = SALESFORCE_CONFIG.maxRetries,
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      lastError = error;

      // Check if the error is transient and retryable
      const apiError = parseApiError(error);
      if (!apiError.isTransient) {
        throw error;
      }

      if (attempt < maxRetries) {
        // Exponential backoff with jitter
        const backoffMs = Math.min(
          SALESFORCE_CONFIG.baseDelayMs * Math.pow(2, attempt) +
            Math.random() * SALESFORCE_CONFIG.baseDelayMs,
          SALESFORCE_CONFIG.maxDelayMs,
        );
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }
  }

  throw lastError ?? new Error(`${operationName} failed after ${maxRetries + 1} attempts`);
}

function parseApiError(error: Error): SalesforceApiError {
  const message = error.message.toLowerCase();

  // Transient errors that should be retried
  if (
    message.includes("timeout") ||
    message.includes("rate limit") ||
    message.includes("503") ||
    message.includes("502") ||
    message.includes("connection") ||
    message.includes("econnreset") ||
    message.includes("temporarily unavailable")
  ) {
    return {
      code: "TRANSIENT_ERROR",
      message: error.message,
      isTransient: true,
    };
  }

  // Permanent errors that should not be retried
  return {
    code: "PERMANENT_ERROR",
    message: error.message,
    isTransient: false,
  };
}

// ─── Salesforce ID Generation (Simulated) ────────────────────────────────────

function generateSalesforceId(): string {
  // Salesforce IDs are 18-character alphanumeric strings
  // Simulate with a realistic format: prefix + unique portion
  const prefix = "00Q"; // Standard Salesforce Lead prefix
  const unique = uuidv4().replace(/-/g, "").substring(0, 15).toUpperCase();
  return `${prefix}${unique}`;
}

// ─── Lead Field Mapping ──────────────────────────────────────────────────────

interface SalesforceLeadPayload {
  FirstName: string;
  LastName: string;
  Email: string | null;
  Phone: string | null;
  Company: string;
  LeadSource: string;
  Description: string;
  Status: string;
  Custom_Budget__c: string | null;
  Custom_Location__c: string | null;
  Custom_Intent__c: string;
  Custom_Priority__c: string;
  Custom_DM_Id__c: string;
}

function mapLeadToSalesforcePayload(lead: Lead): SalesforceLeadPayload {
  const nameParts = lead.name.trim().split(/\s+/);
  const firstName = nameParts.length > 1 ? nameParts.slice(0, -1).join(" ") : lead.name;
  const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : lead.name;

  // Determine if contact is email or phone
  const isEmail = lead.contact.includes("@");
  const email = isEmail ? lead.contact : null;
  const phone = !isEmail ? lead.contact : null;

  return {
    FirstName: firstName,
    LastName: lastName,
    Email: email,
    Phone: phone,
    Company: "[Not Provided]",
    LeadSource: "Social Media DM",
    Description: lead.intent,
    Status: mapLeadStatusToSalesforce(lead.status),
    Custom_Budget__c: lead.budget,
    Custom_Location__c: lead.location,
    Custom_Intent__c: lead.intent,
    Custom_Priority__c: lead.priority,
    Custom_DM_Id__c: lead.dmId,
  };
}

function mapLeadStatusToSalesforce(status: string): string {
  const statusMap: Record<string, string> = {
    new: "Open - Not Contacted",
    contacted: "Working - Contacted",
    qualified: "Closed - Converted",
    converted: "Closed - Converted",
    lost: "Closed - Not Converted",
  };

  return statusMap[status] ?? "Open - Not Contacted";
}

// ─── Simulated Salesforce API Calls ──────────────────────────────────────────

/**
 * Simulates a Salesforce REST API POST /services/data/vXX.0/sobjects/Lead/
 * In production, replace this with actual HTTP calls to Salesforce.
 */
async function simulateCreateLeadApiCall(
  payload: SalesforceLeadPayload,
): Promise<{ id: string; success: boolean; errors: string[] }> {
  await simulateLatency(SALESFORCE_CONFIG.simulatedLatencyMs);

  // Simulate occasional transient failures (5% chance)
  if (Math.random() < 0.05) {
    throw new Error("Salesforce API temporarily unavailable (503)");
  }

  // Validate required fields
  if (!payload.LastName || payload.LastName.trim().length === 0) {
    throw new Error("REQUIRED_FIELD_MISSING: LastName is required");
  }

  const salesforceId = generateSalesforceId();

  return {
    id: salesforceId,
    success: true,
    errors: [],
  };
}

/**
 * Simulates a Salesforce REST API PATCH /services/data/vXX.0/sobjects/Lead/{id}
 * In production, replace this with actual HTTP calls to Salesforce.
 */
async function simulateUpdateLeadApiCall(
  salesforceId: string,
  updates: Partial<SalesforceLeadPayload>,
): Promise<{ success: boolean; errors: string[] }> {
  await simulateLatency(SALESFORCE_CONFIG.simulatedLatencyMs);

  // Simulate occasional transient failures (5% chance)
  if (Math.random() < 0.05) {
    throw new Error("Salesforce API temporarily unavailable (503)");
  }

  // Validate salesforce ID format
  if (!salesforceId || salesforceId.length < 15) {
    throw new Error("INVALID_ID: Salesforce ID is invalid");
  }

  // Simulate not found (very rare in simulation)
  if (salesforceId === "NOT_FOUND") {
    throw new Error("NOT_FOUND: Lead not found in Salesforce");
  }

  return {
    success: true,
    errors: [],
  };
}

/**
 * Simulates a Salesforce REST API GET /services/data/ (connection check)
 * In production, replace this with actual HTTP call to Salesforce.
 */
async function simulateConnectionCheck(): Promise<boolean> {
  await simulateLatency(SALESFORCE_CONFIG.simulatedLatencyMs / 2);

  // Simulate connection success (95% of the time)
  return Math.random() >= 0.05;
}

// ─── Exported Functions ──────────────────────────────────────────────────────

/**
 * Creates a lead in Salesforce CRM.
 * Maps the internal Lead model to Salesforce field format and submits via API.
 * Includes retry logic with exponential backoff for transient failures.
 * Circuit breaker prevents cascading failures during Salesforce outages.
 *
 * @param lead - The lead to create in Salesforce
 * @returns Object containing the Salesforce ID and success status
 */
export async function createLead(
  lead: Lead,
): Promise<SalesforceLeadResponse> {
  // Check circuit breaker
  if (!checkCircuitBreaker()) {
    logAction(
      "salesforce_sync_blocked",
      "system",
      {
        leadId: lead.id,
        reason: "Circuit breaker is open — Salesforce API unavailable",
      },
      "lead",
      lead.id,
    );

    return {
      salesforceId: "",
      success: false,
    };
  }

  const payload = mapLeadToSalesforcePayload(lead);

  try {
    const result = await withRetry(
      () => simulateCreateLeadApiCall(payload),
      "createLead",
    );

    recordSuccess();

    logAction(
      "salesforce_lead_created",
      "system",
      {
        leadId: lead.id,
        salesforceId: result.id,
        leadName: lead.name,
        priority: lead.priority,
      },
      "lead",
      lead.id,
    );

    return {
      salesforceId: result.id,
      success: result.success,
    };
  } catch (err: unknown) {
    recordFailure();

    const errorMessage =
      err instanceof Error ? err.message : "Unknown Salesforce API error";

    logAction(
      "salesforce_lead_create_failed",
      "system",
      {
        leadId: lead.id,
        error: errorMessage,
        circuitBreakerFailures: circuitBreaker.failures,
      },
      "lead",
      lead.id,
    );

    return {
      salesforceId: "",
      success: false,
    };
  }
}

/**
 * Updates an existing lead in Salesforce CRM.
 * Maps partial Lead updates to Salesforce field format and submits via API.
 * Includes retry logic with exponential backoff for transient failures.
 *
 * @param salesforceId - The Salesforce ID of the lead to update
 * @param updates - Partial lead fields to update
 * @returns Whether the update was successful
 */
export async function updateLead(
  salesforceId: string,
  updates: Partial<Lead>,
): Promise<boolean> {
  if (!salesforceId || salesforceId.trim().length === 0) {
    logAction(
      "salesforce_lead_update_failed",
      "system",
      {
        salesforceId,
        error: "Missing Salesforce ID",
      },
      "lead",
      salesforceId ?? "unknown",
    );
    return false;
  }

  // Check circuit breaker
  if (!checkCircuitBreaker()) {
    logAction(
      "salesforce_update_blocked",
      "system",
      {
        salesforceId,
        reason: "Circuit breaker is open — Salesforce API unavailable",
      },
      "lead",
      salesforceId,
    );
    return false;
  }

  // Map partial updates to Salesforce payload fields
  const sfUpdates: Partial<SalesforceLeadPayload> = {};

  if (updates.name !== undefined) {
    const nameParts = updates.name.trim().split(/\s+/);
    sfUpdates.FirstName =
      nameParts.length > 1 ? nameParts.slice(0, -1).join(" ") : updates.name;
    sfUpdates.LastName =
      nameParts.length > 1 ? nameParts[nameParts.length - 1] : updates.name;
  }

  if (updates.contact !== undefined) {
    const isEmail = updates.contact.includes("@");
    if (isEmail) {
      sfUpdates.Email = updates.contact;
    } else {
      sfUpdates.Phone = updates.contact;
    }
  }

  if (updates.budget !== undefined) {
    sfUpdates.Custom_Budget__c = updates.budget;
  }

  if (updates.location !== undefined) {
    sfUpdates.Custom_Location__c = updates.location;
  }

  if (updates.intent !== undefined) {
    sfUpdates.Custom_Intent__c = updates.intent;
    sfUpdates.Description = updates.intent;
  }

  if (updates.priority !== undefined) {
    sfUpdates.Custom_Priority__c = updates.priority;
  }

  if (updates.status !== undefined) {
    sfUpdates.Status = mapLeadStatusToSalesforce(updates.status);
  }

  try {
    const result = await withRetry(
      () => simulateUpdateLeadApiCall(salesforceId, sfUpdates),
      "updateLead",
    );

    recordSuccess();

    logAction(
      "salesforce_lead_updated",
      "system",
      {
        salesforceId,
        updatedFields: Object.keys(sfUpdates),
      },
      "lead",
      salesforceId,
    );

    return result.success;
  } catch (err: unknown) {
    recordFailure();

    const errorMessage =
      err instanceof Error ? err.message : "Unknown Salesforce API error";

    logAction(
      "salesforce_lead_update_failed",
      "system",
      {
        salesforceId,
        error: errorMessage,
        circuitBreakerFailures: circuitBreaker.failures,
      },
      "lead",
      salesforceId,
    );

    return false;
  }
}

/**
 * Checks the connection to Salesforce CRM.
 * Verifies that the Salesforce API is reachable and authentication is valid.
 *
 * @returns Whether the connection to Salesforce is healthy
 */
export async function checkConnection(): Promise<boolean> {
  try {
    const isConnected = await simulateConnectionCheck();

    if (isConnected) {
      recordSuccess();
    } else {
      recordFailure();
    }

    logAction(
      "salesforce_connection_check",
      "system",
      {
        connected: isConnected,
        circuitBreakerOpen: circuitBreaker.isOpen,
        circuitBreakerFailures: circuitBreaker.failures,
      },
      "system",
      "salesforce",
    );

    return isConnected;
  } catch (err: unknown) {
    recordFailure();

    const errorMessage =
      err instanceof Error ? err.message : "Unknown connection error";

    logAction(
      "salesforce_connection_check_failed",
      "system",
      {
        error: errorMessage,
        circuitBreakerOpen: circuitBreaker.isOpen,
      },
      "system",
      "salesforce",
    );

    return false;
  }
}

/**
 * Returns the current status of the Salesforce connection,
 * including circuit breaker state.
 */
export function getConnectionStatus(): SalesforceConnectionStatus {
  return {
    connected: !circuitBreaker.isOpen,
    instanceUrl:
      process.env.SALESFORCE_INSTANCE_URL ?? "https://localhost.my.salesforce.com",
    timestamp: new Date().toISOString(),
  };
}

/**
 * Resets the circuit breaker state.
 * Useful for administrative recovery after a Salesforce outage is resolved.
 */
export function resetCircuitBreaker(): void {
  circuitBreaker.failures = 0;
  circuitBreaker.lastFailureAt = null;
  circuitBreaker.isOpen = false;

  logAction(
    "salesforce_circuit_breaker_reset",
    "system",
    { resetAt: new Date().toISOString() },
    "system",
    "salesforce",
  );
}