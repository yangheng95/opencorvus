import { Feedback } from "../ui/Feedback"
import { isConversationMcpRef } from "@opencorvus-ai/util/conversation-mcp-ref"
import { displayMcpName } from "@opencorvus-ai/util/mcp-name"
import { Key } from "@solid-primitives/keyed"
import { batch, createEffect, createMemo, createSignal, createUniqueId, For, on, Show, onCleanup } from "solid-js"
import { captureApiAuthority, isApiAuthorityCurrent, type ApiAuthority } from "../../services/api"
import {
  loadConversationCapability,
  updateConversationCapability,
  type ConversationCapabilityAssignment,
  type ConversationCapabilitySettings,
  type ConversationExperience,
} from "../../services/conversation-capability"
import { matchesSearchTerms } from "../../services/text-search"
import { workLedgerProject } from "../../services/work-ledger"
import { t } from "../../utils/i18n"
import { formatErrorDetails } from "../../utils/error-details"
import { revealRenderedListRow } from "../../utils/rendered-list-navigation"
import { Disclosure } from "../ui/Disclosure"
import { Checkbox } from "../ui/Checkbox"
import { Button } from "../ui/Button"
import { createSearchResultNavigation, SearchField } from "../ui/SearchField"
import { SettingsProjectScope } from "./SettingsProjectScope"
import {
  SettingsEmpty,
  SettingsGroup,
  SettingsPanel,
  SettingsRow,
  SettingsSurface,
  SettingsReferenceList,
} from "./layout"

type DirectoryProp = string | (() => string | undefined)
type CapabilityScope = { authority: ApiAuthority; directory: string; experience: ConversationExperience }
type CapabilityIssue = { operation: "load"; cause: unknown } | { operation: "save"; cause: unknown; checkCause?: unknown }

