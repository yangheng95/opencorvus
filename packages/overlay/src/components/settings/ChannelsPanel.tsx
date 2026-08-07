// Solid.js component for channel configuration.
// Data source: appStore.channels + appStore.config (populated by loadConfigInfo).
// Save: channel config via PATCH /config (same as pre-Solid original).
//        public URL via PATCH /config (updateConfig pattern).

import { createSignal, createMemo, createEffect, For, Show, onCleanup } from "solid-js"
import { t } from "../../utils/i18n"
import { appStore } from "../../store/app"
import { currentProjectConfigRequestOptions, updateConfig } from "../../services/config"
import { activeProjectDirectory } from "../../services/project-directory"
import { getHostTransport } from "../../services/host-transport-runtime"
import { nativeOpen } from "../../utils/native"
import { Dialog } from "../ui/Dialog"
import { Badge } from "../ui/Badge"
import { Button } from "../ui/Button"
import { TextField } from "../ui/TextField"
import { Switch } from "../ui/Switch"
import {
  channelConfigurationStatusLabelFromString,
  channelConfigurationStatusToneFromString,
} from "../../utils/settings-status-labels"
import { SettingsEmpty, SettingsGroup, SettingsPanel, SettingsRow, SettingsState } from "./layout"

interface ChannelField {
  key: string
  label: string
  type: "text" | "secret" | "boolean" | string
  placeholder?: string
}

interface ChannelEntry {
  id: string
  name: string
  docs_url: string
  summary: string
  status: string
  fields: ChannelField[]
}

type ChannelSaveKind = "channel" | "public-url"

interface ChannelSaveOwner {
  readonly directory: string
  readonly formKind: ChannelSaveKind
  readonly channelID: string
  readonly generation: number
}

interface TutorialOpenOwner {
  readonly directory: string
  readonly formIdentity: string
  readonly target: string
  readonly generation: number
  readonly trigger: HTMLButtonElement
}

