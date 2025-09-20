# Empire OS — Codex Implementation Briefing

## Quick summary (what to build)

A single, modular web application (single-pane-of-glass) that:

* logs **every atomic event** (append-only event stream),
* stores canonical, strongly-relational data model (no free-text canonical fields),
* stores raw blobs in object store and semantic vectors in a vector DB,
* runs **agents** that find/organize/integrate/predict/operate on logs (FOIP),
* supports deterministic automations (n8n/webhooks) and human approvals,
* provides an advanced UI with a command palette, replay mode, simulation canvas, and entity pages,
* supports enterprise-grade security (AD/RBAC, MFA/YubiKey, encryption, Merkle chaining for immutability),
* keeps everything auditable and presentable for external reviewers.

Target stack suggestion (reference; replace as desired):

* Backend: Node.js / TypeScript (Express/Fastify) or Python (FastAPI).
* DB: Postgres (primary relational), pgvector or external vector DB (Pinecone/Weaviate) for embeddings.
* Object store: S3-compatible (MinIO / AWS S3).
* Stream processing: Kafka or Postgres logical replication for scale.
* Automation: n8n for webhook-driven flows.
* Frontend: Next.js + Tailwind or equivalent.
* Auth/IAM: Keycloak or custom AD-like service; HashiCorp Vault for secrets.
* Deployment: Docker + Kubernetes (or Proxmox VMs if private infra).
* AI: OpenAI or local LLM for parsing, embeddings; careful model governance.

---

## 1 — High-level architecture

1. **Ingest Layer**

   * Receives file uploads, webhooks (email, payments), manual inputs, API calls.
   * Immediately stores raw blobs in object storage and creates `media_object` records.
   * Emits a canonical `ingest_event` into the event stream.

2. **Parser & Normalizer**

   * Deterministic parsers + AI parsers:

     * Emails (.eml), PDFs, invoices, receipts, CSV lists, images (OCR), audio (speech → text).
   * Outputs structured rows (purchase_orders, people, vendors, etc.) and `parser_confidence`.
   * Low-confidence items pushed to human review queue.

3. **Vectorizer**

   * Text (extracted text), transcripts, and OCR → embeddings (store either in pgvector or vector DB).
   * Embedding id referenced in relational row.

4. **Event Stream & Store**

   * Master append-only `events` table (bigserial) and/or Kafka topic.
   * All operations produce events (user actions, agent actions, automated operations).

5. **Relational DB (Postgres)**

   * Canonical tables (strongly normalized).
   * Every canonical field that could be reused is its own table (towns, vendors, platforms, products, etc.).

6. **Agents & Intelligence Layer**

   * Microservices that subscribe to events, run semantic search / classification / predictions, propose or execute actions.
   * Agents also record their assumptions, seeds, config, and outputs (fully auditable).

7. **Automation Layer (n8n)**

   * Webhook endpoints for triggering flows; must be part of the event pipeline.
   * n8n runs enrichment, external API calls, or internal triggers (e.g., create shipment, mark insurance).

8. **Frontend (Next.js)**

   * Command palette, mission control, entity pages, replay mode, simulation console, agent console, developer integrations.

9. **Security & Governance**

   * AD-like directory for users and service accounts. RBAC + ABAC (attributes like `llc_id`, `classification`, `role`).
   * All events signed where appropriate; media hashed and stored; optional Merkle chain snapshots.
   * Keys in Vault; encryption at rest and in transit.

---

## 2 — Primary goals for Codex to implement now

1. Build a minimal working foundation that proves the core FOIP loop: ingest → parse → store → vectorize → event → agent suggestion.
2. Make canonical relational model for core entities (LLC, people, events, media, vendors, purchases, shipments, assets, claims, transactions).
3. Provide one UI flow: upload a purchase PDF → system parses → creates `purchase_order`, `vendor` (or links), `media_object`, `event`, and an asset record if delivered.
4. Add semantic search (vector query) on documents + claim tracking.
5. Implement an agent (FinanceAgent) prototype that suggests “create repayment plan” or “flag payment overdue” with an action button that creates an `events` entry when approved.

---

## 3 — Canonical data model (core tables + explanation)

