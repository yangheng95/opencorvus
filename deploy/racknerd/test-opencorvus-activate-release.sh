#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
ACTIVATOR="$SCRIPT_DIR/opencorvus-activate-release"
TEST_ROOT=$(mktemp -d)
trap 'rm -rf -- "$TEST_ROOT"' EXIT
export OPENCORVUS_DEPLOY_ROOT="$TEST_ROOT/site"
export OPENCORVUS_TEST_HARNESS=1
export OPENCORVUS_DEPLOY_ROOT_OWNER="$(id -un)"
export OPENCORVUS_STATE_ROOT="$TEST_ROOT/state"
export OPENCORVUS_ROLLBACK_ROOT="$TEST_ROOT/root-state"
export OPENCORVUS_ROLLBACK_OWNER="$(id -un)"
export OPENCORVUS_CADDY_CONFIG="$TEST_ROOT/Caddyfile"
export OPENCORVUS_SYSTEMD_UNIT="$TEST_ROOT/opencorvus-web.service"
export OPENCORVUS_ACTIVATOR_INSTALL="$TEST_ROOT/installed-opencorvus-activate-release"
export OPENCORVUS_WEB_SERVICE_USER=""
export OPENCORVUS_SYSTEMCTL="$TEST_ROOT/bin/systemctl"
export OPENCORVUS_DEPLOY_PUBLIC_KEY="$TEST_ROOT/deploy-signing-public.pem"
export OPENCORVUS_DEPLOY_PUBLIC_KEY_OWNER="$(id -un)"
export OPENCORVUS_BACKUP_SCRIPT_INSTALL="$TEST_ROOT/installed-opencorvus-registry-backup"
export OPENCORVUS_BACKUP_SERVICE_UNIT="$TEST_ROOT/installed-opencorvus-registry-backup.service"
export OPENCORVUS_BACKUP_TIMER_UNIT="$TEST_ROOT/installed-opencorvus-registry-backup.timer"
export OPENCORVUS_BACKUP_TIMER="opencorvus-registry-backup.timer"
export OPENCORVUS_SUDOERS_INSTALL="$TEST_ROOT/opencorvus-deploy.sudoers"
export OPENCORVUS_READINESS_DELAY_SECONDS=0.01
export OPENCORVUS_READINESS_REQUEST_TIMEOUT_SECONDS=0.1
export OPENCORVUS_READINESS_TIMEOUT_SECONDS=1
mkdir -p "$OPENCORVUS_DEPLOY_ROOT/incoming" "$OPENCORVUS_DEPLOY_ROOT/releases" "$OPENCORVUS_STATE_ROOT" "$OPENCORVUS_ROLLBACK_ROOT" "$TEST_ROOT/bin"
chmod 0755 "$OPENCORVUS_DEPLOY_ROOT" "$OPENCORVUS_DEPLOY_ROOT/releases" "$OPENCORVUS_ROLLBACK_ROOT"
touch "$OPENCORVUS_CADDY_CONFIG"
openssl genpkey -algorithm ED25519 -out "$TEST_ROOT/deploy-signing-private.pem" 2>/dev/null
openssl pkey -in "$TEST_ROOT/deploy-signing-private.pem" -pubout -out "$OPENCORVUS_DEPLOY_PUBLIC_KEY" 2>/dev/null
cp -- "$SCRIPT_DIR/opencorvus-registry-backup" "$OPENCORVUS_BACKUP_SCRIPT_INSTALL"
cp -- "$SCRIPT_DIR/opencorvus-registry-backup.service" "$OPENCORVUS_BACKUP_SERVICE_UNIT"
cp -- "$SCRIPT_DIR/opencorvus-registry-backup.timer" "$OPENCORVUS_BACKUP_TIMER_UNIT"
cp -- "$SCRIPT_DIR/opencorvus-deploy.sudoers" "$OPENCORVUS_SUDOERS_INSTALL"
cp -- "$ACTIVATOR" "$OPENCORVUS_ACTIVATOR_INSTALL"

