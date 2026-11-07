# Runtime security boundaries

The same-origin production server applies CSP to all routes and rewrites every SPA document with a random per-response script nonce. Inline handlers, eval, objects and framing by other sites are blocked. HTML is not cached. Angular receives ngCspNonce; the wallet connector receives the same nonce for its sandboxed adapter scripts. Wallet popups use same-origin-allow-popups.

The paired Angular production build disables inline critical CSS. This prevents the optimizer from generating print-only stylesheets with inline onload handlers that CSP correctly blocks. The full minified stylesheet loads as an ordinary stylesheet before rendering.

Wallet registry/adapters require HTTPS connections and images from varying providers. connect-src permits HTTPS/WSS, frame-src permits HTTPS and styles permit unsafe-inline for the wallet SDK. These are deliberate compatibility allowances, not a fully locked-down third-party supply chain. Script execution in the application remains limited to same-origin scripts and nonce-authorized code. The SDK runs downloaded wallet adapters in an opaque-origin sandbox. Public wallet RPC is configured separately with NEAR_WALLET_RPC_URL; server-side NEAR_RPC_URL is not exposed to browsers.

NEP-413 challenges bind a one-use random nonce, message, recipient/host, expiry and declared flow. DIRECT verification requires the configured same-origin callback in the digest. Only a challenge created for REDIRECT can use the redirect compatibility path, which accepts the expected callback or its omission. The frontend uses that path when consuming a signature returned in the URL fragment; normal returned signatures use DIRECT verification. Flow selection alone never proves wallet ownership: a valid signature and a FullAccess key registered to that testnet account remain mandatory. A signature with another callback is not accepted. Demo login uses accountId; account remains a compatibility alias.

Pending agent recovery is owner-only, checks the contract, compares manifest hashes, and never issues a second registration while a known transaction is UNKNOWN or SUBMITTED. PREPARED recovery reuses the same operation/request ID. A new operation is allowed after a definitive FAILED result and absence of the agent on the contract. Recovery cannot discard an uncertain payment or registration.

Uploads are private by default. Every owner has a shared limit across both books: 100 files, 50 MiB decoded content, and 25 unused files. Transaction advisory locks serialize quota checks and inserts across different idempotency keys. Attached files count toward storage; they cannot be deleted through the unused-upload endpoint. Public IPFS publishing still requires explicit consent.

Only testnet is supported. Mainnet, an independent security audit, production key custody and production monitoring are not covered by local verification.
