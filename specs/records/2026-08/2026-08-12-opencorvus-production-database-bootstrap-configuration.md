# opencorvus.com production database bootstrap configuration

## Recall

| Field | Contract |
| --- | --- |
| User request | Land the production configuration plan for the database-backed public website. This task is configuration design and repository documentation, not a request to obtain credentials, connect to the virtual private server (VPS), mutate Domain Name System (DNS), or perform the cutover. |
| Acceptance | The repository identifies every configuration authority, target value or现场填充值, file owner/mode, service boundary, deployment sequence, rollback state, and verification artifact needed to move the existing static site to the reviewed SQLite Registry architecture. No secret value is committed. |
| Hard constraints | Keep the existing signed deployment boundary; keep production signing private keys out of the VPS; keep SQLite and blobs outside release pruning; keep the Secure Shell (SSH) deploy identity unprivileged except for the exact activator; keep automatic deployment disabled until the release-derived production verification is green; do not reboot the VPS as part of this plan. |
| Sources read | `AGENTS.md`; `specs/current/architecture/public-website.md`; `specs/records/2026-08/2026-08-12-public-website-database-backend.md`; `specs/records/2026-08/2026-08-12-v0.0.41-beta-release.md`; every file under `deploy/racknerd/`; both production workflows; current public DNS and GitHub variable metadata. |
| Repository search | The runtime configuration is already represented by Caddy, the web/backup systemd assets, the signed activator, the backup program, sudoers, the deployment public key, and `production.env.example`. The missing artifact was one configuration ledger tying those files and their rollout state together without conflating configuration delivery with production execution. The approved implementation slice must also update the existing activator, Registry blob/import/restore primitives, and local backup publisher so their owner/mode output matches the reader-group contract rather than preserving the current `0700` single-identity layout. |
| Current observed facts | `opencorvus.com` currently resolves to `192.255.229.117` and still serves the legacy static site; `/health/ready` is not the database contract. GitHub repository variable `OPENCORVUS_AUTOMATIC_DEPLOYMENT_ENABLED` is `false`. The RackNerd address is stored only in the protected GitHub Environment and must be transcribed into the operator inventory without committing it. |
| Independent agent feedback | The database architecture plan and source-bound release plan were independently approved. Delivery review required root-owned release pointers, a full-manifest signature, root-only rollback state, `NOSETENV`, bounded backups including blobs, and a separate manual root bootstrap boundary. This configuration record adopts all of those constraints. |

## Scope and ownership

This record is the one-time production configuration ledger. It does not replace the current architecture authority or the executable deployment assets:

| Concern | Authority |
| --- | --- |
| Current service and data contracts | `specs/current/architecture/public-website.md` |
| Operator procedure and recovery | `deploy/racknerd/README.md` |
| Non-secret inventory schema | `deploy/racknerd/production.env.example` copied to the private operator vault as `production.env` |
| Public TLS/static/reverse-proxy routes | `deploy/racknerd/Caddyfile` |
| Web service sandbox | `deploy/racknerd/opencorvus-web.service` |
| Consistent backup job and schedule | `deploy/racknerd/opencorvus-registry-backup`, `.service`, and `.timer` |
| Routine privileged activation | `deploy/racknerd/opencorvus-activate-release` plus `opencorvus-deploy.sudoers` |
| Full deployment verification root | `deploy/racknerd/deploy-signing-public.pem` installed root-owned on the host |
| Build, sign, upload, activation and probes | `.github/workflows/deploy-opencorvus-com.yml` |
| Native Release and immutable website dispatch source | `.github/workflows/build.yml` |

The private operator inventory holds real hostnames, fingerprints and local credential-envelope paths. GitHub holds delivery copies. Neither is a substitute for this committed contract, and neither may introduce a second runtime configuration path.

## Required configuration values

### Repository and GitHub

