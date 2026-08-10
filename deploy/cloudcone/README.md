# opencorvus.com CloudCone bootstrap

This directory contains the one-time server bootstrap inputs for the static `opencorvus.com` deployment. It does not expose the local Hosted Registry simulation.

## Required facts

Before the first deployment, record the CloudCone server IP, SSH port, operating system, existing listeners/services, deploy username, and the exact SSH host-key fingerprint. Inspect the server read-only before changing Caddy or `/srv/opencorvus`.

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

- `CLOUDCONE_HOST`
- `CLOUDCONE_SSH_PRIVATE_KEY`
- `CLOUDCONE_KNOWN_HOSTS` — the preverified complete known-hosts line; do not populate it with runtime `ssh-keyscan`
- `EXPERT_SQUAD_SIGNING_PRIVATE_KEY_B64` — base64 of a dedicated Ed25519 private PEM, separate from the desktop updater key
- `EXPERT_SQUAD_SECONDARY_SIGNING_PRIVATE_KEY_B64` — optional second Ed25519 key used only during an old/new rotation overlap

Variables:

- `CLOUDCONE_SSH_PORT`
- `CLOUDCONE_DEPLOY_USER`
- `EXPERT_SQUAD_SIGNING_KEY_ID`
- `EXPERT_SQUAD_SECONDARY_SIGNING_KEY_ID` — required exactly when the optional secondary private key is present
- `EXPERT_SQUAD_TRUSTED_KEYS_JSON` — repository-level variable (not a secret) containing every currently trusted key as `{ "keyId", "publicKeySpkiBase64" }`; keep old and new roots together throughout a rotation overlap
- `EXPERT_SQUAD_PUBLICATION_VERSION` — positive, monotonically increasing integer
- `EXPERT_SQUAD_PUBLICATION_EXPIRES_AT` — explicit UTC timestamp renewed by the operator
- `OPENCORVUS_AUTOMATIC_DEPLOYMENT_ENABLED` — repository-level safety switch; leave unset or `false` during bootstrap, then set exactly `true` only after `bootstrap-verify` succeeds

The signing/deploy job downloads the digest-verified build artifact without checking out the repository. It signs with fixed runner/OpenSSL operations, removes the private key before packaging or SSH, verifies the server host key, uploads an immutable release, and invokes the preinstalled activation command.

Every deployment must increment `EXPERT_SQUAD_PUBLICATION_VERSION`; equal-version replay and rollback are rejected on the server. The optional second signer creates an overlap publication with threshold one so pages carrying either trusted root can verify it. Remove the old signer and old public root only after the overlap release has propagated.

## DNS cutover

The first release is a deliberate three-stage operation; ordinary pushes use only the later daily path:

1. Manually run `deploy opencorvus.com` with `deployment_mode=bootstrap-stage`. It uploads and activates the immutable candidate, then the server validates the homepage, pointer, catalog, signature envelope, and bundle through the loopback readiness listener. It intentionally does not call the public domain.
2. Only after that run succeeds, replace the GoDaddy apex A record with the CloudCone IPv4 address, keep `www` as a CNAME to the apex, and remove conflicting parked-site A/AAAA records. Wait for public DNS convergence and Caddy's public certificate issuance.
3. Without changing the source revision, signing keys, publication version, or expiry, manually rerun the workflow with `deployment_mode=bootstrap-verify`. This mode does not upload or activate a release; it requires the public pointer to be byte-identical to the staged candidate and verifies all content-addressed bytes over public HTTPS.

After bootstrap verification succeeds, set `OPENCORVUS_AUTOMATIC_DEPLOYMENT_ENABLED=true`. Subsequent matching `main` pushes and manual `deployment_mode=daily` runs use upload → local readiness → public HTTPS probe, with server rollback on a failed public probe. Before that switch, pushes still run the cross-platform archive and website verification jobs but cannot enter the production signing/deploy job. Also verify `www` redirect behavior, reboot persistence, and Caddy logs during the one-time cutover.
