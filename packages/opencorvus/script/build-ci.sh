#!/usr/bin/env bash
# Build all platforms via GitHub Actions, optionally publish a release,
# then download the result to local disk.
#
# Usage:
#   ./script/build-ci.sh [options]
#
# Options:
#   --version <x.y.z>   Release build: create GitHub Release + push release branch.
#                       Omit for dev snapshot (artifact only, no release).
#   --out <dir>         Download destination (default: ./dist-ci)
#   --ref <branch>      Git ref to build (default: current branch)
#   --run-id <id>       Skip triggering; wait/download an existing run.
#   --from-branch       Download from the release branch (git clone) instead
#                       of Actions artifact. Requires --version.
#   --no-download       Trigger + wait only, skip downloading.

set -euo pipefail

REPO="$(git remote get-url origin 2>/dev/null \
        | sed 's|.*github.com[:/]\(.*\)\.git|\1|;s|.*github.com[:/]\(.*\)|\1|')"
WORKFLOW="build.yml"
OUT_DIR="./dist-ci"
REF="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "dev")"
RUN_ID=""
VERSION=""
FROM_BRANCH=0
NO_DOWNLOAD=0
POLL_INTERVAL=30

while [[ $# -gt 0 ]]; do
  case $1 in
    --version)     VERSION="$2";    shift 2 ;;
    --out)         OUT_DIR="$2";    shift 2 ;;
    --ref)         REF="$2";        shift 2 ;;
    --run-id)      RUN_ID="$2";     shift 2 ;;
    --from-branch) FROM_BRANCH=1;   shift   ;;
    --no-download) NO_DOWNLOAD=1;   shift   ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

export SSL_CERT_FILE="${SSL_CERT_FILE:-/usr/ssl/certs/ca-bundle.crt}"
gh_cmd() { SSL_CERT_FILE="$SSL_CERT_FILE" gh "$@"; }
git_cmd() { SSL_CERT_FILE="$SSL_CERT_FILE" git "$@"; }

# ── 1. Trigger ────────────────────────────────────────────────────────────────
if [[ -z "$RUN_ID" ]]; then
  echo "▶ Triggering canonical release workflow $WORKFLOW on ref=$REF ..."

  TRIGGER_ARGS=(workflow run "$WORKFLOW" --ref "$REF")
  if [[ -n "$VERSION" ]]; then
    TRIGGER_ARGS+=(-f "version=$VERSION")
    echo "  version=$VERSION  → GitHub Release v$VERSION + release branch"
  else
    echo "  no version → dev snapshot (artifact only)"
  fi

  TRIGGER_OUT=$(gh_cmd "${TRIGGER_ARGS[@]}" 2>&1)
  echo "$TRIGGER_OUT"

  RUN_URL=$(echo "$TRIGGER_OUT" | grep -Eo 'https://github.com/[^ ]+/actions/runs/[0-9]+' | head -1)
  if [[ -n "$RUN_URL" ]]; then
    RUN_ID="${RUN_URL##*/}"
  else
    sleep 6
    RUN_ID=$(gh_cmd run list --workflow="$WORKFLOW" --branch="$REF" --limit=1 \
               --json databaseId --jq '.[0].databaseId')
  fi
  echo "  Run ID : $RUN_ID"
  echo "  URL    : https://github.com/$REPO/actions/runs/$RUN_ID"
fi

# ── 2. Poll ───────────────────────────────────────────────────────────────────
echo ""
echo "⏳ Waiting for run $RUN_ID ..."
while true; do
  INFO=$(gh_cmd run view "$RUN_ID" --json status,conclusion \
           --jq '[.status,.conclusion//"–"] | join(" ")' 2>/dev/null || echo "unknown –")
  STATUS="${INFO%% *}"
  CONCLUSION="${INFO##* }"

  if [[ "$STATUS" == "completed" ]]; then
    if [[ "$CONCLUSION" == "success" ]]; then
      echo "✓ Build succeeded"
      break
    else
      echo "✗ Build $CONCLUSION"
      echo "  https://github.com/$REPO/actions/runs/$RUN_ID"
      exit 1
    fi
  fi

  echo -n "  [$(date +%H:%M:%S)] $STATUS  "
  gh_cmd run view "$RUN_ID" --json jobs \
    --jq '.jobs[] | "\(.name | split(" ")[1])=\(.conclusion // .status)"' \
    2>/dev/null | tr '\n' ' ' || true
  echo ""
  sleep "$POLL_INTERVAL"
done

[[ "$NO_DOWNLOAD" == "1" ]] && exit 0

# ── 3. Download ───────────────────────────────────────────────────────────────
echo ""
mkdir -p "$OUT_DIR"

if [[ "$FROM_BRANCH" == "1" ]]; then
  # Clone the release branch directly (contains README + binaries)
  REPO_URL="https://github.com/${REPO}.git"
  echo "⬇ Cloning release branch → $OUT_DIR ..."
  git_cmd clone --branch release --depth 1 "$REPO_URL" "$OUT_DIR"
  rm -rf "$OUT_DIR/.git"
  echo ""
  echo "✓ Contents:"
  find "$OUT_DIR" -maxdepth 2 -not -name '.*' | sort

elif [[ -n "$VERSION" ]]; then
  # Download from GitHub Release assets (permanent, no expiry)
  TAG="v${VERSION#v}"
  echo "⬇ Downloading GitHub Release $TAG → $OUT_DIR ..."
  gh_cmd release download "$TAG" --repo "$REPO" --dir "$OUT_DIR" --clobber
  echo ""
  echo "✓ Release assets:"
  ls -lh "$OUT_DIR"

else
  # Download from Actions artifact (expires in 7 days)
  echo "⬇ Downloading opencorvus-dist artifact → $OUT_DIR ..."
  gh_cmd run download "$RUN_ID" -n opencorvus-dist -D "$OUT_DIR"
  echo ""
  echo "✓ Contents:"
  for d in "$OUT_DIR"/*/; do
    name=$(basename "$d")
    files=$(ls "$d/bin/" 2>/dev/null | grep -v '\.map$' | tr '\n' ' ')
    echo "  $name/bin/  $files"
  done
fi

echo ""
echo "Run URL: https://github.com/$REPO/actions/runs/$RUN_ID"