| Name | Current/target value | Location | Rule |
| --- | --- | --- | --- |
| Repository | `yangheng95/opencorvus` | committed inventory and workflows | Fixed. |
| Production Environment | `production`, restricted to `main` | GitHub | Fixed. |
| `OPENCORVUS_AUTOMATIC_DEPLOYMENT_ENABLED` | Current and bootstrap target: `false`; final target: `true` | repository variable | Change to `true` only after bootstrap verification and the release-derived website, Registry, download manifest and exact archive checks are green. |
| `EXPERT_SQUAD_TRUSTED_KEYS_JSON` | Current committed public Ed25519 trust root set | repository variable | Public JSON only; must include every active signer. |
| `RACKNERD_HOST` | Field value from the protected Environment | Environment secret and private `production.env` | Never commit the address merely by guessing from DNS or local SSH history. |
| `RACKNERD_SSH_PORT` | `22` unless the host inventory proves another value | Environment variable | One value only. |
| `RACKNERD_DEPLOY_USER` | `opencorvus-deploy` | Environment variable | No interactive administration authority. |
| `RACKNERD_KNOWN_HOSTS` | Complete preverified host-key line | Environment secret and private vault file | Never generate trust with deployment-time `ssh-keyscan`. |
| `RACKNERD_SSH_PRIVATE_KEY` | Deploy identity private key | Environment secret and encrypted private vault envelope | Not a root credential. |
| `EXPERT_SQUAD_SIGNING_KEY_ID` | `expert-squad-ed25519-2026-08-11` until an approved rotation | Environment variable | Must match the public trust root and host-pinned deployment key. |
| `EXPERT_SQUAD_SIGNING_PRIVATE_KEY_B64` | Base64-encoded Ed25519 private PEM | Environment secret and encrypted private vault envelope | Used only on the ephemeral GitHub runner; never copied to production. |
| Bootstrap publication version/expiry | Existing protected values held byte-identical across stage and verify | Environment variables | Must remain unchanged between `bootstrap-stage` and `bootstrap-verify`. |

### Host identities, paths and permissions

| Object | Target | Owner/mode | Writable by |
| --- | --- | --- | --- |
| Release root | `/srv/opencorvus` | `root:root`, `0755` | root only, except `incoming` |
| Candidate inbox | `/srv/opencorvus/incoming` | `opencorvus-deploy:opencorvus-deploy`, `0750` | deploy identity |
| Immutable releases | `/srv/opencorvus/releases` | `root:root`, `0755`; release content non-writable | root activator only |
| Active pointers | `/srv/opencorvus/current`, `/srv/opencorvus/previous` | root-owned symbolic links | root activator only |
| Runtime identity | `opencorvus-web` locked system user/group, no login shell | system account | none interactively |
| Registry state | `/var/lib/opencorvus-web` | `opencorvus-web:opencorvus-registry-readers`, `0710` | web owner; backup identity can traverse only |
| SQLite database | `/var/lib/opencorvus-web/registry.sqlite3` | `opencorvus-web:opencorvus-web`, `0600` | single web writer; stopped control process during activation/restore |
| Immutable blobs | `/var/lib/opencorvus-web/blobs/sha256` | `opencorvus-web:opencorvus-registry-readers`; directories `0750`, ZIP files `0640` | web writes immutable content; backup group reads |
| Local backups | `/var/lib/opencorvus-web/backups` | `opencorvus-web:opencorvus-registry-readers`, `0750`; completed generation files `0640` | local backup writes; backup group reads completed generations |
| Operation lock | `/var/lib/opencorvus-web/registry-operation.lock` | `opencorvus-web:opencorvus-registry-readers`, `0660` | all three operations acquire the same exclusive lock; lock-file write conveys no data write authority |
| Off-host state | `/var/lib/opencorvus-backup` | `opencorvus-backup:opencorvus-backup`, `0755`; private state subdirectory `0700`; `status/last-success.json` path `0755/0644` | off-host service writes; monitor reads only the non-secret marker |
| Generation pins | `/var/lib/opencorvus-backup/pins` | `opencorvus-backup:opencorvus-registry-readers`, `0750`; exact pin files `0640` | off-host owner creates/removes; local backup group reads only; deploy has no access |
| Restic cache | `/var/cache/opencorvus-backup` | `opencorvus-backup:opencorvus-backup`, `0700` | off-host service only |
| Root rollback state | `/var/lib/opencorvus-deploy/rollbacks` | `root:root`, `0700` | root activator only |
| Deployment public key | `/etc/opencorvus/deploy-signing-public.pem` | `root:root`, `0644` | manual root bootstrap/rotation only |
| Caddy configuration | `/etc/caddy/Caddyfile` | `root:root`, `0644` | bootstrap, then signed activator transaction |
| Activator | `/usr/local/bin/opencorvus-activate-release` | `root:root`, `0755` | bootstrap, then signed activator transaction |
| Backup program | `/usr/local/bin/opencorvus-registry-backup` | `root:root`, `0755` | manual root bootstrap/upgrade only |
| systemd units | `/etc/systemd/system/opencorvus-{web,registry-backup}.{service,timer}` | `root:root`, `0644` | web unit may be transactionally updated; backup unit/timer require manual root upgrade |
| sudo policy | `/etc/sudoers.d/opencorvus-deploy` | `root:root`, `0440` | manual root bootstrap/upgrade only |

