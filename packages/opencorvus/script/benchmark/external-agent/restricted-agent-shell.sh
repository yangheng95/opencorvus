#!/usr/bin/env bash
set -euo pipefail

if [[ "$(id -u)" != "0" ]]; then
  echo "restricted-agent-shell requires a root-owned OpenCorvus host" >&2
  exit 126
fi

agent_uid="${OPENCORVUS_BENCH_AGENT_UID:?missing OPENCORVUS_BENCH_AGENT_UID}"
agent_home="${OPENCORVUS_BENCH_AGENT_HOME:?missing OPENCORVUS_BENCH_AGENT_HOME}"
if [[ ! "$agent_uid" =~ ^[0-9]+$ ]] || (( agent_uid < 60001 || agent_uid > 60600 )) || [[ "$agent_home" != /tmp/opencorvus-benchmark-agent-* ]]; then
  echo "restricted-agent-shell received an invalid trial identity" >&2
  exit 126
fi

exec unshare --mount --propagation private /bin/bash -c '
  set -euo pipefail
  agent_uid="$1"
  agent_home="$2"
  shift 2
  mount --make-rprivate /
  for candidate in /mnt/[a-z]; do
    [[ -e "$candidate" ]] || continue
    umount -l "$candidate"
  done
  test -d "$agent_home"
  mount -t tmpfs -o "size=256m,mode=700,uid=$agent_uid,gid=$agent_uid,nosuid,nodev,noexec" tmpfs "$agent_home"
  exec setpriv \
    --reuid="$agent_uid" \
    --regid="$agent_uid" \
    --clear-groups \
    --no-new-privs \
    --bounding-set=-all \
    --inh-caps=-all \
    --ambient-caps=-all \
    env -i \
      HOME="$agent_home" \
      TMPDIR="$agent_home" \
      PATH=/usr/local/bin:/usr/bin:/bin \
      LANG=C.UTF-8 \
      SHELL=/bin/bash \
      /bin/bash "$@"
' restricted-agent-shell "$agent_uid" "$agent_home" "$@"
