# opencorvus.com RackNerd bootstrap

This directory contains the one-time server bootstrap inputs and the ongoing runbook for `opencorvus.com`. The complete secret-free configuration ledger is [`specs/records/2026-08/2026-08-12-opencorvus-production-database-bootstrap-configuration.md`](../../specs/records/2026-08/2026-08-12-opencorvus-production-database-bootstrap-configuration.md). Caddy serves the immutable Astro client and proxies only Market, Registry API, and health routes to the Bun/Astro service backed by SQLite. The removed local filesystem Registry simulation is not a production interface.

## Documentation and credential source of truth

- This README is the committed, secret-free operating runbook. `production.env.example` is the complete configuration template.
- The current Windows operator account keeps the recoverable production inventory at `%LOCALAPPDATA%/OpenCorvus/deployment-vault/opencorvus.com`. Its `production.env` contains actual non-secret values and paths, `vault-manifest.json` contains key fingerprints and SHA-256 bindings, and `known_hosts` contains the pinned public SSH host keys.
- Actual deploy/signing private keys are stored only as `*.dpapi.json` envelopes encrypted by Windows Data Protection API (DPAPI) with `CurrentUser` scope. The folder and files must have inherited access disabled and grant full control only to the current Windows identity and `SYSTEM`.
- GitHub Environment secrets are write-only delivery copies, not a backup. Never place private bytes in this repository, an issue, a workflow variable, shell history, or documentation. The RackNerd root password is a provider-console recovery credential and is deliberately outside this deployment vault.
- `vault.ps1` protects, verifies, and restores a credential without printing its bytes. A restored private key is an ephemeral recovery file: upload or use it, then delete it immediately. DPAPI recovery requires the same Windows user profile; back up that profile through the user's normal encrypted Windows backup policy.

Verify both encrypted keys without restoring plaintext:

```powershell
$vault = Join-Path $env:LOCALAPPDATA "OpenCorvus/deployment-vault/opencorvus.com"
$manifest = Get-Content (Join-Path $vault "vault-manifest.json") -Raw | ConvertFrom-Json
./deploy/racknerd/vault.ps1 -Action Verify -InputPath (Join-Path $vault "racknerd-deploy-key.dpapi.json") -Label $manifest.deployKey.label -ExpectedSha256 $manifest.deployKey.privateSha256
./deploy/racknerd/vault.ps1 -Action Verify -InputPath (Join-Path $vault "expert-squad-signing-key.dpapi.json") -Label $manifest.signingKey.label -ExpectedSha256 $manifest.signingKey.privateSha256
```

Restore one key only when recovery requires it:

```powershell
./deploy/racknerd/vault.ps1 -Action Restore -InputPath <dpapi-envelope> -OutputPath <temporary-private-key-inside-private-vault> -Label <manifest-label> -ExpectedSha256 <manifest-sha256>
```

`Protect` and `Restore` reject an output directory unless its ACL already grants full control only to the current Windows identity and `SYSTEM`. They create an empty output, apply the final private-file ACL, and only then write credential bytes; any create, ACL, or write failure removes the output before returning the error.

## Verified production state before database migration

These facts combine committed non-secret configuration with read-only public/GitHub checks from 2026-08-12. The documented local vault is absent from this Windows account, so server-only facts remain unverified until inventory runs.

| Boundary | Current value |
| --- | --- |
| Public origins | `https://opencorvus.com`, `https://www.opencorvus.com` |
| DNS | GoDaddy; the apex currently resolves to legacy-site IPv4 `192.255.229.117`; `www` is a CNAME to the apex. The protected RackNerd IPv4 is a cutover input and is not committed. |
| GitHub repository / Environment | `yangheng95/opencorvus` / `production`, restricted to `main` |
| RackNerd SSH | port `22`, deploy user `opencorvus-deploy` |
| Web service | The public site remains the legacy static release; `https://opencorvus.com/health/ready` returned `404`. The target service binds only `127.0.0.1:4321`, with Caddy readiness on `127.0.0.1:8080`. |
| Release storage | `/srv/opencorvus/releases`, `/srv/opencorvus/current`, `/srv/opencorvus/previous` |
| Persistent Registry state | Target paths are `/var/lib/opencorvus-web/registry.sqlite3`, content-addressed `blobs/`, `staging/`, and `backups/`; their production existence is not yet verified. |
| Server configuration | Existing Caddy/activator details require inventory. Database bootstrap adds the reviewed service, daily backup timer, OpenSSL public key, and signed-manifest activator. |
| Current signing key ID | `expert-squad-ed25519-2026-08-11` |
| Automatic deployment switch | repository variable `OPENCORVUS_AUTOMATIC_DEPLOYMENT_ENABLED=false` while database bootstrap and the release-derived publication remain pending |

