# Persistent private security candidate

Owner-provided Mac output confirms the separate `potok_security_candidate_2026-10-26` volume/container, PostgreSQL 17.6, nonsuperuser `postgres` with BYPASSRLS, `network=none`, `listen_addresses=127.0.0.1`, disabled cron launcher, and healthy original baseline. The cold copy and subsequent row-count check covered 112 tables / 14888 rows. These are owner observations, not direct access by the assistant.

## Scope

`scripts/security/accumulated/private-candidate.mjs --install-private-candidate` is a separate, explicit, one-shot installer for that exact isolated private clone. It has no arbitrary database URL, project ref, container name or volume option. It does not modify the three original eight-candidate portable files or the twelve-candidate rollback runner. Never replace their ROLLBACK with COMMIT.

The installer verifies the local Docker endpoint, exact distinct container identities, same immutable image ID and exact image tag, healthy baseline and candidate, single dedicated local volume with its expected purpose label, no second attachment, no bind mounts, no published ports, no privileged/host PID configuration, and network none. It independently checks the database actor, normal triggers, data directory, cron launcher and listen address. No Auth, API, mail or application service is attached by this step.

Correction after the owner preflight on 2026-10-27: the baseline must retain the exact reviewed image tag, while the candidate Config.Image may be either that tag or the baseline's exact full immutable image ID. Docker records the ID when docker create was invoked by ID. Both actual image IDs must still match exactly. Other references, other IDs and a missing baseline tag are rejected. The initial installer stopped before its evidence-folder message and before any SQL because it incorrectly required the candidate Config.Image to contain the tag. This correction does not relax volume/network/actor checks or change SQL, candidate pins or portable dependencies.

It checks all three original backup checksums, COPY table count/distribution, four unchanged portable dependency hashes, the read-only boundary check hash, and the exact eight plus four public input pins. The installation is authored as its own transaction from the checked candidate bodies; it does not edit or execute the rollback runner's generated transaction. Existing fresh-namespace and source preflights remain in effect. Reapplying after a successful commit is prohibited.

Before mutation it records sorted per-table full-row SHA-256 aggregates, without exporting row contents. During the transaction public tables are locked in SHARE ROW EXCLUSIVE mode; auth/storage receive ACCESS SHARE locks (which do not block their writers). Concurrent writers must remain absent in this isolated, cron-disabled clone. Any content difference observed before final COMMIT aborts the group. Original columns, including day_date, remain hashed; only the new execution_reason column is projected out and separately required to contain only NULL.

The final checks cover the original effective rights/source contracts, exact follow-up projection/paywall contracts, empty authority store, unchanged original content, and conditional application SQL boundary. Reserved platform defaults may remain; they are not edited. All twelve candidates commit together. A separate psql connection then performs READ ONLY checks of the committed state and original content before `PRIVATE_CANDIDATE_COMMITTED_OK` is printed. A pass is not full application acceptance, hosted compatibility, payment verification, a release approval, or generator activation.

## Local evidence and stopping

The backup folder receives a private `private-candidate-install-*` directory (mode 0700), with baseline fingerprints, exact installation SQL, separate read-only committed verifier, pinned public input manifest and SQL logs (mode 0600). These contain private schema identifiers/hashes and must remain local; do not upload the directory or logs to GitHub/chat. Docker environment values and passwords are neither printed nor written to these logs.

`PRIVATE_CANDIDATE_STOPPED` means no success claim. Do not rerun the installer blindly: COMMIT may have happened even if its response or later checks failed. The saved `verify-committed.sql` is read-only and can be used for diagnosis against the exact clone after rechecking identity/isolation. Recover by repairing or recreating only the disposable candidate from the preserved original copy; never restore unsafe client grants as a general-purpose down migration. This installer neither stops nor deletes either volume/container and never connects to Production or Staging.

The two local copies contain real backup data. Future API/browser acceptance needs its own reviewed network and synthetic A/B account setup with outbound mail/webhooks/jobs isolated. Network none remains in place here. Existing owner baseline is the recovery source; its checksums and healthy status are rechecked. A new connection observing persisted SQL state does not prove power-loss durability or off-Mac disaster recovery.

## Validation

The extended synthetic protocol suite covers sixteen cases: the prior eleven rollback cases, persistent installation and committed final checks, rejection of repeat installation, complete rollback on late row-content tampering or privilege leakage, pre-install baseline drift, and container/volume/network/image/privilege substitutions. PGlite PG17 passes locally; native PostgreSQL 17 CI additionally opens an independent connection for committed-state checks. Native workflow result must be recorded on the exact published head before an owner execution command is issued. No claim of full-copy installation is made until the owner returns the Mac result.

Lock semantics: https://www.postgresql.org/docs/17/sql-lock.html. Supabase changelog checked on 2026-10-26; the current HTTP TLS deprecation does not affect this offline Unix-socket operation.