The web service write boundary is exactly `/var/lib/opencorvus-web`. It cannot write releases, pointers, Caddy, units, rollback snapshots, sudo policy or signing material. The deploy identity can write only `incoming` and invoke the exact root-owned activator through `NOSETENV` sudo.

### Runtime and network

| Endpoint/process | Configuration |
| --- | --- |
| Public TLS | Caddy is the only public listener for `opencorvus.com` and redirects `www` to the apex. |
| Static pages/assets | Caddy serves `/srv/opencorvus/current/client`. |
| Dynamic routes | Exact `/market`, `/market/*`, `/zh-cn/market`, `/zh-cn/market/*`, `/api/registry/*`, `/health/live`, and `/health/ready` requests proxy unchanged to `127.0.0.1:4321`. |
| Loopback acceptance | Caddy listens on `127.0.0.1:8080` for the same route contract; it is never bound publicly. |
| Bun/Astro service | `/usr/bin/bun /srv/opencorvus/current/server/opencorvus-web.mjs`, `HOST=127.0.0.1`, `PORT=4321`, production mode. |
| Resource limits | `MemoryMax=512M`, `TasksMax=128`, strict system protection, private temporary directory, no new privileges, write access only to Registry state. |
| Database | SQLite foreign keys on, Write-Ahead Logging (WAL), full synchronous commits, bounded cache/journal, one active publication, one writer. |
| Archives | Served by streaming verified content-addressed files; ZIP bytes never enter SQLite Binary Large Objects (BLOBs). |

Dependency inventory must prove systemd, Caddy, pinned Bun, OpenSSL with Ed25519 `pkeyutl`, Python 3, curl, GNU tar/coreutils, and util-linux `flock`. The distribution-specific package installation command is selected only after the operating system is inventoried; there is no alternate runtime path.

### Backup and recovery

