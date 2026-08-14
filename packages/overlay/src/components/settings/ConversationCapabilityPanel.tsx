import { createEffect, createSignal, For, Show } from "solid-js"
import {
  loadConversationCapability,
  updateConversationCapability,
  type ConversationCapabilityAssignment,
  type ConversationCapabilitySettings,
  type ConversationExperience,
} from "../../services/conversation-capability"
import { t } from "../../utils/i18n"
import { Badge } from "../ui/Badge"
import { Checkbox } from "../ui/Checkbox"
import { SettingsEmpty, SettingsGroup, SettingsPanel, SettingsRow, SettingsState, SettingsSurface } from "./layout"

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
    return value.replaceAll("\\", "/").replace(/\/+$/, "") || value
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
      <SettingsGroup
        title={t("settings.product.capability_title", { product: productLabel() })}
        description={t("settings.product.capability_intro", { product: productLabel() })}
        actions={
          <Badge tone={directory() ? "neutral" : "warn"}>
            <span class="conversation-capability-scope-path" title={scopeDirectory()}>
              {t("settings.product.scope_badge", { project: scopeLabel(), product: productLabel() })}
            </span>
          </Badge>
        }
        contentInset
      >
        <p class="conversation-capability-model-owner conversation-capability-scope-notice">
          {t("settings.product.scope_notice", { project: scopeLabel(), product: productLabel() })}
        </p>
        <p class="conversation-capability-model-owner">{t("settings.product.model_owner")}</p>
        <Show
          when={!!directory()}
          fallback={
            <SettingsState
              tone="warning"
              title={t("settings.product.scope_unavailable_title", { product: productLabel() })}
              data-ui="conversation-capability-scope-unavailable"
            >
              {t("settings.product.scope_unavailable_body", { product: productLabel() })}
            </SettingsState>
          }
        >
          <Show when={!loading()} fallback={<SettingsState>{t("common.loading")}</SettingsState>}>
            <Show
              when={!error()}
              fallback={
                <SettingsState
                  tone="error"
                  title={t("settings.product.load_failed_title", { product: productLabel() })}
                >
                  {t("settings.product.load_failed_body")}
                </SettingsState>
              }
            >
              <Show when={settings()}>
                {(current) => (
                  <div class="conversation-capability-sections">
                    <SettingsGroup
                      title={t("settings.product.tools", { product: productLabel() })}
                      description={t("settings.product.tools_description", { product: productLabel() })}
                    >
                      <SettingsSurface>
                        <For each={current().tools.declared}>
                          {(tool) => (
                            <SettingsRow
                              title={tool}
                              desc={t("settings.product.tool_owned", { product: productLabel() })}
                              actions={<Badge tone="neutral">{t("settings.read_only")}</Badge>}
                            />
                          )}
                        </For>
                      </SettingsSurface>
                    </SettingsGroup>

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
                                  desc={`${skill.description || t("settings.product.skill_available")} ${
                                    assigned()
                                      ? t("settings.product.skill_assigned_runtime", { product: productLabel() })
                                      : t("settings.product.skill_unassigned", { product: productLabel() })
                                  }`}
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
