#!/usr/bin/env bash
set -euo pipefail

REPOSITORY_ROOT=$(cd "$(dirname "$0")/../.." && pwd)
cd "$REPOSITORY_ROOT"

python3 - <<'PY'
from pathlib import Path

root = Path.cwd()
env_file = root / "deploy/racknerd/production.env.example"
values: dict[str, str] = {}
for raw_line in env_file.read_text("utf-8").splitlines():
    line = raw_line.strip()
    if not line or line.startswith("#"):
        continue
    key, separator, value = line.partition("=")
    if separator != "=":
        raise SystemExit(f"invalid production inventory line: {raw_line}")
    values[key] = value

expected = {
    "OPENCORVUS_PRODUCTION_ORIGIN": "https://opencorvus.com",
    "OPENCORVUS_PRODUCTION_WWW_ORIGIN": "https://www.opencorvus.com",
    "OPENCORVUS_GITHUB_REPOSITORY": "yangheng95/opencorvus",
    "OPENCORVUS_GITHUB_ENVIRONMENT": "production",
    "OPENCORVUS_AUTOMATIC_DEPLOYMENT_ENABLED": "false",
    "RACKNERD_SSH_PORT": "22",
    "RACKNERD_DEPLOY_USER": "opencorvus-deploy",
    "OPENCORVUS_SERVER_RELEASE_ROOT": "/srv/opencorvus/releases",
    "OPENCORVUS_SERVER_INCOMING_ROOT": "/srv/opencorvus/incoming",
    "OPENCORVUS_SERVER_CURRENT_LINK": "/srv/opencorvus/current",
    "OPENCORVUS_SERVER_PREVIOUS_LINK": "/srv/opencorvus/previous",
    "OPENCORVUS_SERVER_CADDY_CONFIG": "/etc/caddy/Caddyfile",
    "OPENCORVUS_SERVER_ACTIVATOR": "/usr/local/bin/opencorvus-activate-release",
    "OPENCORVUS_SERVER_BACKUP_PROGRAM": "/usr/local/bin/opencorvus-registry-backup",
    "OPENCORVUS_SERVER_SERVICE_UNIT": "/etc/systemd/system/opencorvus-web.service",
    "OPENCORVUS_SERVER_BACKUP_SERVICE_UNIT": "/etc/systemd/system/opencorvus-registry-backup.service",
    "OPENCORVUS_SERVER_BACKUP_TIMER_UNIT": "/etc/systemd/system/opencorvus-registry-backup.timer",
    "OPENCORVUS_SERVER_SUDOERS": "/etc/sudoers.d/opencorvus-deploy",
    "OPENCORVUS_SERVER_DEPLOY_PUBLIC_KEY": "/etc/opencorvus/deploy-signing-public.pem",
    "OPENCORVUS_SERVER_SERVICE_USER": "opencorvus-web",
    "OPENCORVUS_SERVER_REGISTRY_STATE": "/var/lib/opencorvus-web",
    "OPENCORVUS_SERVER_REGISTRY_DATABASE": "/var/lib/opencorvus-web/registry.sqlite3",
    "OPENCORVUS_SERVER_REGISTRY_BACKUPS": "/var/lib/opencorvus-web/backups",
    "OPENCORVUS_SERVER_ROOT_ROLLBACKS": "/var/lib/opencorvus-deploy/rollbacks",
    "OPENCORVUS_SERVER_BUN": "/usr/bin/bun",
    "OPENCORVUS_SERVER_RUNTIME_ORIGIN": "http://127.0.0.1:4321",
    "OPENCORVUS_SERVER_LOOPBACK_ORIGIN": "http://127.0.0.1:8080",
    "OPENCORVUS_SERVER_OFFSITE_BACKUP_PROGRAM": "/usr/local/bin/opencorvus-registry-offsite-backup",
    "OPENCORVUS_SERVER_OFFSITE_BACKUP_SERVICE_UNIT": "/etc/systemd/system/opencorvus-registry-offsite-backup.service",
    "OPENCORVUS_SERVER_OFFSITE_BACKUP_TIMER_UNIT": "/etc/systemd/system/opencorvus-registry-offsite-backup.timer",
    "OPENCORVUS_SERVER_OFFSITE_BACKUP_ENV": "/etc/opencorvus/backup.env",
    "OPENCORVUS_SERVER_OFFSITE_BACKUP_IDENTITY": "opencorvus-backup",
    "OPENCORVUS_SERVER_OFFSITE_BACKUP_STATE": "/var/lib/opencorvus-backup",
    "OPENCORVUS_SERVER_OFFSITE_BACKUP_CACHE": "/var/cache/opencorvus-backup",
    "OPENCORVUS_BACKUP_RETENTION_GENERATIONS": "16",
    "OPENCORVUS_BACKUP_RETENTION_WEEKLY": "4",
    "OPENCORVUS_BACKUP_RETENTION_MONTHLY": "6",
    "OPENCORVUS_RPO_HOURS": "24",
    "OPENCORVUS_RTO_MINUTES": "30",
}
for key, expected_value in expected.items():
    actual = values.get(key)
    if actual != expected_value:
        raise SystemExit(f"{key} must equal {expected_value!r}; got {actual!r}")