- Activation creates a consistent pre-migration snapshot in the root-only rollback root after stopping the writer.
- The service-owned timer creates immutable generations at `02:41` and `14:41 UTC` with up to 15 minutes randomized delay. It retains the newest sixteen generations (at least seven complete days plus overlap/jitter margin) and four weekly hard-linked generations.
- Every retained snapshot has a relative SQLite checksum manifest and a state-root-relative SHA-256 inventory of all referenced immutable blobs.
- Off-host replication uses one locked `opencorvus-backup` identity and the planned `opencorvus-registry-offsite-backup` program/service/timer. The implementation slice following approval adds these root-owned assets, their checker coverage and an overlap fixture. The program invokes pinned restic against a dedicated OpenCorvus Registry repository; restic provides client-side encryption, content-addressed incremental transfer, repository integrity and snapshot retention.
- `/etc/opencorvus/backup.env` is `root:opencorvus-backup` mode `0640` and is the only runtime configuration containing `RESTIC_REPOSITORY`, `RESTIC_PASSWORD_FILE`, backend credential-file references and `OPENCORVUS_RESTIC_REPOSITORY_ID`. The expected repository ID is copied once from the separately authorized `restic init` evidence and must match `restic cat config` before every backup/check/forget/prune operation. Repository migration or rotation is a manual root configuration change followed by a complete restore drill. The password/backend files are root-owned, group-readable only by `opencorvus-backup`, and never enter Git, GitHub, the deploy artifact or process arguments. The private operator inventory records only paths/fingerprints, backend class and the non-secret expected repository ID; it is audit evidence, not a runtime fallback.
- The off-host service has read-only group access to completed local backup generations and immutable blobs; it cannot read the live database, staging, releases, Caddy, sudoers, signing material or root rollback state. Its systemd sandbox additionally marks `/var/lib/opencorvus-web` read-only.
- A generation is the basename `generation-<UTC timestamp>` and exactly binds `<generation>.sqlite3`, `.sqlite3.sha256`, `.sqlite3.blobs.sha256`, and every relative blob named by the inventory. The off-host process opens the shared lock read-only and takes an exclusive flock, selects one strict newest generation, verifies both manifests, materializes a relative `--files-from` list, then atomically creates `/var/lib/opencorvus-backup/pins/<generation>` containing the verified manifest digests. Only the off-host owner can create/remove pins; the reader group lets local backup inspect them without write authority. It releases the shared lock before network upload. Immutable blobs do not change; local prune acquires the same lock and skips every exact pinned generation. Upload success or terminal failure reacquires the lock and clears only its matching pin. A crash leaves the pin for the next idempotent retry, which revalidates it before reuse. Activation therefore waits only for short local verification/pin operations, not the 45-minute network budget.
- `opencorvus-registry-backup.timer` creates generations at `02:41` and `14:41 UTC` with at most 15 minutes randomized delay. `opencorvus-registry-backup.service` uses systemd `OnSuccess=opencorvus-registry-offsite-backup.service`; bootstrap requires a systemd version supporting this contract. The persistent retry timer runs hourly, selects the same newest generation, and exits successfully without uploading when an exact `generation:<id>` snapshot already exists. It never creates local snapshots and is idempotent.
- The repository is dedicated to this workload and its configured repository ID is verified before mutation. Every snapshot uses host `opencorvus.com` and tags `opencorvus-registry` plus `generation:<id>`. Retention is filtered to that host/tag even in the dedicated repository: seven daily, four weekly and six monthly. Metadata check runs daily; `--read-data-subset=n/20` rotates by UTC day across twenty shards; prune runs in the weekly maintenance window. The off-host unit has `MemoryMax=384M`, `CPUQuota=50%`, low I/O weight and a 45-minute timeout.
- The off-host unit writes restic cache only under `/var/cache/opencorvus-backup` and retry/maintenance state under `/var/lib/opencorvus-backup/private`. Its only monitor output is `/var/lib/opencorvus-backup/status/last-success.json`, mode `0644`, containing generation, restic repository/snapshot IDs and UTC timestamp but no URL or credential. Registry state remains read-only.
- Failure exits nonzero and leaves the generation eligible for hourly retry. The external monitor named in the private inventory observes unit failure and reads the non-secret marker; it alerts when the marker is older than 18 hours. Silent best effort does not satisfy the contract.
- Healthy worst-case completion spacing is at most approximately 13 hours: 12 hours between schedules, up to 15 minutes relative jitter, and the 45-minute service timeout. One failed scheduled upload plus the bounded hourly retry remains below 15 hours. Thus an 18-hour freshness alert has at least three hours margin, and the 24-hour RPO is established only while this bounded schedule, retry and monitor are active. Persistent backend failure correctly violates the RPO and must alert.
- Off-host recovery is complete only when the snapshot, checksum, blob inventory and every named blob are restored from restic, verified, and exercised in a real isolated drill. A database-only copy is not a backup.
- Recovery point objective (RPO): at most 24 hours only after the off-host service, retry timer and external failure monitor are active and a restore drill passes. Recovery time objective (RTO): at most 30 minutes, measured by that drill rather than inferred from configuration.

## One-time bootstrap configuration sequence

This is the required order when production execution is separately authorized. Landing this record does not perform any step below.

