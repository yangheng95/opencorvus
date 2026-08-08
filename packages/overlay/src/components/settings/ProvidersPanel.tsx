// ── ProvidersPanel ──
// Solid.js component for managing custom LLM providers.
// Allows adding, editing, and removing OpenAI-compatible providers
// via the opencorvus config system (PATCH /config → provider field).

import { createEffect, createMemo, createSignal, For, on, Show } from "solid-js"
import { t } from "../../utils/i18n"
import { appStore, dismissProviderAuth, setAppStore } from "../../store/app"
import { updateConfig, updateGlobalConfig } from "../../services/config"
import { apiJson, ApiError } from "../../services/api"
import { loadProviderInfo } from "../../services/config-load"
import { requestProviderCatalogRefresh, requestProviderModelsRefresh } from "../../services/provider-refresh"
import { activeDirectory } from "../../services/workspace"
import {
  authenticateSelectedProvider,
  providerAuthMethods,
  providerEntry,
  providerState,
  testProviderConnection,
  type AuthDialogCallbacks,
  type ProviderTestResult,
} from "../../services/llm"
import { nativeConfirm, nativeOpen, nativePrompt, nativeSelect } from "../../utils/native"
import { nativeMessage } from "../../services/app-dialog"
import { Icon } from "../ui/Icon"
import { AutoGrowTextarea } from "../ui/AutoGrowTextarea"
import { Badge, type BadgeTone } from "../ui/Badge"
import { Button } from "../ui/Button"
import { ArmedConfirmButton } from "../ui/ArmedConfirmButton"
import { Disclosure } from "../ui/Disclosure"
import { SearchField } from "../ui/SearchField"
import { TextField } from "../ui/TextField"
import {
  SettingsDetailSection,
  SettingsEmpty,
  SettingsGroup,
  SettingsPanel,
  SettingsRow,
  SettingsState,
} from "./layout"

function describeFailure(e: unknown): string {
  if (e instanceof ApiError) return e.message
  if (e instanceof Error) return e.message
  return String(e)
}

function describeProviderIssue(issue: { phase?: string; providerID?: string; message: string }): string {
  const owner = [issue.providerID, issue.phase].filter(Boolean).join(" · ")
  return owner ? `${owner}: ${issue.message}` : issue.message
}

function providerStatusTone(tone: string | undefined): BadgeTone {
  if (tone === "active" || tone === "ready") return "accent"
  if (tone === "error") return "bad"
  if (tone === "warn") return "warn"
  return "neutral"
}

interface ProviderModel {
  name: string
  tool_call: boolean
}

interface CustomProvider {
  name: string
  api: string
  env: string[]
  options?: {
    apiKey?: string
    [key: string]: unknown
  }
  models: Record<string, ProviderModel>
}

interface AuthMutationResult {
  ok: true
  issues: Array<{ phase?: string; providerID?: string; message: string }>
}

const VISIBLE_MODEL_SUMMARY_LIMIT = 8

