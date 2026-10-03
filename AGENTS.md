# POTOK operational contract

- Treat POTOK as a production-oriented product. Implement reviewed contracts; do not add hacks or silent fallbacks.
- Preserve all owner dirty and untracked files unless the owner explicitly names an exact path for change.
- Stage exact paths only. Never use `git add .` or `git add -A`.
- Never use `git reset --hard`, `git clean -fd`, or force push.
- Production and Supabase mutations require explicit owner approval. Treat STAGING as read-only unless a specific write or apply is approved.
- Never print, commit, or expose secrets, credentials, tokens, OTPs, private keys, or service-role material.
- Codex Cloud work must use separate branches and pull requests. Do not commit or push directly to `master`.
- Preserve the domain invariant `PLAN != FACT`; a planned meal never proves consumption.
- Preserve Graph v1 compatibility. Graph v2 is separately versioned and must not silently replace Graph v1.
- The trusted generator and Edge execution remain inactive unless the owner explicitly approves activation.
