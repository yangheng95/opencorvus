#!/usr/bin/env bash
# release.sh — Build all platforms locally and optionally publish release assets.

set -euo pipefail

VERSION=""
RELEASE_REPO=""
SKIP_INSTALL=0
NO_UPLOAD=0

while [[ $# -gt 0 ]]; do
  case $1 in
    --version) VERSION="${2:?'--version requires a value'}"; shift 2 ;;
    --release-repo) RELEASE_REPO="${2:?'--release-repo requires a value'}"; shift 2 ;;
    --skip-install) SKIP_INSTALL=1; shift ;;
    --no-upload) NO_UPLOAD=1; shift ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

[[ -z "$VERSION" ]] && { echo "Error: --version is required"; exit 1; }
VERSION="${VERSION#v}"
[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+([-.][0-9A-Za-z.-]+)?$ ]] || {
  echo "Error: invalid --version '$VERSION' (expected x.y.z, x.y.z-tag, vx.y.z, or vx.y.z-tag)"
  exit 1
}
[[ "$NO_UPLOAD" == "1" || -n "$RELEASE_REPO" ]] || {
  echo "Error: --release-repo is required unless --no-upload is used"
  exit 1
}

export SSL_CERT_FILE="${SSL_CERT_FILE:-/usr/ssl/certs/ca-bundle.crt}"
gh_cmd() { SSL_CERT_FILE="$SSL_CERT_FILE" gh "$@"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PKG_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "════════════════════════════════════════════════════════"
echo "  OpenCorvus Release Builder"
echo "  version       : $VERSION"
[[ -n "$RELEASE_REPO" ]] && echo "  release repo  : $RELEASE_REPO"
[[ "$NO_UPLOAD" == "1" ]] && echo "  mode          : --no-upload (build only)"
echo "════════════════════════════════════════════════════════"

if [[ "$NO_UPLOAD" == "0" ]]; then
  echo ""
  echo "📦 Creating GitHub Release v$VERSION on $RELEASE_REPO ..."
  gh_cmd release create "v${VERSION}" \
    --title "v${VERSION}" \
    --generate-notes \
    --repo "$RELEASE_REPO" || true
fi

echo ""
echo "🔨 Building all platforms locally ..."
cd "$PKG_DIR"

BUILD_ARGS=("--all")
[[ "$SKIP_INSTALL" == "1" ]] && BUILD_ARGS+=("--skip-install")

if [[ "$NO_UPLOAD" == "1" ]]; then
  env \
    SSL_CERT_FILE="$SSL_CERT_FILE" \
    OPENCORVUS_VERSION="$VERSION" \
    OPENCORVUS_CHANNEL="latest" \
    bun run script/build.ts "${BUILD_ARGS[@]}"
else
  env \
    SSL_CERT_FILE="$SSL_CERT_FILE" \
    OPENCORVUS_RELEASE="1" \
    OPENCORVUS_VERSION="$VERSION" \
    OPENCORVUS_CHANNEL="latest" \
    GH_REPO="$RELEASE_REPO" \
    bun run script/build.ts "${BUILD_ARGS[@]}"
fi

echo ""
echo "━━━ dist/ contents ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
for d in dist/*/; do
  name=$(basename "$d")
  files=$(ls "$d/bin/" 2>/dev/null | grep -v '\.map$' | tr '\n' ' ')
  ui_count=$(ls "$d/bin/ui/" 2>/dev/null | wc -l)
  echo "  $name/bin/  $files  (ui: ${ui_count} files)"
done
echo ""

if [[ "$NO_UPLOAD" == "1" ]]; then
  echo "⚠  --no-upload: binaries built to dist/ but NOT uploaded."
  if [[ -n "$RELEASE_REPO" ]]; then
    echo "   To publish later:"
    echo "   gh release upload v$VERSION ./dist/*.zip ./dist/*.tar.gz --clobber --repo $RELEASE_REPO"
  fi
else
  echo "🎉 Released!"
  echo "   https://github.com/$RELEASE_REPO/releases/tag/v$VERSION"
fi