cat > "$TEST_ROOT/bin/caddy" <<'SH'
#!/usr/bin/env bash
test "$1" = validate
SH
cat > "$TEST_ROOT/bin/systemctl" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >> "$OPENCORVUS_STATE_ROOT/systemctl.log"
target=${!#}
case "$target" in
  opencorvus-web.service) state="$OPENCORVUS_STATE_ROOT/service-enabled" ;;
  opencorvus-registry-backup.timer) state="$OPENCORVUS_STATE_ROOT/backup-timer-enabled" ;;
  *) state="$OPENCORVUS_STATE_ROOT/unused-enabled" ;;
esac
case "$1" in
  is-enabled) test -f "$state" ;;
  enable) : > "$state" ;;
  disable) rm -f -- "$state" ;;
esac
SH
cat > "$TEST_ROOT/bin/curl" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
url=${!#}
path=${url#http://127.0.0.1:8080}
if [ -d "$OPENCORVUS_DEPLOY_ROOT/current/client" ]; then
  public="$OPENCORVUS_DEPLOY_ROOT/current/client"
else
  public="$OPENCORVUS_DEPLOY_ROOT/current"
fi
case "$path" in
  /) cat "$public/index.html" ;;
  /health/ready)
    connect_timeout=false
    max_time=false
    while [ "$#" -gt 0 ]; do
      case "$1" in
        --connect-timeout) connect_timeout=true; shift ;;
        --max-time) max_time=true; shift ;;
      esac
      shift
    done
    "$connect_timeout"
    "$max_time"
    if [ -f "$OPENCORVUS_STATE_ROOT/fail-readiness" ]; then exit 22; fi
    if [ -f "$OPENCORVUS_STATE_ROOT/readiness-failures-remaining" ]; then
      failures=$(cat "$OPENCORVUS_STATE_ROOT/readiness-failures-remaining")
      if [ "$failures" -gt 0 ]; then
        printf '%s\n' "$((failures - 1))" > "$OPENCORVUS_STATE_ROOT/readiness-failures-remaining"
        exit 22
      fi
    fi
    python3 - "$public/expert-squads/catalog.json" <<'PY'
import json, sys
pointer = json.load(open(sys.argv[1], encoding="utf-8"))
resources = pointer["resources"]
print(json.dumps({"status":"ready","publication":{
    "id":17,
    "catalogSha256":pointer["catalog"]["sha256"],
    "total":resources["total"],
    "embeddedAlreadyAvailable":resources["embeddedAlreadyAvailable"],
    "bundledMarketImportable":resources["bundledMarketImportable"],
    "activatedAt":"2026-08-12T00:00:00.000Z",
}}))
PY
    ;;
  /market/|/zh-cn/market/|/market/*|/zh-cn/market/*) printf '<!doctype html><title>database market</title>\n' ;;
  /api/site/v1/visitors) printf '{"protocol":"opencorvus/site-visitors@1","estimatedParticipatingBrowsers":0,"participating":false,"renewalDue":false,"measuredWindowDays":30}\n' ;;
  /api/registry/v1/squads/*/archive)
    python3 - "$public" <<'PY'
import json, pathlib, sys
root = pathlib.Path(sys.argv[1])
pointer = json.loads((root / "expert-squads/catalog.json").read_text("utf-8"))
catalog = json.loads((root / pointer["catalog"]["path"].lstrip("/")).read_text("utf-8"))
sys.stdout.buffer.write((root / catalog["packages"][0]["archive"]["path"].lstrip("/")).read_bytes())
PY
    ;;
  *) test -f "$public$path"; cat "$public$path" ;;
esac
SH
chmod 0755 "$TEST_ROOT/bin/caddy" "$TEST_ROOT/bin/systemctl" "$TEST_ROOT/bin/curl"
export PATH="$TEST_ROOT/bin:$PATH"

