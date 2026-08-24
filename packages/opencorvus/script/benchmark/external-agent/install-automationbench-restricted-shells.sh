#!/usr/bin/env bash
set -euo pipefail

if [[ "$(id -u)" != "0" ]]; then
  echo "restricted-shell installation requires root" >&2
  exit 1
fi

script_root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
install_root=/var/lib/opencorvus-benchmark
test -d "$install_root"
umask 077
exec 9>"$install_root/restricted-shell-install.lock"
flock -x 9

install_shell() {
  local source="$1"
  local target="$2"
  local temporary="${target}.$$.tmp"
  if ! install -o root -g root -m 0755 "$source" "$temporary" || ! cmp --silent "$source" "$temporary"; then
    rm -f -- "$temporary"
    return 1
  fi
  mv -f -- "$temporary" "$target"
}

install_shell "$script_root/restricted-agent-shell-base.sh" "$install_root/restricted-agent-shell-base"
install_shell "$script_root/restricted-agent-shell.sh" "$install_root/restricted-agent-shell"

printf '{"event":"automationbench_restricted_shells_installed","base_sha256":"%s","extended_sha256":"%s"}\n' \
  "$(sha256sum "$install_root/restricted-agent-shell-base" | cut -d' ' -f1)" \
  "$(sha256sum "$install_root/restricted-agent-shell" | cut -d' ' -f1)"
