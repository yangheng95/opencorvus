# opencorvus.com RackNerd bootstrap

This directory contains the one-time server bootstrap inputs for the static `opencorvus.com` deployment. It does not expose the local Hosted Registry simulation.

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

## Current production inventory

The committed values below are non-secret facts; `production.env` in the local vault is the complete machine-readable copy.

| Boundary | Current value |
| --- | --- |
| Public origins | `https://opencorvus.com`, `https://www.opencorvus.com` |
| DNS | GoDaddy; apex A points to the RackNerd IPv4; `www` is a CNAME to the apex |
| GitHub repository / Environment | `yangheng95/opencorvus` / `production`, restricted to `main` |
| RackNerd SSH | port `22`, deploy user `opencorvus-deploy` |
| Web service | Caddy `2.11.4`, public TCP `80`/`443`, readiness only on `127.0.0.1:8080` |
| Release storage | `/srv/opencorvus/releases`, `/srv/opencorvus/current`, `/srv/opencorvus/previous` |
| Server configuration | `/etc/caddy/Caddyfile`, `/usr/local/bin/opencorvus-activate-release` |
| Current signing key ID | `expert-squad-ed25519-2026-08-11` |
| Automatic deployment switch | repository variable `OPENCORVUS_AUTOMATIC_DEPLOYMENT_ENABLED=true` |

Current GitHub Environment variables are `RACKNERD_SSH_PORT`, `RACKNERD_DEPLOY_USER`, `EXPERT_SQUAD_SIGNING_KEY_ID`, `EXPERT_SQUAD_BOOTSTRAP_PUBLICATION_VERSION`, and `EXPERT_SQUAD_BOOTSTRAP_PUBLICATION_EXPIRES_AT`. Current repository variables are `EXPERT_SQUAD_TRUSTED_KEYS_JSON` and `OPENCORVUS_AUTOMATIC_DEPLOYMENT_ENABLED`. Current Environment secrets are `RACKNERD_HOST`, `RACKNERD_KNOWN_HOSTS`, `RACKNERD_SSH_PRIVATE_KEY`, and `EXPERT_SQUAD_SIGNING_PRIVATE_KEY_B64`. The optional secondary signing key/ID must be absent outside a planned rotation overlap.

The local vault maps the two private-key secrets as follows:

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
- Health: check `systemctl status caddy`, `caddy validate --config /etc/caddy/Caddyfile`, `journalctl -u caddy`, the `/srv/opencorvus/current` symlink, public root/market routes, and `/expert-squads/catalog.json`.
- Rollback: invoke the root-owned activator only through the reviewed release contract; never repoint `current` to an unvalidated directory manually.
- Signing rotation: first add the new public root and secondary key/ID, publish a successful dual-signature `daily` release, then promote the new key, remove the secondary secret/ID and old root, and publish a second successful new-only release.
- Deploy-key rotation: append and test the new public key, replace the GitHub secret, require one successful real deployment, then converge `authorized_keys` to the new key.

## Required facts

Before the first deployment, record the RackNerd server IP, SSH port, operating system, existing listeners/services, deploy username, and the exact SSH host-key fingerprint. Inspect the server read-only before changing Caddy or `/srv/opencorvus`.

## Server boundary

- Install Caddy from its official repository plus Python 3, curl, GNU tar, and GNU coreutils; place `Caddyfile` at `/etc/caddy/Caddyfile`.
- Create a non-root deploy user with no interactive administration authority.
- Create the dedicated `/srv/opencorvus` tree, including `incoming` and `releases`, owned by that deploy user with mode `0755`; this ownership is required for atomic `current`/`previous` pointer replacement. The account owns no parent directory, `/etc/caddy`, systemd unit, or unrelated site.
- Install `opencorvus-activate-release` as root-owned mode `0755` at `/usr/local/bin/opencorvus-activate-release`.
- Validate and reload Caddy once after the configuration is installed. Later content releases switch only the `/srv/opencorvus/current` symlink and do not reload Caddy.
- Keep the Caddy loopback readiness listener on `127.0.0.1:8080`; the activator uses it to verify exact served bytes without depending on public DNS or a public certificate. It is not exposed on the server's public interfaces.
- Keep `current`, `previous`, and the three newest additional immutable releases. After a healthy switch the activation script removes that release's exact validated inbox and prunes only older unreferenced directories whose names match the release-ID contract.

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
- `OPENCORVUS_AUTOMATIC_DEPLOYMENT_ENABLED` — repository-level safety switch; leave unset or `false` during bootstrap, then set exactly `true` only after `bootstrap-verify` succeeds

The signing/deploy job downloads the digest-verified build artifact without checking out the repository. It signs with fixed runner/OpenSSL operations, removes the private key before packaging or SSH, verifies the server host key, uploads an immutable release, and invokes the preinstalled activation command.

Daily publication derives its version as `GitHub workflow run number * 1000 + run attempt`, fails if that value is not a JavaScript safe integer, and derives a fresh expiry 90 days from signing time. GitHub defines the workflow run number as incrementing for every new run of this workflow and the attempt as incrementing for each rerun. Matching pushes deploy automatically after the safety switch is enabled, and a monthly scheduled run renews the signed pointer even when the source is unchanged. A manual `daily` run uses the same automatic derivation. Equal-version replay and rollback are rejected on the server. The optional second signer creates an overlap publication with threshold one so pages carrying either trusted root can verify it. Remove the old signer and old public root only after the overlap release has propagated.

GitHub can automatically disable scheduled workflows in a public repository after 60 days without repository activity, and scheduled runs can be delayed during high load. The monthly renewal is therefore defense in depth, not an unattended availability guarantee. Keep an external expiry monitor and ensure repository activity, manual `daily` renewal, or schedule re-enablement occurs before the 90-day pointer expires.

The immutable release ID is `<commit SHA>-<publication-pointer SHA-256 prefix>`. It binds each release directory to the final pointer, including publication version, expiry, signature envelope, catalog, and bundle references. A monthly or manual renewal of unchanged source therefore creates a new immutable release instead of colliding with the prior commit/bundle pair.

## DNS cutover

The first release is a deliberate three-stage operation; ordinary pushes use only the later daily path:

1. Manually run `deploy opencorvus.com` with `deployment_mode=bootstrap-stage`. It uploads and activates the immutable candidate, then the server validates the homepage, pointer, catalog, signature envelope, and bundle through the loopback readiness listener. It intentionally does not call the public domain.
2. Only after that run succeeds, replace the GoDaddy apex A record with the RackNerd IPv4 address, keep `www` as a CNAME to the apex, and remove conflicting parked-site A/AAAA records. Wait for public DNS convergence and Caddy's public certificate issuance.
3. Without changing the source revision, signing keys, bootstrap publication version, or bootstrap expiry, manually rerun the workflow with `deployment_mode=bootstrap-verify`. This mode does not upload or activate a release; it requires the public pointer to be byte-identical to the staged candidate and verifies all content-addressed bytes over public HTTPS.

After bootstrap verification succeeds, set `OPENCORVUS_AUTOMATIC_DEPLOYMENT_ENABLED=true`. Subsequent matching `main` pushes, monthly renewal runs, and manual `deployment_mode=daily` runs use upload → local readiness → public HTTPS probe, with server rollback on a failed public probe. Before that switch, push and schedule events still run the cross-platform archive and website verification jobs but cannot enter the production signing/deploy job. Also verify `www` redirect behavior, reboot persistence, and Caddy logs during the one-time cutover.
