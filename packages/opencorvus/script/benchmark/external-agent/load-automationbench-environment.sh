#!/usr/bin/env bash

provider_data_root=/var/lib/opencorvus-benchmark/provider-data

set -a
. "$provider_data_root/exa.env"
. "$provider_data_root/network.env"
set +a

: "${EXA_API_KEY:?EXA_API_KEY must be configured in root-private exa.env}"
: "${AUTOMATIONBENCH_PROXY_PORT:?AUTOMATIONBENCH_PROXY_PORT must be configured in root-private network.env}"

case "$AUTOMATIONBENCH_PROXY_PORT" in
  *[!0-9]* | "")
    echo "AUTOMATIONBENCH_PROXY_PORT must be a decimal port" >&2
    exit 1
    ;;
esac
if ((AUTOMATIONBENCH_PROXY_PORT < 1 || AUTOMATIONBENCH_PROXY_PORT > 65535)); then
  echo "AUTOMATIONBENCH_PROXY_PORT must be between 1 and 65535" >&2
  exit 1
fi

automationbench_windows_host="$(ip -4 route show default | awk 'NR == 1 { print $3; exit }')"
: "${automationbench_windows_host:?WSL default-route gateway is unavailable}"

AUTOMATIONBENCH_PROXY_URL="http://${automationbench_windows_host}:${AUTOMATIONBENCH_PROXY_PORT}"
export AUTOMATIONBENCH_PROXY_URL="$AUTOMATIONBENCH_PROXY_URL"
export HTTP_PROXY="$AUTOMATIONBENCH_PROXY_URL"
export HTTPS_PROXY="$AUTOMATIONBENCH_PROXY_URL"
export ALL_PROXY="$AUTOMATIONBENCH_PROXY_URL"
export NO_PROXY="${AUTOMATIONBENCH_NO_PROXY:-127.0.0.1,localhost}"
