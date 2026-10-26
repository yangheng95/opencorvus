#!/usr/bin/env bash
set -euo pipefail

# Preserve the runner's signed suites/components, with one official download origin.
write_ubuntu_sources() {
  local input=$1 output=$2 architecture=$3 mirror
  case "$architecture" in
    amd64|i386) mirror=https://archive.ubuntu.com/ubuntu/ ;;
    *) mirror=https://ports.ubuntu.com/ubuntu-ports/ ;;
  esac
  awk -v mirror="$mirror" '
    tolower($0) ~ /^uris:/ { print "URIs: " mirror; replacing=1; found++; next }
    replacing && /^[ \t]/ { next }
    replacing && /^#/ { print; next }
    { replacing=0; print }
    END { if (!found) { print "Ubuntu source configuration has no URIs field" > "/dev/stderr"; exit 2 } }
  ' "$input" > "$output"
}

install_ubuntu_packages() (
  if (( $# == 0 )); then
    echo "Usage: sudo bash script/install-ubuntu-packages.sh PACKAGE..." >&2
    exit 2
  fi
  original_sources=/etc/apt/sources.list.d/ubuntu.sources
  if [[ ! -r "$original_sources" ]]; then
    echo "Required Ubuntu source configuration is unreadable: $original_sources" >&2
    exit 2
  fi
  sources=$(mktemp --suffix=.sources "${TMPDIR:-/tmp}/opencorvus-ubuntu-sources.XXXXXX")
  trap 'rm -f -- "$sources"' EXIT
  architecture=$(dpkg --print-architecture)
  write_ubuntu_sources "$original_sources" "$sources" "$architecture"
  chmod 644 "$sources"
  export DEBIAN_FRONTEND=noninteractive
  options=(
    -o "Dir::Etc::sourcelist=$sources"
    -o "Dir::Etc::sourceparts=-"
    -o "DPkg::Lock::Timeout=300"
    -o "Acquire::Retries=5"
    -o "Acquire::http::Timeout=20"
    -o "APT::Update::Error-Mode=any"
  )
  apt-get "${options[@]}" update
  apt-get "${options[@]}" install -y -- "$@"
)

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  install_ubuntu_packages "$@"
fi
