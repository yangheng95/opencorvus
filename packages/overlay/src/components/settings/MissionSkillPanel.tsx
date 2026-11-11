import { Feedback } from "../ui/Feedback"
import type { MissionSkillSettingsResponse } from "@opencorvus-ai/sdk"
import { For, Show, batch, createEffect, createMemo, createSignal, onCleanup, untrack } from "solid-js"
import { captureApiAuthority, isApiAuthorityCurrent } from "../../services/api"
import { expertSquadSettingsScope, type ExpertSquadCatalogScopeState } from "../../services/expert-squad-scope"
import { ensureMissionSkillDirectory, loadMissionSkillSettings } from "../../services/mission-skill"
import { matchesSearchTerms } from "../../services/text-search"
import { pathRevealFailureKey, pathRevealLabelKey, pathRevealNoticeKey, revealPath } from "../../services/workspace"
import { appStore } from "../../store/app"
import { formatErrorDetails } from "../../utils/error-details"
import { t, tc } from "../../utils/i18n"
import { missionSkillDescription } from "../../utils/mission-skill-description"
import { Badge } from "../ui/Badge"
import { Disclosure } from "../ui/Disclosure"
import { Button } from "../ui/Button"
import { Icon } from "../ui/Icon"
import { SearchField } from "../ui/SearchField"
import { copyText } from "../../services/clipboard"
import {
  SettingsEmpty,
  SettingsGroup,
  SettingsPanel,
  SettingsRow,
  SettingsSurface,
  SettingsToolbar,
  SettingsReferenceList,
} from "./layout"

type MissionSkillSettingsItem = MissionSkillSettingsResponse["mission_skills"][number]
type MissionSkillSource = MissionSkillSettingsItem["source"]
type MissionSkillFilter = "all" | MissionSkillSource
type MissionSkillAction = "invocation" | "source" | "project-root" | "global-root"
type MissionSkillActionResult = { action: MissionSkillAction } & (
  | { status: "invocation-copied"; name: string }
  | { status: "path-copied"; label: Exclude<ReturnType<typeof pathRevealNoticeKey>, "">; path: string }
  | { status: "failed"; label: ReturnType<typeof pathRevealFailureKey> | "mission_skill.copy_failed"; cause: unknown }
)

function MissionSkillActionFeedback(props: { result: MissionSkillActionResult | undefined }) {
  return (
    <Show when={props.result}>
      {(value) => {
        const failure = () => {
          const result = value()
          return result.status === "failed" ? formatErrorDetails(result.cause) : undefined
        }
        const message = () => {
          const result = value()
          if (result.status === "failed") return t(result.label)
          if (result.status === "invocation-copied") return t("mission_skill.copied", { name: result.name })
          return t(result.label, { path: result.path })
        }
        return (
          <Feedback
            class="mission-skill-action-feedback"
            tone={value().status === "failed" ? "error" : "success"}
            details={failure()}
          >
            {message()}
          </Feedback>
        )
      }}
    </Show>
  )
}

const catalogIssueLabels = {
  invalid_mission_skill: "mission_skill.issue.invalid",
  duplicate_mission_skill: "mission_skill.issue.duplicate",
  mission_skill_shadowed: "mission_skill.issue.shadowed",
  mission_skill_scan_failed: "mission_skill.issue.scan_failed",
} satisfies Record<MissionSkillSettingsResponse["issues"][number]["kind"], string>

function scopeIdentity(scope: ExpertSquadCatalogScopeState): string {
  if (scope.kind === "session") return `session:${scope.directory}:${scope.sessionID}`
  if (scope.kind === "project") return `project:${scope.directory}`
  if (scope.kind === "pending") return `pending:${scope.directory}:${scope.taskID}`
  return "unavailable"
}

function sourceLabel(source: MissionSkillSource): string {
  if (source === "built_in") return t("mission_skill.source.built_in")
  if (source === "project") return t("mission_skill.source.project")
  return t("mission_skill.source.global")
}

function filterLabel(filter: MissionSkillFilter): string {
  return filter === "all" ? t("mission_skill.filter.all") : sourceLabel(filter)
}

function invocation(name: string): string {
  return `@mission(${JSON.stringify(name)})`
}

