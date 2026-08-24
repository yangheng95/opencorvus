import {
  AppBridge,
  PostMessageTransport,
  buildAllowAttribute,
  type McpUiDisplayMode,
  type McpUiDownloadFileRequest,
  type McpUiHostContext,
  type McpUiResourceCsp,
  type McpUiStyles,
} from "@modelcontextprotocol/ext-apps/app-bridge"
import { ListToolsRequestSchema, type CallToolResult } from "@modelcontextprotocol/sdk/types.js"
import { createEffect, createSignal, onCleanup, onMount, Show } from "solid-js"
import type { InteractiveArtifactPayload } from "../../services/interactive-artifact"
import {
  loadSessionInteractiveArtifact,
  openMcpAppHostEventStream,
  requestMcpApp,
} from "../../services/interactive-artifact"
import { ApiError } from "../../services/api"
import type { StreamHandle } from "../../services/host-transport"
import { getHostTransport } from "../../services/host-transport-runtime"
import { promptSessionMessage } from "../../services/chat"
import { observeAppliedTheme } from "../../services/theme"
import { AppLog } from "../../utils/log"
import { getLocale, t } from "../../utils/i18n"
import { OVERLAY_VERSION } from "../../utils/version"
import { Button } from "../ui/Button"
import { ArtifactFrame } from "./ArtifactFrame"
import { externalUrl } from "../../utils/external-url"

type McpAppPayload = Extract<InteractiveArtifactPayload, { renderer: "mcp-app@1" }>

const MCP_APP_MIN_HEIGHT = 180
const MCP_APP_DEFAULT_MAX_HEIGHT = 720
const MCP_APP_MAX_DOWNLOAD_FILES = 20
const MCP_APP_MAX_DOWNLOAD_BYTES = 20 * 1024 * 1024
const MCP_APP_TEARDOWN_TIMEOUT_MS = 1_000
const DISPLAY_MODES: McpUiDisplayMode[] = ["inline", "fullscreen", "pip"]

function cspSource(values: string[] | undefined, fallback: string): string {
  return values?.length ? values.join(" ") : fallback
}

export function mcpAppContentSecurityPolicy(csp: McpUiResourceCsp | undefined): string {
  const resources = csp?.resourceDomains?.length ? ` ${csp.resourceDomains.join(" ")}` : ""
  return [
    "default-src 'none'",
    `script-src 'unsafe-inline' blob:${resources}`,
    `style-src 'unsafe-inline'${resources}`,
    `img-src data: blob:${resources}`,
    `font-src data:${resources}`,
    `media-src data: blob:${resources}`,
    `worker-src blob:${resources}`,
    `connect-src ${cspSource(csp?.connectDomains, "'none'")}`,
    `frame-src ${cspSource(csp?.frameDomains, "'none'")}`,
    `base-uri ${cspSource(csp?.baseUriDomains, "'none'")}`,
    "object-src 'none'",
    "form-action 'none'",
  ].join("; ")
}

export function secureMcpAppHtml(html: string, csp?: McpUiResourceCsp): string {
  const documentNode = new DOMParser().parseFromString(html, "text/html")
  documentNode.head
    .querySelectorAll('meta[http-equiv="Content-Security-Policy" i]')
    .forEach((element) => element.remove())
  const policy = documentNode.createElement("meta")
  policy.httpEquiv = "Content-Security-Policy"
  policy.content = mcpAppContentSecurityPolicy(csp)
  documentNode.head.prepend(policy)
  return `<!doctype html>${documentNode.documentElement.outerHTML}`
}

