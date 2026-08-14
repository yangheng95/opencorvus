# CS-031 — Provider cache and credential identity

## Recall

- User request: continue fixing the accepted code-smell backlog directly, use independent agents for parallel analysis/review, and avoid replacing one weak authority with another.
- Finding: Provider config state used Bun xxHash64 of `JSON.stringify(config)`, Provider SDK instances used a 32-bit hash as the sole Map key, and the DashScope credential lifetime persisted a 32-bit credential hash.
- Acceptance: semantically identical validated config reuses state; distinct config/options never reuse through a hash collision; runtime behavior is independent from Bun hash APIs; DashScope stores no secret and never carries an old numeric-hash lifetime into the new identity.
- Hard constraints: one strict canonical byte/SHA-256 primitive; no JSON-stringify fallback, function source serialization, secret logging, dual schema reader, or compatibility path. Non-UI focused positive tests and independent delivery review are required.
- Sources read: Provider state/SDK cache and every caller, `Config.Info` and provider catchall options, custom loaders/fetch wrappers, DashScope state, Expert Squad projection hashing, Provider architecture, prior debt plan, and the final audit entry.
- Whole-repository search: the accepted finding's three Bun hash owners are `provider.ts` state, `provider.ts` SDK instances, and `dashscope.ts`. The existing strict canonical implementation was private to Expert Squad while other canonical serializers silently omit unsupported values. The shared primitive therefore moves to neutral `util` ownership and Expert Squad consumes it rather than creating a third implementation.
- Independent plan feedback: the initial broad “one digest API for all values” proposal was blocked. The accepted design shares only strict canonical bytes and SHA-256. Provider config/state, SDK instances, and credential lifetime keep distinct equality and lifecycle contracts described below.

## Root cause and design

### Strict canonical source

The neutral primitive accepts only null, boolean, string, finite number, dense arrays, and plain objects. Object keys are code-unit sorted. Undefined, functions, symbols, bigint, non-finite values, sparse arrays, cycles, and non-plain objects fail with a typed digest-contract error. Domain and payload are framed in the canonical bytes before SHA-256.

### Provider config state

Every explicit config enters through one `Config.Info.parse` snapshot. That same snapshot supplies canonical bytes and `buildState`; hashing a clone while executing the caller object is forbidden. SHA-256 is only an index. A digest bucket retains canonical bytes and reuses a state Promise only after exact-byte equality; a collision creates a separate entry. Project directory remains an outer authority dimension. Failed construction removes only its exact entry.

### Provider SDK instances

The SDK identity consists of provider ID, package, and the final declarative options before the timeout wrapper is installed. Plain serializable options use the same digest-index/exact-byte contract. A custom fetch or any other noncanonical capability disables cross-call SDK-provider reuse; functions are never omitted, stringified, named, or compared by digest. The per-model LanguageModel cache remains owned by the already selected Provider state.

### DashScope credential lifetime

The persisted schema becomes exactly `{schema_version:2, credential_sha256, first}` with a domain-separated SHA-256 of UTF-8 credential bytes and mode 0600. A missing, malformed, or legacy numeric-hash file cannot prove identity and is atomically replaced with `first=now`; the secret and canonical bytes are never persisted or logged. A valid v2 matching digest retains its first-seen time; a different credential begins a new occurrence.

## Positive verification

- Fixed canonical byte/digest fixtures, key-order equivalence, typed rejection, and injected same-digest/different-byte cache entries.
- Real `Provider.catalog({config})` calls for key-order-equivalent validated configs and changed semantic config, verifying one state versus distinct state projections.
- Real file-backed Provider module calls verify identical declarative options reuse one SDK provider, known old-xxHash32-collision options no longer reuse, and custom fetch functions do not share an SDK provider.
- DashScope v2 same/different credential and legacy state tests verify exact TTL occurrence, atomic v2 schema, 64-hex digest, and no persisted secret.
- Package typecheck, affected architecture/checks, exact diff check, and independent post-implementation review.

## Impact

No HTTP or generated SDK schema changes. Provider architecture changes from runtime-specific short-hash identity to canonical SHA-256 indexing with exact equality. DashScope's private local state is intentionally replaced rather than migrated because the old hash cannot establish credential identity.

## Verification log

- Focused production/cache/credential suite: `6 pass`, `23 assertions`, including real custom-fetch and Bedrock credential-provider capability paths.
- `packages/opencorvus` typecheck: PASS.
- Independent delivery review: PASS after one correction round. The first review found the real Amazon Bedrock credential-chain function in provider options; the final runtime-capability classifier disables both state and SDK-provider reuse for that exact snapshot while preserving strict failure for invalid data. Real custom-fetch and Bedrock production paths now prove the distinction.
