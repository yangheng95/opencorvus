import { createEffect, createMemo, createSignal, For, on, Show, type JSX } from "solid-js"
import type { VisibleComposerReferences } from "@opencorvus-ai/transport-protocol"
import { captureApiAuthority } from "../services/api"
import type { ExpertSquadMarketIndexItem, ExpertSquadMarketInstallOutcome, ExpertSquadOption } from "../services/expert-squad"
import { createExpertSquadMarketRecommendations } from "../services/expert-squad-market-recommendations"
import type { ComposerExpertSquadPackage, ComposerExpertSquadSearch } from "../services/composer-expert-squad-catalog"
import { setComposerMentionDirectiveSelected, type ComposerMentionKind } from "../services/composer-mention"
import { fuzzySearch } from "../services/fuzzy-search"
import { matchesSearchTerms } from "../services/text-search"
import { t } from "../utils/i18n"
import { expertSquadDescription } from "../utils/expert-squad-description"
import { missionSkillDescription } from "../utils/mission-skill-description"
import { Button } from "./ui/Button"
import { Icon } from "./ui/Icon"
import { ListboxItem, ListboxRoot, ListboxSection } from "./ui/Listbox"
import { Popover } from "./ui/Popover"
import { SearchField } from "./ui/SearchField"
import { Badge } from "./ui/Badge"
import { Disclosure } from "./ui/Disclosure"
import { ComposerReferenceFeedback } from "./ComposerReferenceFeedback"
import { ExpertSquadMarketSearchFeedback } from "./ExpertSquadMarketSearchFeedback"
import { ExpertSquadMarketInstallFeedback } from "./ExpertSquadMarketInstallFeedback"

export interface ComposerReferenceSkillOption {
  name: string
  description?: string
}

interface ComposerReferenceOption {
  key: string
  kind: ComposerMentionKind
  id: string
  label: string
  description?: string
  sourceDescription?: string
  typeLabel: string
  systemRole?: "expert_squad_generator"
  outsideSearch?: boolean
}

interface ComposerReferenceGroup {
  kind: "skills" | "expert-squads"
  label: string
  options: ComposerReferenceOption[]
}

export interface ComposerReferenceSelectorProps {
  contextLabel?: string
  controls?: JSX.Element
  text: string
  onTextChange?: (text: string) => void
  skills: readonly ComposerReferenceSkillOption[]
  missionSkills: readonly ComposerReferenceSkillOption[]
  expertSquads: readonly ExpertSquadOption[]
  expertSquadSearch: ComposerExpertSquadSearch
  referenceCatalogKey: string
  referenceCatalogScopeKey: string
  onExpertSquadQuery?: (query: string, selectedExpertSquadIDs: readonly string[]) => void
  onInstallMoreExpertSquads?: () => void
  // Searching only what is installed answers "which of mine fits" when the
  // question is usually "is there one for this". The catalog the operator has
  // not installed yet is reachable from the same box they are already typing in.
  onMarketExpertSquadQuery?: (query: string) => Promise<readonly ExpertSquadMarketIndexItem[]>
  onInstallMarketExpertSquad?: (item: ExpertSquadMarketIndexItem) => Promise<ExpertSquadMarketInstallOutcome>
  activePackage?: ComposerExpertSquadPackage | null
  referenceOrigin?: "task-request" | "first-message"
  launchReferences: VisibleComposerReferences
  readOnly: boolean
  disabled?: boolean
  catalogError?: string
  onCatalogRetry?: (query: string, selectedExpertSquadIDs: readonly string[]) => void
}