make_release() {
  local release_id=$1 version=$2 source inbox
  source="$TEST_ROOT/source-$release_id"
  inbox="$OPENCORVUS_DEPLOY_ROOT/incoming/$release_id"
  rm -rf -- "$source" "$inbox"
  mkdir -p "$source/client/expert-squads/catalogs" "$source/client/expert-squads/signatures" "$source/client/expert-squads/bundles" "$source/client/expert-squads/archives/test/squad/1.0.0/digest" "$source/server" "$inbox"
  printf '<!doctype html><title>release %s</title>\n' "$version" > "$source/client/index.html"
  printf 'archive-%s\n' "$version" > "$source/client/expert-squads/archives/test/squad/1.0.0/digest/archive.zip"
  VERSION="$version" SOURCE="$source" python3 - <<'PY'
import hashlib, json, os, pathlib
root = pathlib.Path(os.environ["SOURCE"])
public = root / "client"
resources = {"total": 1, "embeddedAlreadyAvailable": 0, "bundledMarketImportable": 1}
archive_path = "/expert-squads/archives/test/squad/1.0.0/digest/archive.zip"
archive_raw = (public / archive_path.lstrip("/")).read_bytes()
package = {
    "namespace":"test", "id":"squad", "version":"1.0.0", "packageDigest":"a" * 64,
    "disposition":"bundled_market_importable",
    "archive":{"path":archive_path,"sha256":hashlib.sha256(archive_raw).hexdigest(),"bytes":len(archive_raw),"files":1},
}
catalog_raw = (json.dumps({"protocol":"opencorvus/expert-squad-static-catalog@1","resources":resources,"packages":[package]}, separators=(",", ":")) + "\n").encode()
catalog_sha = hashlib.sha256(catalog_raw).hexdigest()
catalog_path = f"/expert-squads/catalogs/{catalog_sha}.json"
(public / catalog_path.lstrip("/")).write_bytes(catalog_raw)
bundle_raw = f"bundle-{os.environ['VERSION']}\n".encode()
bundle_sha = hashlib.sha256(bundle_raw).hexdigest()
bundle_path = f"/expert-squads/bundles/{bundle_sha}/all-expert-squads.zip"
(public / bundle_path.lstrip("/")).parent.mkdir(parents=True)
(public / bundle_path.lstrip("/")).write_bytes(bundle_raw)
catalog = {"path":catalog_path,"sha256":catalog_sha,"bytes":len(catalog_raw)}
bundle = {"path":bundle_path,"sha256":bundle_sha,"bytes":len(bundle_raw)}
envelope_raw = (json.dumps({"protocol":"opencorvus/expert-squad-catalog-signatures@1","threshold":1,"catalog":catalog,"bundle":bundle,"publicationVersion":int(os.environ["VERSION"]),"expiresAt":"2035-01-01T00:00:00Z","signatures":[{"algorithm":"Ed25519","keyId":"test","signatureBase64":"AA=="}]}, separators=(",", ":")) + "\n").encode()
envelope_sha = hashlib.sha256(envelope_raw).hexdigest()
envelope_path = f"/expert-squads/signatures/{envelope_sha}.json"
(public / envelope_path.lstrip("/")).write_bytes(envelope_raw)
pointer = {"protocol":"opencorvus/expert-squad-publication@1","publicationVersion":int(os.environ["VERSION"]),"expiresAt":"2035-01-01T00:00:00Z","resources":resources,"catalog":catalog,"signatures":{"path":envelope_path,"sha256":envelope_sha,"bytes":len(envelope_raw)},"bundle":bundle}
(public / "expert-squads/catalog.json").write_text(json.dumps(pointer, separators=(",", ":")) + "\n")
seed_package = {"identity":{"namespace":"test","id":"squad","version":"1.0.0","digest":"a"*64}}
seed = {"protocol":"opencorvus/website-registry-seed@1","schemaVersion":1,"catalog":catalog,"resources":resources,"packages":[seed_package]}
(root / "server/website-registry-seed.json").write_text(json.dumps(seed, separators=(",", ":")) + "\n")
PY
  printf 'export {}\n' > "$source/server/opencorvus-web.mjs"
  printf ':8080 { root * /srv/opencorvus/current/client; file_server }\n' > "$source/server/Caddyfile"
  printf '[Service]\nExecStart=/usr/bin/bun /srv/opencorvus/current/server/opencorvus-web.mjs\n' > "$source/server/opencorvus-web.service"
  cp -- "$ACTIVATOR" "$source/server/opencorvus-activate-release"
  cp -- "$OPENCORVUS_DEPLOY_PUBLIC_KEY" "$source/server/deploy-signing-public.pem"
  cp -- "$OPENCORVUS_BACKUP_SCRIPT_INSTALL" "$source/server/opencorvus-registry-backup"
  cp -- "$OPENCORVUS_BACKUP_SERVICE_UNIT" "$source/server/opencorvus-registry-backup.service"
  cp -- "$OPENCORVUS_BACKUP_TIMER_UNIT" "$source/server/opencorvus-registry-backup.timer"
  cp -- "$OPENCORVUS_SUDOERS_INSTALL" "$source/server/opencorvus-deploy.sudoers"
  cat > "$source/server/opencorvus-registry-control" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
command=$1; shift
value() { local key=$1; shift; while [ "$#" -gt 0 ]; do if [ "$1" = "$key" ]; then printf '%s\n' "$2"; return; fi; shift; done; }
database=$(value --database "$@")
case "$command" in
  import) seed=$(value --seed "$@"); printf 'database publication %s\n' "$(sha256sum "$seed" | cut -d' ' -f1)" > "$database" ;;
  schema-state)
    if grep -q '^legacy-v1$' "$database"; then printf '{"schemaVersion":1,"state":"legacy"}\n'; else printf '{"schemaVersion":1,"state":"current"}\n'; fi ;;
  reset-v1) seed=$(value --seed "$@"); printf 'database publication %s\n' "$(sha256sum "$seed" | cut -d' ' -f1)" > "$(value --target "$@")" ;;
  backup) cp -- "$database" "$(value --target "$@")" ;;
  health) printf '{"status":"ready"}\n' ;;
  *) exit 2 ;;