export default function ChannelsPanel(props: { directory: string }) {
  const nativeCommands = getHostTransport().capabilities.nativeCommands
  const canOpenTutorialDocs = createMemo(() => nativeCommands["open-url"])
  const [editingID, setEditingID] = createSignal<string | null>(null)
  const [editingOwner, setEditingOwner] = createSignal<ReturnType<typeof currentProjectConfigRequestOptions> | null>(
    null,
  )
  const [fieldValues, setFieldValues] = createSignal<Record<string, any>>({})
  const [notice, setNotice] = createSignal("")
  const [noticeTone, setNoticeTone] = createSignal("")
  const [noticeFormIdentity, setNoticeFormIdentity] = createSignal("catalog")
  const [savingOwner, setSavingOwner] = createSignal<ChannelSaveOwner | null>(null)
  const [tutorialOwner, setTutorialOwner] = createSignal<TutorialOpenOwner | null>(null)
  let saveGeneration = 0
  let tutorialGeneration = 0
  let scopeIdentity = props.directory.trim()
  let noticeGeneration = 0
  let noticeTimer: ReturnType<typeof setTimeout> | undefined

  // Reactive data from appStore (populated by loadConfigInfo after connect)
  const channels = createMemo((): ChannelEntry[] => {
    const raw = appStore.channels
    return Array.isArray(raw) ? (raw as ChannelEntry[]) : []
  })

  const publicUrl = createMemo((): string => {
    return (appStore.config as any)?.server?.publicUrl || ""
  })

  const [localPublicUrl, setLocalPublicUrl] = createSignal("")
  // Sync local input from store when it changes
  createEffect(() => {
    const storeUrl = publicUrl()
    if (savingOwner()?.formKind !== "public-url") setLocalPublicUrl(storeUrl)
  })

  const editingEntry = createMemo(() => channels().find((c) => c.id === editingID()) ?? null)
  createEffect(() => {
    const directory = props.directory.trim()
    if (directory === scopeIdentity) return
    scopeIdentity = directory
    invalidateSaveOwner()
    invalidateTutorialOwner()
    clearNotice()
    closeEditWithoutInvalidation()
  })

  onCleanup(() => {
    saveGeneration++
    tutorialGeneration++
    if (noticeTimer) clearTimeout(noticeTimer)
  })

  function configValueForChannel(channelID: string, key: string): any {
    return (appStore.config as any)?.channel?.[channelID]?.[key]
  }

  function openEdit(channelID: string) {
    const entry = channels().find((c) => c.id === channelID)
    if (!entry) return
    invalidateSaveOwner()
    invalidateTutorialOwner()
    clearNotice()
    const initial: Record<string, any> = {}
    for (const field of entry.fields) {
      const existing = configValueForChannel(entry.id, field.key)
      if (field.type === "boolean") {
        initial[field.key] = existing !== false
      } else {
        initial[field.key] = existing != null ? String(existing) : ""
      }
    }
    setFieldValues(initial)
    setEditingOwner(currentProjectConfigRequestOptions())
    setEditingID(channelID)
  }

  function closeEdit() {
    invalidateSaveOwner()
    invalidateTutorialOwner()
    clearNotice()
    closeEditWithoutInvalidation()
  }

  function closeEditWithoutInvalidation() {
    setEditingID(null)
    setEditingOwner(null)
    setFieldValues({})
  }

  function invalidateSaveOwner() {
    saveGeneration++
    setSavingOwner(null)
  }

  function invalidateTutorialOwner() {
    tutorialGeneration++
    setTutorialOwner(null)
  }

  function formIdentity(): string {
    return editingID() ? `channel:${editingID()}` : "catalog"
  }

  function ownsSave(owner: ChannelSaveOwner): boolean {
    if (owner.generation !== saveGeneration || props.directory.trim() !== owner.directory) return false
    if (owner.formKind === "channel") {
      return editingID() === owner.channelID && editingOwner()?.directory === owner.directory
    }
    return true
  }

  function beginSave(formKind: ChannelSaveKind, directory: string, channelID = ""): ChannelSaveOwner {
    const owner = {
      directory,
      formKind,
      channelID,
      generation: ++saveGeneration,
    }
    setSavingOwner(owner)
    return owner
  }

  function savePending(formKind: ChannelSaveKind, channelID = ""): boolean {
    const owner = savingOwner()
    return !!owner && owner.formKind === formKind && owner.channelID === channelID && ownsSave(owner)
  }

  async function handleSaveChannel() {
    const entry = editingEntry()
    const configOwner = editingOwner()
    if (!entry || !configOwner?.directory || configOwner.isCurrentDirectory?.(configOwner.directory) === false) {
      closeEdit()
      return
    }
    const values: Record<string, any> = {}
    const currentValues = fieldValues()
    for (const field of entry.fields) {
      if (field.type === "boolean") {
        values[field.key] = currentValues[field.key] !== false
      } else {
        const value = String(currentValues[field.key] ?? "").trim()
        if (value) values[field.key] = value
      }
    }
    const owner = beginSave("channel", configOwner.directory, entry.id)
    const requestOptions = {
      ...configOwner,
      ownsResponse: () => ownsSave(owner),
    }
    try {
      await updateConfig((config) => {
        config.channel = config.channel || {}
        config.channel[entry.id] = structuredClone(values)
      }, requestOptions)
      if (!ownsSave(owner)) return
      showNotice(t("common.saved"), "active", "catalog")
      closeEditWithoutInvalidation()
    } catch (e) {
      if (ownsSave(owner)) {
        showNotice(e instanceof Error ? e.message : String(e), "error", `channel:${owner.channelID}`)
      }
    } finally {
      if (ownsSave(owner)) setSavingOwner(null)
    }
  }

  async function handleSavePublicUrl() {
    const configOwner = currentProjectConfigRequestOptions()
    const publicUrlSnapshot = localPublicUrl().trim()
    const owner = beginSave("public-url", configOwner.directory)
    const requestOptions = {
      ...configOwner,
      ownsResponse: () => ownsSave(owner),
    }
    try {
      await updateConfig((current: any) => {
        current.server = current.server || {}
        current.server.publicUrl = publicUrlSnapshot || undefined
        if (current.server.publicUrl === undefined) delete current.server.publicUrl
        if (Object.keys(current.server).length === 0) delete current.server
      }, requestOptions)
      if (ownsSave(owner)) showNotice(t("common.saved"), "active", "catalog")
    } catch (e) {
      if (ownsSave(owner)) showNotice(e instanceof Error ? e.message : String(e), "error", "catalog")
    } finally {
      if (ownsSave(owner)) setSavingOwner(null)
    }
  }

  function showNotice(msg: string, tone = "", ownerFormIdentity = formIdentity()) {
    if (noticeTimer) clearTimeout(noticeTimer)
    const generation = ++noticeGeneration
    setNotice(msg)
    setNoticeTone(tone)
    setNoticeFormIdentity(ownerFormIdentity)
    if (msg) {
      noticeTimer = setTimeout(() => {
        if (generation !== noticeGeneration) return
        setNotice("")
        noticeTimer = undefined
      }, 2600)
    }
  }

  function clearNotice() {
    noticeGeneration++
    if (noticeTimer) clearTimeout(noticeTimer)
    noticeTimer = undefined
    setNotice("")
    setNoticeTone("")
    setNoticeFormIdentity("catalog")
  }

  function ownsTutorial(owner: TutorialOpenOwner): boolean {
    return (
      owner.generation === tutorialGeneration &&
      props.directory.trim() === owner.directory &&
      formIdentity() === owner.formIdentity
    )
  }

  async function openTutorial(target: string, trigger: HTMLButtonElement) {
    const owner: TutorialOpenOwner = {
      directory: props.directory.trim(),
      formIdentity: formIdentity(),
      target,
      generation: ++tutorialGeneration,
      trigger,
    }
    setTutorialOwner(owner)
    try {
      const opened = await nativeOpen(target)
      if (!opened) throw new Error("native open returned false")
      if (ownsTutorial(owner)) clearNotice()
    } catch (error) {
      if (!ownsTutorial(owner)) return
      const detail = error instanceof Error ? error.message : String(error)
      showNotice(`${t("channel.tutorial_hint")}: ${detail}`, "error", owner.formIdentity)
      queueMicrotask(() => {
        if (ownsTutorial(owner) && owner.trigger.isConnected) owner.trigger.focus()
      })
    } finally {
      if (ownsTutorial(owner)) setTutorialOwner(null)
    }
  }

  function handleFieldChange(key: string, value: any) {
    setFieldValues((prev) => ({ ...prev, [key]: value }))
  }

  function noticeState() {
    return (
      <SettingsState
        tone={noticeTone() === "error" ? "error" : "success"}
        data-ui="channel-settings-notice"
        role={noticeTone() === "error" ? "alert" : "status"}
        aria-live={noticeTone() === "error" ? "assertive" : "polite"}
      >
        {notice()}
      </SettingsState>
    )
  }

  return (
    <>
      <SettingsPanel class="channel-panel">
        <For each={appStore.configLoadIssues.filter((issue) => issue.resource === "channel")}>
          {(issue) => <SettingsState tone="error">{issue.message}</SettingsState>}
        </For>
        <Show when={notice() && noticeFormIdentity() === "catalog"}>{noticeState()}</Show>

        <SettingsGroup title={t("channel.external_access")} description={t("channel.public_url_hint")} contentInset>
          <div class="extension-head">
            <TextField.Root as="label">
              <TextField.Label>{t("channel.public_url")}</TextField.Label>
              {/* Fixed example URL; the locale-sensitive field label/hint already carries the instruction. */}
              <TextField.Input
                type="url"
                pattern="https?://.+"
                placeholder="https://opencorvus.example.com"
                value={localPublicUrl()}
                onInput={(e) => setLocalPublicUrl(e.currentTarget.value)}
                onBlur={(e) => {
                  const v = e.currentTarget.value.trim()
                  e.currentTarget.setCustomValidity(
                    v && !/^https?:\/\/.+/i.test(v) ? t("channel.public_url_invalid") : "",
                  )
                }}
              />
            </TextField.Root>
            <div class="dialog-actions compact">
              <Button
                type="button"
                variant="solid"
                size="md"
                tone="accent"
                onClick={handleSavePublicUrl}
                disabled={savePending("public-url")}
              >
                {t("common.save")}
              </Button>
            </div>
          </div>
        </SettingsGroup>

        <SettingsGroup title={t("channel.available_channels")}>
          <Show when={channels().length > 0} fallback={<SettingsEmpty>{t("channel.none")}</SettingsEmpty>}>
            <div id="channelList">
              <For each={channels()}>
                {(item) => (
                  <SettingsRow
                    class="channel-settings-row"
                    title={<strong>{item.name}</strong>}
                    desc={item.summary}
                    meta={
                      <small class="channel-doc-credit">
                        {t("channel.tutorial_credit", { source: "OpenClaw Docs" })}
                      </small>
                    }
                    interactive
                    actions={
                      <div class="channel-row-actions">
                        <Badge tone={channelConfigurationStatusToneFromString(item.status)}>
                          {channelConfigurationStatusLabelFromString(item.status)}
                        </Badge>
                        <Show when={canOpenTutorialDocs()}>
                          <Button
                            type="button"
                            variant="ghost"
                            size="md"
                            tone="neutral"
                            title={t("channel.tutorial_hint")}
                            aria-label={t("channel.tutorial_hint")}
                            disabled={
                              tutorialOwner()?.target === item.docs_url && tutorialOwner()?.formIdentity === "catalog"
                            }
                            onClick={(event) => void openTutorial(item.docs_url, event.currentTarget)}
                          >
                            {t("channel.tutorial")}
                          </Button>
                        </Show>
                        <Button
                          type="button"
                          variant="solid"
                          size="md"
                          tone="accent"
                          title={t("channel.edit_title")}
                          aria-label={t("channel.edit_title")}
                          onClick={() => openEdit(item.id)}
                        >
                          {t("common.edit")}
                        </Button>
                      </div>
                    }
                  />
                )}
              </For>
            </div>
          </Show>
        </SettingsGroup>
      </SettingsPanel>

      <Show when={editingEntry() !== null && editingOwner()?.directory === props.directory.trim()}>
        {(_) => {
          const entry = editingEntry()!
          return (
            <Dialog
              open={true}
              title={t("channel.configuration_title", { name: entry.name })}
              onClose={() => closeEdit()}
              footer={
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="md"
                    tone="neutral"
                    onClick={() => closeEdit()}
                    disabled={savePending("channel", entry.id)}
                  >
                    {t("common.cancel")}
                  </Button>
                  <Button
                    type="button"
                    variant="solid"
                    size="md"
                    tone="accent"
                    onClick={handleSaveChannel}
                    disabled={savePending("channel", entry.id)}
                  >
                    {savePending("channel", entry.id) ? t("common.saving") : t("common.save")}
                  </Button>
                </>
              }
            >
              <Show when={notice() && noticeFormIdentity() === `channel:${entry.id}`}>{noticeState()}</Show>
              <div class="channel-doc-card">
                <div class="channel-doc-copy">
                  <span class="channel-doc-title">{t("channel.tutorial_hint")}</span>
                  <small class="channel-doc-credit">{t("channel.tutorial_credit", { source: "OpenClaw Docs" })}</small>
                </div>
                <Show when={canOpenTutorialDocs()}>
                  <Button
                    type="button"
                    variant="ghost"
                    size="md"
                    tone="neutral"
                    title={t("channel.tutorial_hint")}
                    aria-label={t("channel.tutorial_hint")}
                    disabled={
                      tutorialOwner()?.target === entry.docs_url &&
                      tutorialOwner()?.formIdentity === `channel:${entry.id}`
                    }
                    onClick={(event) => void openTutorial(entry.docs_url, event.currentTarget)}
                  >
                    {t("channel.tutorial")}
                  </Button>
                </Show>
              </div>

              <For each={entry.fields}>
                {(field) => {
                  const name = `channel_${entry.id}_${field.key}`
                  const currentVal = () => fieldValues()[field.key]

                  if (field.type === "boolean") {
                    return (
                      <div class="channel-boolean-field">
                        <Switch
                          name={name}
                          checked={currentVal() !== false}
                          onChange={(checked) => handleFieldChange(field.key, checked)}
                        >
                          {field.label}
                        </Switch>
                      </div>
                    )
                  }

                  const inputType = field.type === "secret" ? "password" : "text"
                  return (
                    <TextField.Root as="label">
                      <TextField.Label>{field.label}</TextField.Label>
                      {/* Channel schemas own these placeholders; render the configured example verbatim. */}
                      <TextField.Input
                        type={inputType}
                        name={name}
                        value={String(currentVal() ?? "")}
                        placeholder={field.placeholder || ""}
                        onInput={(e) => handleFieldChange(field.key, e.currentTarget.value)}
                      />
                    </TextField.Root>
                  )
                }}
              </For>
            </Dialog>
          )
        }}
      </Show>
    </>
  )
}
