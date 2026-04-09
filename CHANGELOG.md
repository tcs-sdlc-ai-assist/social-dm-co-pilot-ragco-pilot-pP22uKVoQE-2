# Changelog

All notable changes to the **social-dm-copilot** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-01-01

### Added

- **Unified DM Inbox**
  - Aggregated direct message inbox across multiple social platforms (Instagram, Facebook, Twitter/X, LinkedIn).
  - Real-time message ingestion with platform-specific metadata (sender handle, timestamp, platform identifier).
  - DM status tracking through lifecycle stages: `new`, `drafted`, `sent`, `escalated`.
  - Paginated API responses for efficient inbox browsing and filtering.

- **RAG + GPT Draft Generation**
  - Retrieval-Augmented Generation pipeline combining a knowledge base with GPT-powered response drafting.
  - Knowledge base management with categorized entries, keyword tagging, and contextual search.
  - Confidence scoring on generated drafts (`high`, `medium`, `low`) to guide reviewer attention.
  - Referenced context IDs linking each draft back to the knowledge base entries used during generation.
  - Editable draft text allowing agents to refine AI-generated responses before sending.

- **Human Review Workflow**
  - Draft review system with `pending`, `approved`, `rejected`, and `sent` status tracking.
  - Role-based access control with four user roles: `admin`, `agent`, `reviewer`, `readonly`.
  - Reviewer attribution and timestamp recording on every draft decision.
  - Escalation path for low-confidence drafts requiring senior review.

- **Lead Extraction and Salesforce Sync**
  - Automated lead extraction from inbound DMs with intent detection.
  - Candidate lead identification with structured fields: name, contact, budget, location, and intent.
  - Lead priority classification (`high`, `medium`, `low`) based on extracted signals.
  - Lead lifecycle management through statuses: `new`, `contacted`, `qualified`, `converted`, `lost`.
  - Salesforce integration with external ID mapping (`salesforceId`) for bidirectional sync.

- **Notification and SLA Management**
  - Multi-channel notification delivery: `email`, `sms`, `in_app`, `slack`.
  - Notification types covering key workflow events: `lead_created`, `draft_ready`, `escalation`, `review_needed`.
  - Notification status tracking: `pending`, `sent`, `failed`, `read`.
  - SLA-aware alerting to ensure timely response to inbound messages and pending reviews.

- **Audit Logging**
  - Comprehensive audit trail for all system actions with actor identification.
  - Structured log entries capturing action type, entity type, entity ID, and detailed metadata.
  - Timestamped records for compliance, debugging, and operational visibility.

- **JWT Authentication**
  - JSON Web Token-based authentication for all API endpoints.
  - User management with profile data: email, name, role, avatar URL.
  - Session tracking with `createdAt` and `lastLoginAt` timestamps.
  - Role-based authorization enforcing permissions across admin, agent, reviewer, and readonly roles.

- **API Foundation**
  - Typed API response wrappers (`APIResponse<T>`, `PaginatedResponse<T>`) for consistent client contracts.
  - Pagination support with page, page size, total items, and total pages metadata.
  - Standardized error responses with success flag, error message, and timestamp.