# Sprint 7.1.3 — Real Data Ingestion (Architecture Mode)

## 1. Ingestion Sources
- User Excel (manual, CSV, Google Sheets).
- Public food DB (USDA, OpenFoodFacts, EU datasets).
- Brand catalogs.
- Exercise libraries.
- Medical reference sets (contraindications, allergens).

## 2. Ingestion Pipeline
- Import → Normalize → Deduplicate → Validate → Canonicalize → Index → Version.
- Batch for large datasets; streaming for incremental updates.
- Idempotency via `input_hash` + `idempotency_key`.
- Rollback: versioned snapshots and reversible merges.

## 3. Human‑in‑the‑Loop
- Conflict UI/Workflow for ambiguity and macro conflicts.
- Confidence thresholds gate auto‑merge.
- Manual override always possible; AI arbitration is advisory.

## 4. Safety & Compliance
- Allergen tagging enforced at import.
- Medical contraindications verified before publish.
- Regional constraints (EU/US) and minors safety gating.

## 5. AI Integration
- LLM consumes `confidence`, `verification_level`, `source_rank`.
- Pose/Coaching uses only verified templates.
- Explainability: source + version + confidence on every recommendation.

## 6. Versioning & Evolution
- Canon updates do not break diary links (stable canonical IDs).
- Re‑evaluate past logs on major version bumps.
- Backfill and re‑embedding per version.

## 7. E2E Coverage
- Scenarios 56–65
- Add: 66 Excel import with conflicts
- Add: 67 Canon update re‑evaluates past logs
- Add: 68 AI explanation references canonical source
- Add: 69 Unsafe food blocked by medical profile
- Add: 70 Cross‑country unit mismatch resolution

## 8. Definition of Done
- Safe import of current Excel dataset (72+ foods).
- Scalable to 100k+ products.
- No regressions in AI, reports, pose, coaching.
- Clear path to certified medical/sports datasets.

