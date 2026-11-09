# Dependency review — 9 November 2026

Orby 1.3 lockfiles were checked with npm audit. Backend: 12 low, zero moderate/high/critical. Frontend: 16 moderate, zero high/critical. These are affected dependency-tree nodes, not counts of independently exploitable product vulnerabilities.

`@fastify/static` is pinned to 10.1.10, replacing the vulnerable version. Private files are still served through authenticated API handlers rather than the public static root. See the [maintainer advisory](https://github.com/fastify/fastify-static/security/advisories/GHSA-83w8-p2f5-377r).

The remaining backend low findings are the near-api-js secp256k1/elliptic dependency chain. Orby's authentication accepts Ed25519 keys and rejects other types; local signing fixtures also use Ed25519. This reduces the reachable surface; it does not claim the dependency itself is patched. Replacing the NEAR SDK requires its own compatibility testing.

Frontend moderate findings are in the Angular CLI's development dependency chain (package fetching/signing, glob/minimatch). They are not shipped in `dist/orby/browser`. npm's proposed automatic fix downgrades Angular CLI to 16.2.16, incompatible with this Angular 21 project; that downgrade was not applied. Build dependencies remain a supply-chain risk for trusted development machines. Use the committed lockfile and `npm ci`, and reassess advisories before deploying.

No `audit fix --force` was used. Exact machine-readable audit output is retained locally under the ignored verification/data directories, without application secrets.