export function ComposerReferenceSelector(props: ComposerReferenceSelectorProps) {
  const [open, setOpen] = createSignal(false)
  const [query, setQuery] = createSignal("")
  const [referencesOpen, setReferencesOpen] = createSignal(false)
  const [anchorRef, setAnchorRef] = createSignal<HTMLElement>()
  let searchInputRef: HTMLInputElement | undefined
  let listboxElement: HTMLUListElement | undefined
  let resultsElement: HTMLDivElement | undefined

  const skillOptions = createMemo<ComposerReferenceOption[]>(() => [
    ...props.skills.map((skill) => ({
      key: `skill:${skill.name}`,
      kind: "skill" as const,
      id: skill.name,
      label: skill.name,
      description: skill.description,
      typeLabel: t("chat.references.skill"),
    })),
    ...props.missionSkills.map((skill) => ({
      key: `mission-skill:${skill.name}`,
      kind: "mission-skill" as const,
      id: skill.name,
      label: skill.name,
      description: missionSkillDescription(skill),
      sourceDescription: skill.description,
      typeLabel: t("mission_skill.label"),
    })),
  ])
  const squadOptions = createMemo<ComposerReferenceOption[]>(() =>
    props.expertSquads.map((squad) => ({
      key: `squad:${squad.id}`,
      kind: "squad" as const,
      id: squad.id,
      label: squad.name,
      description: expertSquadDescription(squad),
      typeLabel: t("chat.references.expert_squad"),
      systemRole: squad.system_role,
    })),
  )
  const selectedKeys = createMemo(() => {
    const references = props.launchReferences
    return new Set([
      ...references.skillNames.map((name) => `skill:${name}`),
      ...references.missionSkillNames.map((name) => `mission-skill:${name}`),
      ...references.expertSquadIDs.map((id) => `squad:${id}`),
    ])
  })
  const selectedCount = createMemo(() => selectedKeys().size)
  const filteredSkillOptions = createMemo(() => {
    const options = skillOptions()
    const text = query()
    const nameMatches = fuzzySearch(options, text, (option) => option.label)
    if (!text.trim()) return nameMatches
    const descriptionMatches = options.filter((option) =>
      option.kind === "mission-skill" &&
      !nameMatches.includes(option) &&
      matchesSearchTerms(text, [option.description, option.sourceDescription]),
    )
    return [...nameMatches, ...descriptionMatches]
  })
  const squadSearchCurrent = () => props.expertSquadSearch.query === query().trim()
  const squadSearchLoading = () => !squadSearchCurrent() || props.expertSquadSearch.status === "pending"
  const filteredSquadOptions = createMemo(() => {
    const options = squadOptions()
    const byID = new Map(options.map((option) => [option.id, option]))
    const matchingIDs =
      squadSearchCurrent() && props.expertSquadSearch.status === "ready" ? props.expertSquadSearch.matchingIDs : []
    const matching = new Set(matchingIDs)
    return [
      ...matchingIDs.flatMap((id) => {
        const option = byID.get(id)
        return option ? [option] : []
      }),
      ...options
        .filter((option) => selectedKeys().has(option.key) && !matching.has(option.id))
        .map((option) => ({
          ...option,
          outsideSearch: squadSearchCurrent() && props.expertSquadSearch.status === "ready",
        })),
    ]
  })
  const retryCatalog = () => props.onCatalogRetry?.(query(), props.launchReferences.expertSquadIDs)
  const editableGroups = createMemo<ComposerReferenceGroup[]>(() => [
    ...(filteredSkillOptions().length > 0
      ? [{ kind: "skills" as const, label: t("chat.references.skills"), options: filteredSkillOptions() }]
      : []),
    ...(filteredSquadOptions().length > 0
      ? [
          {
            kind: "expert-squads" as const,
            label: t("chat.references.expert_squads"),
            options: filteredSquadOptions(),
          },
        ]
      : []),
  ])
  const visibleReferenceOptions = createMemo(() => editableGroups().flatMap((group) => group.options))
  const selectedVisibleKeys = createMemo(() =>
    visibleReferenceOptions()
      .filter((option) => selectedKeys().has(option.key))
      .map((option) => option.key),
  )
  const readOnlyOptions = createMemo<ComposerReferenceOption[]>(() => {
    const byKey = new Map([...skillOptions(), ...squadOptions()].map((option) => [option.key, option]))
    return [...selectedKeys()].map(
      (key) =>
        byKey.get(key) ?? {
          key,
          kind: key.slice(0, key.indexOf(":")) as ComposerMentionKind,
          id: key.slice(key.indexOf(":") + 1),
          label: key.slice(key.indexOf(":") + 1),
          typeLabel: key.startsWith("squad:")
            ? t("chat.references.expert_squad")
            : key.startsWith("mission-skill:")
              ? t("mission_skill.label")
              : t("chat.references.skill"),
        },
    )
  })

  const [marketActionError, setMarketActionError] = createSignal("")
  const [marketInstallOutcome, setMarketInstallOutcome] = createSignal<ExpertSquadMarketInstallOutcome>()
  const [marketInstall, setMarketInstall] = createSignal<{
    scopeKey: string
    query: string
    item: ExpertSquadMarketIndexItem
  }>()
  const activeMarketInstall = () => {
    const attempt = marketInstall()
    return attempt?.scopeKey === props.referenceCatalogScopeKey ? attempt : undefined
  }
  const marketQuery = () => query().trim().slice(0, 500)
  createEffect(
    on(
      [() => props.referenceCatalogScopeKey, () => props.referenceCatalogKey],
      ([scopeKey], previous) => {
        if (scopeKey !== previous?.[0]) {
          setQuery("")
          setMarketInstall(undefined)
          setMarketInstallOutcome(undefined)
        }
        if (open() && !props.readOnly) props.onExpertSquadQuery?.(query(), props.launchReferences.expertSquadIDs)
      },
    ),
  )

  const marketSource = createMemo(() => {
    const search = props.onMarketExpertSquadQuery
    const text = marketQuery()
    if (!open() || props.readOnly || !search || !props.referenceCatalogKey || text.length < 2) return undefined
    return { authority: captureApiAuthority(), load: () => search(text) }
  })
  const market = createExpertSquadMarketRecommendations(marketSource, () => searchInputRef)
  const marketItems = createMemo(() => {
    const items = market.items()
    const attempt = activeMarketInstall()
    if (!attempt || attempt.query !== marketQuery() || items.includes(attempt.item)) return items
    return [attempt.item, ...items.filter((item) => item.id !== attempt.item.id)]
  })
  const marketActionBusy = () => market.loading() || !!activeMarketInstall()
  createEffect(on(marketSource, () => setMarketActionError("")))

  async function installFromMarket(item: ExpertSquadMarketIndexItem, trigger: HTMLButtonElement): Promise<void> {
    const install = props.onInstallMarketExpertSquad
    const scopeKey = props.referenceCatalogScopeKey
    if (!install || !scopeKey || marketActionBusy()) return
    const attempt = { scopeKey, query: marketQuery(), item }
    const owns = () => activeMarketInstall() === attempt && open() && !props.readOnly
    const origin = document.activeElement === trigger ? trigger : undefined
    setMarketInstall(attempt)
    setMarketActionError("")
    setMarketInstallOutcome(undefined)
    try {
      const outcome = await install(item)
      if (!owns()) return
      if (outcome.kind !== "receipt") setMarketInstallOutcome(outcome)
      if (outcome.kind === "unconfirmed") return
      if (attempt.query === marketQuery() && origin && document.activeElement === origin && searchInputRef?.isConnected) {
        searchInputRef.focus()
      }
    } catch (error) {
      if (owns()) setMarketActionError(error instanceof Error ? error.message : String(error))
    } finally {
      setMarketInstall((current) => current === attempt ? undefined : current)
    }
  }

  function updateOpen(next: boolean): void {
    setOpen(next)
    if (!next) {
      setQuery("")
      setMarketActionError("")
      setMarketInstallOutcome(undefined)
      props.onExpertSquadQuery?.("", props.launchReferences.expertSquadIDs)
      return
    }
    if (!props.readOnly) setReferencesOpen(selectedCount() > 0)
  }

  function applyListboxSelection(keys: Set<string>): void {
    if (!props.onTextChange) return
    let next = props.text
    for (const option of visibleReferenceOptions()) {
      next = setComposerMentionDirectiveSelected(next, option.kind, option.id, keys.has(option.key))
    }
    if (next !== props.text) props.onTextChange(next)
  }

  function handleReferenceEscape(event: KeyboardEvent): boolean {
    if (event.key !== "Escape") return false
    event.preventDefault()
    event.stopPropagation()
    updateOpen(false)
    return true
  }

  function triggerLabel(): string {
    if (props.readOnly && props.activePackage) return props.activePackage.name
    if (props.contextLabel) return props.contextLabel
    return t(props.readOnly ? "chat.references.view" : "chat.references.trigger")
  }

  function renderOptionCopy(option: ComposerReferenceOption) {
    return (
      <>
        <span
          class="composer-reference-option-icon"
          data-reference-kind={option.kind}
          data-system-role={option.systemRole}
          aria-hidden="true"
        >
          <Icon
            name={
              option.systemRole === "expert_squad_generator"
                ? "config-expert-squad-install"
                : option.kind === "squad"
                  ? "expert-squad"
                  : "config-skill"
            }
            size="compact"
          />
        </span>
        <span class="composer-reference-option-copy">
          <span class="composer-reference-option-heading">
            <span class="composer-reference-option-name">{option.label}</span>
            <Show when={option.outsideSearch}>
              <Badge size="sm">{t("chat.references.selected_outside_search")}</Badge>
            </Show>
            <Show when={option.systemRole === "expert_squad_generator"}>
              <Badge class="composer-reference-option-system-badge" tone="accent" size="sm">
                {t("chat.references.generator")}
              </Badge>
            </Show>
            <span class="composer-reference-option-meta">
              {option.typeLabel}
              <Show when={option.id !== option.label}> · {option.id}</Show>
            </span>
          </span>
          <Show when={option.description}>
            <span class="composer-reference-option-description">{option.description}</span>
          </Show>
        </span>
      </>
    )
  }

  function renderReadOnlyOption(option: ComposerReferenceOption) {
    return (
      <div class="composer-reference-option" data-read-only="true">
        {renderOptionCopy(option)}
      </div>
    )
  }

  function openExpertSquadMarket(): void {
    updateOpen(false)
    props.onInstallMoreExpertSquads?.()
  }

  return (
    <Popover.Root
      open={open()}
      onOpenChange={updateOpen}
      anchorRef={anchorRef}
      placement="top-start"
      gutter={6}
      slide={false}
      fitViewport
    >
      <div ref={setAnchorRef} class="composer-reference-selector" data-ui="composer-reference-selector">
        <Popover.Trigger
          as={Button}
          type="button"
          variant="outline"
          size="sm"
          tone="neutral"
          class="composer-reference-trigger"
          data-ui={props.readOnly ? "composer-reference-view-trigger" : "composer-reference-select-trigger"}
          disabled={props.disabled}
          title={triggerLabel()}
          aria-label={triggerLabel()}
        >
          <Icon name={props.activePackage ? "expert-squad" : "expert-squad-catalog"} size="compact" />
          <span class="composer-reference-trigger-label">{triggerLabel()}</span>
          <Show when={!props.readOnly && selectedCount() > 0}>
            <span class="composer-reference-trigger-count">{selectedCount()}</span>
          </Show>
        </Popover.Trigger>
      </div>
      <Popover.Portal>
        <Popover.Content class="composer-reference-popover" data-editable={props.readOnly ? undefined : "true"}>
          <Show when={props.controls}>
            <div class="composer-reference-controls">{props.controls}</div>
          </Show>
          <Show when={props.readOnly}>
            <ComposerReferenceFeedback
              error={props.catalogError}
              onRetry={props.onCatalogRetry ? retryCatalog : undefined}
            />
          </Show>
          <Show when={props.readOnly}>
            <div class="composer-reference-popover-heading">
              <div class="composer-reference-heading-line">
                <span class="oc-section-heading">
                  {t(props.readOnly ? "chat.references.context_title" : "chat.references.title")}
                </span>
                <Show when={props.readOnly && props.contextLabel}>
                  <span class="composer-reference-context">{props.contextLabel}</span>
                </Show>
              </div>
              <span>
                {t(
                  props.readOnly
                    ? props.referenceOrigin === "task-request"
                      ? "chat.references.task_request_hint"
                      : "chat.references.read_only_hint"
                    : "chat.references.selection_hint",
                )}
              </span>
            </div>
          </Show>
          <Show when={props.readOnly && props.activePackage}>
            {(assigned) => (
              <div class="composer-reference-popover-heading">
                <div>
                  <span class="oc-section-heading">
                    {t(
                      props.referenceOrigin === "task-request"
                        ? "chat.references.task_assignment"
                        : "chat.references.current_assignment",
                    )}
                  </span>
                  <div>{assigned().name}</div>
                  <div>
                    {assigned().revision.namespace}/{assigned().revision.id} · {assigned().revision.version}
                  </div>
                </div>
              </div>
            )}
          </Show>
          <Show when={props.readOnly && readOnlyOptions().length > 0}>
            <div class="composer-reference-popover-heading">
              <span class="oc-section-heading">
                {t(
                  props.referenceOrigin === "task-request"
                    ? "chat.references.task_request_title"
                    : "chat.references.first_message_title",
                )}
              </span>
            </div>
          </Show>
          <Show
            when={!props.readOnly}
            fallback={
              <Show
                when={readOnlyOptions().length > 0}
                fallback={
                  <div class="composer-reference-empty">
                    {t(
                      props.referenceOrigin === "task-request"
                        ? "chat.references.task_request_empty"
                        : "chat.references.none_selected",
                    )}
                  </div>
                }
              >
                <div class="composer-reference-list" data-ui="composer-reference-read-only-list">
                  <For each={readOnlyOptions()}>{renderReadOnlyOption}</For>
                </div>
              </Show>
            }
          >
            <p class="composer-intent-description">{t("chat.references.optional_hint")}</p>
            <Disclosure.Root
              class="composer-optional-references"
              open={referencesOpen()}
              onOpenChange={(next) => {
                setReferencesOpen(next)
                if (next) queueMicrotask(() => searchInputRef?.focus())
              }}
            >
              <Disclosure.Trigger>
                {t("chat.references.title")}
                <Show when={selectedCount() > 0}>
                  <Badge size="sm">{selectedCount()}</Badge>
                </Show>
              </Disclosure.Trigger>
              <Disclosure.Content>
                <div class="composer-reference-search">
                  <SearchField
                    clearable
                    value={query()}
                    onValueChange={(value) => {
                      setQuery(value)
                      props.onExpertSquadQuery?.(value, props.launchReferences.expertSquadIDs)
                    }}
                    placeholder={t("chat.references.search_placeholder")}
                    size="sm"
                    inputRef={(element) => {
                      searchInputRef = element
                    }}
                    onKeyDown={(event) => {
                      if (handleReferenceEscape(event)) return
                      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return
                      const options = listboxElement?.querySelectorAll<HTMLElement>(
                        '[role="option"]:not([aria-disabled="true"])',
                      )
                      const target = event.key === "ArrowDown" ? options?.[0] : options?.[options.length - 1]
                      if (!target) return
                      event.preventDefault()
                      target.focus()
                    }}
                    inputDataUI="composer-reference-search-input"
                    clearDataUI="composer-reference-search-clear"
                  />
                </div>
                <ComposerReferenceFeedback
                  error={props.catalogError}
                  onRetry={props.onCatalogRetry ? retryCatalog : undefined}
                />
                <Show when={squadSearchLoading()}>
                  <div class="composer-reference-empty" role="status">
                    {t("expert_squad.loading")}
                  </div>
                </Show>
                <div ref={resultsElement} class="composer-reference-results">
                  <Show when={editableGroups().length > 0}>
                    <ListboxRoot<ComposerReferenceOption, ComposerReferenceGroup>
                      ref={listboxElement}
                      scrollRef={() => resultsElement}
                      class="composer-reference-listbox"
                      id="composerReferenceListbox"
                      density="rich"
                      aria-label={t("chat.references.title")}
                      options={editableGroups()}
                      optionGroupChildren="options"
                      optionValue={(option) => option.key}
                      optionTextValue={(option) => option.label}
                      value={selectedVisibleKeys()}
                      selectionMode="multiple"
                      selectionBehavior="toggle"
                      shouldFocusWrap
                      allowDuplicateSelectionEvents
                      onChange={applyListboxSelection}
                      onKeyDown={handleReferenceEscape}
                      renderSection={(section) => (
                        <ListboxSection class="composer-reference-section" data-reference-group={section.rawValue.kind}>
                          <span class="composer-reference-section-title">{section.rawValue.label}</span>
                        </ListboxSection>
                      )}
                      renderItem={(node) => {
                        const option = node.rawValue as ComposerReferenceOption
                        return (
                          <ListboxItem
                            item={node}
                            class="composer-reference-option"
                            data-reference-key={option.key}
                            data-reference-kind={option.kind}
                            data-system-role={option.systemRole}
                          >
                            <span class="composer-reference-option-selection" aria-hidden="true">
                              <Show when={selectedKeys().has(option.key)}>
                                <Icon name="check" size="compact" />
                              </Show>
                            </span>
                            {renderOptionCopy(option)}
                          </ListboxItem>
                        )
                      }}
                    />
                  </Show>
                  <Show
                    when={
                      filteredSkillOptions().length === 0 &&
                      filteredSquadOptions().every((option) => option.outsideSearch) &&
                      marketItems().length === 0 &&
                      !market.loading() &&
                      !market.failure() &&
                      !squadSearchLoading() &&
                      !props.catalogError
                    }
                  >
                    <div class="composer-reference-empty">{t("chat.references.no_matches")}</div>
                  </Show>
                  <Show when={market.loading() || market.failure() || marketActionError() || marketInstallOutcome() || marketItems().length > 0}>
                    <div class="composer-reference-market" data-ui="composer-reference-market">
                      <div class="composer-reference-market-head">
                        <span>{t("chat.references.market_results")}</span>
                        <Show when={market.loading() && !market.failure()}>
                          <Icon name="loading" size="compact" />
                        </Show>
                      </div>
                      <ExpertSquadMarketSearchFeedback failure={market.failure()} loading={market.loading()} onRetry={market.retry} />
                      <ExpertSquadMarketInstallFeedback outcome={marketInstallOutcome()} />
                      <Show when={marketActionError()}>
                        <div class="composer-reference-market-error">{marketActionError()}</div>
                      </Show>
                      <For each={marketItems()}>
                        {(item) => (
                          <div class="composer-reference-option" data-reference-kind="market">
                            <span class="composer-reference-option-selection" aria-hidden="true" />
                            <span
                              class="composer-reference-option-icon"
                              data-reference-kind="market"
                              aria-hidden="true"
                            >
                              <Icon name="expert-squad-catalog" size="compact" />
                            </span>
                            <span class="composer-reference-option-copy">
                              <span class="composer-reference-option-heading">
                                <span class="composer-reference-option-name">{item.name}</span>
                                <span class="composer-reference-option-meta">{t("expert_squad.market")}</span>
                              </span>
                              <span class="composer-reference-option-description">{expertSquadDescription(item)}</span>
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              tone="accent"
                              aria-disabled={marketActionBusy() || undefined}
                              aria-busy={activeMarketInstall()?.item === item || undefined}
                              onClick={(event) => void installFromMarket(item, event.currentTarget)}
                            >
                              <Show when={activeMarketInstall()?.item === item}>
                                <Icon name="loading" size="compact" />
                              </Show>
                              {t("chat.references.market_install")}
                            </Button>
                          </div>
                        )}
                      </For>
                    </div>
                  </Show>
                  <Button
                    type="button"
                    variant="ghost"
                    size="md"
                    tone="neutral"
                    class="composer-reference-option"
                    data-ui="composer-reference-install-more"
                    data-reference-kind="action"
                    onClick={openExpertSquadMarket}
                  >
                    <span class="composer-reference-option-selection" aria-hidden="true" />
                    <span class="composer-reference-option-icon" data-reference-kind="action" aria-hidden="true">
                      <Icon name="config-expert-squad-install" size="compact" />
                    </span>
                    <span class="composer-reference-option-copy">
                      <span class="composer-reference-option-heading">
                        <span class="composer-reference-option-name">{t("chat.references.install_more")}</span>
                        <span class="composer-reference-option-meta">{t("expert_squad.market")}</span>
                      </span>
                      <span class="composer-reference-option-description">
                        {t("chat.references.install_more_description")}
                      </span>
                    </span>
                  </Button>
                </div>
              </Disclosure.Content>
            </Disclosure.Root>
          </Show>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
