import { Feedback } from "../ui/Feedback"
import { createEffect, createSignal, For, Show } from "solid-js"
import {
  loadConversationCapability,
  updateConversationCapability,
  type ConversationCapabilityAssignment,
  type ConversationCapabilitySettings,
  type ConversationExperience,
} from "../../services/conversation-capability"
import { t } from "../../utils/i18n"
import { Disclosure } from "../ui/Disclosure"
import { implicitProjectSuffix, projectDirectoryLabel } from "../../utils/project-directory"
import { Checkbox } from "../ui/Checkbox"
import {
  SettingsEmpty,
  SettingsGroup,
  SettingsPanel,
  SettingsRow,
  SettingsSurface,
  SettingsReferenceList,
} from "./layout"

type DirectoryProp = string | (() => string | undefined)

export default function ConversationCapabilityPanel(props: {
  experience: ConversationExperience
  directory: DirectoryProp
}) {
  const [settings, setSettings] = createSignal<ConversationCapabilitySettings | null>(null)
  const [error, setError] = createSignal("")
  const [loading, setLoading] = createSignal(false)
  const [saving, setSaving] = createSignal(false)
  let loadGeneration = 0
  let mutationGeneration = 0
  let mutationScope = ""

  const productLabel = () => (props.experience === "chat" ? "Chat" : "Work")

  function directory() {
    return String(typeof props.directory === "function" ? props.directory() : props.directory || "").trim()
  }

  function scopeDirectory() {
    return settings()?.scope.directory || directory()
  }

  function scopeLabel() {
    const value = scopeDirectory()
    if (!value) return t("settings.product.project_required")
    const name = projectDirectoryLabel(value, t("task.project.unknown"), t("work_ledger.implicit_project")).name
    return [name, implicitProjectSuffix(value)].filter(Boolean).join(" ")
  }

  createEffect(() => {
    const currentDirectory = directory()
    const currentExperience = props.experience
    const currentScope = `${currentExperience}:${currentDirectory}`
    const requestGeneration = ++loadGeneration
    if (mutationScope && mutationScope !== currentScope) {
      mutationScope = ""
      mutationGeneration++
      setSaving(false)
    }
    setSettings(null)
    setError("")
    setLoading(!!currentDirectory)
    if (!currentDirectory) return
    void loadConversationCapability(currentDirectory, currentExperience)
      .then((next) => {
        if (
          requestGeneration !== loadGeneration ||
          directory() !== currentDirectory ||
          props.experience !== currentExperience
        ) {
          return
        }
        setSettings(next)
      })
      .catch((cause) => {
        if (
          requestGeneration !== loadGeneration ||
          directory() !== currentDirectory ||
          props.experience !== currentExperience
        ) {
          return
        }
        setError(cause instanceof Error ? cause.message : String(cause))
      })
      .finally(() => {
        if (
          requestGeneration === loadGeneration &&
          directory() === currentDirectory &&
          props.experience === currentExperience
        ) {
          setLoading(false)
        }
      })
  })

  async function mutateAssignment(next: ConversationCapabilityAssignment) {
    const currentDirectory = directory()
    const currentExperience = props.experience
    const requestGeneration = ++mutationGeneration
    mutationScope = `${currentExperience}:${currentDirectory}`
    setSaving(true)
    setError("")
    try {
      const response = await updateConversationCapability(currentDirectory, currentExperience, next)
      if (
        requestGeneration !== mutationGeneration ||
        directory() !== currentDirectory ||
        props.experience !== currentExperience
      ) {
        return
      }
      loadGeneration++
      setLoading(false)
      setSettings(response)
    } catch (cause) {
      if (
        requestGeneration === mutationGeneration &&
        directory() === currentDirectory &&
        props.experience === currentExperience
      ) {
        setError(cause instanceof Error ? cause.message : String(cause))
      }
    } finally {
      if (requestGeneration === mutationGeneration) {
        mutationScope = ""
        setSaving(false)
      }
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
            <Disclosure.Trigger>{t("settings.product.scope_project", { project: scopeLabel() })}</Disclosure.Trigger>
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
          <Show when={!loading()} fallback={<Feedback>{t("common.loading")}</Feedback>}>
            <Show
              when={!error()}
              fallback={
                <Feedback tone="error" title={t("settings.product.load_failed_title", { product: productLabel() })}>
                  {t("settings.product.load_failed_body")}
                </Feedback>
              }
            >
              <Show when={settings()}>
                {(current) => (
                  <div class="conversation-capability-sections">
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
                                      disabled={saving()}
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
                                      disabled={saving()}
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
        </Show>
      </SettingsGroup>
    </SettingsPanel>
  )
}