Current GitHub Environment variables are `RACKNERD_SSH_PORT`, `RACKNERD_DEPLOY_USER`, `EXPERT_SQUAD_SIGNING_KEY_ID`, `EXPERT_SQUAD_BOOTSTRAP_PUBLICATION_VERSION`, and `EXPERT_SQUAD_BOOTSTRAP_PUBLICATION_EXPIRES_AT`. Current repository variables are `EXPERT_SQUAD_TRUSTED_KEYS_JSON` and `OPENCORVUS_AUTOMATIC_DEPLOYMENT_ENABLED`. Current Environment secrets are `RACKNERD_HOST`, `RACKNERD_KNOWN_HOSTS`, `RACKNERD_SSH_PRIVATE_KEY`, and `EXPERT_SQUAD_SIGNING_PRIVATE_KEY_B64`. The optional secondary signing key/ID must be absent outside a planned rotation overlap.

The intended local-vault mapping is below. Because that vault is currently missing, it is not recovery evidence until restored and verified:

| GitHub secret | Local recovery source |
| --- | --- |
| `RACKNERD_SSH_PRIVATE_KEY` | `racknerd-deploy-key.dpapi.json` plus the `deployKey` label/digest in `vault-manifest.json` |
| `EXPERT_SQUAD_SIGNING_PRIVATE_KEY_B64` | `expert-squad-signing-key.dpapi.json` plus the `signingKey` label/digest in `vault-manifest.json`; base64-encode the restored PEM before uploading |
| `RACKNERD_KNOWN_HOSTS` | `known_hosts`, pinned and hashed by `vault-manifest.json` |
| `RACKNERD_HOST` | `RACKNERD_HOST` in local `production.env` |

## Recovery and reuse

1. Clone the repository and verify `deploy/racknerd/Caddyfile`, the activation script, this runbook, and the vault manifest hashes before touching production.
2. On the same Windows account, run the two `Verify` commands above. Restore only the credential being used into the vault directory; `vault.ps1` refuses overwrite and applies a current-user/SYSTEM-only access control list (ACL).
3. Recreate GitHub variables from `production.env`. Upload the restored deploy key to `RACKNERD_SSH_PRIVATE_KEY`. For the signing key, base64-encode the restored PEM bytes and upload that result to `EXPERT_SQUAD_SIGNING_PRIVATE_KEY_B64`. Upload `known_hosts` to `RACKNERD_KNOWN_HOSTS`. Delete each restored plaintext file immediately after upload.
4. Verify the deploy key with strict host-key checking, then manually run `deployment_mode=daily`. Require all five jobs to pass and verify the public pointer, catalog, signature envelope, and bundle before considering recovery complete.
5. For a new VPS, run the server preparation boundary below first, then point DNS only after a successful `bootstrap-stage`; use `bootstrap-verify` after public HTTPS converges. For an existing VPS, never rerun bootstrap blindly over unknown services or `/srv` ownership.

Routine operations:

- Website/source publication: push a matching path to `main`; the workflow builds all three canonical archive platforms plus the website, signs, validates, uploads, switches the immutable release, probes public HTTPS, and rolls back on failure.
- Manual renewal: run `deployment_mode=daily`. The monthly schedule is best-effort only; monitor expiry separately because GitHub can disable inactive schedules.
- Health: check `systemctl status caddy opencorvus-web`, `caddy validate --config /etc/caddy/Caddyfile`, both journals, the `/srv/opencorvus/current` symlink, `/health/ready`, both language Market list/detail routes, one exact archive response, and `/expert-squads/catalog.json`.
- Rollback: invoke the root-owned activator only through the reviewed release contract; never repoint `current` to an unvalidated directory manually.
- Backups: every activation creates a consistent pre-migration SQLite snapshot with `VACUUM INTO`; activation metadata is bounded to four releases. The hardened timer retains 7 daily and 4 weekly local snapshots plus a SHA-256 inventory of every immutable ZIP blob required by each snapshot. Off-host replication must copy the selected database snapshot, its checksum, its blob inventory, and every `blobs/sha256/**` file named by that inventory. Verify the database manifest from the backup directory (`cd /var/lib/opencorvus-web/backups && sha256sum --check <snapshot>.sqlite3.sha256`) and verify the blob inventory from the state root (`cd /var/lib/opencorvus-web && sha256sum --check backups/<snapshot>.sqlite3.blobs.sha256`), including at the destination. Destination credentials and a successful restore drill remain required production inputs. Copying a live Write-Ahead Logging (WAL) database file is not a valid backup.
- Signing rotation: first add the new browser root and secondary key/ID and publish a dual-signature release. Before promoting that key as the primary deploy signer, use the manual root boundary to replace `/etc/opencorvus/deploy-signing-public.pem`, verify its fingerprint and a real full-manifest signature, and retain the old PEM. Then promote CI, publish, remove the old browser signer/root, and publish new-only. Browser overlap alone does not rotate the host deployment root.
- Deploy-key rotation: append and test the new public key, replace the GitHub secret, require one successful real deployment, then converge `authorized_keys` to the new key.

