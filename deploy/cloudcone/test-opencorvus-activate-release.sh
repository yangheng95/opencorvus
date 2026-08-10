#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
ACTIVATOR="$SCRIPT_DIR/opencorvus-activate-release"
TEST_ROOT=$(mktemp -d)
trap 'rm -rf -- "$TEST_ROOT"' EXIT
export OPENCORVUS_DEPLOY_ROOT="$TEST_ROOT/site"
export OPENCORVUS_CADDY_CONFIG="$TEST_ROOT/Caddyfile"
mkdir -p "$OPENCORVUS_DEPLOY_ROOT/incoming" "$OPENCORVUS_DEPLOY_ROOT/releases" "$TEST_ROOT/bin"
touch "$OPENCORVUS_CADDY_CONFIG"

cat > "$TEST_ROOT/bin/caddy" <<'SH'
#!/usr/bin/env bash
test "$1" = validate
SH
cat > "$TEST_ROOT/bin/curl" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
if [ "${OPENCORVUS_TEST_FAIL_HEALTH:-0}" = 1 ]; then exit 22; fi
url=${!#}
path=${url#https://opencorvus.com}
path=${path#http://127.0.0.1:8080}
if [ -z "$path" ] || [ "$path" = / ]; then path=/index.html; fi
target="$OPENCORVUS_DEPLOY_ROOT/current$path"
test -f "$target"
cat "$target"
SH
chmod 0755 "$TEST_ROOT/bin/caddy" "$TEST_ROOT/bin/curl"
export PATH="$TEST_ROOT/bin:$PATH"

make_release() {
  local release_id=$1 version=$2 source inbox
  source="$TEST_ROOT/source-$release_id"
  inbox="$OPENCORVUS_DEPLOY_ROOT/incoming/$release_id"
  mkdir -p "$source/expert-squads/catalogs" "$source/expert-squads/signatures" "$source/expert-squads/bundles" "$inbox"
  printf '<!doctype html><title>release %s</title>\n' "$version" > "$source/index.html"
  VERSION="$version" SOURCE="$source" python3 - <<'PY'
import hashlib, json, os, pathlib
root = pathlib.Path(os.environ["SOURCE"])
resources = {"total": 3, "embeddedAlreadyAvailable": 1, "bundledMarketImportable": 2}
catalog_raw = (json.dumps({
    "protocol": "opencorvus/expert-squad-static-catalog@1",
    "resources": resources,
    "packages": [{
        "id": f"squad-{index}",
        "disposition": "embedded_already_available" if index < resources["embeddedAlreadyAvailable"] else "bundled_market_importable",
    } for index in range(resources["total"])],
}, separators=(",", ":")) + "\n").encode()
catalog_sha = hashlib.sha256(catalog_raw).hexdigest()
catalog_path = f"/expert-squads/catalogs/{catalog_sha}.json"
(root / catalog_path.lstrip("/")).write_bytes(catalog_raw)

bundle_raw = f"bundle-{os.environ['VERSION']}\n".encode()
bundle_sha = hashlib.sha256(bundle_raw).hexdigest()
bundle_path = f"/expert-squads/bundles/{bundle_sha}/all-expert-squads.zip"
(root / bundle_path.lstrip("/")).parent.mkdir(parents=True)
(root / bundle_path.lstrip("/")).write_bytes(bundle_raw)

catalog = {"path": catalog_path, "sha256": catalog_sha, "bytes": len(catalog_raw)}
bundle = {"path": bundle_path, "sha256": bundle_sha, "bytes": len(bundle_raw)}
envelope_raw = (json.dumps({
    "protocol": "opencorvus/expert-squad-catalog-signatures@1",
    "threshold": 1,
    "catalog": catalog,
    "bundle": bundle,
    "publicationVersion": int(os.environ["VERSION"]),
    "expiresAt": "2035-01-01T00:00:00Z",
    "signatures": [{"algorithm": "Ed25519", "keyId": "test", "signatureBase64": "AA=="}],
}, separators=(",", ":")) + "\n").encode()
envelope_sha = hashlib.sha256(envelope_raw).hexdigest()
envelope_path = f"/expert-squads/signatures/{envelope_sha}.json"
(root / envelope_path.lstrip("/")).write_bytes(envelope_raw)

pointer = {
    "protocol": "opencorvus/expert-squad-publication@1",
    "publicationVersion": int(os.environ["VERSION"]),
    "expiresAt": "2035-01-01T00:00:00Z",
    "resources": resources,
    "catalog": catalog,
    "signatures": {"path": envelope_path, "sha256": envelope_sha, "bytes": len(envelope_raw)},
    "bundle": bundle,
}
(root / "expert-squads/catalog.json").write_text(json.dumps(pointer, separators=(",", ":")) + "\n")
PY
  (cd "$source" && find . -type f -print | LC_ALL=C sort | xargs sha256sum) > "$inbox/DEPLOY_SHA256SUMS"
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
R3=3333333333333333333333333333333333333333-3333333333333333
R4=4444444444444444444444444444444444444444-4444444444444444
R5=5555555555555555555555555555555555555555-5555555555555555
make_release "$R1" 1
activate "$R1" > /dev/null
test "$(readlink "$OPENCORVUS_DEPLOY_ROOT/current")" = "releases/$R1"

make_release "$R2" 2
activate "$R2" > /dev/null
test "$(readlink "$OPENCORVUS_DEPLOY_ROOT/current")" = "releases/$R2"
test "$(readlink "$OPENCORVUS_DEPLOY_ROOT/previous")" = "releases/$R1"
bash "$ACTIVATOR" --rollback "$R2" > /dev/null
test "$(readlink "$OPENCORVUS_DEPLOY_ROOT/current")" = "releases/$R1"
test ! -e "$OPENCORVUS_DEPLOY_ROOT/releases/$R2"

make_release "$R4" 1
if activate "$R4"; then
  echo "equal publication version unexpectedly succeeded" >&2
  exit 1
fi
test "$(readlink "$OPENCORVUS_DEPLOY_ROOT/current")" = "releases/$R1"

make_release "$R3" 3
if OPENCORVUS_TEST_FAIL_HEALTH=1 activate "$R3"; then
  echo "update with failed health unexpectedly succeeded" >&2
  exit 1
fi
test "$(readlink "$OPENCORVUS_DEPLOY_ROOT/current")" = "releases/$R1"
test ! -e "$OPENCORVUS_DEPLOY_ROOT/releases/$R3"

activate "$R3" > /dev/null
test "$(readlink "$OPENCORVUS_DEPLOY_ROOT/current")" = "releases/$R3"
bash "$ACTIVATOR" --rollback "$R3" > /dev/null
test "$(readlink "$OPENCORVUS_DEPLOY_ROOT/current")" = "releases/$R1"
test ! -e "$OPENCORVUS_DEPLOY_ROOT/releases/$R3"

FIRST_FAILURE_ROOT="$TEST_ROOT/first-failure"
mkdir -p "$FIRST_FAILURE_ROOT/incoming" "$FIRST_FAILURE_ROOT/releases"
make_release "$R5" 4
mv "$OPENCORVUS_DEPLOY_ROOT/incoming/$R5" "$FIRST_FAILURE_ROOT/incoming/$R5"
export OPENCORVUS_DEPLOY_ROOT="$FIRST_FAILURE_ROOT"
if OPENCORVUS_TEST_FAIL_HEALTH=1 activate "$R5"; then
  echo "first release with failed health unexpectedly succeeded" >&2
  exit 1
fi
test ! -e "$OPENCORVUS_DEPLOY_ROOT/current"
test ! -e "$OPENCORVUS_DEPLOY_ROOT/releases/$R5"

printf '%s\n' "activation integration paths passed"
