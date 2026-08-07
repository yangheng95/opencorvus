import { createEffect, createMemo, createSignal, onCleanup } from "solid-js"
import { appStore } from "../../store/app"
import { activeTaskID } from "../../store/board"
import {
  currentProjectConfigRequestOptions,
  patchConfig,
  testNetworkProxy,
  type NetworkProxyDraft,
  type NetworkProxyTestResult,
} from "../../services/config"
import { t } from "../../utils/i18n"
import { activeProjectDirectory } from "../../services/project-directory"
import { Icon } from "../ui/Icon"
import { Button } from "../ui/Button"
import { TextField } from "../ui/TextField"
import { Switch } from "../ui/Switch"
import { SettingsGroup, SettingsPanel, SettingsRow } from "./layout"
import { ServerConnectionSettingsGroup } from "./ServerConnectionSettingsGroup"

function configuredProxy(): {
  llmProvider: boolean
  webResearch: boolean
  url: string
  username: string
  password: string
} {
  const proxy = (appStore.config as any)?.network?.proxy
  const url = typeof proxy?.url === "string" ? proxy.url : ""
  return {
    llmProvider: proxy?.llmProvider === true,
    webResearch: proxy?.webResearch === true,
    url,
    username: typeof proxy?.username === "string" ? proxy.username : "",
    password: typeof proxy?.password === "string" ? proxy.password : "",
  }
}

function validProxyUrl(value: string): boolean {
  try {
    const parsed = new URL(value)
    return (parsed.protocol === "http:" || parsed.protocol === "https:") && !parsed.username && !parsed.password
  } catch {
    return false
  }
}

interface ProxyInput {
  proxyUrl: string
  proxyUsername: string
  proxyPassword: string
  proxyEnabled: boolean
}

interface NetworkOperationOwner {
  generation: number
  taskID: string
  directory: string
  configGeneration: number
}

function describeFailure(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return String(error)
}

