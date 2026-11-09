import { Feedback } from "../ui/Feedback"
import { batch, createEffect, createSignal, For, on, Show, onCleanup } from "solid-js"
import { captureApiAuthority, isApiAuthorityCurrent, type ApiAuthority } from "../../services/api"
import {
  loadConversationCapability,
  updateConversationCapability,
  type ConversationCapabilityAssignment,
  type ConversationCapabilitySettings,
  type ConversationExperience,
} from "../../services/conversation-capability"
import { t } from "../../utils/i18n"
import { formatErrorDetails } from "../../utils/error-details"
import { Disclosure } from "../ui/Disclosure"
import { implicitProjectSuffix, projectDirectoryLabel } from "../../utils/project-directory"
import { Checkbox } from "../ui/Checkbox"
import { Button } from "../ui/Button"
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
}) {
  const [settings, setSettings] = createSignal<ConversationCapabilitySettings | null>(null)
  const [issue, setIssue] = createSignal<CapabilityIssue | null>(null)
  const [loading, setLoading] = createSignal(false)
  const [saving, setSaving] = createSignal(false)
  let loadGeneration = 0
  let mutationGeneration = 0
  let scopeTrigger: HTMLElement | undefined
  let checkButton: HTMLButtonElement | undefined
  let assignmentsElement: HTMLDivElement | undefined
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

  function scopeDirectory() {
    return settings()?.scope.directory || directory()
  }

  function scopeLabel() {
    const value = scopeDirectory()
    if (!value) return t("settings.product.project_required")
    const name = projectDirectoryLabel(value, t("task.project.unknown"), t("work_ledger.implicit_project")).name
    return [name, implicitProjectSuffix(value)].filter(Boolean).join(" ")
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
        if (hadAssignmentFocus && document.activeElement === document.body) checkButton?.focus()
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
        <Show when={directory()}>
          <Disclosure.Root class="conversation-capability-scope">
            <Disclosure.Trigger ref={(element) => (scopeTrigger = element)}>
              {t("settings.product.scope_project", { project: scopeLabel() })}
            </Disclosure.Trigger>
            <Disclosure.Content>
              <p class="conversation-capability-scope-path">{scopeDirectory()}</p>
            </Disclosure.Content>
          </Disclosure.Root>
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
                <div class="conversation-capability-sections" ref={(element) => (assignmentsElement = element)}>
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
                    description={t("settings.product.skills_description", { product: productLabel() })}
                  >
                    <SettingsSurface>
                      <Show
                        when={current().skills.installed.length > 0}
                        fallback={<SettingsEmpty>{t("skill.none")}</SettingsEmpty>}
                      >
                        <For each={current().skills.installed}>
                          {(skill) => {
                            const assigned = () => current().skills.assigned_refs.includes(skill.name)
                            return (
                              <SettingsRow
                                title={skill.name}
                                children={
                                  <Disclosure.Root class="conversation-capability-description">
                                    <Disclosure.Trigger indicatorPosition="end">
                                      <span class="conversation-capability-description-preview">
                                        {skill.description || t("settings.product.skill_available")}
                                      </span>
                                      <span class="conversation-capability-description-label">
                                        {t("common.details")}
                                      </span>
                                    </Disclosure.Trigger>
                                    <Disclosure.Content>
                                      {skill.description || t("settings.product.skill_available")}
                                    </Disclosure.Content>
                                  </Disclosure.Root>
                                }
                                actions={
                                  <Checkbox
                                    checked={assigned()}
                                    disabled={assignmentLocked()}
                                    aria-label={t("settings.product.skill_toggle", {
                                      name: skill.name,
                                      product: productLabel(),
                                    })}
                                    onChange={(checked) => toggleSkill(skill.name, checked)}
                                  />
                                }
                              />
                            )
                          }}
                        </For>
                      </Show>
                    </SettingsSurface>
                  </SettingsGroup>

                  <SettingsGroup
                    title={t("settings.product.mcp", { product: productLabel() })}
                    description={t("settings.product.mcp_description", { product: productLabel() })}
                  >
                    <SettingsSurface>
                      <Show
                        when={current().mcp.configured_server_refs.length > 0}
                        fallback={<SettingsEmpty>{t("mcp.none")}</SettingsEmpty>}
                      >
                        <For each={current().mcp.configured_server_refs}>
                          {(serverID) => {
                            const assigned = () => current().mcp.assigned_server_refs.includes(serverID)
                            return (
                              <SettingsRow
                                title={serverID}
                                desc={
                                  assigned()
                                    ? t("settings.product.mcp_assigned_runtime", { product: productLabel() })
                                    : t("settings.product.mcp_unassigned", { product: productLabel() })
                                }
                                actions={
                                  <Checkbox
                                    checked={assigned()}
                                    disabled={assignmentLocked()}
                                    aria-label={t("settings.product.mcp_toggle", {
                                      name: serverID,
                                      product: productLabel(),
                                    })}
                                    onChange={(checked) => toggleMcp(serverID, checked)}
                                  />
                                }
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
