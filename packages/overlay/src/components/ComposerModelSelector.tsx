// Provider/model selector for the internal projected-worker runtime.

import { Popover } from "./ui/Popover"
import { ListboxItem, ListboxRoot } from "./ui/Listbox"
import { Tooltip } from "./ui/Tooltip"
import { createEffect, createMemo, createResource, createSignal, For, onCleanup, Show } from "solid-js"
import { appStore } from "../store/app"
import { activeTaskID } from "../store/board"
import { Icon } from "./ui/Icon"
import { useDisclosure } from "../solid/disclosure"
import {
  getProviderAccountUsage,
  sessionConfigRefreshToken,
  type ProviderAccountUsageResponse,
  type ProviderMonetaryBalanceUsage,
  type ProviderRateLimitsUsage,
} from "../services/config"
import { loadProviderInfo } from "../services/config-load"
import { openConfigDialog } from "../services/config-dialog-control"
import { activeDirectory } from "../services/workspace"
import { formatErrorDetails, reportError } from "../services/diagnostics"
import { connectedModelOptions, providerAccountUsageCapability, providerLabel } from "../services/llm"
import { localeTag, t } from "../utils/i18n"
import { Button } from "./ui/Button"
import { SearchField } from "./ui/SearchField"
import { fuzzySearch } from "../services/fuzzy-search"
import { selectComposerModel } from "../services/composer-model"

interface ModelParts {
  provider: string
  name: string
}

interface ProviderGroup {
  providerID: string
  providerName: string
  /** True when the server reports the provider as connected/auth'd. */
  available: boolean
  /** Fully-qualified model IDs ("<provider>/<model>"). */
  models: string[]
}

interface ModelOption {
  id: string
}

interface ProviderAccountUsageBaseResourceKey {
  capability: "monetary_balance" | "rate_limits"
  directory: string
  model: string
  providerID: string
  providerAuthRefresh: number
  refresh: number
  taskID: string
}

interface ProviderAccountUsageResourceKey extends ProviderAccountUsageBaseResourceKey {
  tick: number
}

const PROVIDER_ACCOUNT_USAGE_REFRESH_MILLISECONDS = 60_000

function splitModelID(modelID: string): ModelParts {
  const trimmed = modelID.trim()
  if (!trimmed) return { provider: "", name: "" }
  const slash = trimmed.indexOf("/")
  if (slash <= 0 || slash === trimmed.length - 1) {
    return { provider: "", name: trimmed }
  }
  return {
    provider: trimmed.slice(0, slash),
    name: trimmed.slice(slash + 1),
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return String(error || "")
}

function runModelSelectorAction(label: string, action: () => void | Promise<void>): void {
  try {
    void Promise.resolve(action()).catch((error) => {
      reportError({
        id: `model-selector:${label}`,
        title: t("model_selector.group"),
        message: errorMessage(error),
        details: formatErrorDetails(error),
      })
    })
  } catch (error) {
    reportError({
      id: `model-selector:${label}`,
      title: t("model_selector.group"),
      message: errorMessage(error),
      details: formatErrorDetails(error),
    })
  }
}

// OpenCorvus (OpenCorvus internal) only surfaces models from providers that
// are already authenticated — there is no point letting the user pick a
// model whose provider can't actually serve it.
function mirrorProviderGroups(): ProviderGroup[] {
  const groups = new Map<string, ProviderGroup>()
  for (const option of connectedModelOptions()) {
    const group = groups.get(option.providerID) ?? {
      providerID: option.providerID,
      providerName: option.providerLabel,
      available: true,
      models: [],
    }
    group.models.push(option.value)
    groups.set(option.providerID, group)
  }
  return [...groups.values()].sort((left, right) => left.providerName.localeCompare(right.providerName))
}

function formatUsageAmount(value: number): string {
  return new Intl.NumberFormat(localeTag(), {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(value)
}

function usageErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return String(error || "")
}

function parseResourceKey(value: string, label: string): Record<string, unknown> {
  const parsed = JSON.parse(value) as unknown
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${label} must be a JSON object`)
  }
  return parsed as Record<string, unknown>
}

function readResourceKeyString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} must be a non-empty string`)
  }
  return value
}

