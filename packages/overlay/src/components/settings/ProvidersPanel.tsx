import { Feedback } from "../ui/Feedback"
import type { ProviderRemovalReceipt } from "@opencorvus-ai/sdk"
// ── ProvidersPanel ──
// Solid.js component for managing custom LLM providers.
// Allows adding, editing, and removing OpenAI-compatible providers
// via the opencorvus config system (PATCH /config → provider field).

import { createEffect, createMemo, createSignal, createUniqueId, For, on, onCleanup, Show } from "solid-js"
import { t, tc } from "../../utils/i18n"
import { appStore, dismissProviderAuth, setAppStore } from "../../store/app"
import { committedConfigFromError, updateConfig, updateGlobalConfig } from "../../services/config"
import { apiJson, ApiError, captureApiAuthority, isApiAuthorityCurrent, type ApiAuthority } from "../../services/api"
import { boardStore } from "../../store/board"
import { loadProviderInfo } from "../../services/config-load"
import { requestProviderCatalogRefresh, requestProviderModelsRefresh } from "../../services/provider-refresh"
import { settleProviderSaveFollowups, type ProviderSaveFollowup, type ProviderSaveIssue } from "../../services/provider-save"
import { onProviderMutation, providerMutationScope, publishProviderMutation } from "../../services/provider-mutation"
import {
  applyProviderForm,
  ProviderFormApiError,
  providerFormValues,
  validateProviderFormApi,
  type ProviderFormValues,
} from "../../services/provider-form"
import { matchesSearchParts } from "../../services/text-search"
import { activeDirectory } from "../../services/workspace"
import {
  authenticateSelectedProvider,
  modelsForProvider,
  providerAuthMethods,
  providerApiKeyConfigured,
  providerState,
  readProviderTestResult,
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
import { DropdownMenu } from "../ui/DropdownMenu"
import { Disclosure } from "../ui/Disclosure"
import { SearchField } from "../ui/SearchField"
import { TextField } from "../ui/TextField"
import { getHostTransport } from "../../services/host-transport-runtime"
import { formatErrorDetails } from "../../utils/error-details"
import { SettingsDetailSection, SettingsEmpty, SettingsGroup, SettingsPanel, SettingsRow } from "./layout"

interface ProviderFeedback {
  key: string
  vars?: Record<string, string>
  details?: string
}

function feedback(key: string, details?: string, vars?: Record<string, string>): ProviderFeedback[] {
  return [{ key, vars, details }]
}

function ProviderMessages(props: { messages: ProviderFeedback[]; testID?: string }) {
  return (
    <For each={props.messages}>
      {(message) => (
        <Feedback tone="error" details={message.details} data-testid={props.testID}>
          {t(message.key, message.vars)}
        </Feedback>
      )}
    </For>
  )
}

function describeProviderIssue(issue: ProviderSaveIssue): string {
  const owner = [issue.providerID, issue.stage, issue.resource, issue.phase].filter(Boolean).join(" · ")
  return owner ? `${owner}: ${issue.message}` : issue.message
}

function providerStatusTone(tone: string | undefined): BadgeTone {
  if (tone === "active" || tone === "ready") return "ok"
  if (tone === "error") return "bad"
  if (tone === "warn") return "warn"
  return "neutral"
}

interface ProviderModel {
  name: string
  tool_call: boolean
}

interface CustomProvider extends Record<string, unknown> {
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

type ProviderTestObservation = { kind: "result"; result: ProviderTestResult } | { kind: "error"; error: unknown }

function connectionResult(observation: ProviderTestObservation): ProviderTestResult | undefined {
  return observation.kind === "result"
    ? observation.result
    : observation.error instanceof ApiError
      ? readProviderTestResult(observation.error.body)
      : undefined
}

function connectionSummary(observation: ProviderTestObservation): string {
  const result = connectionResult(observation)
  return result?.ok
    ? "provider.test.success"
    : result?.code === "no_models"
      ? "provider.test.no_models"
      : "provider.test.failed"
}

function connectionDetails(observation: ProviderTestObservation): string {
  if (observation.kind === "error") return formatErrorDetails(observation.error)
  const result = observation.result
  const identity = [result.providerID, result.modelID].filter(Boolean).join("/")
  return [identity, result.ok ? "" : result.message, result.output].filter(Boolean).join("\n")
}

const VISIBLE_MODEL_SUMMARY_LIMIT = 8

export default function ProvidersPanel() {
  const modelsLabelID = createUniqueId()
  const [saving, setSaving] = createSignal(false)
  const [editing, setEditing] = createSignal<string | null>(null)
  const [showAdd, setShowAdd] = createSignal(false)
  // Per-provider connectivity-test state. testing/results are keyed by
  // provider id so the operator can run several tests in parallel and
  // see each result tagged to its row. Accepted provider mutations retire
  // the affected observation; scope changes retire the whole panel.
  const [testing, setTesting] = createSignal<Set<string>>(new Set())
  const [testResults, setTestResults] = createSignal<Map<string, ProviderTestObservation>>(new Map())
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
  const [formError, setFormError] = createSignal<ProviderFeedback[] | null>(null)
  // The provider declaration and configured live-model identities have
  // independent writers. Keep their UI ownership independent as well so a
  // failure in one refresh never masks or suppresses the other.
  const [refreshingProviders, setRefreshingProviders] = createSignal(false)
  const [refreshingModels, setRefreshingModels] = createSignal(false)
  const [lastProvidersRefreshedAt, setLastProvidersRefreshedAt] = createSignal<number | null>(null)
  const [lastModelsRefreshedAt, setLastModelsRefreshedAt] = createSignal<number | null>(null)
  const [providerRefreshError, setProviderRefreshError] = createSignal<ProviderFeedback[] | null>(null)
  const [modelRefreshError, setModelRefreshError] = createSignal<ProviderFeedback[] | null>(null)
  const [providerSearch, setProviderSearch] = createSignal("")
  const [expandedCatalogProviderID, setExpandedCatalogProviderID] = createSignal("")
  const [discoveringModels, setDiscoveringModels] = createSignal(false)
  const [discoveredModelCount, setDiscoveredModelCount] = createSignal<number | null>(null)

  function providerLoadOptions(directory = activeDirectory().trim(), authority = captureApiAuthority()) {
    const selectionEpoch = boardStore.selectEpoch
    const scopeGeneration = providerTestScopeGeneration
    return {
      authority,
      directory,
      isCurrentDirectory: (candidate: string) =>
        isApiAuthorityCurrent(authority) &&
        boardStore.selectEpoch === selectionEpoch &&
        scopeGeneration === providerTestScopeGeneration &&
        activeDirectory().trim() === candidate,
    }
  }

  function providerScopedPath(path: string, directory: string): string {
    const value = directory.trim()
    return value ? `${path}?directory=${encodeURIComponent(value)}` : path
  }

  async function updateActiveProviderConfig(
    providerID: string,
    directory: string,
    mutator: (config: Record<string, any>) => void,
    options: ReturnType<typeof providerLoadOptions>,
  ): Promise<any> {
    const observeCommit = () => {
      publishProviderMutation({
        authority: options.authority,
        scope: providerMutationScope(directory),
        providerIDs: [providerID],
      })
    }
    try {
      const result = directory.trim()
        ? await updateConfig(mutator, options)
        : await updateGlobalConfig(mutator, options.authority)
      observeCommit()
      return result
    } catch (error) {
      if (committedConfigFromError(error)) observeCommit()
      throw error
    }
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

  function retireProviderTest(providerID: string) {
    providerTestGenerations.set(providerID, (providerTestGenerations.get(providerID) ?? 0) + 1)
    setTesting((previous) => {
      const next = new Set(previous)
      next.delete(providerID)
      return next
    })
    setTestResults((previous) => {
      const next = new Map(previous)
      next.delete(providerID)
      return next
    })
  }

  function retireAllProviderTests() {
    for (const providerID of providerTestGenerations.keys()) retireProviderTest(providerID)
  }

  onCleanup(
    onProviderMutation((mutation) => {
      if (!isApiAuthorityCurrent(mutation.authority)) return
      if (mutation.scope.kind === "project" && mutation.scope.directory !== activeDirectory().trim()) return
      if (mutation.providerIDs === "all") retireAllProviderTests()
      else for (const providerID of mutation.providerIDs) retireProviderTest(providerID)
    }),
  )

  async function refreshProviderCatalog(
    directory: string,
    options: ReturnType<typeof providerLoadOptions>,
  ): Promise<void> {
    const sequence = ++providerRefreshSequence
    setProviderRefreshError(null)
    setRefreshingProviders(true)
    try {
      const result = await requestProviderCatalogRefresh(directory, options.authority)
      if (result.ok)
        publishProviderMutation({ authority: options.authority, scope: { kind: "global" }, providerIDs: "all" })
      if (sequence !== providerRefreshSequence || !options.isCurrentDirectory(directory)) return
      if (!result.ok) {
        setProviderRefreshError(feedback("provider.catalog_refresh.failed", result.error))
        return
      }
      setLastProvidersRefreshedAt(result.fetchedAt ?? Date.now())
      if (result.issues?.length) {
        setProviderRefreshError(
          feedback(
            "provider.catalog_refresh.completed_with_issues",
            result.issues.map(describeProviderIssue).join("\n"),
          ),
        )
      }
    } catch (e) {
      if (sequence === providerRefreshSequence && options.isCurrentDirectory(directory)) {
        setProviderRefreshError(feedback("provider.catalog_refresh.failed", formatErrorDetails(e)))
      }
    } finally {
      if (sequence === providerRefreshSequence && options.isCurrentDirectory(directory)) setRefreshingProviders(false)
    }
  }

  async function refreshProviderModels(
    directory: string,
    options: ReturnType<typeof providerLoadOptions>,
  ): Promise<void> {
    const sequence = ++modelRefreshSequence
    setModelRefreshError(null)
    setRefreshingModels(true)
    try {
      const result = await requestProviderModelsRefresh(directory, options.authority)
      if (result.ok && result.providers)
        publishProviderMutation({
          authority: options.authority,
          scope: { kind: "global" },
          providerIDs: result.providers.map((provider) => provider.providerID),
        })
      if (sequence !== modelRefreshSequence || !options.isCurrentDirectory(directory)) return
      if (!result.ok) {
        setModelRefreshError(feedback("provider.model_refresh.failed", result.error))
        return
      }
      setLastModelsRefreshedAt(result.fetchedAt ?? Date.now())
      if (result.issues?.length) {
        setModelRefreshError(
          feedback("provider.model_refresh.completed_with_issues", result.issues.map(describeProviderIssue).join("\n")),
        )
      }
    } catch (e) {
      if (sequence === modelRefreshSequence && options.isCurrentDirectory(directory)) {
        setModelRefreshError(feedback("provider.model_refresh.failed", formatErrorDetails(e)))
      }
    } finally {
      if (sequence === modelRefreshSequence && options.isCurrentDirectory(directory)) setRefreshingModels(false)
    }
  }

  async function reloadProviderInfo(directory: string, options: ReturnType<typeof providerLoadOptions>): Promise<void> {
    try {
      await loadProviderInfo(undefined, options)
    } catch (error) {
      if (options.isCurrentDirectory(directory))
        setFormError(feedback("provider.form.error.reload_failed", formatErrorDetails(error)))
    }
  }

  createEffect(
    on(
      () => [activeDirectory().trim(), captureApiAuthority().revision, boardStore.selectEpoch] as const,
      ([directory]) => {
        providerTestScopeGeneration += 1
        providerRefreshSequence += 1
        modelRefreshSequence += 1
        providerTestGenerations.clear()
        setRefreshingProviders(false)
        setRefreshingModels(false)
        setAuthing(new Set<string>())
        setSavingKey(new Set<string>())
        setDeletingProviders(new Set<string>())
        setFormError(null)
        setApiKeyInputs(new Map<string, string>())
        setTesting(new Set<string>())
        setTestResults(new Map<string, ProviderTestObservation>())
        setLastProvidersRefreshedAt(null)
        setLastModelsRefreshedAt(null)
        setProviderRefreshError(null)
        setModelRefreshError(null)
        void reloadProviderInfo(directory, providerLoadOptions(directory))
      },
    ),
  )

  async function handleRefreshCatalog(): Promise<void> {
    if (refreshingProviders()) return
    const directory = activeDirectory().trim()
    const options = providerLoadOptions(directory)
    await refreshProviderCatalog(directory, options)
    if (options.isCurrentDirectory(directory)) await reloadProviderInfo(directory, options)
  }

  async function handleRefreshModels(): Promise<void> {
    if (refreshingModels()) return
    const directory = activeDirectory().trim()
    const options = providerLoadOptions(directory)
    await refreshProviderModels(directory, options)
    if (options.isCurrentDirectory(directory)) await reloadProviderInfo(directory, options)
  }

  async function handleTest(providerId: string) {
    const directory = activeDirectory().trim()
    const scopeGeneration = providerTestScopeGeneration
    const options = providerLoadOptions(directory)
    retireProviderTest(providerId)
    const generation = providerTestGenerations.get(providerId)
    const ownsResult = () =>
      scopeGeneration === providerTestScopeGeneration &&
      generation === providerTestGenerations.get(providerId) &&
      options.isCurrentDirectory(directory)
    setTesting((prev) => new Set(prev).add(providerId))
    try {
      const result = await testProviderConnection(providerId, undefined, options)
      if (!ownsResult()) return
      setTestResults((prev) => {
        const next = new Map(prev)
        next.set(providerId, { kind: "result", result })
        return next
      })
    } catch (err) {
      if (!ownsResult()) return
      setTestResults((prev) => {
        const next = new Map(prev)
        next.set(providerId, { kind: "error", error: err })
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

  const authCallbacks = (owns: () => boolean): AuthDialogCallbacks => ({
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
    externalUrlNeedsUserGesture: getHostTransport().capabilities.ui.externalUrlNeedsUserGesture,
    showLlmNotice: (message, tone = "info", _duration, link) => {
      if (!owns()) return
      void nativeMessage(message, { title: t("llm.title"), kind: tone, link }).catch((error) => {
        if (owns()) setFormError(feedback("provider.auth.failed", formatErrorDetails(error)))
      })
    },
    onAuthCancelled: (providerID) => {
      if (owns()) dismissProviderAuth(providerID)
    },
  })

  async function refreshAuthState(options: ReturnType<typeof providerLoadOptions>) {
    return options.isCurrentDirectory(options.directory) ? await loadProviderInfo(undefined, options) : []
  }

  async function handleAuth(providerId: string) {
    if (!providerAuthMethods(providerId).length || authing().has(providerId)) return
    const directory = activeDirectory().trim()
    const options = providerLoadOptions(directory)
    const owns = () => options.isCurrentDirectory(directory)
    setFormError(null)
    setAuthing((prev) => new Set(prev).add(providerId))
    try {
      const ok = await authenticateSelectedProvider(providerId, authCallbacks(owns), options)
      if (ok) publishProviderMutation({ authority: options.authority, scope: { kind: "global" }, providerIDs: "all" })
      if (ok && owns()) {
        try {
          await refreshAuthState(options)
          if (!owns()) return
          await nativeMessage(t("llm.status.connected"), {
            title: t("llm.title"),
            kind: "success",
          })
        } catch (error) {
          if (owns()) setFormError(feedback("provider.auth.completed_with_issues", formatErrorDetails(error)))
        }
      }
    } catch (e) {
      if (!owns()) return
      const body = e instanceof ApiError ? e.body : undefined
      setFormError(
        body && typeof body === "object" && "name" in body && body.name === "ProviderAuthOAuthExchangeActiveError"
          ? feedback("provider.auth.in_progress", formatErrorDetails(e))
          : feedback("provider.auth.failed", formatErrorDetails(e)),
      )
    } finally {
      if (!owns()) return
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
  const [formInitialValues, setFormInitialValues] = createSignal<ProviderFormValues | null>(null)
  const formApiValidation = createMemo(() => validateProviderFormApi(formApi(), formInitialValues()?.api))
  const apiInvalid = () => Boolean(formApi().trim()) && !formApiValidation().ok
  let formOccurrence = 0
  let discoveryRevision = 0

  function invalidateDiscovery() {
    discoveryRevision += 1
    setDiscoveringModels(false)
    setDiscoveredModelCount(null)
  }

  function currentFormValues(): ProviderFormValues {
    return { name: formName(), api: formApi(), env: formEnvKey(), models: formModels() }
  }

  onCleanup(() => {
    formOccurrence += 1
    discoveryRevision += 1
    providerTestScopeGeneration += 1
    providerRefreshSequence += 1
    modelRefreshSequence += 1
  })
  createEffect(
    on(
      () => [activeDirectory().trim(), captureApiAuthority().revision, boardStore.selectEpoch] as const,
      () => cancel(),
      { defer: true },
    ),
  )

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

  function providerMatchesSearch(parts: Array<unknown>): boolean {
    return matchesSearchParts(providerSearch(), parts)
  }

  function resetForm() {
    formOccurrence += 1
    invalidateDiscovery()
    setSaving(false)
    setFormId("")
    setFormName("")
    setFormApi("")
    setFormEnvKey("")
    setFormApiKey("")
    setFormModels("")
    setFormDirectory(null)
    setFormInitialValues(null)
    setFormError(null)
    setDiscoveredModelCount(null)
  }

  function startAdd() {
    resetForm()
    setFormDirectory(activeDirectory().trim())
    setEditing(null)
    setShowAdd(true)
  }

  function startEdit(id: string) {
    const p = configProviders()[id]
    if (!p) return
    resetForm()
    const values = providerFormValues(p)
    setFormDirectory(activeDirectory().trim())
    setFormInitialValues(values)
    setFormId(id)
    setFormName(values.name)
    setFormApi(values.api)
    setFormEnvKey(values.env)
    setFormModels(values.models)
    setEditing(id)
    setShowAdd(true)
    setFormError(null)
    setDiscoveredModelCount(null)
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
    setDiscoveredModelCount(null)
    const directory = formDirectory()
    if (directory === null) {
      setFormError(feedback("provider.form.error.scope_missing"))
      return
    }
    const api = formApi().trim()
    const validation = validateProviderFormApi(api)
    if (validation.ok === false) {
      setFormError(
        feedback(
          validation.code === "PROVIDER_API_REQUIRED"
            ? "provider.form.error.api_required"
            : "provider.form.api_invalid",
        ),
      )
      return
    }
    const occurrence = formOccurrence
    const revision = ++discoveryRevision
    const options = providerLoadOptions(directory)
    const ownsResponse = () =>
      occurrence === formOccurrence && revision === discoveryRevision && options.isCurrentDirectory(directory)
    setDiscoveringModels(true)
    try {
      const path = directory
        ? providerScopedPath("provider/discover-models", directory)
        : "global/providers/discover-models"
      const result = (await apiJson(path, {
        authority: options.authority,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api,
          apiKey: formApiKey().trim() || undefined,
          providerID: formProviderId() || undefined,
        }),
      })) as { ok: boolean; models: string[]; count: number; error?: string }
      if (!ownsResponse()) return
      if (!result.ok) {
        setFormError(feedback("provider.form.discover.failed", result.error))
        return
      }
      setFormModels(result.models.join("\n"))
      setDiscoveredModelCount(result.count)
    } catch (e) {
      if (ownsResponse()) setFormError(feedback("provider.form.discover.failed", formatErrorDetails(e)))
    } finally {
      if (ownsResponse()) setDiscoveringModels(false)
    }
  }

  async function handleSave() {
    if (saving()) return
    setFormError(null)
    setDiscoveredModelCount(null)
    const directory = formDirectory()
    const initial = formInitialValues()
    if (directory === null) {
      setFormError(feedback("provider.form.error.scope_missing"))
      return
    }
    const id = formProviderId()
    if (!id) {
      setFormError(feedback("provider.form.error.id_required"))
      return
    }
    const apiValidation = formApiValidation()
    if (apiValidation.ok === false) {
      setFormError(
        feedback(
          apiValidation.code === "PROVIDER_API_REQUIRED"
            ? "provider.form.error.api_required"
            : "provider.form.api_invalid",
        ),
      )
      return
    }
    const values = currentFormValues()
    const apiKey = formApiKey().trim()
    const occurrence = formOccurrence
    const options = providerLoadOptions(directory)
    const ownsForm = () => occurrence === formOccurrence && options.isCurrentDirectory(directory)
    invalidateDiscovery()
    setSaving(true)
    const issues: ProviderSaveIssue[] = []
    try {
      try {
        await updateActiveProviderConfig(
          id,
          directory,
          (cfg) => {
            removeDisabledProvider(cfg, id)
            cfg.provider = cfg.provider || {}
            cfg.provider[id] = applyProviderForm({ id, current: cfg.provider[id], initial, values })
          },
          options,
        )
      } catch (error) {
        if (!committedConfigFromError(error)) throw error
        issues.push({ stage: "config.reconcile", message: formatErrorDetails(error) })
      }
      const followups: ProviderSaveFollowup[] = []
      if (apiKey) {
        let credentialCommitted = false
        followups.push(
          {
            phase: "auth.save",
            run: async () => {
              const result = (await apiJson(`auth/${id}`, {
                authority: options.authority,
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type: "api", key: apiKey }),
              })) as AuthMutationResult
              credentialCommitted = true
              publishProviderMutation({ authority: options.authority, scope: { kind: "global" }, providerIDs: [id] })
              return result.issues
            },
          },
          {
            phase: "config.credential-cleanup",
            run: async () => {
              if (credentialCommitted) {
                await updateActiveProviderConfig(id, directory, (cfg) => removeProjectApiKeyOverride(cfg, id), options)
              }
            },
          },
        )
      }
      followups.push({ phase: "provider.reload", run: () => refreshAuthState(options) })
      issues.push(...(await settleProviderSaveFollowups(followups, ownsForm)))

      if (!ownsForm()) return
      setShowAdd(false)
      resetForm()
      setEditing(null)
      if (issues.length > 0) {
        setFormError(feedback("provider.form.saved_with_issues", issues.map(describeProviderIssue).join("\n")))
      }
    } catch (e) {
      console.error("[providers] save failed", formatErrorDetails(e))
      if (!ownsForm()) return
      setFormError(
        e instanceof ProviderFormApiError
          ? feedback(
              e.code === "PROVIDER_API_REQUIRED" ? "provider.form.error.api_required" : "provider.form.api_invalid",
            )
          : feedback("provider.form.error.save_failed", formatErrorDetails(e)),
      )
    } finally {
      if (ownsForm()) setSaving(false)
    }
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

  function apiKeyPlaceholder(id?: string): string {
    if (!id) return t("provider.api_key.placeholder_empty")
    const configured = savingKey().has(id) ? undefined : providerApiKeyConfigured(id)
    if (configured === undefined) return t("provider.api_key.placeholder_unknown")
    return t(configured ? "provider.api_key.placeholder_configured" : "provider.api_key.placeholder_empty")
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
    const options = providerLoadOptions(directory)
    const owns = () => options.isCurrentDirectory(directory)
    setFormError(null)
    setSavingKey((prev) => new Set(prev).add(providerId))
    try {
      let authResult: AuthMutationResult | undefined
      const followups: ProviderSaveFollowup[] = [
        {
          phase: "auth.save",
          run: async () => {
            authResult = (await apiJson(`auth/${providerId}`, {
              authority: options.authority,
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ type: "api", key: value }),
            })) as AuthMutationResult
            publishProviderMutation({
              authority: options.authority,
              scope: { kind: "global" },
              providerIDs: [providerId],
            })
            if (owns()) {
              clearApiKeyInput(providerId)
            }
            return authResult.issues
          },
        },
        {
          phase: "config.credential-cleanup",
          run: async () => {
            if (!authResult) return
            await updateActiveProviderConfig(
              providerId,
              directory,
              (cfg) => {
                removeProjectApiKeyOverride(cfg, providerId)
              },
              options,
            )
          },
        },
        {
          phase: "provider.reload",
          run: () => refreshAuthState(options),
        },
      ]
      const issues = await settleProviderSaveFollowups(followups, owns)
      if (!owns()) return
      if (issues.length > 0) {
        setFormError(
          feedback(
            authResult ? "provider.api_key.saved_with_issues" : "provider.api_key.save_failed",
            issues.map(describeProviderIssue).join("\n"),
          ),
        )
      }
    } catch (e) {
      if (!owns()) return
      setFormError(feedback("provider.api_key.save_failed", formatErrorDetails(e)))
    } finally {
      if (!owns()) return
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
            placeholder={apiKeyPlaceholder(id())}
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
    const options = providerLoadOptions(directory)
    const owns = () => options.isCurrentDirectory(directory)
    setFormError(null)
    setDeletingProviders((prev) => new Set(prev).add(id))
    try {
      const path = directory
        ? providerScopedPath(`provider/${encodeURIComponent(id)}`, directory)
        : `global/providers/${encodeURIComponent(id)}`
      const receipt = (await apiJson(path, {
        method: "DELETE",
        authority: options.authority,
      })) as ProviderRemovalReceipt
      publishProviderMutation({
        authority: options.authority,
        scope:
          receipt.scope === "global" || receipt.credential === "removed" || receipt.credential === "absent"
            ? { kind: "global" }
            : providerMutationScope(directory),
        providerIDs: [receipt.providerID],
      })
      if (!owns()) return
      const residueNotice =
        receipt.status === "committed_with_residue"
          ? feedback(
              "provider.form.error.delete_residue",
              receipt.residue.map((item) => `${item.owner}: ${item.message}`).join("\n"),
              { id },
            )
          : null
      if (residueNotice) setFormError(residueNotice)
      clearApiKeyInput(id)
      try {
        await refreshAuthState(options)
      } catch (error) {
        if (!owns()) return
        const refreshNotice = feedback("provider.form.error.delete_refresh_failed", formatErrorDetails(error), { id })
        setFormError([...(residueNotice ?? []), ...refreshNotice])
      }
    } catch (e) {
      if (!owns()) return
      console.error("[providers] delete failed", e)
      setFormError(feedback("provider.form.error.delete_failed", formatErrorDetails(e), { id }))
    } finally {
      if (!owns()) return
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

  function modelListIssue(providerID: string): boolean {
    return appStore.providerLoadIssues.some(
      (issue) =>
        issue.resource === "catalog" ||
        (issue.resource === "provider" && (!issue.providerID || issue.providerID === providerID)),
    )
  }

  function modelListKnown(providerID: string): boolean {
    return Boolean(appStore.providerCatalog) && !modelListIssue(providerID)
  }

  const unfilteredProviderEntries = createMemo(() =>
    Object.entries(configProviders()).map(([id, provider]) => {
      const modelsKnown = modelListKnown(id)
      const modelIds = modelsKnown ? modelsForProvider(id) : []
      const canAuthenticate = providerAuthMethods(id).length > 0
      const status = canAuthenticate ? providerState(id) : null
      const statusText = status
        ? status.label === status.detail
          ? status.label
          : `${status.label}: ${status.detail}`
        : ""
      const modelOverflowText = hasMoreModels(modelIds)
        ? t("provider.models.more", { count: modelIds.length - VISIBLE_MODEL_SUMMARY_LIMIT })
        : ""
      return {
        id,
        provider,
        name: provider.name || id,
        envText: provider.env?.join(", ") || "",
        modelIds,
        modelCountText: modelsKnown ? tc("provider.models.count", modelIds.length) : "—",
        modelSummaryText: modelsKnown
          ? modelSummary(modelIds)
          : t(modelListIssue(id) ? "provider.models.unavailable" : "common.loading"),
        modelOverflowText,
        canAuthenticate,
        status,
        statusText,
      }
    }),
  )
  const providerEntries = createMemo(() =>
    unfilteredProviderEntries().filter((row) =>
      providerMatchesSearch([
        row.id,
        row.name,
        row.provider.api,
        row.envText,
        row.modelCountText,
        row.modelSummaryText,
        ...row.modelIds,
        row.modelOverflowText,
        row.statusText,
      ]),
    ),
  )
  const unfilteredCatalogEntries = createMemo(() => {
    const custom = new Set(Object.keys(configProviders()))
    return catalogProviders()
      .filter((p: any) => p && typeof p.id === "string" && !custom.has(p.id))
      .map((p: any) => {
        const modelsKnown = modelListKnown(p.id)
        const modelCount = modelsKnown ? modelsForProvider(p.id).length : 0
        const providerStatus = providerState(p.id)
        const status = providerStatus.tone === "active" ? providerStatus : null
        return {
          id: p.id,
          name: p.name || p.id,
          modelCountText: modelsKnown ? tc("provider.models.count", modelCount) : "—",
          authMethods: providerAuthMethods(p.id).length,
          status,
          statusText: status
            ? status.label === status.detail
              ? status.label
              : `${status.label}: ${status.detail}`
            : "",
        }
      })
      .sort(
        (left, right) =>
          Number(Boolean(right.status)) - Number(Boolean(left.status)) || left.name.localeCompare(right.name),
      )
  })
  const catalogEntries = createMemo(() =>
    unfilteredCatalogEntries().filter((row) =>
      providerMatchesSearch([row.id, row.name, row.modelCountText, row.statusText]),
    ),
  )
  const totalProviderCount = createMemo(() => unfilteredProviderEntries().length + unfilteredCatalogEntries().length)
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
  const catalogUnavailable = () => appStore.providerLoadIssues.some((issue) => issue.resource === "catalog")
  const configuredUnavailable = () =>
    appStore.providerLoadIssues.some((issue) => ["catalog", "auth", "config"].includes(issue.resource))

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
            <span class="provider-command-description">{t("provider.description")}</span>
            <div class="provider-stat-strip" aria-label={t("provider.stats.label")}>
              <span>
                {t("provider.stats.configured")} ·{" "}
                {configuredUnavailable() || !appStore.providerCatalog ? "—" : configuredProviderCount()}
              </span>
              <span>
                {t("provider.stats.catalog")} ·{" "}
                {catalogUnavailable() || !appStore.providerCatalog ? "—" : catalogProviderCount()}
              </span>
              <Show when={hasProviderSearch()}>
                <span>
                  {t("provider.search.count", { shown: visibleProviderCount(), total: totalProviderCount() })}
                </span>
              </Show>
            </div>
          </div>
          <div class="provider-head-actions">
            <DropdownMenu.Root placement="bottom-end" fitViewport>
              <DropdownMenu.Trigger
                as={Button}
                type="button"
                variant="ghost"
                size="icon"
                tone="neutral"
                aria-label={t("common.more")}
              >
                <Icon name="more-horizontal" />
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content>
                  <DropdownMenu.Item
                    as="button"
                    type="button"
                    title={t("provider.catalog_refresh.title")}
                    disabled={refreshingProviders()}
                    onSelect={() => void handleRefreshCatalog()}
                  >
                    <Icon name="refresh" />
                    {refreshingProviders()
                      ? t("provider.catalog_refresh.refreshing")
                      : t("provider.catalog_refresh.button")}
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    as="button"
                    type="button"
                    title={t("provider.model_refresh.title")}
                    disabled={refreshingModels()}
                    onSelect={() => void handleRefreshModels()}
                  >
                    <Icon name="refresh" />
                    {refreshingModels() ? t("provider.model_refresh.refreshing") : t("provider.model_refresh.button")}
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
            <Button type="button" variant="solid" size="md" tone="neutral" data-ui="provider-add" onClick={startAdd}>
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
            clearable
            class="provider-search-field"
            inputDataUI="provider-search-input"
            inputDataTestID="provider-search-input"
            size="md"
            value={providerSearch()}
            placeholder={t("provider.search.placeholder")}
            ariaLabel={t("provider.search.label")}
            onValueChange={setProviderSearch}
            clearDataUI="provider-search-clear"
            clearDataTestID="provider-search-clear"
          />
        </div>

        <For each={appStore.providerLoadIssues}>
          {(issue) => (
            <Feedback tone="error" details={issue.message}>
              {t("provider.load.unavailable", {
                owner: [t(`provider.load.resource.${issue.resource}`), issue.providerID, issue.phase]
                  .filter(Boolean)
                  .join(" · "),
              })}
            </Feedback>
          )}
        </For>

        <Show
          when={
            providerEntries().length === 0 &&
            catalogEntries().length === 0 &&
            !showAdd() &&
            appStore.providerLoadIssues.length === 0 &&
            Boolean(appStore.providerCatalog)
          }
        >
          <SettingsEmpty>
            {hasProviderSearch()
              ? t("provider.search.no_results", { query: providerSearch().trim() })
              : t("provider.empty_message")}
          </SettingsEmpty>
        </Show>

        <Show when={providerRefreshError()}>
          {(messages) => <ProviderMessages messages={messages()} testID="provider-refresh-error" />}
        </Show>

        <Show when={modelRefreshError()}>
          {(messages) => <ProviderMessages messages={messages()} testID="provider-model-refresh-error" />}
        </Show>

        <Show when={!showAdd() ? formError() : null}>{(messages) => <ProviderMessages messages={messages()} />}</Show>

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
                        <span class="provider-model-count">{row.modelCountText}</span>
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
                          onClick={() => void handleTest(row.id)}
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
                          <Feedback
                            class="provider-connection-feedback"
                            tone={connectionResult(result())?.ok ? "success" : "error"}
                            details={connectionDetails(result())}
                          >
                            {t(connectionSummary(result()))}
                            <Show when={connectionResult(result())?.modelID}>
                              {" · "}
                              {connectionResult(result())?.modelID}
                            </Show>
                          </Feedback>
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

            <TextField.Root as="label" invalid={apiInvalid()}>
              <TextField.Label>{t("provider.form.api_label")}</TextField.Label>
              <TextField.Input
                type="url"
                required={formApiValidation().changed}
                placeholder={t("provider.form.api_placeholder", { value: "https://my-gateway.com/v1" })}
                value={formApi()}
                onInput={(e) => {
                  invalidateDiscovery()
                  setFormApi(e.currentTarget.value)
                }}
              />
              <Show when={apiInvalid()}>
                <TextField.ErrorMessage>{t("provider.form.api_invalid")}</TextField.ErrorMessage>
              </Show>
            </TextField.Root>

            <TextField.Root as="label">
              <TextField.Label>{t("provider.api_key.label")}</TextField.Label>
              <TextField.Input
                type="password"
                autocomplete="off"
                placeholder={apiKeyPlaceholder(editing() ?? undefined)}
                value={formApiKey()}
                onInput={(e) => {
                  invalidateDiscovery()
                  setFormApiKey(e.currentTarget.value)
                }}
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
                      onInput={(e) => {
                        invalidateDiscovery()
                        setFormId(e.currentTarget.value)
                      }}
                    />
                  </TextField.Root>
                </Show>

                <TextField.Root as="label">
                  <TextField.Label>{t("provider.form.name_label")}</TextField.Label>
                  <TextField.Input
                    type="text"
                    placeholder={t("provider.form.name_placeholder", { value: "OpenToken CN2" })}
                    value={formName()}
                    onInput={(e) => {
                      invalidateDiscovery()
                      setFormName(e.currentTarget.value)
                    }}
                  />
                </TextField.Root>

                <TextField.Root as="label">
                  <TextField.Label>{t("provider.form.env_label")}</TextField.Label>
                  <TextField.Input
                    type="text"
                    placeholder={t("provider.form.env_placeholder", { value: "OPENTOKEN_API_KEY" })}
                    value={formEnvKey()}
                    onInput={(e) => {
                      invalidateDiscovery()
                      setFormEnvKey(e.currentTarget.value)
                    }}
                  />
                </TextField.Root>
              </Disclosure.Content>
            </Disclosure.Root>

            <TextField.Root>
              <TextField.Label id={modelsLabelID}>{t("provider.form.models_label")}</TextField.Label>
              <TextField.Description class="provider-form-hint">{t("provider.form.models_hint")}</TextField.Description>
              <div class="provider-model-field-head">
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  tone="neutral"
                  onClick={() => void handleDiscoverModels()}
                  disabled={discoveringModels() || !validateProviderFormApi(formApi()).ok}
                  data-testid="provider-discover-models"
                >
                  <Icon name="refresh" />
                  {discoveringModels() ? t("provider.form.discover.running") : t("provider.form.discover.button")}
                </Button>
              </div>
              <AutoGrowTextarea
                class="provider-models-textarea"
                aria-labelledby={modelsLabelID}
                rows={4}
                placeholder={"gpt-5.4-mini\nqwen3-next:80b"}
                value={formModels()}
                onInput={(e) => {
                  invalidateDiscovery()
                  setFormModels(e.currentTarget.value)
                }}
              />
            </TextField.Root>

            <Show when={discoveredModelCount() !== null}>
              <Feedback tone="success">{tc("provider.form.discover.success", discoveredModelCount()!)}</Feedback>
            </Show>

            <Show when={formError()}>{(messages) => <ProviderMessages messages={messages()} />}</Show>

            <div class="dialog-actions compact provider-form-actions">
              <Button type="button" variant="outline" size="md" tone="neutral" onClick={cancel}>
                {t("common.cancel")}
              </Button>
              <Button
                type="button"
                variant="solid"
                size="md"
                tone="neutral"
                onClick={handleSave}
                disabled={saving() || !formProviderId() || !formApiValidation().ok}
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
            description={t("provider.catalog.hint")}
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
                      <span class="provider-model-count">{p.modelCountText}</span>
                      <Show when={p.status}>
                        {(status) => (
                          <Badge class="provider-auth-status" tone={providerStatusTone(status().tone)}>
                            {p.statusText}
                          </Badge>
                        )}
                      </Show>
                    </div>
                    <div class="provider-row-actions">
                      <Show when={p.authMethods > 0 && expandedCatalogProviderID() === p.id}>
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
