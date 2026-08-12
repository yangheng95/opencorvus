FROM debian:bookworm-slim

ARG OPENCORVUS_BINARY_NAME=opencorvus-linux-x64
ARG BUN_RUNTIME_TRANSPILER_CACHE_PATH=0

# UI means User Interface. Containers serve it from the embedded Linux binary,
# so no sibling ui directory is copied into the image.
ENV BUN_RUNTIME_TRANSPILER_CACHE_PATH=${BUN_RUNTIME_TRANSPILER_CACHE_PATH}
ENV OPENCORVUS_BIN=/opt/opencorvus/opencorvus
ENV OPENCORVUS_HOME=/var/lib/opencorvus
ENV OPENCORVUS_PROJECT_DIR=/workspace
ENV OPENCORVUS_HOSTNAME=0.0.0.0
ENV OPENCORVUS_PORT=7878

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
  ca-certificates \
  chromium \
  file \
  git \
  libgcc-s1 \
  libstdc++6 \
  nodejs \
  npm \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace

COPY packages/opencorvus/dist/binary/${OPENCORVUS_BINARY_NAME}/opencorvus-bundle.tar.gz /tmp/opencorvus-bundle.tar.gz
COPY script/opencorvus-container-entrypoint.sh /usr/local/bin/opencorvus-container-entrypoint

RUN rm -rf /opt/opencorvus \
  && mkdir -p /opt/opencorvus /var/lib/opencorvus /workspace \
  && tar -xzf /tmp/opencorvus-bundle.tar.gz -C /opt/opencorvus \
  && rm /tmp/opencorvus-bundle.tar.gz \
  && chmod 755 /opt/opencorvus/opencorvus /opt/opencorvus/bin/rg /opt/opencorvus/bin/officecli /opt/opencorvus/browser-mcp-node/node /usr/local/bin/opencorvus-container-entrypoint \
  && chmod 0777 /var/lib/opencorvus /workspace \
  && /opt/opencorvus/opencorvus --version \
  && test -x /opt/opencorvus/bin/rg \
  && /opt/opencorvus/bin/rg --version \
  && test -x /opt/opencorvus/bin/officecli \
  && /opt/opencorvus/bin/officecli --version \
  && test -f /opt/opencorvus/licenses/OfficeCLI-LICENSE \
  && test -f /opt/opencorvus/licenses/OfficeCLI-NOTICE \
  && test -f /opt/opencorvus/licenses/OfficeCLI-THIRD-PARTY-NOTICES.txt \
  && test -f /opt/opencorvus/licenses/WORK-ARTIFACT-RUNTIMES-LOCK.json \
  && test -x /opt/opencorvus/browser-mcp-node/node \
  && /opt/opencorvus/browser-mcp-node/node --version \
  && test -f /opt/opencorvus/browser-mcp-node/browser.mjs \
  && test -f /opt/opencorvus/browser-mcp-node/node_modules/playwright/index.js \
  && node --version \
  && git --version \
  && chromium --version

EXPOSE 7878

ENTRYPOINT ["/usr/local/bin/opencorvus-container-entrypoint"]
