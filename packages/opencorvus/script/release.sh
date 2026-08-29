#!/usr/bin/env bash
# release.sh — Build local artifacts. Immutable publication is owned by .github/workflows/build.yml.

set -euo pipefail

VERSION=""
SKIP_INSTALL=0

while [[ $# -gt 0 ]]; do
  case $1 in
    --version) VERSION="${2:?'--version requires a value'}"; shift 2 ;;
    --skip-install) SKIP_INSTALL=1; shift ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

[[ -z "$VERSION" ]] && { echo "Error: --version is required"; exit 1; }
VERSION="${VERSION#v}"
[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+([-.][0-9A-Za-z.-]+)?$ ]] || {
  echo "Error: invalid --version '$VERSION' (expected x.y.z, x.y.z-tag, vx.y.z, or vx.y.z-tag)"
  exit 1
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PKG_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "════════════════════════════════════════════════════════"
echo "  OpenCorvus Local Artifact Builder"
echo "  version       : $VERSION"
echo "  publication   : .github/workflows/build.yml"
echo "════════════════════════════════════════════════════════"

echo ""
echo "🔨 Building all platforms available on this host ..."
cd "$PKG_DIR"

BUILD_ARGS=("--all")
[[ "$SKIP_INSTALL" == "1" ]] && BUILD_ARGS+=("--skip-install")

env \
  OPENCORVUS_VERSION="$VERSION" \
  OPENCORVUS_CHANNEL="latest" \
  bun run script/build.ts "${BUILD_ARGS[@]}"

echo ""
echo "━━━ dist/ contents ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
for d in dist/*/; do
  name=$(basename "$d")
  files=$(ls "$d/bin/" 2>/dev/null | grep -v '\.map$' | tr '\n' ' ')
  ui_count=$(ls "$d/bin/ui/" 2>/dev/null | wc -l)
  echo "  $name/bin/  $files  (ui: ${ui_count} files)"
done
echo ""
echo "Artifacts built locally; no tag, Release, or asset upload was performed."
echo "Canonical publication: .github/workflows/build.yml"
