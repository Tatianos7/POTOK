# Food Knowledge Base v1

## Canonical Food Entity
- **Identity**: `canonical_food_id` (UUID), `normalized_name`, `normalized_brand`, `source` (core/brand/user), `verified`.
- **Nutrients**:
  - Macro: calories, protein, fat, carbs, fiber.
  - Micro: vitamins, minerals (A, B, C, D, E, K, iron, calcium, etc.).
  - Glycemic: glycemic_index, glycemic_load (derived).
  - Amino acids: essential profile (optional v1‑lite).
- **Units & Density**: serving size, grams per unit, density for volumetric conversions.
- **Brands/Generic**: canonical brand family and generic fallback.
- **Allergens/Intolerances**: nuts, dairy, gluten, soy, eggs, shellfish, etc.
- **Cooking Loss Factors**: raw → cooked weight and nutrient adjustments.

## Aliases & Multilingual
- `food_aliases` with `normalized_alias` and locale.
- Bi‑directional mapping: alias → canonical, canonical → known aliases.

## Versioning & Verification
- `nutrition_version` increments on canonical changes.
- `verified` levels: crowd / trusted / certified.
- Audit trail: who/what updated and validation status.

## AI‑Normalization Pipeline
- OCR (label), barcode scan, text search, voice input.
- Normalize: name, brand, unit, serving size.
- Dedupe: `(normalized_name, normalized_brand)`.
- Guard: macronutrient bounds + suspicious flag.