esac
SH
  chmod 0755 "$source/server/opencorvus-registry-control"
  (cd "$source" && find . -type f -print | LC_ALL=C sort | xargs sha256sum) > "$inbox/DEPLOY_SHA256SUMS"
  openssl pkeyutl -sign -inkey "$TEST_ROOT/deploy-signing-private.pem" -rawin -in "$inbox/DEPLOY_SHA256SUMS" -out "$inbox/DEPLOY_SHA256SUMS.sig"
  tar -czf "$inbox/$release_id.tar.gz" -C "$source" .
  (cd "$inbox" && sha256sum "$release_id.tar.gz" > "$release_id.tar.gz.sha256")
}

activate() {
  local release_id=$1
  bash "$ACTIVATOR" "$release_id" \
    "$OPENCORVUS_DEPLOY_ROOT/incoming/$release_id/$release_id.tar.gz" \
    "$OPENCORVUS_DEPLOY_ROOT/incoming/$release_id/DEPLOY_SHA256SUMS"
}

R1=1111111111111111111111111111111111111111-1111111111111111
R2=2222222222222222222222222222222222222222-2222222222222222
RS=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-aaaaaaaaaaaaaaaa
RPRE=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb-bbbbbbbbbbbbbbbb
RPOST=cccccccccccccccccccccccccccccccccccccccc-cccccccccccccccc
RCURRENT=dddddddddddddddddddddddddddddddddddddddd-dddddddddddddddd
RF=ffffffffffffffffffffffffffffffffffffffff-ffffffffffffffff
LEGACY=eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee-eeeeeeeeeeeeeeee
make_release "$RF" 1
mkdir -p "$OPENCORVUS_DEPLOY_ROOT/releases/$LEGACY"
cp -a "$TEST_ROOT/source-$RF/client/." "$OPENCORVUS_DEPLOY_ROOT/releases/$LEGACY/"
ln -s "releases/$LEGACY" "$OPENCORVUS_DEPLOY_ROOT/current"