export default function ProvidersPanel() {
  const [saving, setSaving] = createSignal(false)
  const [editing, setEditing] = createSignal<string | null>(null)
  const [showAdd, setShowAdd] = createSignal(false)
  // Per-provider connectivity-test state. testing/results are keyed by
  // provider id so the operator can run several tests in parallel and
  // see each result tagged to its row. Cleared when the provider is
  // edited or removed (covered by row remount via the For key).
  const [testing, setTesting] = createSignal<Set<string>>(new Set())
  const [testResults, setTestResults] = createSignal<Map<string, ProviderTestResult>>(new Map())
  const [authing, setAuthing] = createSignal<Set<string>>(new Set())
  const [savingKey, setSavingKey] = createSignal<Set<string>>(new Set())
  const [deletingProviders, setDeletingProviders] = createSignal<Set<string>>(new Set())
  const [apiKeyInputs, setApiKeyInputs] = createSignal<Map<string, string>>(new Map())
  // Surface every save / delete / form-validation failure into the UI.
  // Before this signal existed, handleSave/handleDelete only `console.error`d
  // (Tauri WebView users have no devtools), and a silent `return` on missing
  // id / api in handleSave produced a button that did nothing. Anything
  // user-visible writes here; clearForm / startAdd / startEdit / cancel
  // resets it so a new attempt starts clean.
  const [formError, setFormError] = createSignal<string | null>(null)
  // The provider declaration and configured live-model identities have
  // independent writers. Keep their UI ownership independent as well so a
  // failure in one refresh never masks or suppresses the other.
  const [refreshingProviders, setRefreshingProviders] = createSignal(false)
  const [refreshingModels, setRefreshingModels] = createSignal(false)
  const [lastProvidersRefreshedAt, setLastProvidersRefreshedAt] = createSignal<number | null>(null)
  const [lastModelsRefreshedAt, setLastModelsRefreshedAt] = createSignal<number | null>(null)
  const [providerRefreshError, setProviderRefreshError] = createSignal<string | null>(null)
  const [modelRefreshError, setModelRefreshError] = createSignal<string | null>(null)
  const [providerSearch, setProviderSearch] = createSignal("")
  const [expandedCatalogProviderID, setExpandedCatalogProviderID] = createSignal("")
  const [discoveringModels, setDiscoveringModels] = createSignal(false)
  const [formNotice, setFormNotice] = createSignal<string | null>(null)

  function providerLoadOptions(directory = activeDirectory().trim()) {
    return {
      directory,
      isCurrentDirectory: (candidate: string) => activeDirectory().trim() === candidate,
    }
  }

  function providerScopedPath(path: string, directory: string): string {
    const value = directory.trim()
    return value ? `${path}?directory=${encodeURIComponent(value)}` : path
  }

  async function updateActiveProviderConfig(
    directory: string,
    mutator: (config: Record<string, any>) => void,
  ): Promise<any> {
    return directory.trim()
      ? await updateConfig(mutator, {
          directory,
          isCurrentDirectory: (candidate) => activeDirectory().trim() === candidate.trim(),
        })
      : await updateGlobalConfig(mutator)
  }

  function formatRelative(ms: number): string {
    const diff = Date.now() - ms
    if (diff < 60_000) return t("provider.refresh.just_now")
    const mins = Math.floor(diff / 60_000)
    if (mins < 60) return t("provider.refresh.minutes_ago", { n: mins })
    const hours = Math.floor(mins / 60)
    return t("provider.refresh.hours_ago", { n: hours })
  }

  let providerRefreshSequence = 0
  let modelRefreshSequence = 0
  let providerTestScopeGeneration = 0
  const providerTestGenerations = new Map<string, number>()

  async function refreshProviderCatalog(directory: string): Promise<void> {
    const sequence = ++providerRefreshSequence
    setProviderRefreshError(null)
    setRefreshingProviders(true)
    try {
      const result = await requestProviderCatalogRefresh(directory)
      if (sequence !== providerRefreshSequence || activeDirectory().trim() !== directory) return
      if (!result.ok) {
        setProviderRefreshError(t("provider.catalog_refresh.failed", { reason: result.error || "unknown" }))
        return
      }
      setLastProvidersRefreshedAt(result.fetchedAt ?? Date.now())
      if (result.issues?.length) {
        setProviderRefreshError(
          t("provider.catalog_refresh.completed_with_issues", {
            reason: result.issues.map(describeProviderIssue).join("; "),
          }),
        )
      }
    } catch (e) {
      if (sequence === providerRefreshSequence && activeDirectory().trim() === directory) {
        setProviderRefreshError(t("provider.catalog_refresh.failed", { reason: describeFailure(e) }))
      }
    } finally {
      if (sequence === providerRefreshSequence) setRefreshingProviders(false)
    }
  }

  async function refreshProviderModels(directory: string): Promise<void> {
    const sequence = ++modelRefreshSequence
    setModelRefreshError(null)
    setRefreshingModels(true)
    try {
      const result = await requestProviderModelsRefresh(directory)
      if (sequence !== modelRefreshSequence || activeDirectory().trim() !== directory) return
      if (!result.ok) {
        setModelRefreshError(t("provider.model_refresh.failed", { reason: result.error || "unknown" }))
        return
      }
      setLastModelsRefreshedAt(result.fetchedAt ?? Date.now())
      if (result.issues?.length) {
        setModelRefreshError(
          t("provider.model_refresh.completed_with_issues", {
            reason: result.issues.map(describeProviderIssue).join("; "),
          }),
        )
      }
    } catch (e) {
      if (sequence === modelRefreshSequence && activeDirectory().trim() === directory) {
        setModelRefreshError(t("provider.model_refresh.failed", { reason: describeFailure(e) }))
      }
    } finally {
      if (sequence === modelRefreshSequence) setRefreshingModels(false)
    }
  }

  async function reloadProviderInfo(directory: string): Promise<void> {
    try {
      await loadProviderInfo(undefined, providerLoadOptions(directory))
    } catch (error) {
      if (activeDirectory().trim() === directory) setFormError(describeFailure(error))
    }
  }

  createEffect(
    on(
      () => activeDirectory().trim(),
      (directory) => {
        providerTestScopeGeneration += 1
        providerTestGenerations.clear()
        setTesting(new Set<string>())
        setTestResults(new Map<string, ProviderTestResult>())
        setLastProvidersRefreshedAt(null)
        setLastModelsRefreshedAt(null)
        setProviderRefreshError(null)
        setModelRefreshError(null)
        void (async () => {
          await refreshProviderCatalog(directory)
          if (activeDirectory().trim() === directory) await reloadProviderInfo(directory)
        })()
      },
    ),
  )

  async function handleRefreshCatalog(): Promise<void> {
    if (refreshingProviders()) return
    const directory = activeDirectory().trim()
    await refreshProviderCatalog(directory)
    if (activeDirectory().trim() === directory) await reloadProviderInfo(directory)
  }

  async function handleRefreshModels(): Promise<void> {
    if (refreshingModels()) return
    const directory = activeDirectory().trim()
    await refreshProviderModels(directory)
    if (activeDirectory().trim() === directory) await reloadProviderInfo(directory)
  }

  async function handleTest(providerId: string, models: Record<string, ProviderModel>) {
    const modelID = Object.keys(models)[0]
    if (!modelID) {
      setTestResults((prev) => {
        const next = new Map(prev)
        next.set(providerId, { ok: false, message: t("provider.test.no_models") })
        return next
      })
      return
    }
    const directory = activeDirectory().trim()
    const scopeGeneration = providerTestScopeGeneration
    const generation = (providerTestGenerations.get(providerId) ?? 0) + 1
    providerTestGenerations.set(providerId, generation)
    const ownsResult = () =>
      scopeGeneration === providerTestScopeGeneration &&
      generation === providerTestGenerations.get(providerId) &&
      directory === activeDirectory().trim()
    setTesting((prev) => new Set(prev).add(providerId))
    try {
      const result = await testProviderConnection(providerId, modelID, { directory })
      if (!ownsResult()) return
      setTestResults((prev) => {
        const next = new Map(prev)
        next.set(providerId, result)
        return next
      })
    } catch (err) {
      if (!ownsResult()) return
      const msg = err instanceof Error ? err.message : String(err)
      setTestResults((prev) => {
        const next = new Map(prev)
        next.set(providerId, { ok: false, message: msg })
        return next
      })
    } finally {
      if (!ownsResult()) return
      setTesting((prev) => {
        const next = new Set(prev)
        next.delete(providerId)
        return next
      })
    }
  }

  const authCallbacks: AuthDialogCallbacks = {
    nativePrompt: (message, opts) => nativePrompt(message, opts),
    nativeSelect: (message, opts) =>
      nativeSelect(message, {
        ...opts,
        options: opts.options.map((item) => ({
          value: item.value,
          label: item.hint ? `${item.label} - ${item.hint}` : item.label,
        })),
      }),
    nativeConfirm: (message, opts) => nativeConfirm(message, opts),
    nativeOpen,
    showLlmNotice: (message, tone = "info") => {
      void nativeMessage(message, { title: t("llm.title"), kind: tone }).catch((error) => {
        setFormError(t("provider.auth.failed", { reason: describeFailure(error) }))
      })
    },
    onAuthCancelled: dismissProviderAuth,
  }

  async function refreshAuthState(directory = activeDirectory().trim()) {
    await loadProviderInfo(undefined, providerLoadOptions(directory))
  }

  async function handleAuth(providerId: string) {
    if (!providerAuthMethods(providerId).length || authing().has(providerId)) return
    const directory = activeDirectory().trim()
    setFormError(null)
    setAuthing((prev) => new Set(prev).add(providerId))
    try {
      const ok = await authenticateSelectedProvider(providerId, authCallbacks, { directory })
      if (ok) {
        await refreshAuthState(directory)
        await nativeMessage(t("llm.status.connected"), {
          title: t("llm.title"),
          kind: "success",
        })
      }
    } catch (e) {
      setFormError(t("provider.auth.failed", { reason: describeFailure(e) }))
    } finally {
      setAuthing((prev) => {
        const next = new Set(prev)
        next.delete(providerId)
        return next
      })
    }
  }

  // Form state for add/edit
  const [formId, setFormId] = createSignal("")
  const [formName, setFormName] = createSignal("")
  const [formApi, setFormApi] = createSignal("")
  const [formEnvKey, setFormEnvKey] = createSignal("")
  const [formApiKey, setFormApiKey] = createSignal("")
  const [formModels, setFormModels] = createSignal("")
  const [formDirectory, setFormDirectory] = createSignal<string | null>(null)
  const [formBaseConfig, setFormBaseConfig] = createSignal<Record<string, unknown> | null>(null)

  function providerConfigs(): Record<string, any> {
    const cfg = appStore.config
    const p = cfg?.provider
    if (!p || typeof p !== "object" || Array.isArray(p)) return {}
    return p as Record<string, any>
  }

  function isCustomProviderConfig(value: any): value is CustomProvider {
    return (
      !!value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      (typeof value.api === "string" ||
        (value.models && typeof value.models === "object" && !Array.isArray(value.models)))
    )
  }

  function disabledProviderIds(): Set<string> {
    const disabled = appStore.config?.disabled_providers
    if (!Array.isArray(disabled)) return new Set()
    return new Set(disabled.filter((id: unknown): id is string => typeof id === "string"))
  }

  function configProviders(): Record<string, CustomProvider> {
    const out: Record<string, CustomProvider> = {}
    const disabled = disabledProviderIds()
    for (const [id, value] of Object.entries(providerConfigs())) {
      if (disabled.has(id)) continue
      if (isCustomProviderConfig(value)) out[id] = value
    }
    return out
  }

  function catalogProviders(): any[] {
    const cat = appStore.providerCatalog as any
    return Array.isArray(cat?.all) ? cat.all : []
  }

  function normalizeSearch(value: unknown): string {
    return String(value ?? "")
      .trim()
      .toLowerCase()
  }

  function providerModelIds(models: Record<string, unknown> | undefined): string[] {
    if (!models || typeof models !== "object" || Array.isArray(models)) return []
    return Object.keys(models)
  }

  function providerMatchesSearch(parts: Array<unknown>): boolean {
    const q = normalizeSearch(providerSearch())
    if (!q) return true
    return parts.some((part) => normalizeSearch(part).includes(q))
  }

  function resetForm() {
    setFormId("")
    setFormName("")
    setFormApi("")
    setFormEnvKey("")
    setFormApiKey("")
    setFormModels("")
    setFormDirectory(null)
    setFormBaseConfig(null)
    setFormError(null)
    setFormNotice(null)
  }

  function startAdd() {
    resetForm()
    setFormDirectory(activeDirectory().trim())
    setFormBaseConfig({})
    setEditing(null)
    setShowAdd(true)
  }

  function startEdit(id: string) {
    const p = configProviders()[id]
    if (!p) return
    setFormDirectory(activeDirectory().trim())
    setFormBaseConfig(providerConfigWithoutApiKey(id))
    setFormId(id)
    setFormName(p.name || "")
    setFormApi(p.api || "")
    setFormEnvKey(p.env?.[0] || "")
    setFormApiKey("")
    const modelStr = Object.entries(p.models || {})
      .map(([mid, m]) => `${mid}:${m.name || mid}`)
      .join("\n")
    setFormModels(modelStr)
    setEditing(id)
    setShowAdd(true)
    setFormError(null)
    setFormNotice(null)
  }

  function parseModels(text: string): Record<string, ProviderModel> {
    const models: Record<string, ProviderModel> = {}
    for (const line of text.split("\n")) {
      const trimmed = line.trim()
      if (!trimmed) continue
      const colonIdx = trimmed.indexOf(":")
      const id = colonIdx > 0 ? trimmed.slice(0, colonIdx).trim() : trimmed
      const name = colonIdx > 0 ? trimmed.slice(colonIdx + 1).trim() : id
      if (id) {
        models[id] = { name: name || id, tool_call: true }
      }
    }
    return models
  }

  function sanitizeProviderId(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
  }

  function providerIdFromApi(value: string): string {
    try {
      const host = new URL(value.trim()).hostname
      const parts = host.split(".").filter(Boolean)
      const source = parts.length >= 2 ? parts[parts.length - 2] : (parts[0] ?? "")
      return sanitizeProviderId(source)
    } catch {
      return ""
    }
  }

  function formProviderId(): string {
    return editing() || sanitizeProviderId(formId()) || sanitizeProviderId(formName()) || providerIdFromApi(formApi())
  }

  async function handleDiscoverModels() {
    if (discoveringModels()) return
    setFormError(null)
    setFormNotice(null)
    const directory = formDirectory()
    if (directory === null) {
      setFormError(t("provider.form.error.scope_missing"))
      return
    }
    const api = formApi().trim()
    if (!api) {
      setFormError(t("provider.form.error.api_required"))
      return
    }
    setDiscoveringModels(true)
    try {
      const path = directory
        ? providerScopedPath("provider/discover-models", directory)
        : "global/providers/discover-models"
      const result = (await apiJson(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api,
          apiKey: formApiKey().trim() || undefined,
          providerID: formProviderId() || undefined,
        }),
      })) as { ok: boolean; models: string[]; count: number; error?: string }
      if (!result.ok) {
        setFormError(t("provider.form.discover.failed", { reason: result.error || "unknown" }))
        return
      }
      setFormModels(result.models.join("\n"))
      setFormNotice(t("provider.form.discover.success", { count: result.count }))
    } catch (e) {
      setFormError(t("provider.form.discover.failed", { reason: describeFailure(e) }))
    } finally {
      setDiscoveringModels(false)
    }
  }

  async function handleSave() {
    setFormError(null)
    setFormNotice(null)
    const directory = formDirectory()
    const baseConfig = formBaseConfig()
    if (directory === null || baseConfig === null) {
      setFormError(t("provider.form.error.scope_missing"))
      return
    }
    const id = formProviderId()
    if (!id) {
      setFormError(t("provider.form.error.id_required"))
      return
    }
    if (!formApi().trim()) {
      setFormError(t("provider.form.error.api_required"))
      return
    }
    const models = parseModels(formModels())
    if (Object.keys(models).length === 0) {
      setFormError(t("provider.form.error.models_required"))
      return
    }

    setSaving(true)
    let configCommitted = false
    let credentialIssues: AuthMutationResult["issues"] = []
    try {
      const provider: CustomProvider = {
        name: formName().trim() || id,
        api: formApi().trim().replace(/\/+$/, ""),
        env: formEnvKey().trim() ? [formEnvKey().trim()] : [],
        options:
          baseConfig.options && typeof baseConfig.options === "object" && !Array.isArray(baseConfig.options)
            ? { ...(baseConfig.options as Record<string, unknown>) }
            : {},
        models,
      }
      const apiKey = formApiKey().trim()
      if (provider.options && Object.keys(provider.options).length === 0) delete provider.options

      await updateActiveProviderConfig(directory, (cfg) => {
        removeDisabledProvider(cfg, id)
        cfg.provider = cfg.provider || {}
        cfg.provider[id] = provider
      })
      configCommitted = true
      if (apiKey) {
        const authResult = (await apiJson(`auth/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "api", key: apiKey }),
        })) as AuthMutationResult
        credentialIssues = authResult.issues
        await refreshAuthState(directory)
      }

      setShowAdd(false)
      resetForm()
      setEditing(null)
      if (credentialIssues.length > 0) {
        setFormError(
          t("provider.api_key.saved_with_issues", {
            reason: credentialIssues.map(describeProviderIssue).join("; "),
          }),
        )
      }
    } catch (e) {
      console.error("[providers] save failed", e)
      if (configCommitted) {
        setShowAdd(false)
        resetForm()
        setEditing(null)
        setFormError(t("provider.form.saved_with_issues", { reason: describeFailure(e) }))
      } else {
        setFormError(t("provider.form.error.save_failed", { reason: describeFailure(e) }))
      }
    } finally {
      setSaving(false)
    }
  }

  function providerConfig(id: string): any {
    return providerConfigs()[id]
  }

  function providerConfigWithoutApiKey(id: string): Record<string, unknown> {
    const current = providerConfig(id)
    if (!current || typeof current !== "object" || Array.isArray(current)) return {}
    const next = { ...current } as Record<string, unknown>
    const options =
      next.options && typeof next.options === "object" && !Array.isArray(next.options)
        ? { ...(next.options as Record<string, unknown>) }
        : null
    if (options && Object.hasOwn(options, "apiKey")) delete options.apiKey
    if (options && Object.keys(options).length > 0) next.options = options
    else delete next.options
    return next
  }

  function removeProjectApiKeyOverride(cfg: Record<string, any>, providerId: string): void {
    const providers =
      cfg.provider && typeof cfg.provider === "object" && !Array.isArray(cfg.provider) ? cfg.provider : null
    if (!providers) return
    const current =
      providers[providerId] && typeof providers[providerId] === "object" && !Array.isArray(providers[providerId])
        ? { ...providers[providerId] }
        : null
    if (!current) return
    const options =
      current.options && typeof current.options === "object" && !Array.isArray(current.options)
        ? { ...current.options }
        : null
    if (options && Object.hasOwn(options, "apiKey")) delete options.apiKey
    if (options && Object.keys(options).length > 0) current.options = options
    else delete current.options
    if (Object.keys(current).length === 0) delete providers[providerId]
    else providers[providerId] = current
    if (Object.keys(providers).length === 0) delete cfg.provider
  }

  function removeDisabledProvider(cfg: Record<string, any>, providerId: string): void {
    if (!Array.isArray(cfg.disabled_providers)) return
    cfg.disabled_providers = cfg.disabled_providers.filter((id: unknown) => id !== providerId)
    if (cfg.disabled_providers.length === 0) delete cfg.disabled_providers
  }

  function providerHasSavedApiKey(id: string): boolean {
    const override = providerConfig(id)?.options?.apiKey
    if (typeof override === "string" && override.trim() !== "") return true
    const entry = providerEntry(id)
    return typeof entry?.key === "string" && entry.key.trim() !== ""
  }

  function apiKeyInput(id: string): string {
    return apiKeyInputs().get(id) ?? ""
  }

  function setApiKeyInput(id: string, value: string): void {
    setApiKeyInputs((prev) => {
      const next = new Map(prev)
      next.set(id, value)
      return next
    })
  }

  function clearApiKeyInput(id: string): void {
    setApiKeyInputs((prev) => {
      const next = new Map(prev)
      next.delete(id)
      return next
    })
  }

  async function handleSaveApiKey(providerId: string) {
    const value = apiKeyInput(providerId).trim()
    if (!value || savingKey().has(providerId)) return
    const directory = activeDirectory().trim()
    setFormError(null)
    setSavingKey((prev) => new Set(prev).add(providerId))
    try {
      const authResult = (await apiJson(`auth/${providerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "api", key: value }),
      })) as AuthMutationResult
      clearApiKeyInput(providerId)
      const followups: Array<{ phase: string; run: () => Promise<unknown> }> = [
        {
          phase: "config.credential-cleanup",
          run: () =>
            updateActiveProviderConfig(directory, (cfg) => {
              removeProjectApiKeyOverride(cfg, providerId)
            }),
        },
        {
          phase: "provider.reload",
          run: () => refreshAuthState(directory),
        },
      ]
      const settled = await Promise.allSettled(followups.map((operation) => operation.run()))
      const followupIssues = settled.flatMap((result, index) =>
        result.status === "rejected"
          ? [
              {
                phase: followups[index]?.phase,
                message: describeFailure(result.reason),
              },
            ]
          : [],
      )
      const issues = [...authResult.issues, ...followupIssues]
      if (issues.length > 0) {
        setFormError(
          t("provider.api_key.saved_with_issues", {
            reason: issues.map(describeProviderIssue).join("; "),
          }),
        )
      }
    } catch (e) {
      setFormError(t("provider.api_key.save_failed", { reason: describeFailure(e) }))
    } finally {
      setSavingKey((prev) => {
        const next = new Set(prev)
        next.delete(providerId)
        return next
      })
    }
  }

  function ApiKeyEditor(props: { providerId: string }) {
    const id = () => props.providerId
    return (
      <div class="provider-api-key-row">
        <TextField.Root as="label" class="provider-api-key-field">
          <TextField.Label>{t("provider.api_key.label")}</TextField.Label>
          <TextField.Input
            type="password"
            autocomplete="off"
            placeholder={
              providerHasSavedApiKey(id())
                ? t("provider.api_key.placeholder_configured")
                : t("provider.api_key.placeholder_empty")
            }
            value={apiKeyInput(id())}
            onInput={(e) => setApiKeyInput(id(), e.currentTarget.value)}
            data-testid={`provider-api-key-input-${id()}`}
          />
        </TextField.Root>
        <Button
          type="button"
          variant="outline"
          size="control"
          tone="neutral"
          onClick={() => void handleSaveApiKey(id())}
          disabled={savingKey().has(id()) || !apiKeyInput(id()).trim()}
          data-testid={`provider-api-key-save-${id()}`}
        >
          {savingKey().has(id()) ? t("common.loading") : t("provider.api_key.save")}
        </Button>
      </div>
    )
  }

  async function handleDelete(id: string) {
    if (deletingProviders().has(id)) return
    const directory = activeDirectory().trim()
    setFormError(null)
    setDeletingProviders((prev) => new Set(prev).add(id))
    try {
      const path = directory
        ? providerScopedPath(`provider/${encodeURIComponent(id)}`, directory)
        : `global/providers/${encodeURIComponent(id)}`
      const receipt = (await apiJson(path, { method: "DELETE" })) as {
        status: "committed" | "committed_with_residue"
        residue: Array<{ owner: string; message: string }>
      }
      if (receipt.status === "committed_with_residue") {
        const reason = receipt.residue.map((item) => `${item.owner}: ${item.message}`).join("; ")
        setFormError(t("provider.form.error.delete_residue", { id, reason }))
      }
      await refreshAuthState(directory)
      clearApiKeyInput(id)
      setTestResults((prev) => {
        const next = new Map(prev)
        next.delete(id)
        return next
      })
    } catch (e) {
      console.error("[providers] delete failed", e)
      setFormError(t("provider.form.error.delete_failed", { id, reason: describeFailure(e) }))
    } finally {
      setDeletingProviders((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  function cancel() {
    setShowAdd(false)
    resetForm()
    setEditing(null)
  }

  const providerEntries = createMemo(() =>
    Object.entries(configProviders())
      .map(([id, provider]) => {
        const modelIds = providerModelIds(provider.models)
        const canAuthenticate = providerAuthMethods(id).length > 0
        const status = canAuthenticate ? providerState(id) : null
        const statusText = status ? `${status.label}: ${status.detail}` : ""
        const modelOverflowText = hasMoreModels(modelIds)
          ? t("provider.models.more", { count: modelIds.length - VISIBLE_MODEL_SUMMARY_LIMIT })
          : ""
        return {
          id,
          provider,
          name: provider.name || id,
          envText: provider.env?.join(", ") || "",
          modelIds,
          modelCountText: t("provider.models.count", { count: modelIds.length }),
          modelSummaryText: modelSummary(modelIds),
          modelOverflowText,
          canAuthenticate,
          status,
          statusText,
        }
      })
      .filter((row) =>
        providerMatchesSearch([
          row.id,
          row.name,
          row.provider.api,
          row.envText,
          row.modelCountText,
          row.modelSummaryText,
          row.modelOverflowText,
          row.statusText,
        ]),
      ),
  )
  const catalogEntries = createMemo(() => {
    const custom = new Set(Object.keys(configProviders()))
    return catalogProviders()
      .filter((p: any) => p && typeof p.id === "string" && !custom.has(p.id))
      .map((p: any) => {
        const modelCount = providerModelIds(p.models).length
        const providerStatus = providerState(p.id)
        const status = providerStatus.tone === "active" ? providerStatus : null
        return {
          id: p.id,
          name: p.name || p.id,
          modelCountText: t("provider.models.count", { count: modelCount }),
          authMethods: providerAuthMethods(p.id).length,
          status,
          statusText: status ? `${status.label}: ${status.detail}` : "",
        }
      })
      .filter((row) => providerMatchesSearch([row.id, row.name, row.modelCountText, row.statusText]))
  })
  const totalProviderCount = createMemo(() => Object.keys(configProviders()).length + catalogProviders().length)
  const visibleProviderCount = createMemo(() => providerEntries().length + catalogEntries().length)
  const hasProviderSearch = createMemo(() => providerSearch().trim().length > 0)
  const configuredProviderCount = createMemo(() => {
    const configured = new Set(Object.keys(providerConfigs()))
    const connected = appStore.providerCatalog?.connected
    if (Array.isArray(connected)) {
      for (const providerId of connected) {
        if (typeof providerId === "string" && providerId.trim()) configured.add(providerId)
      }
    }
    return configured.size
  })
  const catalogProviderCount = createMemo(() => catalogProviders().length)

  function modelSummary(modelIds: string[]): string {
    if (modelIds.length === 0) return t("provider.label.no_models")
    return modelIds.slice(0, VISIBLE_MODEL_SUMMARY_LIMIT).join(", ")
  }

  function hasMoreModels(modelIds: string[]): boolean {
    return modelIds.length > VISIBLE_MODEL_SUMMARY_LIMIT
  }

  return (
    <SettingsPanel class="general-panel provider-panel">
      <SettingsGroup class="provider-settings-flat">
        <div class="provider-command">
          <div class="provider-command-main">
            <div class="provider-stat-strip" aria-label={t("provider.stats.label")}>
              <div class="provider-stat">
                <span class="provider-stat-value">{configuredProviderCount()}</span>
                <span class="provider-stat-label">{t("provider.stats.configured")}</span>
              </div>
              <div class="provider-stat">
                <span class="provider-stat-value">{catalogProviderCount()}</span>
                <span class="provider-stat-label">{t("provider.stats.catalog")}</span>
              </div>
              <div class="provider-toolbar-count">
                {t("provider.search.count", { shown: visibleProviderCount(), total: totalProviderCount() })}
              </div>
            </div>
          </div>
          <div class="provider-head-actions">
            <Button
              type="button"
              variant="outline"
              size="md"
              tone="neutral"
              data-ui="provider-refresh-button"
              onClick={() => void handleRefreshCatalog()}
              disabled={refreshingProviders()}
              title={t("provider.catalog_refresh.title")}
              data-spinning={refreshingProviders() ? "true" : "false"}
            >
              <span class="provider-refresh-icon" aria-hidden="true">
                <Icon name="refresh" />
              </span>
              {refreshingProviders() ? t("provider.catalog_refresh.refreshing") : t("provider.catalog_refresh.button")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="md"
              tone="neutral"
              data-ui="provider-model-refresh-button"
              onClick={() => void handleRefreshModels()}
              disabled={refreshingModels()}
              title={t("provider.model_refresh.title")}
              data-spinning={refreshingModels() ? "true" : "false"}
            >
              <span class="provider-refresh-icon" aria-hidden="true">
                <Icon name="refresh" />
              </span>
              {refreshingModels() ? t("provider.model_refresh.refreshing") : t("provider.model_refresh.button")}
            </Button>
            <Button type="button" variant="solid" size="md" tone="accent" data-ui="provider-add" onClick={startAdd}>
              <Icon name="plus" />
              {t("provider.action.add")}
            </Button>
          </div>
          <div class="provider-refresh-status" aria-live="polite">
            <Show when={lastProvidersRefreshedAt()}>
              {(ts) => (
                <span class="provider-refresh-meta" title={new Date(ts()).toLocaleString()}>
                  {t("provider.catalog_refresh.last", { when: formatRelative(ts()) })}
                </span>
              )}
            </Show>
            <Show when={lastModelsRefreshedAt()}>
              {(ts) => (
                <span class="provider-refresh-meta" title={new Date(ts()).toLocaleString()}>
                  {t("provider.model_refresh.last", { when: formatRelative(ts()) })}
                </span>
              )}
            </Show>
          </div>
          <SearchField
            class="provider-search-field"
            inputDataUI="provider-search-input"
            inputDataTestID="provider-search-input"
            size="md"
            value={providerSearch()}
            placeholder={t("provider.search.placeholder")}
            ariaLabel={t("provider.search.label")}
            onValueChange={setProviderSearch}
            onClear={() => setProviderSearch("")}
            clearDataUI="provider-search-clear"
            clearDataTestID="provider-search-clear"
          />
        </div>

        <For each={appStore.providerLoadIssues}>
          {(issue) => (
            <SettingsState tone="error">
              {t("provider.load.failed", {
                owner: [
                  t(`provider.load.resource.${issue.resource}`),
                  issue.providerID,
                  issue.phase,
                ]
                  .filter(Boolean)
                  .join(" · "),
                reason: issue.message,
              })}
            </SettingsState>
          )}
        </For>

        <Show when={providerEntries().length === 0 && catalogEntries().length === 0 && !showAdd()}>
          <SettingsEmpty>
            {hasProviderSearch()
              ? t("provider.search.no_results", { query: providerSearch().trim() })
              : t("provider.empty_message")}
          </SettingsEmpty>
        </Show>

        <Show when={providerRefreshError()}>
          {(msg) => (
            <SettingsState tone="error" data-testid="provider-refresh-error">
              {msg()}
            </SettingsState>
          )}
        </Show>

        <Show when={modelRefreshError()}>
          {(msg) => (
            <SettingsState tone="error" data-testid="provider-model-refresh-error">
              {msg()}
            </SettingsState>
          )}
        </Show>

        <Show when={!showAdd() ? formError() : null}>
          {(msg) => <SettingsState tone="error">{msg()}</SettingsState>}
        </Show>

        <Show when={providerEntries().length > 0}>
          <SettingsDetailSection
            class="provider-flat-section"
            title={t("provider.section.custom")}
            description={t("provider.section.count", { count: providerEntries().length })}
          >
            <div class="provider-flat-list">
              <For each={providerEntries()}>
                {(row) => {
                  return (
                    <SettingsRow
                      class="provider-settings-row"
                      data-testid={`provider-custom-row-${row.id}`}
                      customContent
                      interactive
                    >
                      <div class="provider-row-main">
                        <div class="provider-row-title-line">
                          <strong class="provider-row-title">{row.name}</strong>
                          <span class="provider-row-id">{row.id}</span>
                        </div>
                        <div class="provider-row-meta">
                          <span>
                            {t("provider.label.api")}: {row.provider.api}
                          </span>
                          <Show when={row.envText}>
                            <span>
                              {t("provider.label.env")}: {row.envText}
                            </span>
                          </Show>
                        </div>
                      </div>
                      <div class="provider-row-summary">
                        <Badge class="provider-model-count">{row.modelCountText}</Badge>
                        <Show when={row.status}>
                          {(s) => (
                            <Badge class="provider-auth-status" tone={providerStatusTone(s().tone)}>
                              {row.statusText}
                            </Badge>
                          )}
                        </Show>
                      </div>
                      <div class="provider-row-actions">
                        <Show when={row.canAuthenticate}>
                          <Button
                            type="button"
                            variant="outline"
                            size="md"
                            tone="neutral"
                            onClick={() => void handleAuth(row.id)}
                            disabled={authing().has(row.id)}
                            title={t("llm.auth_connect_title")}
                            data-testid={`provider-auth-${row.id}`}
                          >
                            {authing().has(row.id) ? t("common.loading") : t("llm.auth_connect")}
                          </Button>
                        </Show>
                        <Button
                          type="button"
                          variant="outline"
                          size="md"
                          tone="neutral"
                          onClick={() => void handleTest(row.id, row.provider.models || {})}
                          disabled={testing().has(row.id)}
                          title={t("provider.test.button_title")}
                          data-testid={`provider-test-${row.id}`}
                        >
                          {testing().has(row.id) ? t("provider.test.testing") : t("provider.test.button")}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="md"
                          tone="neutral"
                          onClick={() => startEdit(row.id)}
                        >
                          {t("common.edit")}
                        </Button>
                        <ArmedConfirmButton
                          type="button"
                          variant="outline"
                          size="md"
                          tone="danger"
                          label={t("provider.delete.label", { id: row.id })}
                          armedDescription={t("provider.delete.armed", { id: row.id })}
                          onConfirm={() => void handleDelete(row.id)}
                          disabled={deletingProviders().has(row.id)}
                          data-testid={`provider-delete-${row.id}`}
                          confirmChildren={<span>{t("provider.delete.confirm")}</span>}
                        >
                          {deletingProviders().has(row.id) ? t("common.loading") : t("common.delete")}
                        </ArmedConfirmButton>
                      </div>
                      <div class="provider-row-key">
                        <ApiKeyEditor providerId={row.id} />
                      </div>
                      <Show when={testResults().get(row.id)}>
                        {(result) => (
                          <div
                            class="provider-test-result"
                            data-ok={result().ok ? "true" : "false"}
                            role="status"
                            aria-live="polite"
                          >
                            <span class="provider-test-result-icon" aria-hidden="true">
                              <Icon name={result().ok ? "status-completed" : "status-failed"} />
                            </span>
                            <span class="provider-test-result-msg">
                              {result().ok
                                ? result().message || t("provider.test.success")
                                : result().message || t("provider.test.failed")}
                            </span>
                          </div>
                        )}
                      </Show>
                      <div class="provider-row-models" title={row.modelIds.join(", ")}>
                        {row.modelSummaryText}
                        <Show when={row.modelOverflowText}>
                          <span class="provider-model-overflow">{row.modelOverflowText}</span>
                        </Show>
                      </div>
                    </SettingsRow>
                  )
                }}
              </For>
            </div>
          </SettingsDetailSection>
        </Show>

        {/* ── Add / Edit Form ── */}
        <Show when={showAdd()}>
          <div class="provider-add-card">
            <h4 class="provider-add-title oc-section-heading">
              {editing() ? t("provider.form.edit_title", { id: editing() ?? "" }) : t("provider.form.add_title")}
            </h4>

            <TextField.Root as="label">
              <TextField.Label>{t("provider.form.api_label")}</TextField.Label>
              <TextField.Input
                type="url"
                pattern="https?://.+"
                required
                placeholder={t("provider.form.api_placeholder", { value: "https://my-gateway.com/v1" })}
                value={formApi()}
                onInput={(e) => setFormApi(e.currentTarget.value)}
                onBlur={(e) => {
                  const v = e.currentTarget.value.trim()
                  e.currentTarget.setCustomValidity(
                    v && !/^https?:\/\/.+/i.test(v) ? "API base URL must start with http:// or https://" : "",
                  )
                }}
              />
            </TextField.Root>

            <TextField.Root as="label">
              <TextField.Label>{t("provider.api_key.label")}</TextField.Label>
              <TextField.Input
                type="password"
                autocomplete="off"
                placeholder={
                  editing() && providerHasSavedApiKey(editing()!)
                    ? t("provider.api_key.placeholder_configured")
                    : t("provider.api_key.placeholder_empty")
                }
                value={formApiKey()}
                onInput={(e) => setFormApiKey(e.currentTarget.value)}
              />
            </TextField.Root>

            <Disclosure.Root class="provider-advanced-fields" variant="surface">
              <Disclosure.Trigger class="provider-advanced-summary">
                <span>{t("provider.form.advanced")}</span>
                <span class="provider-advanced-derived">
                  {t("provider.form.advanced_id", { id: formProviderId() || t("provider.form.advanced_id_pending") })}
                </span>
              </Disclosure.Trigger>

              <Disclosure.Content class="provider-advanced-grid">
                <Show when={!editing()}>
                  <TextField.Root as="label">
                    <TextField.Label>{t("provider.form.id_label")}</TextField.Label>
                    <TextField.Input
                      type="text"
                      placeholder={t("provider.form.id_placeholder", { value: "opentoken" })}
                      value={formId()}
                      onInput={(e) => setFormId(e.currentTarget.value)}
                    />
                  </TextField.Root>
                </Show>

                <TextField.Root as="label">
                  <TextField.Label>{t("provider.form.name_label")}</TextField.Label>
                  <TextField.Input
                    type="text"
                    placeholder={t("provider.form.name_placeholder", { value: "OpenToken CN2" })}
                    value={formName()}
                    onInput={(e) => setFormName(e.currentTarget.value)}
                  />
                </TextField.Root>

                <TextField.Root as="label">
                  <TextField.Label>{t("provider.form.env_label")}</TextField.Label>
                  <TextField.Input
                    type="text"
                    placeholder={t("provider.form.env_placeholder", { value: "OPENTOKEN_API_KEY" })}
                    value={formEnvKey()}
                    onInput={(e) => setFormEnvKey(e.currentTarget.value)}
                  />
                </TextField.Root>
              </Disclosure.Content>
            </Disclosure.Root>

            <TextField.Root as="label">
              <TextField.Label>{t("provider.form.models_label")}</TextField.Label>
              <div class="provider-model-field-head">
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  tone="neutral"
                  onClick={() => void handleDiscoverModels()}
                  disabled={discoveringModels() || !formApi().trim()}
                  data-testid="provider-discover-models"
                >
                  <Icon name="refresh" />
                  {discoveringModels() ? t("provider.form.discover.running") : t("provider.form.discover.button")}
                </Button>
              </div>
              <AutoGrowTextarea
                class="provider-models-textarea"
                rows={4}
                placeholder={"gpt-5.4-mini:GPT-5.4 Mini\ngpt-5.4:GPT-5.4"}
                value={formModels()}
                onInput={(e) => {
                  setFormModels(e.currentTarget.value)
                  setFormNotice(null)
                }}
              />
            </TextField.Root>

            <Show when={formNotice()}>
              {(msg) => (
                <div class="provider-form-notice" role="status" aria-live="polite">
                  {msg()}
                </div>
              )}
            </Show>

            <Show when={formError()}>
              {(msg) => (
                <div class="provider-form-error" role="alert" aria-live="polite">
                  {msg()}
                </div>
              )}
            </Show>

            <div class="dialog-actions compact provider-form-actions">
              <Button type="button" variant="outline" size="md" tone="neutral" onClick={cancel}>
                {t("common.cancel")}
              </Button>
              <Button
                type="button"
                variant="solid"
                size="md"
                tone="accent"
                onClick={handleSave}
                disabled={saving() || !formProviderId() || !formApi().trim()}
              >
                {saving() ? t("common.saving") : editing() ? t("provider.form.update") : t("provider.form.add")}
              </Button>
            </div>
          </div>
        </Show>
        <Show when={catalogEntries().length > 0}>
          <SettingsDetailSection
            class="provider-flat-section provider-catalog-section"
            title={t("provider.section.catalog")}
            description={t("provider.section.count", { count: catalogEntries().length })}
            actions={<div class="provider-catalog-hint">{t("provider.catalog.hint")}</div>}
          >
            <div class="provider-flat-list">
              <For each={catalogEntries()}>
                {(p) => (
                  <SettingsRow
                    class="provider-settings-row provider-catalog-row"
                    data-testid={`provider-catalog-row-${p.id}`}
                    customContent
                    interactive
                  >
                    <div class="provider-row-main">
                      <div class="provider-row-title-line">
                        <strong class="provider-row-title">{p.name}</strong>
                        <span class="provider-row-id">{p.id}</span>
                      </div>
                    </div>
                    <div class="provider-row-summary">
                      <Badge class="provider-model-count">{p.modelCountText}</Badge>
                      <Show when={p.status}>
                        {(status) => (
                          <Badge class="provider-auth-status" tone={providerStatusTone(status().tone)}>
                            {p.statusText}
                          </Badge>
                        )}
                      </Show>
                    </div>
                    <div class="provider-row-actions">
                      <Show when={p.authMethods > 0}>
                        <Button
                          type="button"
                          variant="outline"
                          size="md"
                          tone="neutral"
                          onClick={() => void handleAuth(p.id)}
                          disabled={authing().has(p.id)}
                          title={t("llm.auth_connect_title")}
                          data-testid={`provider-auth-${p.id}`}
                        >
                          {authing().has(p.id) ? t("common.loading") : t("llm.auth_connect")}
                        </Button>
                      </Show>
                      <Button
                        type="button"
                        variant="ghost"
                        size="md"
                        tone="neutral"
                        data-ui="provider-catalog-configure"
                        data-testid={`provider-catalog-configure-${p.id}`}
                        aria-expanded={expandedCatalogProviderID() === p.id}
                        title={
                          expandedCatalogProviderID() === p.id
                            ? t("provider.action.collapse")
                            : t("provider.action.configure")
                        }
                        onClick={() => setExpandedCatalogProviderID((current) => (current === p.id ? "" : p.id))}
                      >
                        <Icon name={expandedCatalogProviderID() === p.id ? "chevron-down" : "chevron"} size="compact" />
                        {expandedCatalogProviderID() === p.id
                          ? t("provider.action.collapse")
                          : t("provider.action.configure")}
                      </Button>
                    </div>
                    <Show when={expandedCatalogProviderID() === p.id}>
                      <div class="provider-row-key">
                        <ApiKeyEditor providerId={p.id} />
                      </div>
                    </Show>
                  </SettingsRow>
                )}
              </For>
            </div>
          </SettingsDetailSection>
        </Show>
      </SettingsGroup>
    </SettingsPanel>
  )
}
