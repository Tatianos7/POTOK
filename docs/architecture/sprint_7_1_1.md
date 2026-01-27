# Sprint 7.1.1 — Canonical Knowledge Core (Architecture Only)

## 1. Scope Sprint 7.1.1

### Canonical Food Schema v1
- **Identity**: `canonical_food_id`, `normalized_name`, `normalized_brand`, `source`, `verified_level`.
- **Nutrients**: macros, micros, fiber, glycemic_index/load, amino acids.
- **Units & Density**: unit ontology, gram‑equivalents, density for volume.
- **Allergens/Intolerances**: standardized tags, severity.
- **Cooking Loss**: raw→cooked adjustment factors.
- **Versioning**: `nutrition_version`, `updated_at`, `audit_meta`.

### Canonical Exercise Schema v1
- **Identity**: `canonical_exercise_id`, `normalized_name`, aliases.
- **Movement**: pattern, equipment, difficulty, compound flag.
- **Biomechanics**: gold‑standard angles/ROM/tempo templates.
- **Risk**: ACL, lumbar, shoulder, neck patterns.
- **Progression/Regression**: ladders + rehab‑safe variants.

### Ontologies
- Units: grams, ml, servings, pieces, density mapping.
- Nutrients: standardized macro/micro IDs.
- Muscles: canonical muscle IDs, regions, roles.
- Movement patterns: push/pull/hinge/squat/carry/rotation.

### Aliases / Multilingual / Brand Mapping
- `food_aliases`, `exercise_aliases`, locale support.
- Brand families → canonical brand.
- Bidirectional mapping and dedupe rules.

### Verification Levels
- trusted / community / AI‑extracted.
- Verification impacts trust and AI guard.

## 2. Integration Contracts

### AI Planning
- Inputs use canonical IDs only.
- AI plans reference KB version and entity IDs.

### Pose Engine
- Loads biomechanics templates from Exercise KB.
- Risk patterns and constraints derived from KB.

### Explainability
- Every advice references KB entity + version.
- Source metadata embedded for audit.

### Guard Layer
- Allergies/intolerances block food.
- Injury/contraindication tags block exercises.

## 3. Versioning & Evolution
- KB updates are additive; breaking changes require version bump.
- History retained per `nutrition_version`/`exercise_version`.
- AI retrains or revalidates on new versions via `input_hash` change.

## 4. Privacy & Compliance
- Knowledge data is non‑PII.
- Allergies/injuries are sensitive; stored user‑scoped with strict RLS.
- GDPR readiness: data lineage + deletion on request.
- HIPAA posture: non‑medical coaching + explicit disclaimers.

## 5. E2E привязка
- Scenario 56–60 mapped directly.
- Добавить: 61 (ambiguous food resolution), 62 (unsafe exercise blocked).

## 6. Definition of Done (Architectural)
- Канонические модели утверждены.
- Все контуры AI/Pose имеют контракты к KB.
- Импорт данных возможен без изменения архитектуры.