placeholders = {
    "RACKNERD_HOST",
    "RACKNERD_KNOWN_HOSTS_FILE",
    "RACKNERD_SSH_PRIVATE_KEY_DPAPI_FILE",
    "EXPERT_SQUAD_SIGNING_KEY_ID",
    "EXPERT_SQUAD_SIGNING_PRIVATE_KEY_DPAPI_FILE",
    "EXPERT_SQUAD_TRUSTED_KEYS_JSON",
    "EXPERT_SQUAD_BOOTSTRAP_PUBLICATION_VERSION",
    "EXPERT_SQUAD_BOOTSTRAP_PUBLICATION_EXPIRES_AT",
    "OPENCORVUS_OFFSITE_BACKUP_BACKEND",
    "OPENCORVUS_OFFSITE_BACKUP_REPOSITORY_ID",
    "OPENCORVUS_OFFSITE_BACKUP_ALERT_TARGET",
    "OPENCORVUS_ROOT_BOOTSTRAP_METHOD",
    "OPENCORVUS_ROOT_BOOTSTRAP_OPERATOR",
}
for key in placeholders:
    value = values.get(key, "")
    if not (value.startswith("<") and value.endswith(">")):
        raise SystemExit(f"{key} must remain an explicit operator-supplied placeholder")

assets = [
    "deploy/racknerd/Caddyfile",
    "deploy/racknerd/deploy-signing-public.pem",
    "deploy/racknerd/opencorvus-activate-release",
    "deploy/racknerd/opencorvus-deploy.sudoers",
    "deploy/racknerd/opencorvus-registry-backup",
    "deploy/racknerd/opencorvus-registry-backup.service",
    "deploy/racknerd/opencorvus-registry-backup.timer",
    "deploy/racknerd/opencorvus-web.service",
    "deploy/racknerd/production.env.example",
    "specs/current/architecture/public-website.md",
    "specs/records/2026-08/2026-08-12-opencorvus-production-database-bootstrap-configuration.md",
]
for relative in assets:
    path = root / relative
    if not path.is_file() or path.stat().st_size == 0:
        raise SystemExit(f"required production configuration asset is unavailable: {relative}")

caddy = (root / "deploy/racknerd/Caddyfile").read_text("utf-8")
for contract in (
    "root * /srv/opencorvus/current/client",
    "reverse_proxy @website_runtime 127.0.0.1:4321",
    "http://127.0.0.1:8080",
    "bind 127.0.0.1",
    "www.opencorvus.com",
    "redir https://opencorvus.com{uri} permanent",
):
    if contract not in caddy:
        raise SystemExit(f"Caddy production contract is incomplete: {contract}")

service = (root / "deploy/racknerd/opencorvus-web.service").read_text("utf-8")
for contract in (
    "User=opencorvus-web",
    "Environment=HOST=127.0.0.1",
    "Environment=PORT=4321",
    "ExecStart=/usr/bin/bun /srv/opencorvus/current/server/opencorvus-web.mjs",
    "ReadWritePaths=/var/lib/opencorvus-web",
    "MemoryMax=512M",
):
    if contract not in service:
        raise SystemExit(f"web service production contract is incomplete: {contract}")

timer = (root / "deploy/racknerd/opencorvus-registry-backup.timer").read_text("utf-8")
for contract in ("OnCalendar=*-*-* 02:41:00 UTC", "Persistent=true", "RandomizedDelaySec=15m"):
    if contract not in timer:
        raise SystemExit(f"backup timer production contract is incomplete: {contract}")

sudoers = (root / "deploy/racknerd/opencorvus-deploy.sudoers").read_text("utf-8")
for contract in (
    "Defaults:opencorvus-deploy env_reset",
    "Defaults:opencorvus-deploy secure_path=",
    "NOPASSWD: NOSETENV: /usr/local/bin/opencorvus-activate-release",
):
    if contract not in sudoers:
        raise SystemExit(f"sudo production contract is incomplete: {contract}")

print(
    "production configuration passed: safe deployment default, operator placeholders, "
    "host path matrix, Caddy, systemd, backup timer, and sudo boundary"
)
PY