make_release "$R1" 2
: > "$OPENCORVUS_STATE_ROOT/fail-readiness"
FAILURE_OUTPUT=$(activate "$R1" 2>&1 || true)
rm -f -- "$OPENCORVUS_STATE_ROOT/fail-readiness"
test "$FAILURE_OUTPUT" = "local readiness check failed; release, database, and service were rolled back"
test "$(readlink "$OPENCORVUS_DEPLOY_ROOT/current")" = "releases/$LEGACY"
test "$(curl --fail --silent --show-error http://127.0.0.1:8080/)" = '<!doctype html><title>release 1</title>'

make_release "$R1" 2
printf '2\n' > "$OPENCORVUS_STATE_ROOT/readiness-failures-remaining"
activate "$R1" > /dev/null
test "$(cat "$OPENCORVUS_STATE_ROOT/readiness-failures-remaining")" = 0
rm -f -- "$OPENCORVUS_STATE_ROOT/readiness-failures-remaining"
test "$(readlink "$OPENCORVUS_DEPLOY_ROOT/current")" = "releases/$R1"
test "$(readlink "$OPENCORVUS_DEPLOY_ROOT/previous")" = "releases/$LEGACY"
R1_DATABASE=$(cat "$OPENCORVUS_STATE_ROOT/registry.sqlite3")
test -n "$R1_DATABASE"
test -f "$OPENCORVUS_STATE_ROOT/service-enabled"
test -f "$OPENCORVUS_STATE_ROOT/backup-timer-enabled"
cmp "$ACTIVATOR" "$OPENCORVUS_ACTIVATOR_INSTALL"

ROLLBACK_TARGET=$(bash "$ACTIVATOR" --rollback "$R1")
test "$ROLLBACK_TARGET" = "releases/$LEGACY"
test "$(readlink "$OPENCORVUS_DEPLOY_ROOT/current")" = "releases/$LEGACY"
test "$(curl --fail --silent --show-error http://127.0.0.1:8080/)" = '<!doctype html><title>release 1</title>'

make_release "$R1" 2
activate "$R1" > /dev/null

assert_failed_activation_restored() {
  local release_id=$1 expected_database=$2
  test "$(readlink "$OPENCORVUS_DEPLOY_ROOT/current")" = "releases/$R1"
  test "$(cat "$OPENCORVUS_STATE_ROOT/registry.sqlite3")" = "$expected_database"
  test "$(tail -n 1 "$OPENCORVUS_STATE_ROOT/systemctl.log")" = "restart opencorvus-web.service"
  test ! -e "$OPENCORVUS_STATE_ROOT/.registry-$release_id.sqlite3"
  test ! -e "$OPENCORVUS_STATE_ROOT/.registry-$release_id.sqlite3-wal"
  test ! -e "$OPENCORVUS_STATE_ROOT/.registry-$release_id.sqlite3-shm"
}

make_release "$RS" 3
: > "$OPENCORVUS_STATE_ROOT/test-fail-snapshot-metadata"
SNAPSHOT_FAILURE=$(activate "$RS" 2>&1 || true)
test "$SNAPSHOT_FAILURE" = "database snapshot metadata fixture requested rollback"
assert_failed_activation_restored "$RS" "$R1_DATABASE"

make_release "$RCURRENT" 3
: > "$OPENCORVUS_STATE_ROOT/test-fail-current-path"
CURRENT_FAILURE=$(activate "$RCURRENT" 2>&1 || true)
test "$CURRENT_FAILURE" = "database current-path fixture requested rollback"
assert_failed_activation_restored "$RCURRENT" "$R1_DATABASE"