Below is an abbreviated DDL for the **core** objects. Use this as the master schema scaffold. After this core, additional tables (email lineage, call logs, SCIF visitors, backups, etc.) follow the same pattern.

> Note: this is *starter DDL* — indexes, partitioning, and tuning come next. Also consider separating event store into partitioned table(s).

### Core SQL DDL (Postgres — master set)

```sql
-- =======================================================
-- MASTER ENTITIES
-- =======================================================

CREATE TABLE llcs (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  ein TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE people (
  id BIGSERIAL PRIMARY KEY,
  llc_id BIGINT REFERENCES llcs(id),
  name TEXT,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  person_id BIGINT REFERENCES people(id),
  username TEXT UNIQUE,
  display_name TEXT,
  auth_provider TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE towns (
  id BIGSERIAL PRIMARY KEY,
  name TEXT UNIQUE
);

CREATE TABLE platforms (
  id BIGSERIAL PRIMARY KEY,
  name TEXT,
  notes TEXT
);

CREATE TABLE vendors (
  id BIGSERIAL PRIMARY KEY,
  name TEXT,
  vendor_identifier TEXT,
  platform_id BIGINT REFERENCES platforms(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =======================================================
-- MEDIA & VECTORS
-- =======================================================

CREATE TABLE media_objects (
  id BIGSERIAL PRIMARY KEY,
  llc_id BIGINT REFERENCES llcs(id),
  media_type TEXT, -- pdf, image, audio, eml, csv
  mime TEXT,
  s3_pointer TEXT,
  sha256 TEXT,
  extracted_text TEXT,
  parsed_json JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE embeddings (
  id BIGSERIAL PRIMARY KEY,
  media_id BIGINT REFERENCES media_objects(id),
  model_name TEXT,
  vector_id TEXT,
  dim INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =======================================================
-- EVENT STREAM & CLAIMS
-- =======================================================

CREATE TABLE events (
  id BIGSERIAL PRIMARY KEY,
  ts TIMESTAMPTZ DEFAULT now(),
  llc_id BIGINT REFERENCES llcs(id),
  actor_type TEXT, -- user, agent, system, webhook
  actor_id BIGINT,
  event_type TEXT,
  entity_type TEXT,
  entity_id BIGINT,
  payload JSONB,
  media_id BIGINT REFERENCES media_objects(id),
  signature TEXT,
  hash TEXT
);

CREATE TABLE claims (
  id BIGSERIAL PRIMARY KEY,
  llc_id BIGINT REFERENCES llcs(id),
  claim_text TEXT,
  source_event_id BIGINT REFERENCES events(id),
  asserted_by_actor BIGINT,
  asserted_at TIMESTAMPTZ DEFAULT now(),
  confidence NUMERIC,
  status TEXT DEFAULT 'unverified',
  meta JSONB
);

CREATE TABLE claim_verifications (
  id BIGSERIAL PRIMARY KEY,
  claim_id BIGINT REFERENCES claims(id),
  verifier_actor BIGINT,
  verification_event_id BIGINT REFERENCES events(id),
  result TEXT, -- supports, refutes, inconclusive
  score NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =======================================================
-- PURCHASES & SUPPLY CHAIN
-- =======================================================

CREATE TABLE purchase_orders (
  id BIGSERIAL PRIMARY KEY,
  llc_id BIGINT REFERENCES llcs(id),
  vendor_id BIGINT REFERENCES vendors(id),
  platform_id BIGINT REFERENCES platforms(id),
  order_number TEXT,
  currency TEXT,
  total_amount NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now(),
  parsed_json JSONB
);

CREATE TABLE purchase_items (
  id BIGSERIAL PRIMARY KEY,
  purchase_order_id BIGINT REFERENCES purchase_orders(id),
  description TEXT,
  sku TEXT,
  quantity INT,
  unit_price NUMERIC,
  meta JSONB
);

CREATE TABLE shipments (
  id BIGSERIAL PRIMARY KEY,
  purchase_order_id BIGINT REFERENCES purchase_orders(id),
  carrier TEXT,
  tracking_number TEXT,
  insured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  meta JSONB
);

CREATE TABLE shipment_events (
  id BIGSERIAL PRIMARY KEY,
  shipment_id BIGINT REFERENCES shipments(id),
  event_ts TIMESTAMPTZ DEFAULT now(),
  status TEXT,
  location TEXT,
  meta JSONB
);

CREATE TABLE assets (
  id BIGSERIAL PRIMARY KEY,
  llc_id BIGINT REFERENCES llcs(id),
  purchase_item_id BIGINT REFERENCES purchase_items(id),
  serial_number TEXT,
  current_status TEXT, -- in_transit, received, in_use, disposed
  location_id BIGINT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =======================================================
-- TREASURY & ACCOUNTS
-- =======================================================

CREATE TABLE accounts (
  id BIGSERIAL PRIMARY KEY,
  llc_id BIGINT REFERENCES llcs(id),
  name TEXT,
  account_type TEXT,
  meta JSONB
);

CREATE TABLE transactions (
  id BIGSERIAL PRIMARY KEY,
  llc_id BIGINT REFERENCES llcs(id),
  account_id BIGINT REFERENCES accounts(id),
  amount NUMERIC,
  currency TEXT,
  tx_type TEXT, -- credit, debit
  reference TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  meta JSONB
);

-- =======================================================
-- HR & DIRECTORY
-- =======================================================

CREATE TABLE employees (
  id BIGSERIAL PRIMARY KEY,
  person_id BIGINT REFERENCES people(id),
  llc_id BIGINT REFERENCES llcs(id),
  position TEXT,
  hire_date DATE,
  status TEXT,
  meta JSONB
);

CREATE TABLE payroll (
  id BIGSERIAL PRIMARY KEY,
  employee_id BIGINT REFERENCES employees(id),
  amount NUMERIC,
  currency TEXT,
  pay_date DATE,
  meta JSONB
);

CREATE TABLE training_logs (
  id BIGSERIAL PRIMARY KEY,
  employee_id BIGINT REFERENCES employees(id),
  training_name TEXT,
  completed BOOLEAN,
  completed_at TIMESTAMPTZ,
  meta JSONB
);

-- =======================================================
-- SCIF & SECURITY
-- =======================================================

CREATE TABLE scif_visitors (
  id BIGSERIAL PRIMARY KEY,
  name TEXT,
  affiliation TEXT,
  visit_date DATE,
  purpose TEXT,
  signed_in_by BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE backups (
  id BIGSERIAL PRIMARY KEY,
  llc_id BIGINT REFERENCES llcs(id),
  backup_date TIMESTAMPTZ,
  storage_pointer TEXT,
  checksum TEXT,
  status TEXT,
  meta JSONB
);

CREATE TABLE sop_documents (
  id BIGSERIAL PRIMARY KEY,
  llc_id BIGINT REFERENCES llcs(id),
  title TEXT,
  sop_text TEXT,
  version INT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ
);

-- =======================================================
-- COMMUNICATIONS
-- =======================================================

CREATE TABLE emails (
  id BIGSERIAL PRIMARY KEY,
  llc_id BIGINT REFERENCES llcs(id),
  from_address TEXT,
  to_address TEXT,
  subject TEXT,
  body TEXT,
  sent_at TIMESTAMPTZ,
  media_id BIGINT REFERENCES media_objects(id)
);

CREATE TABLE call_logs (
  id BIGSERIAL PRIMARY KEY,
  llc_id BIGINT REFERENCES llcs(id),
  caller TEXT,
  callee TEXT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  transcript TEXT,
  media_id BIGINT REFERENCES media_objects(id)
);

-- =======================================================
-- AGENTS, PLANS, SIMULATIONS
-- =======================================================

CREATE TABLE agents (
  id BIGSERIAL PRIMARY KEY,
  llc_id BIGINT REFERENCES llcs(id),
  name TEXT,
  description TEXT,
  config JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE plans (
  id BIGSERIAL PRIMARY KEY,
  llc_id BIGINT REFERENCES llcs(id),
  name TEXT,
  created_by BIGINT,
  plan_json JSONB,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE simulations (
  id BIGSERIAL PRIMARY KEY,
  plan_id BIGINT REFERENCES plans(id),
  inputs JSONB,
  seed BIGINT,
  model_version TEXT,
  results JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =======================================================
-- AUDIT & OVERSIGHT
-- =======================================================

CREATE TABLE audit_entries (
  id BIGSERIAL PRIMARY KEY,
  event_id BIGINT REFERENCES events(id),
  auditor_id BIGINT,
  correction JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

> This is a core minimal set — add email tables, call logs, SCIF visitors, backups, SOPs, etc., following these patterns.

---

## 4 — Ingestion & webhook contracts (practical specs)

Design a single, consistent webhook API for external connectors (n8n, mail provider, payment gateway). All webhooks must:

* accept a signed payload (HMAC with shared secret),
* return 2xx on success,
* insert a raw `media_object` if contains files and emit an `ingest_event` into `events`.

### Example webhook (POST /api/webhooks/ingest)

Request headers:

```
X-Hub-Signature: sha256=<hmac>
X-Source: mailgun | stripe | ebay | s3 | custom
X-Sent-At: 2025-09-19T12:34:56Z
```

Body (JSON):

```json
{
  "source":"mailgun",
  "source_id":"MG-evt-abc123",
  "llc_id": 1,
  "raw_payload": { ... },       // full provider webhook JSON
  "attachments": [
    {
      "filename":"invoice.pdf",
      "content_base64":"...",
      "mime":"application/pdf"
    }
  ],
  "meta": {"received_ip":"1.2.3.4"}
}
```

Server:

* verify header HMAC,
* store attachments to object store (`s3_pointer`),
* create `media_objects` rows,
* create `events` row `{event_type: "webhook_ingest", payload: raw_payload, media_id: ...}`.

### Example event (events.payload)

```json
{
  "raw": { /* raw webhook */ },
  "parsed": { /* parser results (if synchronous) */ },
  "source":"mailgun",
  "source_id":"MG-evt-abc123"
}
```

---

## 5 — n8n flow outline (example)

(Flow: webhook → store raw → parse → vectorize → insert structured rows → emit events)

1. **Webhook Trigger**: /api/webhooks/ingest
2. **Save Attachments**: write files to S3 (MinIO) — return s3 pointers.
3. **POST to Parser Service**: send s3 pointers to parser endpoint; parser returns structured JSON + confidence.
4. **DB Insert**: Insert `media_objects` + parsed structured rows (purchase_orders, people) via API backend.
5. **Embedding Job**: call embedding function; store embedding id in DB or push to vector DB.
6. **Emit Event**: POST to /api/events with canonical event payload.
7. **Agent Trigger**: agent microservices subscribe to events (via Kafka/DB triggers) to run their logic.

---

## 6 — Agents & intelligence (design pattern)

* Agents are event-driven microservices:

  * subscribe to `events` (or Kafka topics),
  * run a logic pipeline: enrich (relational + vector search) → score → propose action,
  * propose action is recorded in `events` and shown in Agent Console for approval (or auto-executed if policy allows),
  * every agent action recorded as `events` and `audit_entries`.

**Agent examples**

* FinanceAgent: predicts cash runway, recommends intercompany loan, suggests payments scheduling.
* OpsAgent: monitors shipments, suggests alternate carrier on delay probability.
* ComplianceAgent: scans contracts against SOP, flags missing clauses.
* KnowledgeAgent: cluster docs, creates summaries and new SOP drafts.

**Agent governance**

* each agent must have a config (in `agents.config`), versioned,
* each run stores inputs, model_version, seed, outputs in `simulations` or `agent_actions` table.

---

## 7 — Claims & falsehood handling

Design `claims` as first-class objects:

* every transcribed statement, extracted assertion, or user-entered claim produces a `claims` row referencing its `source_event_id`.
* claims have **verification events**: attempts to validate supported/refute via evidence (shipments, logs, receipts).
* the UI shows a claim timeline: asserted → verified/refuted/inconclusive → human review.
* never delete or overwrite claims; always append verification events.

---

## 8 — UI/UX design (key screens & behaviors)

### Global chrome

* Left rail: LLC switcher (select an LLC context), modules list (Dashboard, Finance, Assets, HR, Comms, Agents, SCIF).
* Top bar: command palette (⌘+C), global search (semantic + relational), quick-add.

### Mission Control dashboard

* Empire rollups: consolidated treasury, assets at risk, top alerts, current simulations.
* Heat map / graph for inter-LLC flows, royalties, loans.

### Entity page (contract, asset, purchase, person)

* Header summary (canonical info).
* Timeline (events) with filters (all / agent actions / user actions / webhooks).
* Raw media (PDF, audio) with extracted text and vector similarity panel.
* Related entities (linked contracts, invoices, people).
* Claim panel (assertions + verifications).
* Action buttons: create plan, start simulation, escalate to audit.

### Command palette examples

* “Log purchase from eBay seller xyz, order 123” → opens quick modal → creates purchase and event.
* “Simulate 20% revenue drop for LLC-3” → run simulation UI, present outputs.
* “Find documents similar to contract #456” → vector search results.

### Replay Mode

* Play events for an entity in chronological order, show media at time of event, allow step back/forward.

### Agent Console

* Pending suggestions, recommended actions, approvals, action history.

---

## 9 — Security & compliance

**Identity**

* Built-in AD-like directory: users/groups/roles. SSO (SAML/OAuth2) for enterprise.
* Each user assigned attributes: allowed_llcs[], clearance_level, roles[].

**Authentication**

* MFA (TOTP + FIDO2 hardware keys).
* Service accounts for agents with limited scopes.

**Data protection**

* Raw blobs encrypted with envelope encryption; keys in Vault.
* Field-level redaction for Boardroom mode.
* Logging of all accesses (create, read, update events are recorded — reads also logged if sensitive).

**Immutability & provenance**

* Events append-only; store hash + optional signature.
* Optional periodic merkle-root snapshot of events for tamper-proof proofs.

**Model governance**

* Every model/agent run stores model_version, prompt, input dataset references, seed, outputs — all stored as events.

**Legal / privacy**

* Implement access controls for PII; provide export and redaction tools; maintain a compliance audit view.

---

## 10 — .env / configuration variables (minimum)

```
# Database
DATABASE_URL=postgres://user:pass@db:5432/empire