1. **Freeze automatic deployment.** Prove the repository variable equals `false`. Record the reviewed source SHA and the current public DNS answer.
2. **Read-only host inventory.** Record operating system/version, processor compatibility, memory, disk/free space, listeners, Caddy/Bun/OpenSSL/systemd versions, existing `/srv` ownership and pointers, current activator digest, deploy identity, exact SSH host-key fingerprint, and backup destination capacity. Require at least three times measured Registry state plus normal release reserve.
3. **Capture legacy recovery state.** Preserve current Caddy, activator, release pointers and service enablement in root-only recovery storage before changing ownership or routes. Do not copy a live WAL database as backup.
4. **Install bootstrap contracts.** Install dependencies including pinned restic; create web/backup identities and the reader group; install Registry/off-host state and cache directories, public deployment key, local/off-host backup programs/services/timers, off-host environment/credential files, sudo policy, Caddy, web unit and activator with the exact owner/mode matrix above. Validate Caddy, sudoers and every systemd unit; verify the deployment public key SubjectPublicKeyInfo bytes and a real full-manifest signature; initialize and pin the dedicated restic repository ID.
5. **Prove privilege isolation.** Confirm deploy cannot write releases/pointers or set environment overrides; web cannot write root rollback state or control files; backup can traverse state and read only completed generations/immutable blobs but cannot read the live database or write Registry bytes; only `incoming` and web-owned Registry paths are writable by their respective identities. Confirm `backup.env` and credential files are `0640` and unavailable to deploy/web identities. Prove off-host can create/remove generation pins, local backup can only read them, web cannot alter them, and deploy cannot traverse the pin directory.
6. **Stage one signed candidate.** Run the source-bound `bootstrap-stage` workflow. The activator copies the inbox to root-only scratch, verifies the full signed file set, reconstructs the database projection from signed archives, activates exactly one publication, switches release pointers transactionally, and starts the web service.
7. **Loopback acceptance.** Require service liveness/readiness, SQLite integrity/foreign keys/schema fingerprint, active resource totals, every blob binding, both locale Market list/detail routes, one exact archive, the static homepage, signed pointer/catalog/signature/bundle, systemd enablement, both backup timers, first successful off-host generation, external monitor freshness and an isolated restore drill. RPO/RTO do not become established until this gate passes.
8. **DNS cutover.** Only after loopback acceptance, replace the old apex A value with the inventoried RackNerd IPv4, retain `www` as CNAME to the apex, remove conflicting parked A/AAAA records, and wait for authoritative/public convergence and Caddy certificate issuance.
9. **Byte-identical public verification.** Run `bootstrap-verify` without changing source, signer, publication version or expiry. Prove public pointer equality, bilingual dynamic pages, exact archive bytes, `www` redirect and clean Caddy/service journals.
10. **Release publication.** Keep automatic deployment `false`; perform the approved `0.0.41-beta` source-aligned main/branch/tag publication. The Release dispatch must carry and verify the tag plus peeled source SHA before the database-backed website activation.
11. **Enable routine deployment.** Only after native assets, updater/download manifest, website Action, Registry readiness, bilingual pages and exact archive are green, record the mutation and set the repository variable to exactly `true`.

No VPS reboot occurs in this sequence. A reboot is a separate destructive maintenance event requiring explicit authority, an interruption window and a verified rollback channel.

## Failure and rollback contract

- Before the activation commit point, any validation, import, unit, Caddy, service or readiness failure restores the recorded database-absent/database-present state, old release pointers, old Caddy/unit/activator bytes and old service/timer enablement.
- After the commit point, inbox and retention cleanup are non-fatal and cannot misreport a healthy switch as failed.
- A `bootstrap-stage` loopback failure occurs inside the activator transaction and restores the recorded pre-stage server state.
- `bootstrap-verify` is strictly read-only and does not possess SSH credentials or call the activator. If its public probe fails, automatic deployment remains `false`, the staged candidate is retained, the old DNS value is restored first, and operators repeat loopback diagnosis. Only when the candidate itself is proven unhealthy may an authorized operator invoke the exact root activator `--rollback <release-id>` contract and re-accept the restored release.
- A `daily` activation public-probe failure is the only workflow path that automatically calls the reviewed activator rollback transaction. Operators do not manually repoint `current`.
- Unreferenced content-addressed blobs may remain after a failed import and are not recursively deleted in the failure path.
- DNS remains on the old site until loopback acceptance succeeds. If `bootstrap-verify` fails after cutover, restore the prior DNS value and diagnose the retained staged release; no server rollback occurs unless separately authorized after the candidate is proven unhealthy. A `daily` public-probe failure uses the workflow's automatic server rollback.
- Automatic deployment stays `false` after any failed or incomplete stage.

## Evidence ledger for later execution

The execution record must fill every row; placeholders are not success evidence.

| Gate | Required evidence |
| --- | --- |
| Source freeze | Reviewed commit SHA; repository variable output showing `false`; exact remote main/branch/tag refs. |
| Host inventory | Timestamped command output for OS, CPU, memory, disk, listeners, dependencies, fingerprints, users, owners/modes and existing services. |
| Recovery state | Root-only snapshot identifiers and SHA-256 digests; recovery path and retained previous control files. |
| Bootstrap contracts | `caddy validate`, `visudo -cf`, systemd unit verification, pinned restic/repository identity, public-key fingerprint/full-manifest verification, exact file owners/modes. |
| Privilege isolation | Read-only identity/permission checks for deploy, web, backup-reader, credential and root rollback boundaries. |
| Stage Action/rollback | Workflow run URL/ID, source SHA, release ID, publication identity, loopback result, and activator transaction/rollback result. |
| Loopback | `/health/live`, complete `/health/ready`, English/Chinese list/detail, exact archive digest/bytes, signed distribution objects, service/timer status. |
| DNS/public verify | Old/new authoritative answers, certificate/public HTTPS, `www` redirect, byte-identical bootstrap verification; on failure, evidence of DNS restoration and loopback diagnosis, plus explicit activator rollback only if separately invoked. |
| Release | Version projections, main/requested branch/tag peeled equality, five GUI plus five command-line artifacts, checksums/signatures, updater/download manifest. |
| Routine activation/rollback | Release-derived website run source equality, public Registry checks, daily automatic rollback result if the public probe fails, and separate mutation evidence setting the automatic switch to `true` only on success. |
| Disaster recovery | Atomic generation ID, same-lock overlap evidence, tagged restic snapshot/repository ID, local/off-host timer and retry state, freshness alert evidence, snapshot/blob verification plus a real restore drill meeting measured RPO/RTO. |

