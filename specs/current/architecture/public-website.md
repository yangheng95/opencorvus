# Public website and Registry architecture

This document is the current authority for the `opencorvus.com` runtime, Expert Squad website Registry, and RackNerd delivery boundary.

## Serving boundary

- Astro remains a static build for landing, documentation, download, trust, and publishing pages. English and Simplified Chinese Market list/detail routes plus `/api/registry/v1/**`, exact visitor routes `/api/site/v1/visitors` and `/api/site/v1/visitors/current`, and `/health/**` are the only on-demand routes in the single bundled Astro runtime.
- Caddy is the sole public Transport Layer Security (TLS) endpoint. It serves `/srv/opencorvus/current/client` directly and proxies the exact Market, Registry API, visitor-count API and health matchers to `opencorvus-web.service` on `127.0.0.1:4321` without rewriting the public path.
- `opencorvus-web.service` runs as the locked `opencorvus-web` identity. Its only writable boundary is `/var/lib/opencorvus-web`; application releases under `/srv/opencorvus/releases` are immutable.
- `/srv/opencorvus`, immutable releases, and `current`/`previous` are root-owned and not writable by the Secure Shell (SSH) deploy identity. That identity can write only a candidate under `incoming`; the activator copies it to root-only scratch before verification and mutation.
- Market requests read only the active SQLite publication. Generated TypeScript facts, the signed static catalog, release files, and the removed filesystem simulation are not runtime query fallbacks.

## Registry authority

- `/var/lib/opencorvus-web/registry.sqlite3` is the sole website metadata authority. One SQLite writer uses foreign keys, Write-Ahead Logging (WAL), full synchronous commits, bounded cache/journal settings, a strict schema fingerprint, executable digest/ordinal/count constraints, and one active-publication pointer.
- Normalized revision tables own identities, immutable version/digest binding, bilingual copy, pillars, agents, workflows, nodes, dependencies, capability/configuration counts, publication ordering, and archive-response counters.
- Immutable ZIP bytes live at `/var/lib/opencorvus-web/blobs/sha256/<prefix>/<sha256>.zip`. SQLite stores their digest, size, file count, public publication path, and content-addressed relative path; ZIP bodies are not SQLite Binary Large Objects (BLOBs).
- `UNIQUE(namespace, squad_id, version)` makes a version immutable. Reimport reconstructs every public fact from the ZIP, compares every signed-catalog field, verifies the normalized relational projection against its canonical SHA-256, and returns a typed conflict on drift.
- Readiness verifies the schema fingerprint, SQLite integrity and foreign keys, active inventory/resource counts, normalized-fact digests, and every active archive's bytes and SHA-256. Its publication binding is the signed catalog SHA-256 plus total/embedded/importable counts.

## Trust boundaries

- The existing signed catalog/bundle remains the desktop bulk-install trust contract. Continuous Integration (CI) holds the Ed25519 private key temporarily; RackNerd never receives a signing private key.
- The same primary Ed25519 key signs `DEPLOY_SHA256SUMS`, which covers the exact `client/` and `server/` file set. The root activator verifies that signature with `/etc/opencorvus/deploy-signing-public.pem`, requires exact file-set equality, then verifies every file digest before any privileged mutation.
- The deploy sudo rule is `NOSETENV` with `env_reset` and a fixed secure path. When effective user ID is root, the activator also clears all path/owner/service overrides and sets its own fixed `PATH`; test injection exists only for non-root harness execution.
- Routine activation can transactionally update only Caddy, the web service unit, and the activator from a complete signed deployment. The backup program/service/timer, sudo rule, and deployment public key are separately preinstalled root-bootstrap contracts; activation compares the signed candidate bytes to those root-owned copies and fails closed on drift. Updating a bootstrap contract requires an announced manual root operation with validation and a retained prior copy. The deploy account's self-authored tar/checksum pair has no root authority.
- The pinned deployment public key is a separate root-owned server trust root even when its bytes match the browser catalog key. Primary-key rotation must provision and verify the new root key through an announced manual root boundary before CI promotes the new private signer.

## Activation, rollback, and backup

- Persistent state never enters a release directory. Activation stops the writer, creates a checksum-bound `VACUUM INTO` snapshot, imports the signed candidate, switches the release pointer, starts the service, reloads Caddy, and proves static bytes, readiness, both locales, detail pages, and one exact archive binding.
- Root-trusted rollback snapshots, Caddy/unit/activator copies, and state markers live under a separate root-only directory outside the web service's writable boundary. Failure restores the previous database or recorded database-absent state, prior release pointer, trusted control files, service/timer enablement, and then proves the restored dynamic or one-time legacy static release.
- Pre-activation state is retained for the four newest activations. A hardened daily systemd timer creates consistent snapshots and retains seven daily plus four weekly local copies; each snapshot has a checksum and a SHA-256 inventory of every immutable blob needed to restore it. Off-host replication must copy the snapshot and every inventory-bound blob, verify both at the destination, and pass a real restore drill before production is declared complete. A database-only copy is not a Registry backup.
- Activation, rollback, and scheduled backup serialize through one state-root file lock. The signed activator update remains inside the recoverable transaction; inbox/release/backup pruning occurs after the commit point and is non-fatal cleanup.
- The baseline registry-control executable is built as `bun-linux-x64-baseline` in CI. The Astro module runs under the pinned server Bun runtime.

## Public product contract

- Public mutation endpoints are closed. New Squads enter through repository review, canonical archive generation, CI signing, and transactional import; the server has no publisher identity, namespace ownership, or signing authority.
- Exact archive responses are counted only after the persistent file passes SHA-256/size verification and immediately before a `200` response begins. The value means archive responses, never users, installations, activations, or popularity.
- The detail-page action reports preparing, completed, and failed states through an accessible live region. Download does not install or activate a Squad.
- Public and documentation footers read one 30-day estimated participating-browser total from the same `registry.sqlite3` authority. The numeric Registry schema version remains `1`; the one-time schema-fingerprint upgrade stops the writer, snapshots the old v1 file, rebuilds signed Market facts plus empty visitor/counter state in a same-directory sibling, and atomically replaces the same database path. It has no version 2, compatibility reader, fallback or second database. Reading sets no cookie. A browser enters the estimate only after explicit activation; the service stores only a SHA-256 digest of a random host-only token, never Internet Protocol (IP), User-Agent, path history or fingerprint inputs. Participation can be withdrawn idempotently, bounded cleanup runs inside the existing backup command before snapshots, and the visible copy never calls the estimate people, accounts or devices.
- PublicSiteLayout navigation prioritizes Expert Squads, Agent interoperability, Mission and Download. Contribution, trust, documentation and source links remain real no-JavaScript links in one keyboard-operable disclosure; the separate Starlight documentation header/sidebar keep their documentation-specific hierarchy.
