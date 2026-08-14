# CS-029 — Canonical Skill source trust identity

## Recall

- User request: continue repairing the accepted code-smell backlog directly and in parallel without creating another weak authority.
- Finding: installed Skill trust used `source.includes(...)`; deceptive hostnames, URL paths, queries, fragments, and userinfo could be projected as official/curated/community.
- Acceptance: only exact canonical source identities receive non-local trust; deceptive/unparseable variants do not; builtin and local-path classifications retain their current behavior.
- Hard constraints: one parser and one trust table; no substring fallback, network lookup, redirect inference, UI work, or UI automation. Preserve the strict remote snapshot source authority introduced by CS-053.
- Read/search scope: Skill installed inventory, Git/URL installation normalization, managed source manifest, strict remote snapshot manifest, builtin market identities, trust/risk/policy consumers, and focused remote cache test.
- Independent agent feedback before implementation: the first plan review blocked two over-broad/under-complete boundaries. Production Git sources also support exact GitHub SSH URLs, while plain HTTP cannot establish official or marketplace provenance. The final design below incorporates both corrections.

## Root cause and design

Trust is provenance, so it must match an exact normalized source identity rather than human-readable text. The single parser accepts HTTPS URLs, GitHub's SCP-like `git@github.com:owner/repo(.git)` form, and exact `ssh://git@github.com/owner/repo(.git)` URLs. HTTPS rejects username/password, query, fragment, non-default ports, and raw dot-segment paths before URL normalization. Empty userinfo, query, and fragment delimiters are rejected from the original source text rather than inferred from the normalized URL. SSH requires the exact `git` username and rejects passwords, query, fragment, non-default ports, and dot segments. SCP accepts only the exact GitHub host and two path segments. Plain HTTP, other schemes, malformed sources, and additional GitHub path segments are untrusted. HTTPS identities normalize hostname case, collapse the default port, remove a single repository `.git` suffix, and compare exact host/path segments against one explicit trust table:

- official: `github.com/openai/skills`, `github.com/anthropics/skills`;
- curated: exact hosts `skills.sh`, `skillstore.io`;
- community: exact host `skills.pub`.

Curated/community directory paths remain within their exact host identity. GitHub trust requires the exact owner/repository path and no additional path. When a source fact exists, every parsed or unparseable source outside that table is `unknown`; it must not fall through to the cache or managed directory's `local` classification. Only an installed Skill with no source fact uses the existing local/external location classification. The parser is the sole source-trust authority for both managed Git manifests and strict CS-053 remote snapshot manifests.

## Positive verification

- Through production installed inventory, verify exact HTTPS, SCP, and SSH official Git sources plus strict HTTPS remote marketplace sources receive the matching trust.
- Exercise a table of plain HTTP, deceptive userinfo, query, fragment, similar host, embedded path, extra GitHub path, non-default port, invalid SSH user, and unsupported scheme inputs and assert their resulting production inventory classification is `unknown`.
- Verify a source-less configured path remains `local`, fixing the source-present `unknown` precedence separately from ordinary local installation.
- Correct the CS-053 localhost fixture expectation: a path containing `skills.pub` on `127.0.0.1` is not community trust.
- Run focused non-UI tests, package typecheck, and exact diff check; obtain independent post-implementation review before commit.

## Impact

Public installed Skill schemas are unchanged. Some previously mislabeled sources intentionally change trust and recommended policy to the conservative existing classification. No stored data migration is needed because inventory recomputes trust from the canonical source on read.

## Verification log

- Production inventory source-identity matrix: `1 pass`, `2 assertions`.
- Existing remote publication contract: `2 pass`, including localhost path text now projecting `unknown` without changing its strict source, location, or writable facts.
- `packages/opencorvus` typecheck: pass.
- Independent delivery review: PASS after three adversarial rounds. The reviewer first found normalized-away empty userinfo/query/fragment and raw dot segments, then found percent-encoded dot segments. The final parser rejects both representations from the original source, fails closed on invalid escapes, and retains exact HTTPS/SSH/SCP identities.
