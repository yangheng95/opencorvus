#!/usr/bin/env bash
set -euo pipefail

readonly OUTPUT="${1:?absolute output directory is required}"
readonly PLAYWRIGHT_NODE_MODULES="${2:?absolute Playwright node_modules directory is required}"
readonly CHROMIUM_RUNTIME="${3:?absolute Chromium runtime directory is required}"
readonly BROWSER_SYSROOT="${4:?absolute browser dependency sysroot is required}"
if [[ "$OUTPUT" != /* || -e "$OUTPUT" ]]; then
  printf 'CAPSULE_TOOLCHAIN_OUTPUT_INVALID:%s\n' "$OUTPUT" >&2
  exit 64
fi

mkdir -p "$OUTPUT/usr" "$OUTPUT/etc"
if [[ "$PLAYWRIGHT_NODE_MODULES" != /* || ! -f "$PLAYWRIGHT_NODE_MODULES/playwright/index.js" ||
  ! -f "$PLAYWRIGHT_NODE_MODULES/playwright-core/index.js" ]]; then
  printf 'CAPSULE_PLAYWRIGHT_RUNTIME_INVALID:%s\n' "$PLAYWRIGHT_NODE_MODULES" >&2
  exit 69
fi
if [[ "$CHROMIUM_RUNTIME" != /* || ! -x "$CHROMIUM_RUNTIME/chrome-headless-shell" ]]; then
  printf 'CAPSULE_CHROMIUM_RUNTIME_INVALID:%s\n' "$CHROMIUM_RUNTIME" >&2
  exit 69
fi
if [[ "$BROWSER_SYSROOT" != /* || ! -f "$BROWSER_SYSROOT/usr/lib/x86_64-linux-gnu/libnss3.so" ||
  ! -f "$BROWSER_SYSROOT/usr/lib/x86_64-linux-gnu/libnspr4.so" ]]; then
  printf 'CAPSULE_BROWSER_SYSROOT_INVALID:%s\n' "$BROWSER_SYSROOT" >&2
  exit 69
fi

copy_file() {
  local source="$1"
  local destination="$source"
  [[ -f "$source" ]] || { printf 'CAPSULE_TOOLCHAIN_RESOURCE_MISSING:%s\n' "$source" >&2; exit 69; }
  if [[ "$destination" == /lib/* ]]; then destination="/usr/lib/${destination#/lib/}"; fi
  if [[ "$destination" == /lib64/* ]]; then destination="/usr/lib64/${destination#/lib64/}"; fi
  mkdir -p "$OUTPUT$(dirname "$destination")"
  cp -L -- "$source" "$OUTPUT$destination"
}

copy_binary() {
  local requested="$1"
  local source
  source="$(type -P -- "$requested")"
  copy_file "$source"
  while IFS= read -r library; do
    [[ -n "$library" ]] && copy_file "$library"
  done < <(ldd "$source" 2>/dev/null | awk '/=> \/.+ \(0x/{print $3} $1 ~ /^\// {print $1}' | sort -u)
}

for command in \
  bash sh env ip \
  node bun rg git find sed awk grep cp mv rm mkdir touch chmod sha256sum \
  cat head tail sort uniq xargs realpath dirname basename tee sleep kill rmdir tar gzip unzip; do
  copy_binary "$command"
done

mkdir -p "$OUTPUT/opt/opencorvus-browser/node_modules" "$OUTPUT/opt/opencorvus-browser/chromium"
cp -aL -- "$PLAYWRIGHT_NODE_MODULES/playwright" "$OUTPUT/opt/opencorvus-browser/node_modules/playwright"
cp -aL -- "$PLAYWRIGHT_NODE_MODULES/playwright-core" "$OUTPUT/opt/opencorvus-browser/node_modules/playwright-core"
cp -aL -- "$CHROMIUM_RUNTIME/." "$OUTPUT/opt/opencorvus-browser/chromium/"
mkdir -p "$OUTPUT/usr/lib/x86_64-linux-gnu"
cp -aL -- "$BROWSER_SYSROOT/usr/lib/x86_64-linux-gnu/." "$OUTPUT/usr/lib/x86_64-linux-gnu/"
while IFS= read -r library; do
  [[ -n "$library" ]] && copy_file "$library"
done < <(ldd "$CHROMIUM_RUNTIME/chrome-headless-shell" 2>/dev/null | awk '/=> \/.+ \(0x/{print $3} $1 ~ /^\// {print $1}' | sort -u)

git_exec_path="$(git --exec-path)"
mkdir -p "$OUTPUT$git_exec_path"
cp -aL -- "$git_exec_path/." "$OUTPUT$git_exec_path/"
while IFS= read -r executable; do
  while IFS= read -r library; do
    [[ -n "$library" ]] && copy_file "$library"
  done < <(ldd "$executable" 2>/dev/null | awk '/=> \/.+ \(0x/{print $3} $1 ~ /^\// {print $1}' | sort -u)
done < <(find "$git_exec_path" -type f -perm -0100 | sort)

if [[ -d /usr/share/git-core ]]; then
  mkdir -p "$OUTPUT/usr/share/git-core"
  cp -aL -- /usr/share/git-core/. "$OUTPUT/usr/share/git-core/"
fi
if [[ -d /etc/ssl/certs ]]; then
  mkdir -p "$OUTPUT/etc/ssl"
  cp -aL -- /etc/ssl/certs "$OUTPUT/etc/ssl/certs"
fi
if [[ -f /etc/ssl/openssl.cnf ]]; then cp -L -- /etc/ssl/openssl.cnf "$OUTPUT/etc/ssl/openssl.cnf"; fi
printf 'root:x:0:0:root:/workspace/home:/bin/bash\n' > "$OUTPUT/etc/passwd"
printf 'root:x:0:\n' > "$OUTPUT/etc/group"
printf 'hosts: files dns\n' > "$OUTPUT/etc/nsswitch.conf"
printf '127.0.0.1 localhost\n' > "$OUTPUT/etc/hosts"
printf 'UTC\n' > "$OUTPUT/etc/timezone"

find "$OUTPUT" -type d -exec chmod 0555 {} +
find "$OUTPUT" -type f -exec chmod 0444 {} +
find "$OUTPUT/usr" -type f \( -path '*/bin/*' -o -path '*/sbin/*' -o -path '*/git-core/*' \) -exec chmod 0555 {} +
chmod 0555 "$OUTPUT/opt/opencorvus-browser/chromium/chrome-headless-shell"