## Configuration-delivery acceptance

This configuration plan is complete when:

1. the current architecture, runbook and current executable assets remain consistent with the checked single-identity, once-daily baseline, while this record and `production.env.example` identify the approved future target without presenting it as executable current state;
2. every current executable/configuration asset exists, `check-production-configuration.sh` passes against that baseline, every planned off-host asset/change is named in the atomic implementation slice, and the runbook hard-stops operators from applying the reader-group or twice-daily target before the entire slice is committed, checked and independently reviewed;
3. `production.env.example` defaults the safety switch to `false` and contains only non-secret values or placeholders;
4. current public facts are not presented as completed production bootstrap evidence;
5. an uninvolved agent reviews the exact documentation/configuration delta with no unresolved finding.

Production migration and Release success remain later execution evidence; they are not conditions for declaring the configuration scheme itself landed.

## Approved implementation slice after plan approval

The configuration implementation is one atomic slice; none of these changes may land alone:

1. add the off-host program, service, retry timer, status checker and focused overlap fixture;
2. update the existing activator to create/upgrade state root, backups, immutable blob directories/files and the shared lock to the reader-group `0710/0750/0640/0660` matrix while keeping the live database `0600`;
3. update Registry archive import/copy and restore primitives so every new or restored blob preserves group-read and never exposes the live database or staging;
4. update the local backup publisher to create a generation privately, verify it, atomically publish its three files as `0640`, retain sixteen twice-daily generations plus four weekly generations, skip every exact off-host pin while pruning, and trigger off-host only after publication;
5. update the current architecture authority, RackNerd README, twice-daily local timer, OnSuccess wiring, hourly retry timer, configuration checker, bootstrap root-owned asset installation/upgrade documentation and deploy artifact contract together; the checker must verify both local schedules, `OnSuccess`, persistent hourly retry, read-only Registry/read-write off-host sandbox, resource bounds, repository ID and marker path;
6. extend the real fixture across fresh bootstrap, in-place upgrade from the prior `0700` state, activation rollback, local prune overlapping off-host upload/retry, exact generation idempotency, pin owner/group/deploy permissions, repository-ID mismatch typed failure, marker freshness and restored blob/database permissions.

## Plan-delivery evidence

- Independent plan review: APPROVED after four review/repair cycles. The final review reported no P0–P3 finding and explicitly approved the short-lock generation pin, reader-group permission matrix, twice-daily retention/RPO calculation, repository-ID fail-closed check, off-host state/cache/marker boundaries, systemd trigger/retry/resource limits, bootstrap gates and real overlap fixture scope.
- Independent delivery review: APPROVED after the runbook hard-stopped partial application of the future reader-group target and the acceptance criteria distinguished the checked current baseline from the later atomic implementation. The final review reported no unresolved P0–P3 finding.
- `bash deploy/racknerd/check-production-configuration.sh`: PASS against the current production configuration baseline; it proves the safe automatic-deployment default, operator placeholders, existing host path matrix, Caddy, web systemd, local backup timer and sudo boundary. The atomic implementation slice must extend it before claiming the planned off-host assets exist.
- `bash deploy/racknerd/test-opencorvus-activate-release.sh`: PASS; the current signed activation, database snapshot, service switch, rollback and bounded local-backup paths remain intact.
- `bun run packages/web/test/signing-workflow-integration.ts`: PASS after the fixture was aligned with the source-bound workflow's single `WEBSITE_SOURCE_SHA` authority; the signed catalog, full deploy manifest and immutable release ID remain verified.
- `git diff --check`: PASS for the configuration-plan delta.
- External mutations performed by this plan-delivery round: none. The VPS, DNS, GitHub secrets and root/bootstrap state were not read or changed; repository variable `OPENCORVUS_AUTOMATIC_DEPLOYMENT_ENABLED` remains `false`.