function readResourceKeyNumber(value: unknown, label: string): number {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`)
  }
  return value as number
}

function encodeProviderAccountUsageBaseKey(input: ProviderAccountUsageBaseResourceKey): string {
  return JSON.stringify(input)
}

function parseProviderAccountUsageBaseKey(key: string): ProviderAccountUsageBaseResourceKey {
  const value = parseResourceKey(key, "Provider account usage base key")
  const capability = readResourceKeyString(value.capability, "Provider account usage base key capability")
  if (capability !== "monetary_balance" && capability !== "rate_limits") {
    throw new Error("Provider account usage base key capability is invalid")
  }
  if (typeof value.directory !== "string") {
    throw new Error("Provider account usage base key directory must be a string")
  }
  return {
    capability,
    directory: value.directory,
    model: readResourceKeyString(value.model, "Provider account usage base key model"),
    providerID: readResourceKeyString(value.providerID, "Provider account usage base key providerID"),
    providerAuthRefresh: readResourceKeyNumber(
      value.providerAuthRefresh,
      "Provider account usage base key providerAuthRefresh",
    ),
    refresh: readResourceKeyNumber(value.refresh, "Provider account usage base key refresh"),
    taskID: typeof value.taskID === "string" ? value.taskID : "",
  }
}

function encodeProviderAccountUsageKey(input: ProviderAccountUsageResourceKey): string {
  return JSON.stringify(input)
}

function parseProviderAccountUsageKey(key: string): ProviderAccountUsageResourceKey {
  const value = parseResourceKey(key, "Provider account usage key")
  const base = parseProviderAccountUsageBaseKey(key)
  return {
    ...base,
    tick: readResourceKeyNumber(value.tick, "Provider account usage key tick"),
  }
}

function formatUsagePercent(value: number): string {
  return new Intl.NumberFormat(localeTag(), { maximumFractionDigits: 1 }).format(value)
}

function ProviderAccountUsageTooltip(props: {
  providerID: string
  response: ProviderAccountUsageResponse | undefined
  loading: boolean
  error: unknown
}) {
  const usage = createMemo(() => (props.response?.ok ? props.response.usage : undefined))
  const monetary = createMemo(() => {
    const value = usage()
    return value?.kind === "monetary_balance" ? (value as ProviderMonetaryBalanceUsage) : undefined
  })
  const rateLimits = createMemo(() => {
    const value = usage()
    return value?.kind === "rate_limits" ? (value as ProviderRateLimitsUsage) : undefined
  })
  const providerError = createMemo(() => {
    const response = props.response
    return response?.ok === false ? response.error.message : ""
  })
  const transportError = createMemo(() => usageErrorMessage(props.error))
  const errorDetail = createMemo(() => providerError() || transportError())
  const balance = createMemo(() => {
    const monetaryValue = monetary()
    if (monetaryValue) {
      return `${monetaryValue.currency} ${formatUsageAmount(monetaryValue.remaining)} / ${formatUsageAmount(monetaryValue.limit)}`
    }
    const rateLimitValue = rateLimits()
    const window = rateLimitValue?.primary ?? rateLimitValue?.secondary
    if (!window) return ""
    return `${formatUsagePercent(window.remainingPercent)}% / 100%`
  })
  return (
    <div
      class="composer-model-usage-card"
      data-ui="composer-model-account-usage"
      data-loading={props.loading ? "true" : "false"}
      data-exceeded={monetary()?.exceeded ? "true" : "false"}
      role="status"
      aria-live="polite"
      aria-label={t("model_selector.account_usage_title", { provider: providerLabel(props.providerID) })}
    >
      <span class="composer-model-usage-label">{t("model_selector.account_usage_balance")}</span>
      <Show when={props.loading}>
        <span class="composer-model-usage-message">{t("model_selector.account_usage_loading")}</span>
      </Show>
      <Show when={!props.loading && balance()} keyed>
        {(value) => <strong class="composer-model-usage-value">{value}</strong>}
      </Show>
      <Show when={!props.loading && !balance() && errorDetail()} keyed>
        {(detail) => (
          <span class="composer-model-usage-message composer-model-usage-error" title={detail}>
            {t("model_selector.account_usage_error")}
          </span>
        )}
      </Show>
      <Show when={!props.loading && !balance() && !errorDetail()}>
        <span class="composer-model-usage-message">{t("model_selector.account_usage_empty")}</span>
      </Show>
    </div>
  )
}

function createProviderAccountUsageState(model: () => string, taskID: () => string) {
  const [refreshTick, setRefreshTick] = createSignal(0)
  const capability = createMemo(() => providerAccountUsageCapability(splitModelID(model()).provider))
  const eligible = createMemo(() => !!capability())
  const baseKey = createMemo(() => {
    if (!appStore.connected) return null
    const parts = splitModelID(model())
    const currentCapability = capability()
    if (!currentCapability || !parts.provider || !parts.name) return null
    return encodeProviderAccountUsageBaseKey({
      capability: currentCapability,
      directory: activeDirectory().trim(),
      model: parts.name,
      providerID: parts.provider,
      providerAuthRefresh: appStore.providerAuthRefreshRevision,
      refresh: sessionConfigRefreshToken(),
      taskID: taskID(),
    })
  })
  createEffect(() => {
    if (!baseKey()) return
    const timer = window.setInterval(
      () => setRefreshTick((value) => value + 1),
      PROVIDER_ACCOUNT_USAGE_REFRESH_MILLISECONDS,
    )
    onCleanup(() => window.clearInterval(timer))
  })
  const key = createMemo(() => {
    const current = baseKey()
    return current
      ? encodeProviderAccountUsageKey({ ...parseProviderAccountUsageBaseKey(current), tick: refreshTick() })
      : null
  })
  const [accountUsage] = createResource(key, async (currentKey) => {
    const parsed = parseProviderAccountUsageKey(currentKey)
    return await getProviderAccountUsage({ providerID: parsed.providerID, directory: parsed.directory })
  })
  const loading = createMemo(() => eligible() && (!key() || accountUsage.loading))
  return { eligible, key, accountUsage, loading }
}

export interface ComposerModelSelectorProps {
  onModelAvailabilityChange: (available: boolean) => void
}

export function ComposerModelSelector(props: ComposerModelSelectorProps) {
  const disclosure = useDisclosure()
  const [slotRef, setSlotRef] = createSignal<HTMLElement>()
  const [providerLoading, setProviderLoading] = createSignal(false)
  const [query, setQuery] = createSignal("")
  let searchInputRef: HTMLInputElement | undefined
  const taskID = createMemo(() => activeTaskID().trim())
  const selectedModel = createMemo(() => appStore.composerModel)
  createEffect(() => {
    props.onModelAvailabilityChange(Boolean(selectedModel().trim()))
  })
  const modelLabel = createMemo(() => selectedModel() || t("model_selector.model_choose"))
  const accountUsage = createProviderAccountUsageState(selectedModel, taskID)
  const groups = createMemo(mirrorProviderGroups)
  const filteredGroups = createMemo(() => {
    const search = query()
    return groups()
      .map((group) => ({
        ...group,
        models: fuzzySearch(group.models, search, (modelID) => `${modelID} ${group.providerID} ${group.providerName}`),
      }))
      .filter((group) => group.models.length > 0)
  })

  async function ensureProviderInfoLoaded(): Promise<void> {
    if (providerLoading()) return
    if (appStore.providerCatalog) return
    setProviderLoading(true)
    try {
      await loadProviderInfo(undefined, {
        directory: activeDirectory().trim(),
        isCurrentDirectory: (directory) => activeDirectory().trim() === directory,
      })
    } finally {
      setProviderLoading(false)
    }
  }

  function open() {
    runModelSelectorAction("composer-provider-info", ensureProviderInfoLoaded)
    disclosure.openIt()
    queueMicrotask(() => searchInputRef?.focus())
  }

  async function pickModel(value: string) {
    if (value === selectedModel()) {
      disclosure.close()
      return
    }
    await selectComposerModel(value)
    disclosure.close()
  }

  function configureProvider() {
    disclosure.close()
    openConfigDialog("providers")
  }

  return (
    <Popover.Root
      open={disclosure.open()}
      onOpenChange={(openState) => {
        if (openState) {
          open()
          return
        }
        setQuery("")
        disclosure.close()
      }}
      anchorRef={slotRef}
      placement="top-start"
      gutter={6}
      slide={false}
      fitViewport
    >
      <div
        ref={setSlotRef}
        class="composer-model-selector"
        data-ui="composer-model-selector"
        data-requires-selection={!selectedModel() ? "true" : undefined}
      >
        <Tooltip.Root disabled={!accountUsage.eligible()} openDelay={250} closeDelay={120} placement="top" gutter={7}>
          <Tooltip.Trigger as="div" class="composer-model-usage-trigger">
            <Popover.Trigger
              as={Button}
              type="button"
              variant="outline"
              size="sm"
              tone="neutral"
              data-ui="composer-model-selector-trigger"
              title={t("model_selector.model_chip_title", { model: modelLabel() })}
              aria-label={t("model_selector.model_chip_aria", { model: modelLabel() })}
            >
              <span class="composer-model-selector-copy">
                <span class="composer-model-selector-value" title={modelLabel()}>
                  {modelLabel()}
                </span>
              </span>
              <Icon name="chevron-down" size="medium" />
            </Popover.Trigger>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content class="card-meta-tooltip composer-model-usage-tooltip">
              <ProviderAccountUsageTooltip
                providerID={splitModelID(selectedModel()).provider}
                response={accountUsage.accountUsage()}
                loading={accountUsage.loading()}
                error={accountUsage.accountUsage.error}
              />
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
      </div>
      <Popover.Portal>
        <Popover.Content class="model-selector-popover composer-model-selector-popover">
          <div class="model-selector-search">
            <SearchField
              value={query()}
              onValueChange={setQuery}
              onClear={() => searchInputRef?.focus()}
              placeholder={t("model_selector.search_placeholder")}
              size="sm"
              inputRef={(element) => {
                searchInputRef = element
              }}
              inputDataUI="model-selector-search-input"
              clearDataUI="model-selector-search-clear"
            />
          </div>
          <Show
            when={groups().length > 0}
            fallback={
              <div class="model-selector-popover-empty">
                {providerLoading() ? t("common.loading") : t("model_selector.no_connected_providers")}
              </div>
            }
          >
            <Show
              when={filteredGroups().length > 0}
              fallback={<div class="model-selector-popover-empty">{t("model_selector.no_matches")}</div>}
            >
              <div class="model-selector-popover-body">
                <For each={filteredGroups()}>
                  {(group) => <ProviderModelGroup group={group} currentModel={selectedModel()} onPick={pickModel} />}
                </For>
              </div>
            </Show>
          </Show>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            tone="neutral"
            class="composer-model-configure-provider"
            data-ui="composer-model-configure-provider"
            onClick={configureProvider}
          >
            <span class="composer-model-configure-provider-copy">
              <span>{t("model_selector.configure_provider")}</span>
              <small>{t("model_selector.configure_provider_description")}</small>
            </span>
          </Button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

interface ProviderModelGroupProps {
  group: ProviderGroup
  currentModel: string
  disabled?: boolean
  onPick: (modelID: string) => void | Promise<void>
}

function ProviderModelGroup(props: ProviderModelGroupProps) {
  const options = createMemo<ModelOption[]>(() =>
    props.group.models.map((modelID) => ({
      id: modelID,
    })),
  )
  const selectedOption = createMemo(() => options().find((option) => option.id === props.currentModel) ?? null)
  const selectedKeys = createMemo(() => {
    const option = selectedOption()
    return option ? [option.id] : []
  })

  return (
    <div class="model-selector-popover-group" data-provider-id={props.group.providerID}>
      <div class="model-selector-popover-group-header">
        <span class="model-selector-provider-mark" aria-hidden="true">
          {props.group.providerName.slice(0, 1).toUpperCase()}
        </span>
        <span class="model-selector-popover-group-copy">
          <span class="model-selector-popover-group-name oc-section-heading">{props.group.providerName}</span>
          <span class="model-selector-popover-group-id">{props.group.providerID}</span>
        </span>
        <span class="model-selector-popover-group-count">
          {t(options().length === 1 ? "provider.models.count_one" : "provider.models.count", {
            count: options().length,
          })}
        </span>
      </div>
      <ListboxRoot<ModelOption>
        class="model-selector-listbox"
        density="default"
        aria-label={props.group.providerName}
        options={options()}
        value={selectedKeys()}
        optionValue={(option) => option.id}
        optionTextValue={(option) => option.id}
        optionDisabled={() => !!props.disabled}
        disallowEmptySelection={options().length > 0}
        allowDuplicateSelectionEvents
        shouldFocusWrap
        onChange={(keys) => {
          const modelID = [...keys][0]
          if (modelID) runModelSelectorAction(`pick-model:${props.group.providerID}`, () => props.onPick(modelID))
        }}
        renderItem={(node) => {
          const option = node.rawValue as ModelOption
          return (
            <ListboxItem
              item={node}
              as="button"
              type="button"
              class="model-selector-option"
              data-model-value={option.id}
            >
              <span class="composer-picker-option-icon" aria-hidden="true">
                <Icon name="config-agent-models" size="compact" />
              </span>
              <span class="composer-picker-option-label">{option.id}</span>
              <Show when={option.id === props.currentModel}>
                <Icon class="model-selector-option-check" name="check" size="compact" />
              </Show>
            </ListboxItem>
          )
        }}
      />
    </div>
  )
}