function safeFilename(value: string): string {
  const basename = value.split(/[\\/]/).pop()?.trim() || "mcp-app-download"
  return basename.replace(/[<>:\"|?*\u0000-\u001f]/g, "_").slice(0, 180) || "mcp-app-download"
}

function bytesFromBase64(value: string): Uint8Array {
  const decoded = atob(value)
  const bytes = new Uint8Array(decoded.length)
  for (let index = 0; index < decoded.length; index++) bytes[index] = decoded.charCodeAt(index)
  return bytes
}

export function mcpAppDownloadBytes(resource: { text?: unknown; blob?: unknown }, remainingBytes: number): Uint8Array {
  let payload: Uint8Array | undefined
  if (typeof resource.text === "string") {
    if (resource.text.length > remainingBytes) {
      throw new Error(`MCP App download exceeds ${MCP_APP_MAX_DOWNLOAD_BYTES} bytes`)
    }
    payload = new TextEncoder().encode(resource.text)
  } else if (typeof resource.blob === "string") {
    if (resource.blob.length > Math.ceil(remainingBytes / 3) * 4 + 4) {
      throw new Error(`MCP App download exceeds ${MCP_APP_MAX_DOWNLOAD_BYTES} bytes`)
    }
    payload = bytesFromBase64(resource.blob)
  }
  if (!payload) throw new Error("MCP App download resource has no text or blob content")
  if (payload.byteLength > remainingBytes) {
    throw new Error(`MCP App download exceeds ${MCP_APP_MAX_DOWNLOAD_BYTES} bytes`)
  }
  return payload
}

function hostErrorDetail(error: unknown): string {
  if (!(error instanceof ApiError)) return error instanceof Error ? error.message : String(error)
  const body = error.body
  if (body && typeof body === "object" && !Array.isArray(body)) {
    const value = body as Record<string, unknown>
    if (typeof value.message === "string" && value.message.trim()) return value.message.trim()
    const data = value.data
    if (data && typeof data === "object" && !Array.isArray(data)) {
      const message = (data as Record<string, unknown>).message
      if (typeof message === "string" && message.trim()) return message.trim()
    }
  }
  return `MCP App request failed with HTTP ${error.status}`
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = safeFilename(filename)
  anchor.rel = "noopener"
  anchor.click()
  queueMicrotask(() => URL.revokeObjectURL(url))
}

function hostStyleContext(): McpUiHostContext["styles"] {
  const styles = getComputedStyle(document.documentElement)
  const token = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback
  const variables: Partial<McpUiStyles> = {
    "--color-background-primary": token("--surface", "#111111"),
    "--color-background-secondary": token("--surface-inset", "#181818"),
    "--color-text-primary": token("--text", "#f5f5f5"),
    "--color-text-secondary": token("--text-soft", "#a3a3a3"),
    "--color-border-primary": token("--border", "#333333"),
    "--color-ring-primary": token("--accent", "#7c9cff"),
    "--font-sans": token("--font", "sans-serif"),
    "--font-mono": token("--mono", "monospace"),
    "--border-radius-md": token("--oc-radius-soft", "6px"),
  }
  return {
    // ext-apps models the finite key record as required keys whose values may
    // be undefined; a Host intentionally supplies only the tokens it owns.
    variables: variables as McpUiStyles,
  }
}

type Confirmation = {
  kind: "link" | "download"
  title: string
  detail: string
  resolve: (approved: boolean) => void
}

export function McpAppArtifact(props: {
  payload: McpAppPayload
  sessionID: string
  artifactID: string
  directory: string
}) {
  let frame!: HTMLIFrameElement
  let shell!: HTMLElement
  let bridge: AppBridge | undefined
  let resizeObserver: ResizeObserver | undefined
  let eventStream: StreamHandle | undefined
  let stopThemeObserver: (() => void) | undefined
  let teardownPromise: Promise<void> | undefined
  let lifecycleQueue = Promise.resolve()
  let lifecycleFingerprint = ""
  let fullInputSent = false
  let appInitialized = false
  let latestLifecyclePayload = props.payload
  const maximumHeight = () => props.payload.presentation?.height ?? MCP_APP_DEFAULT_MAX_HEIGHT
  const [height, setHeight] = createSignal(Math.min(360, maximumHeight()))
  const [displayMode, setDisplayMode] = createSignal<McpUiDisplayMode>("inline")
  const [closed, setClosed] = createSignal(false)
  const [bridgeConnected, setBridgeConnected] = createSignal(false)
  const [confirmation, setConfirmation] = createSignal<Confirmation>()
  const [hostError, setHostError] = createSignal("")
  const [hostTheme, setHostTheme] = createSignal<"light" | "dark">(
    document.documentElement.dataset.theme === "light" ? "light" : "dark",
  )

  const setBridgeHostContext = (context: Parameters<AppBridge["sendHostContextChange"]>[0]) => {
    if (!bridgeConnected() || teardownPromise) return
    try {
      bridge?.sendHostContextChange(context)
    } catch (error) {
      if (teardownPromise) return
      setHostError(hostErrorDetail(error))
      AppLog.warn("mcp-app", "Host context delivery failed", {
        artifactID: props.artifactID,
        error: String(error),
      })
    }
  }

  const hostRequest = async <T,>(
    method:
      | "tools/list"
      | "tools/call"
      | "resources/list"
      | "resources/templates/list"
      | "resources/read"
      | "prompts/list"
      | "ui/update-model-context",
    params: Record<string, unknown> | undefined,
    signal?: AbortSignal,
  ) => {
    try {
      const result = await requestMcpApp<T>({
        sessionID: props.sessionID,
        artifactID: props.artifactID,
        directory: props.directory,
        request: { method, ...(params ? { params } : {}) },
        signal,
      })
      setHostError("")
      return result
    } catch (error) {
      setHostError(hostErrorDetail(error))
      throw error
    }
  }

  const askConfirmation = (input: Omit<Confirmation, "resolve">): Promise<boolean> => {
    if (confirmation()) return Promise.resolve(false)
    return new Promise<boolean>((resolve) => setConfirmation({ ...input, resolve }))
  }

  const answerConfirmation = (approved: boolean) => {
    const pending = confirmation()
    if (!pending) return
    setConfirmation(undefined)
    pending.resolve(approved)
  }

  const leaveTopLayer = async () => {
    if (document.fullscreenElement === shell) await document.exitFullscreen()
    if (shell.matches(":popover-open")) shell.hidePopover()
    shell.removeAttribute("popover")
  }

  const applyDisplayMode = async (requested: McpUiDisplayMode): Promise<McpUiDisplayMode> => {
    const supported = bridge?.getAppCapabilities()?.availableDisplayModes ?? ["inline"]
    const mode = DISPLAY_MODES.includes(requested) && supported.includes(requested) ? requested : "inline"
    try {
      if (mode === "fullscreen") {
        if (shell.matches(":popover-open")) shell.hidePopover()
        shell.removeAttribute("popover")
        await shell.requestFullscreen()
      } else if (mode === "pip") {
        if (document.fullscreenElement === shell) await document.exitFullscreen()
        setDisplayMode("pip")
        shell.setAttribute("popover", "manual")
        shell.showPopover()
      } else {
        await leaveTopLayer()
      }
      setDisplayMode(mode)
      return mode
    } catch (error) {
      await leaveTopLayer()
      setDisplayMode("inline")
      setHostError(hostErrorDetail(error))
      return "inline"
    }
  }

  const deliverToolLifecycle = (payload: McpAppPayload) => {
    latestLifecyclePayload = payload
    if (!appInitialized) return
    lifecycleQueue = lifecycleQueue
      .then(async () => {
        if (!bridge) return
        const lifecycle = payload.tool.lifecycle
        const fingerprint = JSON.stringify(lifecycle)
        if (fingerprint === lifecycleFingerprint) return
        if (lifecycle.status === "input-streaming") {
          await bridge.sendToolInputPartial({ arguments: lifecycle.partialInput })
        } else {
          if (!fullInputSent) {
            await bridge.sendToolInput({ arguments: lifecycle.input })
            fullInputSent = true
          }
          if (lifecycle.status === "completed") {
            await bridge.sendToolResult(lifecycle.result as CallToolResult)
          } else if (lifecycle.status === "cancelled") {
            await bridge.sendToolCancelled({ reason: lifecycle.reason })
          } else if (lifecycle.status === "error") {
            setHostError(lifecycle.message)
            await bridge.sendToolCancelled({ reason: lifecycle.message })
          }
        }
        lifecycleFingerprint = fingerprint
      })
      .catch((error) => {
        AppLog.error("mcp-app", "Tool lifecycle delivery failed", {
          artifactID: props.artifactID,
          error: String(error),
        })
      })
  }

  const teardown = (): Promise<void> => {
    teardownPromise ??= (async () => {
      setBridgeConnected(false)
      answerConfirmation(false)
      resizeObserver?.disconnect()
      eventStream?.close("consumer-dispose")
      await lifecycleQueue
      if (bridge) {
        await bridge.teardownResource({}, { timeout: MCP_APP_TEARDOWN_TIMEOUT_MS }).catch((error) => {
          AppLog.warn("mcp-app", "View teardown request failed", {
            artifactID: props.artifactID,
            error: String(error),
          })
        })
        await bridge.close().catch((error) => {
          AppLog.debug("mcp-app", "Bridge was already disconnected during teardown", {
            artifactID: props.artifactID,
            error: String(error),
          })
        })
      }
      setClosed(true)
    })()
    return teardownPromise
  }

  const download = async (contents: McpUiDownloadFileRequest["params"]["contents"]): Promise<void> => {
    if (contents.length === 0 || contents.length > MCP_APP_MAX_DOWNLOAD_FILES) {
      throw new Error(`MCP App downloads must contain 1-${MCP_APP_MAX_DOWNLOAD_FILES} resources`)
    }
    const approved = await askConfirmation({
      kind: "download",
      title: t("artifact.mcp_app.confirm_download_title"),
      detail: t("artifact.mcp_app.confirm_download_detail", { count: contents.length }),
    })
    if (!approved) throw new Error("MCP App download was rejected")

    let totalBytes = 0
    for (const content of contents) {
      const resources =
        content.type === "resource_link"
          ? (
              await hostRequest<{ contents: Array<Record<string, unknown>> }>("resources/read", {
                uri: content.uri,
              })
            ).contents
          : [content.resource as unknown as Record<string, unknown>]
      for (const resource of resources) {
        const uri = typeof resource.uri === "string" ? resource.uri : "mcp-app-download"
        const mimeType = typeof resource.mimeType === "string" ? resource.mimeType : "application/octet-stream"
        const payload = mcpAppDownloadBytes(resource, MCP_APP_MAX_DOWNLOAD_BYTES - totalBytes)
        totalBytes += payload.byteLength
        if (totalBytes > MCP_APP_MAX_DOWNLOAD_BYTES) {
          throw new Error(`MCP App download exceeds ${MCP_APP_MAX_DOWNLOAD_BYTES} bytes`)
        }
        triggerDownload(new Blob([new Uint8Array(payload).buffer], { type: mimeType }), safeFilename(uri))
      }
    }
  }

  onMount(() => {
    stopThemeObserver = observeAppliedTheme((theme) => setHostTheme(theme === "light" ? "light" : "dark"))
    const csp = props.payload.resource.metadata.csp
    const permissions = props.payload.resource.metadata.permissions
    const hostTransport = getHostTransport()
    const canOpenLinks = hostTransport.capabilities.nativeCommands["open-url"]
    const sourceDocument = secureMcpAppHtml(props.payload.resource.html, csp)
    bridge = new AppBridge(
      null,
      { name: "OpenCorvus Overlay", version: OVERLAY_VERSION },
      {
        ...(canOpenLinks ? { openLinks: {} } : {}),
        downloadFile: {},
        serverTools: { listChanged: true },
        serverResources: { listChanged: true },
        logging: {},
        sandbox: { permissions, csp },
        updateModelContext: { text: {}, structuredContent: {} },
        message: { text: {} },
      },
      {
        hostContext: {
          toolInfo: { tool: props.payload.tool.definition as any },
          theme: hostTheme(),
          styles: hostStyleContext(),
          displayMode: "inline",
          availableDisplayModes: DISPLAY_MODES,
          containerDimensions: { maxWidth: frame.clientWidth, maxHeight: maximumHeight() },
          locale: getLocale(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          userAgent: `OpenCorvus Overlay/${OVERLAY_VERSION}`,
          platform: "desktop",
          deviceCapabilities: {
            touch: navigator.maxTouchPoints > 0,
            hover: matchMedia("(hover: hover)").matches,
          },
        },
      },
    )

    bridge.setRequestHandler(
      ListToolsRequestSchema,
      (request, extra) => hostRequest("tools/list", request.params, extra.signal) as any,
    )
    bridge.oncalltool = (params, extra) => hostRequest<CallToolResult>("tools/call", params, extra.signal)
    bridge.onlistresources = (params, extra) => hostRequest("resources/list", params, extra.signal) as any
    bridge.onlistresourcetemplates = (params, extra) =>
      hostRequest("resources/templates/list", params, extra.signal) as any
    bridge.onreadresource = (params, extra) => hostRequest("resources/read", params, extra.signal) as any
    bridge.onlistprompts = (params, extra) => hostRequest("prompts/list", params, extra.signal) as any
    bridge.onmessage = async ({ role, content }) => {
      if (role !== "user" || content.some((item) => item.type !== "text")) {
        return { isError: true }
      }
      const text = content
        .map((item) => (item.type === "text" ? item.text : ""))
        .join("\n\n")
        .trim()
      if (!text) return { isError: true }
      await promptSessionMessage({
        sessionID: props.sessionID,
        directory: props.directory,
        text,
        metadata: {
          source: "mcp-app",
          artifactID: props.artifactID,
          serverID: props.payload.server.id,
        },
      })
      return {}
    }
    bridge.onupdatemodelcontext = (params, extra) =>
      hostRequest("ui/update-model-context", params, extra.signal).then(() => ({}))
    bridge.onloggingmessage = (params) => {
      const level = params.level === "critical" ? "error" : params.level
      const method =
        level === "debug" || level === "info" || level === "warning" || level === "error"
          ? level === "warning"
            ? "warn"
            : level
          : "info"
      AppLog[method]("mcp-app", String(params.data), {
        artifactID: props.artifactID,
        logger: params.logger,
      })
    }
    bridge.onopenlink = async ({ url }) => {
      try {
        if (!canOpenLinks) throw new Error("This OpenCorvus Host cannot open external links")
        const parsed = externalUrl(url)
        const approved = await askConfirmation({
          kind: "link",
          title: t("artifact.mcp_app.confirm_link_title"),
          detail: parsed.href,
        })
        if (!approved) return { isError: true }
        await hostTransport.native({ kind: "open-url", url: parsed.href })
        return {}
      } catch (error) {
        AppLog.warn("mcp-app", "Open-link request rejected", {
          artifactID: props.artifactID,
          error: String(error),
        })
        return { isError: true }
      }
    }
    bridge.ondownloadfile = async ({ contents }) => {
      try {
        await download(contents)
        return {}
      } catch (error) {
        AppLog.warn("mcp-app", "Download request rejected", {
          artifactID: props.artifactID,
          error: String(error),
        })
        return { isError: true }
      }
    }
    bridge.onrequestdisplaymode = async ({ mode }) => ({ mode: await applyDisplayMode(mode) })
    bridge.onrequestteardown = () => {
      void teardown().catch((error) => {
        AppLog.warn("mcp-app", "View teardown failed", {
          artifactID: props.artifactID,
          error: String(error),
        })
      })
    }
    bridge.onsizechange = ({ height: requestedHeight }) => {
      if (typeof requestedHeight !== "number" || !Number.isFinite(requestedHeight)) return
      setHeight(Math.max(MCP_APP_MIN_HEIGHT, Math.min(Math.ceil(requestedHeight), maximumHeight())))
    }
    bridge.oninitialized = () => {
      appInitialized = true
      setBridgeConnected(true)
      deliverToolLifecycle(latestLifecyclePayload)
    }

    const appTransport = new PostMessageTransport(frame.contentWindow!, frame.contentWindow!)
    void bridge.connect(appTransport).catch((error) => {
      if (teardownPromise) return
      setHostError(hostErrorDetail(error))
      AppLog.warn("mcp-app", "App bridge connection failed", {
        artifactID: props.artifactID,
        error: String(error),
      })
    })
    frame.srcdoc = sourceDocument
    frame.allow = buildAllowAttribute(permissions)
    eventStream = openMcpAppHostEventStream({
      sessionID: props.sessionID,
      artifactID: props.artifactID,
      directory: props.directory,
      onEvent(event) {
        if (event.type === "mcp-app.lifecycle_changed") {
          if (event.artifactID !== props.artifactID) return
          void loadSessionInteractiveArtifact({
            sessionID: props.sessionID,
            artifactID: props.artifactID,
            directory: props.directory,
          })
            .then((artifact) => {
              if (artifact.payload.renderer === "mcp-app@1") deliverToolLifecycle(artifact.payload)
            })
            .catch((error) => {
              setHostError(hostErrorDetail(error))
              AppLog.warn("mcp-app", "Tool lifecycle refresh failed", {
                artifactID: props.artifactID,
                error: String(error),
              })
            })
          return
        }
        if (
          (event.type === "tools/list_changed" ||
            event.type === "resources/list_changed" ||
            event.type === "prompts/list_changed") &&
          event.serverID !== props.payload.server.id
        ) {
          return
        }
        const notification =
          event.type === "tools/list_changed"
            ? bridge?.sendToolListChanged()
            : event.type === "resources/list_changed"
              ? bridge?.sendResourceListChanged()
              : event.type === "prompts/list_changed"
                ? bridge?.sendPromptListChanged()
                : undefined
        void notification?.catch((error) => {
          AppLog.warn("mcp-app", "Capability list-changed delivery failed", {
            artifactID: props.artifactID,
            event: event.type,
            error: String(error),
          })
        })
      },
      onError(error) {
        AppLog.warn("mcp-app", "Capability event stream failed", {
          artifactID: props.artifactID,
          error: String(error),
        })
      },
    })

    resizeObserver = new ResizeObserver(() => {
      setBridgeHostContext({
        containerDimensions:
          displayMode() === "inline"
            ? { maxWidth: frame.clientWidth, maxHeight: maximumHeight() }
            : { width: frame.clientWidth, height: frame.clientHeight },
      })
    })
    resizeObserver.observe(frame)

    const syncTopLayer = () => {
      if (document.fullscreenElement !== shell && !shell.matches(":popover-open") && displayMode() !== "inline") {
        shell.removeAttribute("popover")
        setDisplayMode("inline")
      }
    }
    document.addEventListener("fullscreenchange", syncTopLayer)
    shell.addEventListener("toggle", syncTopLayer)
    onCleanup(() => {
      document.removeEventListener("fullscreenchange", syncTopLayer)
      shell.removeEventListener("toggle", syncTopLayer)
      void leaveTopLayer()
      stopThemeObserver?.()
      void teardown().catch((error) => {
        AppLog.warn("mcp-app", "View cleanup failed", {
          artifactID: props.artifactID,
          error: String(error),
        })
      })
    })
  })

  createEffect(() => {
    setBridgeHostContext({
      theme: hostTheme(),
      styles: hostStyleContext(),
      displayMode: displayMode(),
    })
  })

  return (
    <ArtifactFrame
      title={props.payload.title}
      kind="MCP App"
      expandable={false}
      artifactID={props.artifactID}
      class={`msg-artifact--mcp-${displayMode()}`}
      elementRef={(element) => {
        shell = element
      }}
      headerActions={
        <Show when={!closed()}>
          <div class="msg-artifact-app__modes" aria-label={t("artifact.mcp_app.display_modes")}>
            <Button
              variant="ghost"
              size="mini"
              tone="neutral"
              aria-pressed={displayMode() === "inline"}
              onClick={() => void applyDisplayMode("inline")}
            >
              {t("artifact.mcp_app.inline")}
            </Button>
            <Button
              variant="ghost"
              size="mini"
              tone="neutral"
              aria-pressed={displayMode() === "fullscreen"}
              onClick={() => void applyDisplayMode("fullscreen")}
            >
              {t("artifact.mcp_app.fullscreen")}
            </Button>
            <Button
              variant="ghost"
              size="mini"
              tone="neutral"
              aria-pressed={displayMode() === "pip"}
              onClick={() => void applyDisplayMode("pip")}
            >
              {t("artifact.mcp_app.pip")}
            </Button>
          </div>
        </Show>
      }
    >
      <Show when={!closed()} fallback={<div class="msg-artifact-state">{t("artifact.mcp_app.closed")}</div>}>
        <Show when={confirmation()}>
          {(pending) => (
            <div class="msg-artifact-app__confirmation" role="alertdialog" aria-label={pending().title}>
              <div>
                <strong>{pending().title}</strong>
                <p>{pending().detail}</p>
              </div>
              <div class="msg-artifact-app__confirmation-actions">
                <Button variant="ghost" size="sm" tone="neutral" onClick={() => answerConfirmation(false)}>
                  {t("common.cancel")}
                </Button>
                <Button variant="solid" size="sm" tone="accent" onClick={() => answerConfirmation(true)}>
                  {t("common.continue")}
                </Button>
              </div>
            </div>
          )}
        </Show>
        <Show when={hostError()}>
          <div class="msg-artifact-app__error" role="alert">
            <strong>{t("artifact.mcp_app.request_failed")}</strong>
            <span>{hostError()}</span>
          </div>
        </Show>
        <iframe
          ref={frame}
          class="msg-artifact-app"
          style={{ "--mcp-app-height": height() }}
          title={props.payload.title}
          referrerPolicy="no-referrer"
          sandbox="allow-scripts"
          data-mcp-app="true"
        />
      </Show>
    </ArtifactFrame>
  )
}
