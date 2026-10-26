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

write_ubuntu_apt_configuration() {
  local sources=$1 apt_directory=$2 apt_etc_directory=$3
  if [[ "$sources" == *'"'* || "$sources" == *'\'* || "$sources" == *$'\n'* || "$sources" == *$'\r'* ]]; then
    echo "Ubuntu source path cannot be represented in APT configuration" >&2
    return 2
  fi
  cat <<EOF
Binary::apt-get {
  Dir "$apt_directory";
  Dir::Etc "$apt_etc_directory";
  Dir::Etc::sourcelist "$sources";
  Dir::Etc::sourceparts "-";
  DPkg::Lock::Timeout "300";
  Acquire::Retries "5";
  Acquire::http::Timeout "20";
  APT::Update::Error-Mode "any";
};
EOF
}

with_ubuntu_apt() (
  original_sources=/etc/apt/sources.list.d/ubuntu.sources
  if [[ ! -r "$original_sources" ]]; then
    echo "Required Ubuntu source configuration is unreadable: $original_sources" >&2
    exit 2
  fi
  directory=$(mktemp -d "${TMPDIR:-/tmp}/opencorvus-ubuntu-apt.XXXXXX")
  sources=$directory/ubuntu.sources
  configuration=$directory/apt.conf
  trap 'rm -f -- "$sources" "$configuration"; rmdir -- "$directory"' EXIT
  architecture=$(dpkg --print-architecture)
  write_ubuntu_sources "$original_sources" "$sources" "$architecture"
  eval "$(apt-config shell apt_directory Dir apt_etc_directory Dir::Etc)"
  write_ubuntu_apt_configuration "$sources" "$apt_directory" "$apt_etc_directory" > "$configuration"
  chmod 755 "$directory"
  chmod 644 "$sources" "$configuration"
  export DEBIAN_FRONTEND=noninteractive
  export APT_CONFIG=$configuration
  "$@"
)

install_requested_packages() {
  apt-get update
  apt-get install -y -- "$@"
}

install_ubuntu_packages() {
  if (( $# == 0 )); then
    echo "Usage: sudo bash script/install-ubuntu-packages.sh PACKAGE... | --command COMMAND..." >&2
    return 2
  fi
  if [[ "$1" == --command ]]; then
    shift
    if (( $# == 0 )); then
      echo "Usage: sudo bash script/install-ubuntu-packages.sh PACKAGE... | --command COMMAND..." >&2
      return 2
    fi
    with_ubuntu_apt "$@"
  else
    with_ubuntu_apt install_requested_packages "$@"
  fi
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  install_ubuntu_packages "$@"
fi