export default function NetworkPanel() {
  const [llmProvider, setLlmProvider] = createSignal(false)
  const [webResearch, setWebResearch] = createSignal(false)
  const [url, setUrl] = createSignal("")
  const [username, setUsername] = createSignal("")
  const [password, setPassword] = createSignal("")
  const [saving, setSaving] = createSignal(false)
  const [deleting, setDeleting] = createSignal(false)
  const [testing, setTesting] = createSignal(false)
  const [saved, setSaved] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)
  const [statusMessage, setStatusMessage] = createSignal<string | null>(null)
  const [testResult, setTestResult] = createSignal<NetworkProxyTestResult | null>(null)
  const proxyConfigured = createMemo(() => !!(appStore.config as any)?.network?.proxy)
  let operationGeneration = 0
  let configGeneration = 0
  let scopeIdentity = ""
  let feedbackTimer: ReturnType<typeof setTimeout> | undefined

  createEffect(() => {
    const taskID = String(activeTaskID() || "").trim()
    const directory = activeProjectDirectory().trim()
    const nextScopeIdentity = `${taskID}\u0000${directory}`
    const scopeChanged = nextScopeIdentity !== scopeIdentity
    if (scopeChanged) {
      scopeIdentity = nextScopeIdentity
      operationGeneration += 1
      setSaving(false)
      setDeleting(false)
      setTesting(false)
      setError(null)
      setSaved(false)
      setStatusMessage(null)
      if (feedbackTimer) clearTimeout(feedbackTimer)
      feedbackTimer = undefined
    }
    const proxy = configuredProxy()
    configGeneration += 1
    setLlmProvider(proxy.llmProvider)
    setWebResearch(proxy.webResearch)
    setUrl(proxy.url)
    setUsername(proxy.username)
    setPassword(proxy.password)
    setTestResult(null)
  })

  function captureOwner(): NetworkOperationOwner {
    return {
      generation: ++operationGeneration,
      taskID: String(activeTaskID() || "").trim(),
      directory: activeProjectDirectory().trim(),
      configGeneration,
    }
  }

  function ownsScope(owner: NetworkOperationOwner): boolean {
    return (
      owner.generation === operationGeneration &&
      owner.taskID === String(activeTaskID() || "").trim() &&
      owner.directory === activeProjectDirectory().trim()
    )
  }

  function ownsUnchangedConfig(owner: NetworkOperationOwner): boolean {
    return ownsScope(owner) && owner.configGeneration === configGeneration
  }

  function scheduleOwnedFeedbackClear(owner: NetworkOperationOwner, clear: () => void): void {
    if (feedbackTimer) clearTimeout(feedbackTimer)
    feedbackTimer = setTimeout(() => {
      if (ownsScope(owner) && owner.configGeneration === configGeneration) clear()
      feedbackTimer = undefined
    }, 1800)
  }

  onCleanup(() => {
    operationGeneration += 1
    if (feedbackTimer) clearTimeout(feedbackTimer)
    feedbackTimer = undefined
  })

  function clearFeedback() {
    setError(null)
    setSaved(false)
    setStatusMessage(null)
    setTestResult(null)
  }

  function readProxyInput(): ProxyInput {
    const proxyUrl = url().trim()
    const proxyUsername = username().trim()
    const proxyPassword = password().trim()
    const proxyEnabled = llmProvider() || webResearch()
    return { proxyUrl, proxyUsername, proxyPassword, proxyEnabled }
  }

  function validateProxyInput(input: ProxyInput, requireUrl: boolean): boolean {
    if (requireUrl && !input.proxyUrl) {
      setError(t("network.proxy.test_url_required"))
      return false
    }
    if (input.proxyEnabled && !input.proxyUrl) {
      setError(t("network.proxy.url_required"))
      return false
    }
    if (input.proxyUrl && !validProxyUrl(input.proxyUrl)) {
      setError(t("network.proxy.url_invalid"))
      return false
    }
    if (input.proxyPassword && !input.proxyUsername) {
      setError(t("network.proxy.username_required"))
      return false
    }
    return true
  }

  function proxyDraft(input: ProxyInput): NetworkProxyDraft {
    return {
      url: input.proxyUrl,
      llmProvider: llmProvider(),
      webResearch: webResearch(),
      ...(input.proxyUsername ? { username: input.proxyUsername } : {}),
      ...(input.proxyPassword ? { password: input.proxyPassword } : {}),
    }
  }

  function proxyTestMessage(result: NetworkProxyTestResult): string {
    const durationMs = Math.round(result.durationMs)
    if (result.ok) {
      return t("network.proxy.test_success", { code: result.statusCode ?? "-", ms: durationMs })
    }
    if (typeof result.statusCode === "number") {
      return t("network.proxy.test_failed_with_code", {
        code: result.statusCode,
        ms: durationMs,
        reason: result.message,
      })
    }
    return t("network.proxy.test_failed", { reason: result.message })
  }

  async function saveProxy() {
    if (saving() || deleting()) return
    clearFeedback()
    const input = readProxyInput()
    if (!validateProxyInput(input, false)) return
    const owner = captureOwner()

    setSaving(true)
    try {
      const nextProxy = input.proxyUrl ? proxyDraft(input) : null
      const savedConfig = await patchConfig({ network: { proxy: nextProxy } }, currentProjectConfigRequestOptions())
      if (!savedConfig) {
        if (ownsScope(owner)) setError(t("network.proxy.save_failed"))
        return
      }
      if (!ownsScope(owner)) return
      const completionOwner = { ...owner, configGeneration }
      setSaved(true)
      scheduleOwnedFeedbackClear(completionOwner, () => setSaved(false))
    } catch (err) {
      if (ownsScope(owner)) setError(`${t("network.proxy.save_failed")} ${describeFailure(err)}`)
    } finally {
      if (ownsScope(owner)) setSaving(false)
    }
  }

  async function deleteProxy() {
    if (deleting() || saving() || testing() || !proxyConfigured()) return
    clearFeedback()
    const owner = captureOwner()

    setDeleting(true)
    try {
      const savedConfig = await patchConfig({ network: { proxy: null } }, currentProjectConfigRequestOptions())
      if (!savedConfig) {
        if (ownsScope(owner)) setError(t("network.proxy.delete_failed", { reason: t("network.proxy.save_failed") }))
        return
      }
      if (!ownsScope(owner)) return
      const completionOwner = { ...owner, configGeneration }
      setStatusMessage(t("network.proxy.deleted"))
      scheduleOwnedFeedbackClear(completionOwner, () => setStatusMessage(null))
    } catch (err) {
      if (ownsScope(owner)) setError(t("network.proxy.delete_failed", { reason: describeFailure(err) }))
    } finally {
      if (ownsScope(owner)) setDeleting(false)
    }
  }

  async function testProxy() {
    if (testing() || deleting()) return
    clearFeedback()
    const input = readProxyInput()
    if (!validateProxyInput(input, true)) return
    const owner = captureOwner()

    setTesting(true)
    try {
      const result = await testNetworkProxy(proxyDraft(input))
      if (ownsUnchangedConfig(owner)) setTestResult(result)
    } catch (err) {
      if (ownsUnchangedConfig(owner)) {
        setTestResult({
          ok: false,
          status: "error",
          targetUrl: "",
          durationMs: 0,
          message: describeFailure(err),
        })
      }
    } finally {
      if (ownsScope(owner)) setTesting(false)
    }
  }

  return (
    <SettingsPanel class="general-panel network-panel">
      <ServerConnectionSettingsGroup />
      <SettingsGroup title={t("network.proxy.title")}>
        <SettingsRow
          title={<label for="network-proxy-llm-provider">{t("network.proxy.llm_provider_label")}</label>}
          desc={t("network.proxy.llm_provider_hint")}
          align="center"
          interactive
          actions={
            <Switch
              inputID="network-proxy-llm-provider"
              checked={llmProvider()}
              onChange={(checked) => {
                setLlmProvider(checked)
                clearFeedback()
              }}
            />
          }
        />

        <SettingsRow
          title={<label for="network-proxy-web-research">{t("network.proxy.web_research_label")}</label>}
          desc={t("network.proxy.web_research_hint")}
          align="center"
          interactive
          actions={
            <Switch
              inputID="network-proxy-web-research"
              checked={webResearch()}
              onChange={(checked) => {
                setWebResearch(checked)
                clearFeedback()
              }}
            />
          }
        />

        <SettingsRow>
          <TextField.Root as="label">
            <TextField.Label>{t("network.proxy.url_label")}</TextField.Label>
            <TextField.Input
              type="url"
              value={url()}
              placeholder="http://127.0.0.1:7890"
              onInput={(e) => {
                setUrl(e.currentTarget.value)
                clearFeedback()
              }}
            />
          </TextField.Root>
        </SettingsRow>

        <SettingsRow>
          <TextField.Root as="label">
            <TextField.Label>{t("network.proxy.username_label")}</TextField.Label>
            <TextField.Input
              type="text"
              value={username()}
              autocomplete="username"
              onInput={(e) => {
                setUsername(e.currentTarget.value)
                clearFeedback()
              }}
            />
          </TextField.Root>
        </SettingsRow>

        <SettingsRow>
          <TextField.Root as="label">
            <TextField.Label>{t("network.proxy.password_label")}</TextField.Label>
            <TextField.Input
              type="password"
              value={password()}
              autocomplete="current-password"
              onInput={(e) => {
                setPassword(e.currentTarget.value)
                clearFeedback()
              }}
            />
          </TextField.Root>
        </SettingsRow>

        {error() ? (
          <div class="provider-form-error" role="alert" aria-live="polite">
            {error()}
          </div>
        ) : null}

        {statusMessage() ? (
          <div class="provider-test-result" data-ok="true" role="status" aria-live="polite">
            <span class="provider-test-result-msg">{statusMessage()}</span>
          </div>
        ) : null}

        {testResult() ? (
          <div
            class="provider-test-result"
            data-ok={testResult()!.ok ? "true" : "false"}
            role="status"
            aria-live="polite"
            title={testResult()!.targetUrl}
          >
            <span class="provider-test-result-msg">{proxyTestMessage(testResult()!)}</span>
          </div>
        ) : null}

        <SettingsRow
          align="center"
          actions={
            <>
              <Button
                type="button"
                variant="outline"
                size="md"
                tone="neutral"
                onClick={() => void testProxy()}
                disabled={testing() || saving() || deleting()}
                title={t("network.proxy.test_button_title")}
              >
                {testing() ? t("network.proxy.test_testing") : t("network.proxy.test_button")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="md"
                tone="danger"
                onClick={() => void deleteProxy()}
                disabled={deleting() || saving() || testing() || !proxyConfigured()}
                title={t("network.proxy.delete_button_title")}
                aria-label={t("network.proxy.delete_button_title")}
                data-ui="network-proxy-delete"
              >
                <Icon name="delete" decorative />
                {deleting() ? t("network.proxy.deleting") : t("common.delete")}
              </Button>
              <Button
                type="button"
                variant="solid"
                size="md"
                tone="accent"
                onClick={() => void saveProxy()}
                disabled={saving() || testing() || deleting()}
              >
                {saving() ? t("common.saving") : saved() ? t("common.saved") : t("common.save")}
              </Button>
            </>
          }
        />
      </SettingsGroup>
    </SettingsPanel>
  )
}
