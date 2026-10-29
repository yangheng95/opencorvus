ARG BUN_VERSION
ARG NODE_VERSION
FROM oven/bun:${BUN_VERSION} AS bun-runtime

FROM node:${NODE_VERSION}-bookworm-slim AS node-runtime

FROM rust:1-bookworm

ARG DEBIAN_MIRROR=http://deb.debian.org/debian
ARG DEBIAN_SECURITY_MIRROR=http://deb.debian.org/debian-security
ARG NPM_REGISTRY=https://registry.npmjs.org

ENV DEBIAN_FRONTEND=noninteractive

# Tauri v2 Linux system dependencies
RUN sed -i \
    -e "s|http://deb.debian.org/debian-security|${DEBIAN_SECURITY_MIRROR}|g" \
    -e "s|http://deb.debian.org/debian|${DEBIAN_MIRROR}|g" \
    /etc/apt/sources.list.d/debian.sources \
  && apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    libwebkit2gtk-4.1-dev \
    libssl-dev \
    libgtk-3-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev \
    pkg-config \
    ripgrep \
    xdg-utils \
  && rm -rf /var/lib/apt/lists/*

COPY --from=bun-runtime /usr/local/bin/bun /usr/local/bin/bun
COPY --from=node-runtime /usr/local/bin/node /usr/local/bin/node
ENV BUN_CONFIG_REGISTRY=${NPM_REGISTRY}
ENV PATH="/root/.bun/bin:$PATH"

# Pre-install tauri-cli globally (pre-built binary, fast)
RUN bun install --global @tauri-apps/cli@^2