make_release "$R2" 3
printf 'legacy-v1\n' > "$OPENCORVUS_STATE_ROOT/registry.sqlite3"

make_release "$RPRE" 3
: > "$OPENCORVUS_STATE_ROOT/test-fail-pre-swap"
PRE_SWAP_FAILURE=$(activate "$RPRE" 2>&1 || true)
test "$PRE_SWAP_FAILURE" = "database v1 pre-swap fixture requested rollback"
assert_failed_activation_restored "$RPRE" "legacy-v1"

make_release "$RPOST" 3
: > "$OPENCORVUS_STATE_ROOT/test-fail-post-swap"
POST_SWAP_FAILURE=$(activate "$RPOST" 2>&1 || true)
test "$POST_SWAP_FAILURE" = "database v1 post-swap fixture requested rollback"
assert_failed_activation_restored "$RPOST" "legacy-v1"

activate "$R2" > /dev/null
test "$(readlink "$OPENCORVUS_DEPLOY_ROOT/current")" = "releases/$R2"
test "$(readlink "$OPENCORVUS_DEPLOY_ROOT/previous")" = "releases/$R1"
test "$(cat "$OPENCORVUS_ROLLBACK_ROOT/rollbacks/pre-$R2.sqlite3")" = "legacy-v1"
test "$(cat "$OPENCORVUS_STATE_ROOT/registry.sqlite3")" != "legacy-v1"
(cd / && sha256sum --check "$OPENCORVUS_ROLLBACK_ROOT/rollbacks/pre-$R2.sqlite3.sha256") > /dev/null
test "$(stat -c %a "$OPENCORVUS_ROLLBACK_ROOT/rollbacks")" = 700

ROLLBACK_TARGET=$(bash "$ACTIVATOR" --rollback "$R2")
test "$ROLLBACK_TARGET" = "releases/$R1"
test "$(readlink "$OPENCORVUS_DEPLOY_ROOT/current")" = "releases/$R1"
test "$(cat "$OPENCORVUS_STATE_ROOT/registry.sqlite3")" = "legacy-v1"
test "$(tail -n 1 "$OPENCORVUS_STATE_ROOT/systemctl.log")" = "restart opencorvus-web.service"

mkdir -p "$OPENCORVUS_STATE_ROOT/blobs/sha256/aa"
printf 'immutable-archive\n' > "$OPENCORVUS_STATE_ROOT/blobs/sha256/aa/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.zip"

for day in $(seq -w 1 10); do
  OPENCORVUS_BACKUP_STAMP="2026-01-${day}T024100Z" \
  OPENCORVUS_BACKUP_WEEK="2026-W${day}" \
  OPENCORVUS_REGISTRY_CONTROL="$OPENCORVUS_DEPLOY_ROOT/current/server/opencorvus-registry-control" \
    bash "$OPENCORVUS_BACKUP_SCRIPT_INSTALL"
done
test "$(find "$OPENCORVUS_STATE_ROOT/backups" -maxdepth 1 -type f -name 'daily-*.sqlite3' | wc -l)" -eq 7
test "$(find "$OPENCORVUS_STATE_ROOT/backups" -maxdepth 1 -type f -name 'weekly-*.sqlite3' | wc -l)" -eq 4
(cd "$OPENCORVUS_STATE_ROOT/backups" && sha256sum --check daily-2026-01-10T024100Z.sqlite3.sha256) > /dev/null
(cd "$OPENCORVUS_STATE_ROOT/backups" && sha256sum --check weekly-2026-W10.sqlite3.sha256) > /dev/null
(cd "$OPENCORVUS_STATE_ROOT" && sha256sum --check "$OPENCORVUS_STATE_ROOT/backups/daily-2026-01-10T024100Z.sqlite3.blobs.sha256") > /dev/null

printf '%s\n' "database activation, snapshot, service switch, rollback, and bounded backup retention paths passed"
