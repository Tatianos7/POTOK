# RPC source inventory coverage — 2026-10-24

This change publishes source-analysis tooling only. It contains no live database definitions, ACL snapshots, Production observations or user records.

Full tracked git trees were parsed, including `src`, Edge sources, operator scripts, tests and the tracked Android bundle. SQL/YAML/HTML/shell/Python/JSON/TOML text references were inspected separately. TypeScript syntax trees include generic, optional, bracket and non-null RPC calls; dynamic calls and extracted method references remain explicit manual-review items.

| Exact source commit | Tracked files | Parsed JS/TS files | Parse errors | Runtime call sites | Distinct literal RPC names |
| --- | ---: | ---: | ---: | ---: | ---: |
| master `555d3263ce20e70ae59576e9dd3e2d2c4a97240e` | 1555 | 648 | 0 | 29 | 22 |
| PR #184 `97ba981ae0d50a3aea3d83cbb51a0538e6bc5d40` | 1633 | 658 | 0 | 29 | 23 |

The only direct app-source `get_entitlements` and `get_paywall_state` call sites in each tree are `src/services/entitlementService.ts:33/:45`. No runtime literal `start_purchase`/`restore_purchase` calls were found in these trees. Four dynamic call sites per tree include three Edge forwarding wrappers and the Android SDK rpc method; source coverage does not prove deployment identity or absence of external backends/older clients.

Reproduce after `npm ci`: `node scripts/contracts/rpc-source-inventory.mjs <exact-commit> /tmp/rpc-inventory.json`. The JSON records paths, lines and names, not source-line contents. Regression tests verify syntax variants, dynamic names, extracted references and exact-ref isolation from a dirty worktree.

Cloud security and recovery evidence are deliberately excluded from this public PR. This source inventory is not deployment or restoration approval.