## Required facts

Before the first database-backed deployment, record the RackNerd server IP, SSH port, operating system, free disk and memory, existing listeners/services, Bun version/path, systemd availability, OpenSSL version and Ed25519 verification support, deploy username, exact SSH host-key fingerprint, off-host backup destination, and tested restore capacity. Require enough free space for the candidate, immutable blobs, live database, pre-deploy snapshot, and rollback copy (at least three times the measured Registry state plus the normal release reserve). Inspect the server read-only before changing Caddy, systemd, `/srv/opencorvus`, or `/var/lib/opencorvus-web`.

## Server boundary

- Install Caddy from its official repository plus pinned Bun, pinned OpenSSL with Ed25519 `pkeyutl` support, Python 3, curl, GNU tar, GNU coreutils, and util-linux `flock`; place `Caddyfile` at `/etc/caddy/Caddyfile`.
- Create a non-root deploy user with no interactive administration authority.
- Create `/srv/opencorvus`, `releases`, and the `current`/`previous` pointers as root-owned and not group/world writable. Only `/srv/opencorvus/incoming` is writable by the deploy user so CI can stage one release inbox. The root activator alone creates immutable releases and switches pointers; possession of the SSH deploy key cannot bypass the signed manifest by replacing the static root or server entrypoint.
- **Planned atomic target — do not execute partially:** the committed activator, local-backup program and systemd assets still implement the current single-identity, once-daily baseline. The reader-group/off-host design below becomes an operational instruction only after every item in the approved atomic implementation slice is committed, checked and independently reviewed. Until then, stop rather than creating these identities or changing state permissions by hand.
- In that future atomic target, create locked `opencorvus-web` and `opencorvus-backup` service identities plus an `opencorvus-registry-readers` group containing both. `/var/lib/opencorvus-web` is service-owned mode `0710`; the live database remains owner-only `0600`. Only completed local backup generations and immutable blob directories/files are group-readable (`0750` directories, `0640` files); staging and the live database are not. The shared operation lock is `0660`, allowing the off-host reader to serialize with activation and local backup without data-write authority. Create `/var/lib/opencorvus-deploy/rollbacks` separately as root-owned mode `0700`, outside both service units' data access. Database/Caddy/unit/activator rollback copies and state markers live only there. Deploy, web and backup identities must not be able to read or modify rollback materials or signing material.
- Install `opencorvus-activate-release` and `opencorvus-registry-backup` as root-owned mode `0755` under `/usr/local/bin`. Install the web/backup service and timer units as root-owned mode `0644`, and install the reviewed `opencorvus-deploy.sudoers` with `visudo -cf` validation as root-owned mode `0440`, then run `systemctl daemon-reload`.
- Install the committed `deploy-signing-public.pem` as root-owned, non-writable mode `0644` at `/etc/opencorvus/deploy-signing-public.pem`. Verify its SubjectPublicKeyInfo bytes against the committed PEM and the current public signing root, then verify a real full-manifest signature. Public provenance matched `MCow…XAiM=` on 2026-08-12; production ownership/content still require host inventory.
- Enable the web service only after candidate import succeeds and the backup timer only after readiness succeeds. Do not broaden either service's `ReadWritePaths`.
- Grant the deploy account passwordless sudo for the exact root-owned activator command only. The committed rule requires `env_reset`, `NOSETENV`, and a fixed `secure_path`; the activator independently clears every test/path override and fixes `PATH` whenever its effective user is root. It receives no general systemctl, file-copy, shell, database, or Caddy privileges.
- CI signs the exact `client/` + `server/` deploy manifest after every file is final. The activator verifies it against the root-pinned PEM, proves exact file-set equality and every file digest, and only then may transactionally replace Caddy, the web service unit, or the activator. The backup program/service/timer, sudo rule, and deployment public key are root-bootstrap assets: routine activation requires their candidate bytes to equal the installed root-owned copies and fails closed on a difference. Upgrading any of those four contracts requires an announced manual root change, validation, and retained previous copy before CI can deploy a candidate containing the new bytes.
- Keep the Caddy loopback readiness listener on `127.0.0.1:8080`; the activator uses it to verify exact served bytes without depending on public DNS or a public certificate. It is not exposed on the server's public interfaces.
- Keep `current`, `previous`, and the three newest additional immutable releases. After a healthy switch the activation script removes that release's exact validated inbox and prunes only older unreferenced directories whose names match the release-ID contract.
- Activation, explicit rollback, and the daily backup timer all hold the same state-root `flock`; database snapshot/import/restore and backup retention cannot overlap. The signed activator update is part of the rollback transaction. Inbox and old-retention cleanup happen after the commit point and report warnings without misreporting a healthy switch as failed.