export default function ConversationCapabilityPanel(props: {
  experience: ConversationExperience
  directory: DirectoryProp
  onMcpSectionReady: (section: HTMLElement) => void
}) {
  const [settings, setSettings] = createSignal<ConversationCapabilitySettings | null>(null)
  const [issue, setIssue] = createSignal<CapabilityIssue | null>(null)
  const [loading, setLoading] = createSignal(false)
  const [saving, setSaving] = createSignal(false)
  const [skillQuery, setSkillQuery] = createSignal("")
  let loadGeneration = 0
  let mutationGeneration = 0
  let scopeTrigger: HTMLElement | undefined
  let checkButton: HTMLButtonElement | undefined
  let assignmentsElement: HTMLDivElement | undefined
  let mcpSection: HTMLElement | undefined
  let skillSearchInput: HTMLInputElement | undefined
  let skillResults: HTMLDivElement | undefined
  const skillSearchHintID = `capability-skill-search-hint-${createUniqueId()}`
  onCleanup(() => {
    loadGeneration++
    mutationGeneration++
  })

  const productLabel = () => t(props.experience === "chat" ? "settings.section.code" : "settings.section.work")

  function directory() {
    return String(typeof props.directory === "function" ? props.directory() : props.directory || "").trim()
  }

  const currentScope = (): CapabilityScope => ({ authority: captureApiAuthority(), directory: directory(), experience: props.experience })
  const ownsScope = (scope: CapabilityScope) =>
    directory() === scope.directory && props.experience === scope.experience && isApiAuthorityCurrent(scope.authority)
  const assignmentLocked = () => saving() || loading() || issue() !== null
  const canBrowseMcpAssignments = createMemo(() =>
    (settings()?.mcp.configured_server_refs.filter(isConversationMcpRef).length ?? 0) > 1,
  )
  const mcpAssignmentNavigation = createSearchResultNavigation(
    () => Array.from(mcpSection?.querySelectorAll<HTMLInputElement>('input[type="checkbox"]:enabled') ?? []),
    {
      pageViewport: (action) => action.closest<HTMLElement>(".config-content"),
      pageRow: (action) => action.closest<HTMLElement>(".s-row"),
    },
  )
  const installedSkills = () => settings()?.skills.installed ?? []
  const filteredSkills = createMemo(() => {
    const query = skillQuery().trim()
    const skills = installedSkills()
    return query ? skills.filter((skill) => matchesSearchTerms(query, [skill.name, skill.description])) : skills
  })
  const hasSkillResults = () => filteredSkills().length > 0
  const hasFilteredSkillResults = () => Boolean(skillQuery().trim()) && hasSkillResults()
  const skillResultKeyShortcuts = () => hasFilteredSkillResults()
    ? "ArrowUp ArrowDown PageUp PageDown Escape"
    : "ArrowUp ArrowDown PageUp PageDown"
  const skillNavigationOptions = {
    pageViewport: (action: HTMLElement) => action.closest<HTMLElement>(".config-content"),
    pageRow: (action: HTMLElement) => action.closest<HTMLElement>(".s-row"),
    returnToSearch: () => hasFilteredSkillResults() ? skillSearchInput : undefined,
  }
  const skillDetailNavigation = createSearchResultNavigation(
    () => Array.from(skillResults?.querySelectorAll<HTMLElement>(".conversation-capability-description > summary") ?? []),
    skillNavigationOptions,
  )
  const skillAssignmentNavigation = createSearchResultNavigation(
    () => Array.from(skillResults?.querySelectorAll<HTMLInputElement>('input[type="checkbox"]:enabled') ?? []),
    skillNavigationOptions,
  )

  function scopeDirectory() {
    return settings()?.scope.directory || directory()
  }

  async function readCapability(scope: CapabilityScope): Promise<void> {
    if (!scope.directory) return
    const requestGeneration = ++loadGeneration
    const owns = () => requestGeneration === loadGeneration && ownsScope(scope)
    setLoading(true)
    try {
      const next = await loadConversationCapability(scope.directory, scope.experience, scope.authority)
      if (!owns()) return
      const hadCheckFocus = document.activeElement === checkButton
      batch(() => {
        setSettings(next)
        setIssue(null)
      })
      if (hadCheckFocus && document.activeElement === document.body) scopeTrigger?.focus()
    } catch (cause) {
      if (owns()) {
        setIssue((previous) => previous?.operation === "save"
          ? { ...previous, checkCause: cause }
          : { operation: "load", cause })
      }
    } finally {
      if (owns()) setLoading(false)
    }
  }

  createEffect(on(currentScope, (scope) => {
    loadGeneration++
    mutationGeneration++
    batch(() => {
      setSettings(null)
      setSkillQuery("")
      setIssue(null)
      setLoading(!!scope.directory)
      setSaving(false)
    })
    if (scope.directory) void readCapability(scope)
  }))

  async function mutateAssignment(next: ConversationCapabilityAssignment) {
    if (!settings() || assignmentLocked()) return
    const scope = currentScope()
    const requestGeneration = ++mutationGeneration
    const owns = () => requestGeneration === mutationGeneration && ownsScope(scope)
    const active = document.activeElement
    const hadAssignmentFocus = active instanceof HTMLInputElement && active.type === "checkbox" && assignmentsElement?.contains(active)
    setSaving(true)
    try {
      const response = await updateConversationCapability(scope.directory, scope.experience, next, scope.authority)
      if (!owns()) return
      setSettings(response)
    } catch (cause) {
      if (owns()) {
        setIssue({ operation: "save", cause })
        if (hadAssignmentFocus && (document.activeElement === active || document.activeElement === document.body)) {
          checkButton?.focus()
        }
      }
    } finally {
      if (owns()) setSaving(false)
    }
  }

  function toggleSkill(name: string, checked: boolean) {
    void mutateAssignment({
      kind: "skill",
      ref: name,
      assigned: checked,
    })
  }

  function toggleMcp(serverID: string, checked: boolean) {
    void mutateAssignment({
      kind: "mcp_server",
      ref: serverID,
      assigned: checked,
    })
  }

  return (
    <SettingsPanel
      class="conversation-capability-panel"
      data-ui={`${props.experience === "chat" ? "code" : "work"}-capability-settings`}
      data-experience={props.experience}
    >
      <SettingsGroup description={t("settings.product.capability_intro", { product: productLabel() })}>
        <Show when={directory() && scopeDirectory()} keyed>
          {(scope) => (
            <SettingsProjectScope
              class="conversation-capability-scope"
              directory={scope}
              customName={workLedgerProject(scope)?.title}
              triggerRef={(element) => (scopeTrigger = element)}
            />
          )}
        </Show>
        <Show
          when={!!directory()}
          fallback={
            <Feedback
              tone="warning"
              title={t("settings.product.scope_unavailable_title", { product: productLabel() })}
              data-ui="conversation-capability-scope-unavailable"
            >
              {t("settings.product.scope_unavailable_body", { product: productLabel() })}
            </Feedback>
          }
        >
          <Show when={!loading() || settings() || issue()} fallback={<Feedback>{t("common.loading")}</Feedback>}>
            <Show when={issue()}>
              {(problem) => {
                const isSave = () => problem().operation === "save"
                const details = () => {
                  const current = problem()
                  return [formatErrorDetails(current.cause), current.operation === "save" ? formatErrorDetails(current.checkCause) : ""]
                    .filter(Boolean).join("\n\n")
                }
                return (
                  <Feedback
                    tone="error"
                    title={t(isSave() ? "settings.product.save_unconfirmed_title" : "settings.product.load_failed_title", { product: productLabel() })}
                    details={details()}
                    actions={
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        tone="neutral"
                        ref={(element) => (checkButton = element)}
                        aria-disabled={loading() || undefined}
                        aria-busy={loading() || undefined}
                        onClick={() => {
                          if (!loading() && !saving()) void readCapability(currentScope())
                        }}
                      >
                        {t(isSave()
                          ? loading() ? "settings.product.checking_assignments" : "settings.product.check_assignments"
                          : loading() ? "common.retrying" : "common.retry")}
                      </Button>
                    }
                  >
                    {t(isSave() ? "settings.product.save_unconfirmed_body" : "settings.product.load_failed_body")}
                  </Feedback>
                )
              }}
            </Show>
            <Show when={settings()}>
              {(current) => (
                <div
                  class="conversation-capability-sections"
                  aria-busy={saving() || undefined}
                  ref={(element) => (assignmentsElement = element)}
                >
                  <Disclosure.Root>
                    <Disclosure.Trigger>
                      {t("settings.product.tools_count", { count: current().tools.declared.length })}
                    </Disclosure.Trigger>
                    <Disclosure.Content>
                      <SettingsReferenceList values={current().tools.declared} />
                    </Disclosure.Content>
                  </Disclosure.Root>

                  <SettingsGroup
                    title={t("settings.product.skills", { product: productLabel() })}
                    description={
                      <>
                        {t("settings.product.skills_description", { product: productLabel() })}
                        <Show when={hasFilteredSkillResults()}>
                          <p id={skillSearchHintID} class="settings-search-keyboard-hint">
                            {t("settings.product.skills_keyboard_hint")}
                          </p>
                        </Show>
                      </>
                    }
                    actions={
                      <Show when={installedSkills().length > 0}>
                        <SearchField
                          clearable
                          dataUI="conversation-capability-skill-search"
                          value={skillQuery()}
                          ariaLabel={t("settings.product.skills_search_label")}
                          ariaDescribedBy={hasFilteredSkillResults() ? skillSearchHintID : undefined}
                          ariaKeyShortcuts={hasSkillResults() ? "ArrowUp ArrowDown" : undefined}
                          placeholder={t("settings.product.skills_search")}
                          inputRef={(element) => { skillSearchInput = element }}
                          onValueChange={setSkillQuery}
                          resultFocusTarget={skillDetailNavigation.resultFocusTarget}
                        />
                      </Show>
                    }
                  >
                    <SettingsSurface class="conversation-capability-skill-results" ref={skillResults}>
                      <Show
                        when={filteredSkills().length > 0}
                        fallback={
                          <SettingsEmpty>{t(installedSkills().length ? "settings.product.skills_no_results" : "skill.none")}</SettingsEmpty>
                        }
                      >
                        <Key each={filteredSkills()} by="name">
                          {(skill) => {
                            const assigned = () => current().skills.assigned_refs.includes(skill().name)
                            let description: HTMLDetailsElement | undefined
                            return (
                              <SettingsRow
                                title={skill().name}
                                children={
                                  <Disclosure.Root
                                    ref={description}
                                    class="conversation-capability-description"
                                    onOpenChange={(open) => {
                                      if (!open || !description?.contains(document.activeElement)) return
                                      const row = skillNavigationOptions.pageRow(description)
                                      const viewport = skillNavigationOptions.pageViewport(description)
                                      if (row && viewport) revealRenderedListRow(row, viewport)
                                    }}
                                  >
                                    <Disclosure.Trigger
                                      indicatorPosition="end"
                                      aria-keyshortcuts={skillResultKeyShortcuts()}
                                      on:keydown={skillDetailNavigation.handleResultKeyDown}
                                    >
                                      <span class="conversation-capability-description-preview">
                                        {skill().description || t("settings.product.skill_available")}
                                      </span>
                                      <span class="conversation-capability-description-label">
                                        {t("common.details")}
                                      </span>
                                    </Disclosure.Trigger>
                                    <Disclosure.Content>
                                      {skill().description || t("settings.product.skill_available")}
                                    </Disclosure.Content>
                                  </Disclosure.Root>
                                }
                                actions={
                                  <Checkbox
                                    checked={assigned()}
                                    readOnly={assignmentLocked()}
                                    aria-keyshortcuts={skillResultKeyShortcuts()}
                                    aria-label={t("settings.product.skill_toggle", {
                                      name: skill().name,
                                      product: productLabel(),
                                    })}
                                    onKeyDown={skillAssignmentNavigation.handleResultKeyDown}
                                    onChange={(checked) => toggleSkill(skill().name, checked)}
                                  />
                                }
                              />
                            )
                          }}
                        </Key>
                      </Show>
                    </SettingsSurface>
                  </SettingsGroup>

                  <SettingsGroup
                    ref={(section) => {
                      mcpSection = section
                      props.onMcpSectionReady(section)
                    }}
                    class="conversation-capability-mcp"
                    tabIndex={-1}
                    aria-label={t("settings.product.mcp", { product: productLabel() })}
                    title={t("settings.product.mcp", { product: productLabel() })}
                    description={
                      <>
                        {t("settings.product.mcp_description", { product: productLabel() })}
                        <Show when={canBrowseMcpAssignments()}>
                          <p class="settings-search-keyboard-hint">{t("mcp.connection_keyboard_hint")}</p>
                        </Show>
                      </>
                    }
                  >
                    <SettingsSurface>
                      <Show
                        when={current().mcp.configured_server_refs.length > 0}
                        fallback={<SettingsEmpty>{t("mcp.none")}</SettingsEmpty>}
                      >
                        <For each={current().mcp.configured_server_refs}>
                          {(serverID) => {
                            const assignable = isConversationMcpRef(serverID)
                            const name = displayMcpName(serverID)
                            const assigned = () => current().mcp.assigned_server_refs.includes(serverID)
                            return (
                              <SettingsRow
                                title={<span class="mcp-connection-name">{name}</span>}
                                desc={
                                  !assignable ? t("settings.product.mcp_name_unassignable")
                                    : assigned() ? t("settings.product.mcp_assigned_runtime", { product: productLabel() })
                                      : t("settings.product.mcp_unassigned", { product: productLabel() })
                                }
                                actions={assignable && (
                                  <Checkbox
                                    checked={assigned()}
                                    readOnly={assignmentLocked()}
                                    aria-label={t("settings.product.mcp_toggle", {
                                      name,
                                      product: productLabel(),
                                    })}
                                    aria-keyshortcuts={canBrowseMcpAssignments() ? "ArrowUp ArrowDown PageUp PageDown" : undefined}
                                    onKeyDown={mcpAssignmentNavigation.handleResultKeyDown}
                                    onChange={(checked) => toggleMcp(serverID, checked)}
                                  />
                                )}
                              />
                            )
                          }}
                        </For>
                      </Show>
                    </SettingsSurface>
                  </SettingsGroup>
                </div>
              )}
            </Show>
          </Show>
        </Show>
      </SettingsGroup>
    </SettingsPanel>
  )
}
