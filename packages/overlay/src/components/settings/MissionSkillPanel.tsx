import { Feedback } from "../ui/Feedback"
import type { MissionSkillSettingsResponse } from "@opencorvus-ai/sdk"
import { For, Show, createEffect, createMemo, createSignal } from "solid-js"
import { expertSquadSettingsScope, type ExpertSquadCatalogScopeState } from "../../services/expert-squad-scope"
import { ensureMissionSkillDirectory, loadMissionSkillSettings } from "../../services/mission-skill"
import { pathRevealFailureText, pathRevealLabelKey, pathRevealNoticeKey, revealPath } from "../../services/workspace"
import { t, tc } from "../../utils/i18n"
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
  const currentScopeIdentity = createMemo(() => scopeIdentity(currentScope()))
  const [catalog, setCatalog] = createSignal<MissionSkillSettingsResponse | null>(null)
  const [catalogIdentity, setCatalogIdentity] = createSignal("")
  const [selectedName, setSelectedName] = createSignal("")
  const [detailOpen, setDetailOpen] = createSignal(false)
  const [query, setQuery] = createSignal("")
  const [filter, setFilter] = createSignal<MissionSkillFilter>("all")
  const [loading, setLoading] = createSignal(false)
  const [error, setError] = createSignal("")
  const [notice, setNotice] = createSignal("")
  const [noticeTone, setNoticeTone] = createSignal<"active" | "error">("active")
  let loadSequence = 0
  let operationGeneration = 0

  const scopedCatalog = createMemo(() => (catalogIdentity() === currentScopeIdentity() ? catalog() : null))
  const skills = createMemo(() => scopedCatalog()?.mission_skills ?? [])
  const catalogIssues = createMemo(
    () =>
      (
        scopedCatalog() as
          | (MissionSkillSettingsResponse & {
              issues?: Array<{ source: string; path: string; name?: string; message: string }>
            })
          | null
      )?.issues ?? [],
  )
  const filteredSkills = createMemo(() => {
    const normalizedQuery = query().trim().toLocaleLowerCase()
    return skills().filter((skill) => {
      if (filter() !== "all" && skill.source !== filter()) return false
      if (!normalizedQuery) return true
      return [skill.name, skill.description, sourceLabel(skill.source), ...skill.required_tools]
        .join("\n")
        .toLocaleLowerCase()
        .includes(normalizedQuery)
    })
  })
  const selectedSkill = createMemo(() => {
    const list = filteredSkills()
    return list.find((skill) => skill.name === selectedName()) ?? list[0]
  })

  function operationIdentity(skillName: string): string {
    return `${currentScopeIdentity()}\u0000${skillName}`
  }

  function beginOperation(skillName: string) {
    const generation = ++operationGeneration
    const identity = operationIdentity(skillName)
    setNotice("")
    return {
      owns: () => generation === operationGeneration && operationIdentity(skillName) === identity,
    }
  }

  async function refresh(scope = currentScope(), expectedIdentity = scopeIdentity(scope)): Promise<void> {
    if (scope.kind === "unavailable") {
      loadSequence++
      setCatalog(null)
      setCatalogIdentity("")
      setLoading(false)
      setError("")
      return
    }
    const sequence = ++loadSequence
    setLoading(true)
    setError("")
    try {
      const next = await loadMissionSkillSettings(scope)
      if (sequence !== loadSequence || currentScopeIdentity() !== expectedIdentity) return
      setCatalog(next)
      setCatalogIdentity(expectedIdentity)
      setSelectedName((current) =>
        next.mission_skills.some((skill) => skill.name === current) ? current : (next.mission_skills[0]?.name ?? ""),
      )
    } catch (cause) {
      if (sequence === loadSequence && currentScopeIdentity() === expectedIdentity) {
        setError(cause instanceof Error ? cause.message : String(cause))
      }
    } finally {
      if (sequence === loadSequence && currentScopeIdentity() === expectedIdentity) setLoading(false)
    }
  }

  createEffect<string>((previousIdentity) => {
    const identity = currentScopeIdentity()
    if (identity === previousIdentity) return previousIdentity
    setDetailOpen(false)
    operationGeneration += 1
    setNotice("")
    void refresh(currentScope(), identity)
    return identity
  }, "")

  createEffect<string>((previousIdentity) => {
    const identity = operationIdentity(selectedSkill()?.name ?? "")
    if (identity === previousIdentity) return previousIdentity
    operationGeneration += 1
    setNotice("")
    return identity
  }, "")

  async function openPath(target: string, skillName: string): Promise<void> {
    const owner = beginOperation(skillName)
    try {
      const outcome = await revealPath(target)
      if (!owner.owns()) return
      const notice = pathRevealNoticeKey(outcome)
      if (notice) {
        setNoticeTone("active")
        setNotice(t(notice, { path: target }))
      }
    } catch (cause) {
      if (!owner.owns()) return
      setNoticeTone("error")
      setNotice(pathRevealFailureText(cause))
    }
  }

  async function openRoot(source: "global" | "project"): Promise<void> {
    const scope = currentScope()
    if (scope.kind === "unavailable") return
    const owner = beginOperation(selectedSkill()?.name ?? "")
    try {
      const target = await ensureMissionSkillDirectory(scope, source)
      if (!owner.owns()) return
      const outcome = await revealPath(target)
      if (!owner.owns()) return
      const notice = pathRevealNoticeKey(outcome)
      if (notice) {
        setNoticeTone("active")
        setNotice(t(notice, { path: target }))
      }
    } catch (cause) {
      if (!owner.owns()) return
      setNoticeTone("error")
      setNotice(pathRevealFailureText(cause))
    }
  }

  async function copyInvocation(skill: MissionSkillSettingsItem): Promise<void> {
    const owner = beginOperation(skill.name)
    try {
      await copyText(invocation(skill.name))
      if (!owner.owns()) return
      setNoticeTone("active")
      setNotice(t("mission_skill.copied", { name: skill.name }))
    } catch (cause) {
      if (!owner.owns()) return
      setNoticeTone("error")
      setNotice(t("mission_skill.copy_failed", { error: cause instanceof Error ? cause.message : String(cause) }))
    }
  }

  const scopeStatus = createMemo(() => {
    const scope = currentScope()
    if (scope.kind === "unavailable") return t("mission_skill.scope_unavailable")
    return ""
  })

  return (
    <SettingsPanel class="general-panel mission-skill-panel" id="missionSkillBody" data-ui="mission-skill-settings">
      <Show when={!detailOpen()}>
        <SettingsToolbar>
          <p class="mission-skill-intro">{t("mission_skill.intro")}</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            tone="neutral"
            data-ui="mission-skill-refresh"
            disabled={loading() || !!scopeStatus()}
            onClick={() => void refresh()}
          >
            <Icon name={loading() ? "loading" : "refresh"} />
            {t("common.refresh")}
          </Button>
        </SettingsToolbar>
      </Show>

      <Show when={notice()}>
        <Feedback tone={noticeTone() === "error" ? "error" : "success"}>{notice()}</Feedback>
      </Show>
      <Show when={error()}>
        <Feedback tone="error" data-ui="mission-skill-error">
          {error()}
        </Feedback>
      </Show>
      <For each={catalogIssues()}>
        {(issue) => (
          <Feedback tone="error" data-ui="mission-skill-catalog-issue">
            {t("mission_skill.catalog_issue", {
              owner: [issue.name, issue.source, issue.path].filter(Boolean).join(" · "),
              error: issue.message,
            })}
          </Feedback>
        )}
      </For>

      <SettingsGroup
        title={!detailOpen() ? t("mission_skill.catalog_title") : undefined}
        actions={
          !detailOpen() ? (
            <Badge tone="muted">{t("mission_skill.count", { count: filteredSkills().length })}</Badge>
          ) : undefined
        }
      >
        <SettingsSurface class="mission-skill-catalog-surface">
          <Show when={!detailOpen()}>
            <SettingsToolbar>
              <SearchField
                class="mission-skill-search"
                dataUI="mission-skill-search"
                clearDataUI="mission-skill-search-clear"
                value={query()}
                placeholder={t("mission_skill.search_placeholder")}
                onValueChange={setQuery}
                onClear={() => setQuery("")}
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
          </Show>

          <Show
            when={!scopeStatus()}
            fallback={
              <Feedback tone="warning" title={t("expert_squad.scope_unavailable_title")}>
                {scopeStatus()}
              </Feedback>
            }
          >
            <Show when={!loading() || scopedCatalog()} fallback={<Feedback>{t("common.loading")}</Feedback>}>
              <Show
                when={skills().length > 0}
                fallback={
                  <SettingsEmpty>{error() ? t("mission_skill.load_failed") : t("mission_skill.empty")}</SettingsEmpty>
                }
              >
                <Show
                  when={filteredSkills().length > 0}
                  fallback={<SettingsEmpty>{t("mission_skill.no_results")}</SettingsEmpty>}
                >
                  <div class="mission-skill-browser">
                    <Show when={!detailOpen()}>
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
                              onClick={() => {
                                setSelectedName(skill.name)
                                setDetailOpen(true)
                              }}
                            />
                          )}
                        </For>
                      </SettingsSurface>
                    </Show>

                    <Show when={detailOpen() ? selectedSkill() : undefined}>
                      {(skill) => (
                        <SettingsSurface class="mission-skill-detail" data-ui="mission-skill-detail">
                          <Button
                            class="s-detail-back"
                            type="button"
                            variant="ghost"
                            size="sm"
                            tone="neutral"
                            onClick={() => setDetailOpen(false)}
                          >
                            <Icon name="nav-back" />
                            {t("settings.back_to_list")}
                          </Button>
                          <header class="mission-skill-detail-head">
                            <div>
                              <span>{t("mission_skill.detail_eyebrow")}</span>
                              <h3>{skill().name}</h3>
                            </div>
                            <Badge tone="muted">{sourceLabel(skill().source)}</Badge>
                          </header>
                          <p class="mission-skill-detail-description">{skill().description}</p>
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
                              </div>
                            )}
                          </Show>
                        </SettingsSurface>
                      )}
                    </Show>
                  </div>
                </Show>
              </Show>
            </Show>
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
              </SettingsSurface>
            </Disclosure.Content>
          </Disclosure.Root>
        )}
      </Show>
    </SettingsPanel>
  )
}
