# Exact nutrition numeric values V2

Implemented: a pure numeric representation, strict decoders, exact arithmetic,
canonical bytes/digests and explicit display-only projection. It has no Food
review revision, issuer, identity, authority, Graph, SQL, network or mutation
port. No runtime route imports it. Graph V1/V2 and existing evidence formats,
digests, rounding and history remain unchanged.

## Formats and semantics

`potok-exact-nutrition-values-v2` with encoding
`potok-exact-nutrition-canonical-json-v2` contains exactly `contract`, `encoding`
and `values`. The values object has exactly calories/protein/fat/carbs/fiber;
each value has exactly two decimal integer strings, numerator and denominator.
Values are nonnegative, denominator positive, gcd 1. Zero is uniquely `0/1`.
JSON numbers, exponents, signs, leading zeroes, missing axes, unknown fields and
nonreduced fractions reject. These are numeric quantities, not nutrient claims.
An explicit all-zero vector is representable; an empty aggregate is rejected.
This does not waive existing Food/nonfood zero-vector rules.

`potok-exact-nutrition-numeric-input-v2` additionally retains the supplied
`mappedDecimalText` and a **declared** reference: source record, retained artifact
hash, basis, units, available-carbohydrate semantics and mapping-policy reference.
Every exact value must equal the corresponding finite decimal text. Input text,
including trailing zeroes, is preserved; no rounding or density conversion is
performed. `PER_100_G_FOOD` is not renamed `PER_100_G_EDIBLE`.

The text is the caller's already-mapped numeric input, **not** a replacement for
original primary-source bytes. In particular available carbs may be the existing
same-record total-minus-fiber mapping; the numeric input does not pretend this
derived number was an original primary field. Full source facts, definitions,
methods, field mappings and retained bytes remain in existing source evidence.

A well-formed reference hash or policy label does not authenticate the source,
establish field applicability, prove that retained bytes exist, validate a
reviewer, or issue approved evidence. The hash field is deliberately named
`declaredRetainedArtifactSha256`. Source/admission proof remains a separate
existing authority boundary. No canonical food or account IDs are invented.

## Arithmetic and canonical storage bytes

- Parse finite decimal text to a reduced exact fraction using BigInt.
- Add, subtract nonnegative results, multiply, divide by nonzero values, and
  compare by integer equations. No floating-point nutrient arithmetic.
- Scale complete vectors using a fused multiply/divide followed by reduction;
  this permits valid final cancellation without rejecting an artificial
  over-budget intermediate result. Sum vectors exactly, never display strings.
- One-third plus one-third plus one-third is exactly one. Source values such as
  oat energy `378.866123` and almond energy `583.597022` remain exact.
- Canonicalization reuses the current sorted-key JSON serializer and SHA-256
  primitive with separate V2 value/input digest domains. Source input text
  `1.2300` and `1.23` has different input bytes/digests, while the canonical
  numeric value and its digest agree. Digests prove integrity, not authority.
- All returned snapshots are owned and deeply frozen. Object accessors, custom
  prototypes, extra/symbol fields and sparse aggregates reject. Async digest
  entry snapshots before returning its Promise.

## Bounds

| Limit | Value |
| --- | ---: |
| Persisted numerator or denominator | 80 decimal digits |
| Source finite-decimal integer part | 9 digits |
| Source finite-decimal fractional part | 18 digits |
| Raw JSON | 65536 UTF-8 bytes |
| Raw structural nesting | 8 |
| Vectors in one aggregate | 1–1024 |

Input budgets are checked before BigInt parsing. Arithmetic operates only on
bounded operands and checks reduced results before returning them; overflow is
an error, never clamping or fallback. At most three bounded scalar factors are
multiplied before reduction in fused scaling. Addition rejects a result that
exceeds its bound even if a later aggregate term could make a denominator reduce;
there is no unbounded aggregate retry. Raw nesting is bounded before calling the
shared recursive duplicate-aware scanner. Brackets inside escaped JSON strings
are not structural depth. Escaped duplicate keys remain rejected.

These bounds define this isolated numeric version. They do not approve a future
server's operation, request, ingredient, account or memory budgets. Future
version compatibility must be reviewed before changing them.

## Display projection

An explicit `{fractionDigits: 0|1|2|3, rounding: 'HALF_UP'}` policy produces a
`potok-exact-nutrition-display-only-v2` object with `authority: 'NONE'` and text
values. There is no implicit policy. This preserves existing presentation-style
rounding choices without changing UI or tokens. The V2 numeric decoder rejects
display projections; they cannot be supplied where an exact packet is expected.
Projection never mutates numeric values or their digest. A caller must never
parse display strings back into authoritative totals/ranking.

## Pilot verification

The offline compatibility command reruns the existing pinned pipeline, validates
the original source/model freeze and snapshots caller-owned models/witnesses
before awaits. It validates each source vector with existing primary mappers,
captures declared numeric-input references, scales source-per100g by the existing
conditional grams, sums whole recipes, divides by declared servings, and sums
assigned meals/days/week using the new kernel.

Typed water keeps its explicitly validated source-zero vector and null mass;
unknown ML quantities are never converted to grams. Salt retains declared grams.
No measured yield, cooked nutrient retention or physical serving is claimed.

The real private run has 19 recipes, 88 components, 7 days and 28 assigned meals.
All 810 component/whole/serving/meal/day/week axis comparisons agree exactly with
the prior transfer/handoff. All 35 original source-binding labels round-trip
through the input format. Old Food/Graph validation still rejects unsupported
precision and these numeric packets. Source approvals, admissions, account
context and canonical bindings remain absent; server submission is not attempted.

Next: implement the separately versioned Food nutrition evidence/source mapping
over this value type with independently retained source bytes, canonical
identity/state/basis and existing review/currentness authority. Then connect
the compatible new Graph/publication/validator/storage/readback versions from
the migration proposal. A numeric packet alone must never mount that path.
