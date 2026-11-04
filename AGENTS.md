# POTOK operational contract

- Treat POTOK as a production-oriented product. Implement reviewed contracts; do not add hacks or silent fallbacks.
- Preserve all owner dirty and untracked files unless the owner explicitly names an exact path for change.
- Stage exact paths only. Never use `git add .` or `git add -A`.
- Never use `git reset --hard`, `git clean -fd`, or force push.
- Production and Supabase mutations require explicit owner approval. Treat STAGING as read-only unless a specific write or apply is approved.
- Never print, commit, or expose secrets, credentials, tokens, OTPs, private keys, or service-role material.
- Codex Cloud work must use separate branches and pull requests. Do not commit or push directly to `master`.
- Preserve the domain invariant `PLAN != FACT`; a planned meal never proves consumption.
- Owner decision (2026-11-03): defer physical recipe cooking, yield and portion checks until the owner's application testing before launch. Continue development with existing authoring data and explicit unknowns. Do not make cooking every recipe a prerequisite for coding or offline test previews; do not invent measurements, approve sources or publish unreviewed data as a consequence of this deferral.
- Owner ingredient-state decision (2026-11-04): choose ordinary or green buckwheat per recipe; young potatoes may retain skin, non-young potatoes are peeled. Unspecified recipe states remain unknown. This is not source/identity approval or permission to recalculate/publish data. See docs/premium/ingredient-state-owner-decisions-20261104.md.
- Preserve Graph v1 compatibility. Graph v2 is separately versioned and must not silently replace Graph v1.
- The trusted generator and Edge execution remain inactive unless the owner explicitly approves activation.
- Owner sequence (2026-10-26): finish the agreed security stage, celebrate with fireworks, resume meal-plan generation, then implement real purchase verification tracked in https://github.com/Tatianos7/POTOK/issues/198. Do not pull payment implementation into the current security stage. Read docs/security/accumulated-release-order-20261026.md for candidate dependencies and outstanding release gates.
- New public tables must declare their intended API roles and minimum explicit GRANTs alongside RLS/policies; do not rely on Supabase automatic/default grants. Internal tables must remain ungranted to clients. Include needed sequence privileges for sequence-backed inserts and test with automatic grants absent. Never restore blanket grants to resolve permission errors.