# Object store
S3_ENDPOINT=https://minio.local
S3_BUCKET=empire-raw
S3_ACCESS_KEY=...
S3_SECRET_KEY=...

# Vector DB
VECTOR_PROVIDER=pgvector|pinecone|weaviate
VECTOR_DB_URL=...

# Embeddings / LLM
EMBEDDINGS_API_URL=https://api.openai.com/v1/embeddings
EMBEDDINGS_API_KEY=sk-...

# Webhook secret
WEBHOOK_SECRET=supersecret

# Agent config
AGENT_SERVICE_URL=http://agents:9000
AGENT_SIGNING_KEY=...

# Security & Vault
VAULT_ADDR=https://vault.local
VAULT_TOKEN=...

# App
APP_HOST=0.0.0.0
APP_PORT=3000
JWT_SECRET=...

# AD/SSO
SSO_PROVIDER_URL=...
SSO_CLIENT_ID=...
SSO_CLIENT_SECRET=...

# Merkle snapshot config
MERKLE_WINDOW_SIZE=10000
```

---

## 11 — Example event payloads (practical)

**Webhook ingest event**

```json
{
  "type":"webhook_ingest",
  "source":"mailgun",
  "source_id":"MG-evt-abc123",
  "llc_id":1,
  "raw_payload": {/* raw provider payload */},
  "attachments":[{"s3_pointer":"s3://empire-raw/abc.pdf","sha256":"..."}]
}
```

**Purchase created event**

```json
{
  "type":"purchase_created",
  "llc_id":1,
  "actor_type":"system",
  "actor_id":0,
  "payload":{
    "purchase_order_id":234,
    "vendor_id":45,
    "order_number":"123-XYZ",
    "total_amount":125.50,
    "currency":"USD"
  },
  "media_id": 999
}
```

**Claim event**

```json
{
  "type":"claim_logged",
  "llc_id":1,
  "actor_type":"user",
  "actor_id":12,
  "payload":{
    "claim_id": 42,
    "claim_text":"Vendor X always delivers on time"
  },
  "media_id": 400 -- (link to meeting transcript)
}
```

---

## 12 — Roadmap & milestones (practical timeline)

### Phase 0 — Spec & infra (1-2 weeks)

* Finalize DDL for core schema (llcs, events, media, claims, purchases, shipments).
* Provision infra (Postgres, S3, vector DB, n8n, app skeleton).

### Phase 1 — MVP (6–8 weeks)

* Implement ingestion for CSV, PDF, .eml.
* Insert parsed rows into DB and create events.
* Basic UI: Mission Control + Entity page + command palette.
* Implement pgvector + simple semantic search on media text.

### Phase 2 — Core modules (8–12 weeks)

* Finance (accounts, transactions), Purchases & Shipments, Asset lifecycle.
* Agent: FinanceAgent prototype (cash runway suggestions + action button).
* Audit queue & parser confidence human review UI.

### Phase 3 — Intelligence & Simulation (8–12 weeks)

* Improve agents (Ops, Compliance).
* Implement simulations & scenario runner (Monte Carlo).
* Add Merkle snapshot mechanism for immutability.

### Phase 4 — Scale & Enterprise (ongoing)

* AD integration, SSO, hardened deployment, full SCIF features, high-volume indexing and partitioning.

---

## 13 — Testing plan / acceptance criteria

**Unit / Integration tests**

* Parsers: given test artifacts (pdf invoice, .eml), they produce consistent structured rows and `media_object` with text extraction.
* Event pipeline: webhook → media → events created → agent picked up event and proposed suggestion.
* Vector search: known text cluster returns relevant documents within top-K.

**E2E tests**

* Upload sample purchase PDF → system creates purchase_order, purchase_items, shipment, asset, and event timeline. Replay mode shows full chain with media images.

**Security tests**

* SSO flows, RBAC enforcement, secrets retrieval from Vault, MFA tests.

**Load tests**

* Bulk ingestion (10k docs) with embedding and event insertion; measure throughput and vector DB behavior.

---

## 14 — Example developer tasks for Codex (first sprint)

1. Create Postgres schema from DDL above and run migrations.
2. Implement S3 object store integration and `media_objects` API.
3. Implement webhook ingest endpoint (signed HMAC) and object storage for attachments.
4. Implement a simple PDF OCR + parser microservice that extracts invoice fields and returns JSON.
5. Implement event insertion after parse and a simple agent that listens for `purchase_created` to create a `transaction` placeholder.
6. Build minimal Next.js UI: upload page, mission control with a list of recent events, entity page that shows events for a purchase.

---

## 15 — Helpful design notes & best practices

* **Normalization first**: enforce FK checks early. If uncertain, ingest as `media_objects` + an event with parsed_json — then link later in normalization pass.
* **Store raw + parsed**: never throw away raw bytes. Always keep `media_objects.raw_blob` pointer + parsed JSON.
* **Parser confidence**: add parser confidence; use a human review queue for < threshold.
* **Vectors outside Postgres if large**: for >100k vectors use Pinecone/Weaviate; keep vector_id in `embeddings`.
* **Audit everything including reads for sensitive entities**.
* **Agent actions are privileged**: require policy to auto-execute; otherwise queue for approval.
* **Schema evolutions**: treat tables as data contracts; add `meta JSONB` rather than new columns in early iterations.
* **Backups & recovery**: regular object-store snapshots + DB backups; store key verification artifacts in SCIF module.

---

## 16 — Example CLI / API endpoints (essential)

* `POST /api/webhooks/ingest` — raw webhook ingest (HMAC signature)
* `GET /api/events?llc_id=1&since=...` — stream events
* `POST /api/media` — upload media directly (multipart/form-data)
* `GET /api/entity/{type}/{id}` — canonical entity view (contract, purchase)
* `POST /api/agents/{id}/run` — trigger agent run, returns simulation id
* `POST /api/plans` — create plan
* `POST /api/simulations/{id}/run` — run simulation
* `POST /api/claims` — log a claim
* `GET /api/embeddings/similar?query=...` — vector similarity search

---

## 17 — Deliverables Codex should produce in first PR

* DB migration files for DDL above.
* Webhook ingest endpoint.
* Media upload service + S3 integration.
* Parser microservice (PDF → parsed JSON) + test fixtures.
* Event emitter that inserts to `events` table.
* Basic Next.js UI: upload page + recent events feed + simple entity page (purchase view).
* README with run instructions, .env template, and deploy notes.

---

## 18 — Operational & governance considerations

* Define retention policy per data classification (PII may be restricted, but you stated you want to keep everything — ensure legal review).
* Keep user access logs and make privacy controls visible to auditors.
* Add a governance UI to manage agent policies (auto-execute thresholds, sensitive operations).
* Schedule model reviews and version control (store all prompts & outputs).

---

## 19 — Agent → data domain mapping

The tables above drive dozens of independent agents. Codex should wire each service to the appropriate event types and relational sources to guarantee complete coverage.

### Finance & Treasury

* **FinanceAgent** — tables: `transactions`, `accounts`, `purchase_orders`, `payroll`; events: `transaction_created`, `purchase_created`, `payroll_issued`.
* **CreditAgent** — tables: `transactions`, `vendors`, `claims`; events: `transaction_defaulted`, `claim_logged`.
* **InvestmentAgent** — tables: `assets`, `accounts`, `plans`, `simulations`; events: `asset_created`, `plan_created`, `simulation_run`.
* **CostAgent** — tables: `transactions`, `accounts`, `subscriptions` (future); events: `transaction_created`, `subscription_created`.

### Operations & Assets

* **OpsAgent** — tables: `shipments`, `shipment_events`, `purchase_orders`; events: `shipment_event_logged`, `purchase_created`.
* **AssetAgent** — tables: `assets`, `purchase_items`, `claims`; events: `asset_created`, `asset_disposed`, `claim_logged`.
* **SupplyAgent** — tables: `vendors`, `purchase_orders`, `shipments`; events: `purchase_created`, `shipment_delayed`.
* **InsuranceAgent** — tables: `shipments`, `assets`, `claims`; events: `shipment_created`, `claim_logged`.

### Compliance & Governance

* **ComplianceAgent** — tables: `contracts` (extension), `sop_documents`, `claims`; events: `contract_signed`, `sop_updated`, `claim_logged`.
* **AuditAgent** — tables: `audit_entries`, `events`; events: `event_created`, `audit_correction_logged`.
* **PolicyAgent** — tables: `sop_documents`, `claims`, `training_logs`; events: `sop_updated`, `claim_logged`, `training_completed`.

### Human Resources

* **HRAgent** — tables: `employees`, `payroll`; events: `employee_hired`, `payroll_issued`.
* **TrainingAgent** — tables: `training_logs`, `employees`; events: `training_completed`, `training_assigned`.
* **AccessAgent** — tables: `users`, `employees`, `roles` (extension); events: `user_created`, `role_changed`.

### Knowledge & Documentation

* **KnowledgeAgent** — tables: `media_objects`, `embeddings`, `sop_documents`; events: `media_ingested`, `embedding_created`, `sop_updated`.
* **SOPAgent** — tables: `sop_documents`, `audit_entries`; events: `sop_updated`, `audit_correction_logged`.
* **ClaimAgent** — tables: `claims`, `claim_verifications`; events: `claim_logged`, `claim_verification_added`.

### Risk & Simulation

* **RiskAgent** — tables: `transactions`, `claims`, `vendors`, `accounts`; events: `transaction_created`, `claim_logged`, `vendor_blacklisted`.
* **SimulationAgent** — tables: `plans`, `simulations`, `assets`; events: `plan_created`, `simulation_run`.
* **ForecastAgent** — tables: `transactions`, `shipments`, `payroll`; events: `transaction_created`, `shipment_event_logged`, `payroll_issued`.

### Security & SCIF

* **SecurityAgent** — tables: `events`, `users`, `audit_entries`; events: `user_login`, `event_created`, `audit_correction_logged`.
* **SCIFAgent** — tables: `scif_visitors`, `backups`, `sop_documents`; events: `scif_visitor_logged`, `backup_created`, `sop_updated`.
* **OPSECAgent** — tables: `vendors`, `transactions`, `claims`, `media_objects`; events: `media_ingested`, `claim_logged`, `transaction_created`.

### Specialized coverage

* **AnomalyAgent** — cross-table analytics over `events`, `claims`, `transactions`, `shipments`; reacts to aggregate anomaly detectors.
* **ReputationAgent** — extends `claims` and `media_objects` with OSINT feeds; events: `claim_logged`, `media_ingested`.
* **EthicsAgent** — tables: `claims`, `sop_documents`, `agents`; events: `claim_logged`, `agent_run`.

Codex should persist agent configs in `agents.config`, version each deployment, and emit agent actions back into the `events` stream for audit.

---

## 20 — Event stream trigger scaffolding

Append-only triggers keep downstream agents synchronized without bespoke plumbing. Implement the following PL/pgSQL functions (or equivalent logical decoding) during migration setup.

### Transaction inserts → `transaction_created`

```sql
CREATE OR REPLACE FUNCTION log_transaction_event()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO events (
    ts, llc_id, actor_type, actor_id, event_type,
    entity_type, entity_id, payload
  )
  VALUES (
    now(),
    NEW.llc_id,
    'system',
    0,
    'transaction_created',
    'transaction',
    NEW.id,
    jsonb_build_object(
      'account_id', NEW.account_id,
      'amount', NEW.amount,
      'currency', NEW.currency,
      'tx_type', NEW.tx_type,
      'reference', NEW.reference
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_transaction_event
AFTER INSERT ON transactions
FOR EACH ROW
EXECUTE FUNCTION log_transaction_event();
```

### Shipment inserts → `shipment_created`

```sql
CREATE OR REPLACE FUNCTION log_shipment_event()
RETURNS TRIGGER AS $$
DECLARE
  shipment_llc BIGINT;
BEGIN
  SELECT llc_id INTO shipment_llc FROM purchase_orders WHERE id = NEW.purchase_order_id;

  INSERT INTO events (
    ts, llc_id, actor_type, actor_id, event_type,
    entity_type, entity_id, payload
  )
  VALUES (
    now(),
    shipment_llc,
    'system',
    0,
    'shipment_created',
    'shipment',
    NEW.id,
    jsonb_build_object(
      'carrier', NEW.carrier,
      'tracking_number', NEW.tracking_number,
      'insured', NEW.insured
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_shipment_event
AFTER INSERT ON shipments
FOR EACH ROW
EXECUTE FUNCTION log_shipment_event();
```

### Claim inserts → `claim_logged`

```sql
CREATE OR REPLACE FUNCTION log_claim_event()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO events (
    ts, llc_id, actor_type, actor_id, event_type,
    entity_type, entity_id, payload
  )
  VALUES (
    now(),
    NEW.llc_id,
    'user',
    COALESCE(NEW.asserted_by_actor, 0),
    'claim_logged',
    'claim',
    NEW.id,
    jsonb_build_object(
      'claim_text', NEW.claim_text,
      'confidence', NEW.confidence,
      'status', NEW.status
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_claim_event
AFTER INSERT ON claims
FOR EACH ROW
EXECUTE FUNCTION log_claim_event();
```

These triggers demonstrate the append-only contract. If Codex later needs update hooks (e.g., `shipment_events` status progression), create additional trigger pairs that emit delta events without mutating canonical rows, maintaining ledger integrity.

---

## 21 — Final words to Codex (concise handoff)

Build the system as a layered platform: ingest → canonicalize → vectorize → eventize → reason (agents) → act (automations). Keep the relational model normalized and authoritative. Treat the event stream as the single source of provenance. Make vectors the semantic augmentation. Log everything — even falsehoods — but always link claims to evidence and verification attempts. Prioritize auditability, secure defaults, and a simple first MVP that proves ingestion → event → agent suggestion flow. Expand modules iteratively.

---

If additional artifacts are required next, choose from the following and request explicitly:

* Full master DDL extended with auxiliary modules and indices.
* n8n flow JSON for the ingestion pipeline.
* Concrete agent prototype (FinanceAgent) with sample code, endpoint spec, and simulation JSON.