## One-time static-to-database migration

1. Complete the required read-only inventory and take a recoverable snapshot of the current Caddy configuration, activator, release pointers, and host state. Record `openssl version` and prove Ed25519 verification. Do not run the new activator until Bun, OpenSSL, the service account, persistent state directory, root-pinned deploy key, backup timer, systemd boundary, and exact sudo rule are present.
2. Stage one signed candidate containing `client/` and `server/`. The server artifact contains the single bundled Astro runtime, Registry control executable, import seed, Caddy configuration, systemd unit, and activator. Production never receives a signing private key.
3. Let the activator copy the deploy-user inbox into a root-only scratch directory, then validate candidate hashes and signed catalog/bundle bindings from that stable copy. It stops the single writer, creates the consistent pre-deploy database snapshot in the root-only rollback store, reconstructs every seed projection from the signed ZIP archives, imports the candidate publication without activating it early, atomically switches the release, installs the reviewed unit/configuration, and starts the service.
4. Require loopback liveness/readiness, schema checksum, SQLite integrity and foreign-key checks, blob digest/size checks, English and Chinese Market list/detail pages, signed pointer bytes, and one exact archive byte binding before success. The initial import total is read from the signed seed; it is not a hard-coded historical count.
5. On any failure, the activator restores the previous release pointer, database snapshot, Caddy configuration, systemd unit, and prior service state. Newly copied content-addressed blobs may remain unreferenced for later controlled garbage collection; never recursively delete them in the failure path.
6. Do not infer authority to reboot the VPS from bootstrap or deployment approval. A real reboot is a separate, later maintenance operation that requires explicit authorization, an announced interruption window, and a verified rollback channel. When that operation is authorized, repeat readiness, bilingual page, archive, backup-timer, and public HTTPS checks after boot and record the measured recovery time objective (RTO); the target is no more than 30 minutes, with recovery point objective (RPO) no more than 24 hours after daily off-host backup begins. Until then, prove persistence non-destructively from systemd enablement and the active service/timer state.

For a disaster restore, provision an empty state root, restore one daily/weekly snapshot and verify its `.sqlite3.sha256` manifest from the directory containing that snapshot, restore every relative blob path listed in its `.blobs.sha256` inventory, verify the blob inventory from the state root, set ownership/modes, and only then start the old matching release. `/health/ready`, both locale routes, and an exact archive response are the restore acceptance checks. A database-only copy is incomplete and must never be reported as a Registry backup.

## GitHub production environment

Configure a protected `production` Environment restricted to `main`, then add:

Secrets:

- `RACKNERD_HOST`
- `RACKNERD_SSH_PRIVATE_KEY`
- `RACKNERD_KNOWN_HOSTS` — the preverified complete known-hosts line; do not populate it with runtime `ssh-keyscan`
- `EXPERT_SQUAD_SIGNING_PRIVATE_KEY_B64` — base64 of a dedicated Ed25519 private PEM, separate from the desktop updater key
- `EXPERT_SQUAD_SECONDARY_SIGNING_PRIVATE_KEY_B64` — optional second Ed25519 key used only during an old/new rotation overlap

Variables:

- `RACKNERD_SSH_PORT`
- `RACKNERD_DEPLOY_USER`
- `EXPERT_SQUAD_SIGNING_KEY_ID`
- `EXPERT_SQUAD_SECONDARY_SIGNING_KEY_ID` — required exactly when the optional secondary private key is present
- `EXPERT_SQUAD_TRUSTED_KEYS_JSON` — repository-level variable (not a secret) containing every currently trusted key as `{ "keyId", "publicKeySpkiBase64" }`; keep old and new roots together throughout a rotation overlap
- `EXPERT_SQUAD_BOOTSTRAP_PUBLICATION_VERSION` — positive integer used only by the byte-identical `bootstrap-stage`/`bootstrap-verify` pair; choose a value lower than the next automatic workflow run number multiplied by 1000
- `EXPERT_SQUAD_BOOTSTRAP_PUBLICATION_EXPIRES_AT` — explicit future UTC timestamp held unchanged across the two bootstrap runs
- `OPENCORVUS_AUTOMATIC_DEPLOYMENT_ENABLED` — repository-level safety switch; leave unset or `false` through bootstrap, version synchronization, release creation, and the release-derived website deployment, then set exactly `true` only after `bootstrap-verify` plus the website, Registry, downloads manifest, and exact archive checks are all green

The signing/deploy job downloads the digest-verified `client/` + `server/` build artifact without checking out the repository. It signs with fixed runner/OpenSSL operations, removes the private key before packaging or SSH, verifies the server host key, uploads an immutable release, and invokes the preinstalled activation command through its exact sudo rule. The catalog signature authenticates the desktop publication contract; the separate full deploy-manifest signature authenticates every privileged server/client artifact. If the primary key rotates before the root-pinned host key is updated and verified, deployment must stop rather than use a fallback key.

Daily publication derives its version as `GitHub workflow run number * 1000 + run attempt`, fails if that value is not a JavaScript safe integer, and derives a fresh expiry 90 days from signing time. GitHub defines the workflow run number as incrementing for every new run of this workflow and the attempt as incrementing for each rerun. Matching pushes deploy automatically after the safety switch is enabled, and a monthly scheduled run renews the signed pointer even when the source is unchanged. A manual `daily` run uses the same automatic derivation. Equal-version replay and rollback are rejected on the server. The optional second signer creates an overlap publication with threshold one so pages carrying either trusted root can verify it. Remove the old signer and old public root only after the overlap release has propagated.

GitHub can automatically disable scheduled workflows in a public repository after 60 days without repository activity, and scheduled runs can be delayed during high load. The monthly renewal is therefore defense in depth, not an unattended availability guarantee. Keep an external expiry monitor and ensure repository activity, manual `daily` renewal, or schedule re-enablement occurs before the 90-day pointer expires.

The immutable release ID is `<commit SHA>-<publication-pointer SHA-256 prefix>`. It binds each release directory to the final pointer, including publication version, expiry, signature envelope, catalog, and bundle references. A monthly or manual renewal of unchanged source therefore creates a new immutable release instead of colliding with the prior commit/bundle pair.

## DNS cutover

The first release is a deliberate three-stage operation; ordinary pushes use only the later daily path:

1. Manually run `deploy opencorvus.com` with `deployment_mode=bootstrap-stage`. It uploads and activates the immutable candidate, then validates database readiness, both language Market routes, one exact archive, the homepage, pointer, catalog, signature envelope, and bundle through loopback. It intentionally does not call the public domain.
2. Only after that run succeeds, replace the GoDaddy apex A record with the RackNerd IPv4 address, keep `www` as a CNAME to the apex, and remove conflicting parked-site A/AAAA records. Wait for public DNS convergence and Caddy's public certificate issuance.
3. Without changing the source revision, signing keys, bootstrap publication version, or bootstrap expiry, manually rerun the workflow with `deployment_mode=bootstrap-verify`. This mode does not upload or activate a release; it requires the public pointer to be byte-identical to the staged candidate and verifies all content-addressed bytes over public HTTPS.

After bootstrap verification succeeds and the release-derived website deployment, Registry, downloads manifest, and exact archive checks are all green, set `OPENCORVUS_AUTOMATIC_DEPLOYMENT_ENABLED=true`. Subsequent matching `main` pushes, monthly renewal runs, and manual `deployment_mode=daily` runs use upload → local readiness → public HTTPS probe, with server rollback on a failed public probe. Before that switch, push and schedule events still run the cross-platform archive and website verification jobs but cannot enter the production signing/deploy job. During the one-time cutover, verify `www` redirect behavior, systemd enablement, the active service and backup timer, and Caddy logs. A real VPS reboot remains outside this procedure until separately authorized as described above.