export default function MissionSkillPanel() {
  const currentScope = createMemo(expertSquadSettingsScope)
  const currentScopeIdentity = createMemo(() => `${captureApiAuthority().revision}:${scopeIdentity(currentScope())}`)
  const [catalog, setCatalog] = createSignal<MissionSkillSettingsResponse | null>(null)
  const [catalogIdentity, setCatalogIdentity] = createSignal("")
  const [selectedName, setSelectedName] = createSignal<string>()
  const detailOpen = () => selectedName() !== undefined
  const [query, setQuery] = createSignal("")
  const [filter, setFilter] = createSignal<MissionSkillFilter>("all")
  const [loading, setLoading] = createSignal(false)
  const [readFailure, setReadFailure] = createSignal<{ cause: unknown }>()
  const [actionResult, setActionResult] = createSignal<MissionSkillActionResult>()
  const resultFor = (action: MissionSkillAction) => {
    const current = actionResult()
    return current?.action === action ? current : undefined
  }
  let loadSequence = 0
  let operationGeneration = 0
  let focusGeneration = 0
  let panel: HTMLDivElement | undefined
  let detailSurface: HTMLDivElement | undefined
  let detailHeading: HTMLHeadingElement | undefined
  let searchInput: HTMLInputElement | undefined
  onCleanup(() => {
    loadSequence++
    operationGeneration++
    focusGeneration++
  })

  const scopedCatalog = createMemo(() => (catalogIdentity() === currentScopeIdentity() ? catalog() : null))
  const skills = createMemo(() => scopedCatalog()?.mission_skills ?? [])
  const catalogIssues = createMemo(() => scopedCatalog()?.issues ?? [])
  const filteredSkills = createMemo(() => {
    const term = query().trim()
    const source = filter()
    return skills().filter((skill) => {
      if (source !== "all" && skill.source !== source) return false
      return !term || matchesSearchTerms(term, [
        skill.name, missionSkillDescription(skill), skill.description, sourceLabel(skill.source), ...skill.required_tools,
      ])
    })
  })
  const selectedSkill = createMemo(() => {
    const name = selectedName()
    return name === undefined ? undefined : skills().find((skill) => skill.name === name)
  })

  function changeCatalogView(change: () => void, target: () => HTMLElement | null | undefined) {
    const scope = currentScopeIdentity()
    const origin = document.activeElement
    const generation = ++focusGeneration
    change()
    queueMicrotask(() => {
      if (generation !== focusGeneration || currentScopeIdentity() !== scope || !panel?.isConnected) return
      if (document.activeElement !== origin && document.activeElement !== document.body) return
      const element = target()
      if (element?.isConnected) element.focus()
    })
  }

  function openDetail(name: string) {
    changeCatalogView(
      () => setSelectedName(name),
      () => selectedName() === name ? detailHeading : undefined,
    )
  }

  function returnToCatalog() {
    const name = selectedName()
    if (name === undefined) return
    changeCatalogView(
      () => setSelectedName(undefined),
      () => !detailOpen()
        ? panel?.querySelector<HTMLButtonElement>(`[data-skill-name="${CSS.escape(name)}"]`) ?? searchInput
        : undefined,
    )
  }

  function operationIdentity(skillName: string): string {
    return `${currentScopeIdentity()}\u0000${skillName}`
  }

  function beginOperation(skillName: string) {
    const authority = captureApiAuthority()
    const generation = ++operationGeneration
    const identity = operationIdentity(skillName)
    setActionResult(undefined)
    return {
      authority,
      owns: () =>
        generation === operationGeneration &&
        operationIdentity(skillName) === identity &&
        isApiAuthorityCurrent(authority),
    }
  }

  async function refresh(retryTrigger?: HTMLButtonElement): Promise<void> {
    const scope = currentScope()
    const expectedIdentity = currentScopeIdentity()
    const authority = captureApiAuthority()
    if (scope.kind === "unavailable") {
      loadSequence++
      setCatalog(null)
      setCatalogIdentity("")
      setLoading(false)
      setReadFailure(undefined)
      return
    }
    const sequence = ++loadSequence
    const owns = () =>
      sequence === loadSequence && currentScopeIdentity() === expectedIdentity && isApiAuthorityCurrent(authority)
    setLoading(true)
    try {
      const next = await loadMissionSkillSettings({ ...scope, authority })
      if (!owns()) return
      const accept = () =>
        batch(() => {
          setCatalog(next)
          setCatalogIdentity(expectedIdentity)
          setReadFailure(undefined)
        })
      const name = selectedName()
      const origin = document.activeElement
      const focusedSkillRemoved = origin && detailSurface?.contains(origin) && selectedSkill() &&
        !next.mission_skills.some((skill) => skill.name === name)
      if (origin && ((origin === retryTrigger && detailOpen()) || focusedSkillRemoved)) {
        changeCatalogView(accept, () => (!origin.isConnected && selectedName() === name ? detailHeading : undefined))
      } else {
        accept()
      }
    } catch (cause) {
      if (owns()) setReadFailure({ cause })
    } finally {
      if (owns()) setLoading(false)
    }
  }

  createEffect<string>((previousIdentity) => {
    const identity = currentScopeIdentity()
    if (identity === previousIdentity) return previousIdentity
    setSelectedName(undefined)
    setReadFailure(undefined)
    operationGeneration += 1
    focusGeneration += 1
    setActionResult(undefined)
    untrack(() => void refresh())
    return identity
  }, "")

  createEffect<string>((previousIdentity) => {
    const identity = operationIdentity(selectedSkill()?.name ?? "")
    if (identity === previousIdentity) return previousIdentity
    operationGeneration += 1
    setActionResult(undefined)
    return identity
  }, "")

  async function openPath(target: string, skillName: string): Promise<void> {
    const owner = beginOperation(skillName)
    try {
      if (!owner.owns()) return
      const outcome = await revealPath(target)
      if (!owner.owns()) return
      const label = pathRevealNoticeKey(outcome)
      if (label) setActionResult({ action: "source", status: "path-copied", label, path: target })
    } catch (cause) {
      if (!owner.owns()) return
      setActionResult({ action: "source", status: "failed", label: pathRevealFailureKey(), cause })
    }
  }

  async function openRoot(source: "global" | "project"): Promise<void> {
    const scope = currentScope()
    if (scope.kind === "unavailable") return
    const action = source === "project" ? "project-root" : "global-root"
    const owner = beginOperation(selectedSkill()?.name ?? "")
    try {
      const target = await ensureMissionSkillDirectory({ ...scope, authority: owner.authority }, source)
      if (!owner.owns()) return
      const outcome = await revealPath(target)
      if (!owner.owns()) return
      const label = pathRevealNoticeKey(outcome)
      if (label) setActionResult({ action, status: "path-copied", label, path: target })
    } catch (cause) {
      if (!owner.owns()) return
      setActionResult({ action, status: "failed", label: pathRevealFailureKey(), cause })
    }
  }

  async function copyInvocation(skill: MissionSkillSettingsItem): Promise<void> {
    const owner = beginOperation(skill.name)
    try {
      if (!owner.owns()) return
      await copyText(invocation(skill.name))
      if (!owner.owns()) return
      setActionResult({ action: "invocation", status: "invocation-copied", name: skill.name })
    } catch (cause) {
      if (!owner.owns()) return
      setActionResult({ action: "invocation", status: "failed", label: "mission_skill.copy_failed", cause })
    }
  }

  const scopeUnavailable = () => currentScope().kind === "unavailable"
  const refreshBusy = () => !scopeUnavailable() && loading()
  const scopeStatus = createMemo(() => {
    if (!scopeUnavailable()) return ""
    return t(appStore.connected ? "mission_skill.scope_unavailable" : "mission_skill.scope_disconnected")
  })

  return (
    <SettingsPanel ref={panel} class="general-panel mission-skill-panel" id="missionSkillBody" data-ui="mission-skill-settings">
      <Show when={!detailOpen()}>
        <SettingsToolbar>
          <p class="mission-skill-intro">{t("mission_skill.intro")}</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            tone="neutral"
            data-ui="mission-skill-refresh"
            disabled={scopeUnavailable()}
            aria-disabled={refreshBusy() || undefined}
            aria-busy={refreshBusy() || undefined}
            onClick={() => {
              if (!scopeUnavailable() && !loading()) void refresh()
            }}
          >
            <Icon name={loading() ? "loading" : "refresh"} />
            {t("common.refresh")}
          </Button>
        </SettingsToolbar>
      </Show>

      <Show when={detailOpen() && loading() && scopedCatalog() && !readFailure()}>
        <Feedback tone="info" aria-busy="true">
          {t("mission_skill.detail_refreshing_retained")}
        </Feedback>
      </Show>
      <Show when={readFailure()}>
        {(failure) => (
          <Feedback
            tone="error"
            data-ui="mission-skill-error"
            details={formatErrorDetails(failure().cause)}
            actions={
              <Show when={detailOpen()}>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  tone="neutral"
                  aria-disabled={refreshBusy() || undefined}
                  aria-busy={refreshBusy() || undefined}
                  onClick={(event) => {
                    if (!scopeUnavailable() && !loading()) void refresh(event.currentTarget)
                  }}
                >
                  <Icon name={refreshBusy() ? "loading" : "refresh"} />
                  {t(refreshBusy() ? "common.retrying" : "common.retry")}
                </Button>
              </Show>
            }
          >
            {t(scopedCatalog() ? "mission_skill.load_failed_retained" : "mission_skill.load_failed")}
          </Feedback>
        )}
      </Show>
      <Show when={!detailOpen() && catalogIssues().length > 0}>
        <Feedback
          tone="warning"
          title={t("mission_skill.issues_title")}
          data-ui="mission-skill-catalog-issues"
          details={catalogIssues().map((issue) => issue.message).join("\n\n")}
        >
          <ul class="mission-skill-catalog-issues">
            <For each={catalogIssues()}>
              {(issue) => (
                <li data-ui="mission-skill-catalog-issue">
                  {t(catalogIssueLabels[issue.kind])}
                  <span>{sourceLabel(issue.source)} · <code>{issue.path}</code></span>
                </li>
              )}
            </For>
          </ul>
        </Feedback>
      </Show>

      <SettingsGroup
        title={!detailOpen() ? t("mission_skill.catalog_title") : undefined}
        actions={
          !detailOpen() && scopedCatalog() ? (
            <Badge tone="muted">{t("mission_skill.count", { count: filteredSkills().length })}</Badge>
          ) : undefined
        }
      >
        <SettingsSurface class="mission-skill-catalog-surface">
          <Show when={!detailOpen()}>
            <SettingsToolbar>
              <SearchField
                clearable
                class="mission-skill-search"
                dataUI="mission-skill-search"
                clearDataUI="mission-skill-search-clear"
                inputRef={(element) => (searchInput = element)}
                value={query()}
                placeholder={t("mission_skill.search_placeholder")}
                onValueChange={setQuery}
              />
              <div class="mission-skill-filters" role="toolbar" aria-label={t("mission_skill.filter_label")}>
                <For each={["all", "built_in", "project", "global"] as MissionSkillFilter[]}>
                  {(value) => (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      tone="neutral"
                      class="mission-skill-filter"
                      data-ui="mission-skill-filter"
                      data-filter={value}
                      data-selected={filter() === value ? "true" : undefined}
                      aria-pressed={filter() === value}
                      onClick={() => setFilter(value)}
                    >
                      {filterLabel(value)}
                    </Button>
                  )}
                </For>
              </div>
            </SettingsToolbar>

            <Show
              when={!scopeStatus()}
              fallback={
                <Feedback tone="warning" title={t("mission_skill.scope_unavailable_title")}>
                  {scopeStatus()}
                </Feedback>
              }
            >
              <Show when={!loading() || scopedCatalog()} fallback={
                <Show when={!readFailure()}><Feedback>{t("common.loading")}</Feedback></Show>
              }>
                <Show
                  when={skills().length > 0}
                  fallback={
                    <Show when={scopedCatalog()}>
                      <SettingsEmpty>{t("mission_skill.empty")}</SettingsEmpty>
                    </Show>
                  }
                >
                  <Show
                    when={filteredSkills().length > 0}
                    fallback={<SettingsEmpty>{t("mission_skill.no_results")}</SettingsEmpty>}
                  >
                    <div class="mission-skill-browser">
                      <SettingsSurface class="mission-skill-list">
                        <For each={filteredSkills()}>
                          {(skill) => (
                            <SettingsRow
                              as="button"
                              class="mission-skill-item"
                              data-ui="mission-skill-item"
                              data-skill-name={skill.name}
                              interactive
                              leading={<Icon name="workflow" />}
                              title={skill.name}
                              meta={
                                <>
                                  <Badge tone="muted" size="sm">
                                    {sourceLabel(skill.source)}
                                  </Badge>
                                </>
                              }
                              actions={<Icon name="chevron" />}
                              onClick={() => openDetail(skill.name)}
                            />
                          )}
                        </For>
                      </SettingsSurface>
                    </div>
                  </Show>
                </Show>
              </Show>
            </Show>
          </Show>

          <Show when={selectedName()}>
            {(name) => (
              <SettingsSurface ref={detailSurface} class="mission-skill-detail" data-ui="mission-skill-detail">
                <Button
                  class="s-detail-back"
                  type="button"
                  variant="ghost"
                  size="sm"
                  tone="neutral"
                  onClick={returnToCatalog}
                >
                  <Icon name="nav-back" />
                  {t("settings.back_to_list")}
                </Button>
                <header class="mission-skill-detail-head">
                  <div>
                    <span>{t("mission_skill.detail_eyebrow")}</span>
                    <h3 ref={detailHeading} tabIndex={-1}>{name()}</h3>
                  </div>
                  <Show when={selectedSkill()}>
                    {(skill) => <Badge tone="muted">{sourceLabel(skill().source)}</Badge>}
                  </Show>
                </header>
                <Show
                  when={selectedSkill()}
                  fallback={<Feedback tone="warning">{t("mission_skill.detail_unavailable")}</Feedback>}
                >
                  {(skill) => (
                    <>
                      <p class="mission-skill-detail-description">{missionSkillDescription(skill())}</p>
                      <div class="mission-skill-detail-section mission-skill-invocation">
                        <strong>{t("mission_skill.invoke_title")}</strong>
                        <code>{invocation(skill().name)}</code>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          tone="neutral"
                          data-ui="mission-skill-copy"
                          onClick={() => void copyInvocation(skill())}
                        >
                          <Icon name="copy" />
                          {t("mission_skill.copy_invocation")}
                        </Button>
                        <MissionSkillActionFeedback result={resultFor("invocation")} />
                      </div>
                      <Disclosure.Root class="mission-skill-detail-section">
                        <Disclosure.Trigger>
                          {tc("mission_skill.tools_count", skill().required_tools.length)}
                        </Disclosure.Trigger>
                        <Disclosure.Content>
                          <SettingsReferenceList values={skill().required_tools} />
                        </Disclosure.Content>
                      </Disclosure.Root>
                      <Show when={skill().location}>
                        {(location) => (
                          <div class="mission-skill-detail-section">
                            <strong>{t("mission_skill.source_location")}</strong>
                            <code class="mission-skill-path">{location()}</code>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              tone="neutral"
                              data-ui="mission-skill-open-source"
                              onClick={() => void openPath(location(), skill().name)}
                            >
                              <Icon name="folder-open" />
                              {t(pathRevealLabelKey())}
                            </Button>
                            <MissionSkillActionFeedback result={resultFor("source")} />
                          </div>
                        )}
                      </Show>
                    </>
                  )}
                </Show>
              </SettingsSurface>
            )}
          </Show>
        </SettingsSurface>
      </SettingsGroup>

      <Show when={!detailOpen() ? scopedCatalog() : null}>
        {(current) => (
          <Disclosure.Root>
            <Disclosure.Trigger>{t("mission_skill.directories_title")}</Disclosure.Trigger>
            <Disclosure.Content>
              <p class="mission-skill-boundary-copy">{t("mission_skill.directories_intro")}</p>
              <SettingsSurface>
                <SettingsRow
                  title={t("mission_skill.source.project")}
                  desc={current().roots.project}
                  actions={
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      tone="neutral"
                      data-ui="mission-skill-open-project-root"
                      onClick={() => void openRoot("project")}
                    >
                      <Icon name="folder-open" />
                      {t(pathRevealLabelKey())}
                    </Button>
                  }
                />
                <MissionSkillActionFeedback result={resultFor("project-root")} />
                <SettingsRow
                  title={t("mission_skill.source.global")}
                  desc={current().roots.global}
                  actions={
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      tone="neutral"
                      data-ui="mission-skill-open-global-root"
                      onClick={() => void openRoot("global")}
                    >
                      <Icon name="folder-open" />
                      {t(pathRevealLabelKey())}
                    </Button>
                  }
                />
                <MissionSkillActionFeedback result={resultFor("global-root")} />
              </SettingsSurface>
            </Disclosure.Content>
          </Disclosure.Root>
        )}
      </Show>
    </SettingsPanel>
  )
}
