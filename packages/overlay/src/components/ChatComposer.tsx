// ── ChatComposer Component ──
// Solid.js port of renderChatComposer / renderChatAttachments / chatForm submit
// and related attachment/keyboard logic

import {
  createSignal,
  createMemo,
  createEffect,
  createResource,
  For,
  Show,
  onCleanup,
  onMount,
  on,
  untrack,
} from "solid-js"
import type { JSX } from "solid-js"
import { DropdownMenu } from "./ui/DropdownMenu"
import { Slider } from "./ui/Slider"
import { t, tArray } from "../utils/i18n"
import { nativeMessage } from "../services/app-dialog"
import { formatErrorDetails, reportError } from "../services/diagnostics"
import { messageStore, setChatAttachments } from "../store/messages"
import type { ConversationExperience } from "../store/conversation-session"
import {
  canAcceptComposerAttachment,
  setComposerAttachmentInputEnabled,
} from "../services/composer-attachment-acceptance"
import {
  captureComposerFile,
  uploadComposerBytes,
  uploadComposerDirectoryReference,
} from "../services/attachment-upload"
import { fetchResourceAsObjectUrl } from "../services/api"
import {
  SCREENSHOT_BROWSER_THUMBNAIL_VARIANT,
  type VisibleComposerReferences,
  visibleComposerReferences,
} from "@opencorvus-ai/transport-protocol"
import { Icon } from "./ui/Icon"
import { AutoGrowTextarea } from "./ui/AutoGrowTextarea"
import { Badge } from "./ui/Badge"
import { Button } from "./ui/Button"
import { SelectControl } from "./ui/SelectControl"
import { PreviewableImage } from "./ImagePreview"
import {
  clampComposerTextareaHeight,
  composerTextareaResizeBounds,
  nextComposerTextareaKeyboardHeight,
} from "./composer-resizer"
import {
  clearComposerDraft,
  composerDraftText,
  normalizeComposerDraftKey,
  setComposerDraft,
} from "../services/composer-draft"
import type { ExpertSquadOption } from "../services/expert-squad"
import { currentUIScale } from "../utils/layout-tokens"
import { ComposerModelSelector } from "./ComposerModelSelector"
import { appStore } from "../store/app"
import { currentProjectConfigRequestOptions, patchConfig } from "../services/config"
import {
  composerRunControlState,
  parallelismConfigPatch,
  unattendedConfigPatch,
} from "../services/composer-run-controls"
import { composerPrimaryAction } from "../services/composer-primary-action"
import { isComposerImeKeyboardEvent } from "../services/composer-keyboard"
import {
  applyComposerMentionOption,
  composerMentionAtomicCaret,
  composerMentionAtomicEdit,
  composerMentionAtomicNavigation,
  composerMentionAtomicSelection,
  composerMentionDirectiveRanges,
  ComposerMentionDirectiveError,
  composerMentionOptions,
  composerMentionPresentationSegments,
  composerMentionQueryKey,
  findComposerMentionQuery,
  resolveComposerMentionDirectives,
  type ComposerMentionCatalog,
  type ComposerMentionEntity,
  type ComposerMentionOption,
} from "../services/composer-mention"
import { ComposerMentionMenu } from "./ComposerMentionMenu"
import { ComposerReferenceSelector } from "./ComposerReferenceSelector"
import { pickDirectory } from "../services/workspace"
import { activeProjectDirectory } from "../services/project-directory"
import {
  composerAttachmentCapacity,
  composerAttachmentCounts,
  type ComposerAttachmentKind,
} from "../services/composer-attachment-capacity"
import {
  COMPOSER_FILE_ATTACHMENT_LIMIT,
  COMPOSER_FOLDER_ATTACHMENT_LIMIT,
  DIRECTORY_REFERENCE_MIME,
} from "@opencorvus-ai/transport-protocol"
import type { ComposerIntent, ConversationTarget, ProductPillar } from "@opencorvus-ai/transport-protocol"

// ── Types ──

export interface ChatAttachment {
  kind: ComposerAttachmentKind
  sha: string
  mime: string
  url: string
  filename: string
  size: number
}

export type { ExpertSquadOption } from "../services/expert-squad"

interface ComposerIntentOption<T extends string> {
  value: T
  label: string
  description: string
  icon: "terminal" | "work" | "message" | "mission"
}

export interface ComposerSkillOption {
  name: string
  description?: string
}

export interface ComposerSubmitDirectives {
  expertSquadIDs: string[]
  missionSkillNames: string[]
}

export interface ChatComposerProps {
  /**
   * Whether the composer should be interactive.
   */
  enabled: boolean
  /**
   * Whether a task is active (in-flight request or interruptable task status).
   * When true the send button becomes a stop button.
   */
  busy: boolean
  /**
   * Whether the busy request is being stopped (transitional state).
   */
  stopping?: boolean
  /** Called when the user submits a message. */
  onSubmit: (
    text: string,
    attachments: ChatAttachment[],
    webSearch: boolean,
    directives: ComposerSubmitDirectives,
  ) => void | Promise<void>
  /** Resolve and activate the Project that owns a real attachment upload. */
  resolveAttachmentDirectory: () => Promise<string>
  /** Called when the user clicks the stop button while busy. */
  onStop?: () => void
  formID?: string
  textareaID?: string
  sendID?: string
  stopID?: string
  textareaDataUI?: string
  sendDataUI?: string
  /** Stable task/mission scoped key used to save and restore draft text. */
  draftKey?: string
  /** Optional single prompt hint for scoped composers such as Mission launch. */
  placeholder?: string
  skills: ComposerSkillOption[]
  missionSkills: ComposerSkillOption[]
  referenceCatalogError?: string
  expertSquads: ExpertSquadOption[]
  onExpertSquadQuery?: (query: string, selectedExpertSquadIDs: readonly string[]) => void
  onInstallMoreExpertSquads?: () => void
  activeExpertSquadID: string
  conversationActive: boolean
  launchReferences: VisibleComposerReferences
  conversationExperience?: ConversationExperience
  composerIntent: ComposerIntent
  activeComposerIntent?: ComposerIntent
  onComposerIntentChange: (intent: ComposerIntent) => void
}

function composerDialogErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function showComposerMessage(
  owner: string,
  message: string,
  options: { title?: string; kind?: string; okLabel?: string } = {},
): void {
  void nativeMessage(message, options).catch((error) => {
    reportError({
      id: `chat-composer:${owner}`,
      title: t("common.error"),
      message: composerDialogErrorMessage(error),
      details: formatErrorDetails(error),
    })
  })
}

// ── Constants ──

const REQUEST_PERFORMANCE_WARNING_BYTES = 50 * 1024
const UTF8_ENCODER = new TextEncoder()

// ── Helpers ──

// Names that propagate from drop / paste / file-picker into the
// orchestrator's attachment inventory must be:
//   - non-empty (paste hands us "" on Chromium)
//   - shell-safe (no path separators, no metacharacters) — server-side
//     `displayFilename` replaces unsafe names with a generated display name
//     that stays readable to sub-agents
// Mirrors the SAFE_FILENAME_RE rule in
// `opencorvus/src/storage/attachment-store.ts`. Keeping the regex
// duplicated here (the server-side helper is not bundled into the
// overlay) is the lesser evil; the alternative is shipping the server
// rule through the SDK just for one literal.
const SAFE_FILENAME_RE = /^[A-Za-z0-9._\-一-鿿 ]+$/
const PASTE_EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "application/pdf": "pdf",
  "text/plain": "txt",
}

const SUPPORTED_COMPOSER_FILE_ACCEPT = [
  "image/*",
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "text/tab-separated-values",
  "application/json",
  "application/xml",
  "text/xml",
  "application/zip",
  "application/gzip",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".c",
  ".cpp",
  ".cs",
  ".css",
  ".csv",
  ".doc",
  ".docx",
  ".env",
  ".gif",
  ".go",
  ".gz",
  ".heic",
  ".heif",
  ".hpp",
  ".html",
  ".java",
  ".jpeg",
  ".jpg",
  ".js",
  ".json",
  ".jsonc",
  ".jsx",
  ".kt",
  ".log",
  ".md",
  ".markdown",
  ".pdf",
  ".png",
  ".ppt",
  ".pptx",
  ".ps1",
  ".py",
  ".rs",
  ".rtf",
  ".sh",
  ".sql",
  ".svg",
  ".tar",
  ".tgz",
  ".toml",
  ".ts",
  ".tsx",
  ".tsv",
  ".txt",
  ".webp",
  ".xls",
  ".xlsx",
  ".xml",
  ".yaml",
  ".yml",
  ".zip",
].join(",")

interface ComposerAttachmentLoadersProps {
  disabled: boolean
  fileCount: number
  folderCount: number
  uploadingCount: number
  parallelism: number | null
  unattended: boolean | null
  runControlBusy: boolean
  onFiles: (files: readonly File[]) => void | Promise<void>
  onFolder: () => void | Promise<void>
  onParallelismChange: (value: number) => void
  onUnattendedChange: (enabled: boolean) => void
}

function ComposerAttachmentLoaders(props: ComposerAttachmentLoadersProps): JSX.Element {
  let fileInputRef: HTMLInputElement | undefined

  function openFilePicker(): void {
    if (props.disabled) return
    fileInputRef?.click()
  }

  function openFolderPicker(): void {
    if (props.disabled) return
    void props.onFolder()
  }

  function handleFileSelection(event: Event): void {
    const input = event.currentTarget as HTMLInputElement
    const files = Array.from(input.files ?? [])
    input.value = ""
    if (files.length === 0) return
    void props.onFiles(files)
  }

  return (
    <div class="composer-attachment-loaders" data-ui="composer-attachment-loaders">
      <input
        ref={fileInputRef}
        class="composer-attachment-input"
        data-ui="composer-file-input"
        type="file"
        multiple
        accept={SUPPORTED_COMPOSER_FILE_ACCEPT}
        disabled={props.disabled}
        tabIndex={-1}
        aria-hidden="true"
        onChange={handleFileSelection}
      />
      <Show
        when={props.uploadingCount > 0}
        fallback={
          <Show when={props.fileCount > 0 || props.folderCount > 0}>
            <span class="composer-attachment-loader-count" role="status" aria-live="polite">
              {t("chat.attachment_loader.count", {
                files: props.fileCount,
                fileLimit: COMPOSER_FILE_ATTACHMENT_LIMIT,
                folders: props.folderCount,
                folderLimit: COMPOSER_FOLDER_ATTACHMENT_LIMIT,
              })}
            </span>
          </Show>
        }
      >
        <span class="composer-attachment-loader-count" role="status" aria-live="polite">
          {t("chat.attachment_loader.uploading", { count: props.uploadingCount })}
        </span>
      </Show>
      <DropdownMenu.Root placement="top-start" gutter={6} fitViewport>
        <DropdownMenu.Trigger
          as={Button}
          variant="ghost"
          size="icon"
          tone="neutral"
          type="button"
          class="composer-attachment-loader-trigger"
          data-ui="composer-attachment-menu-trigger"
          disabled={props.disabled}
          title={t("chat.attachment_loader.file_title")}
          aria-label={t("chat.attachment_loader.file_title")}
        >
          <Icon name="plus" size="medium" />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content class="composer-attachment-menu">
            <DropdownMenu.Item
              as="button"
              type="button"
              class="composer-attachment-menu-item"
              data-ui="composer-file-loader-trigger"
              onSelect={openFilePicker}
            >
              <Icon name="attach" size="medium" />
              <span>{t("chat.attachment_loader.file_title")}</span>
            </DropdownMenu.Item>
            <DropdownMenu.Item
              as="button"
              type="button"
              class="composer-attachment-menu-item"
              data-ui="composer-folder-loader-trigger"
              onSelect={openFolderPicker}
            >
              <Icon name="folder-open" size="medium" />
              <span>{t("chat.attachment_loader.folder_title")}</span>
            </DropdownMenu.Item>
            <DropdownMenu.Separator />
            <DropdownMenu.Sub gutter={6}>
              <DropdownMenu.SubTrigger
                class="composer-attachment-menu-item composer-runtime-menu-item"
                data-ui="composer-parallelism-control"
                disabled={props.parallelism === null || props.runControlBusy}
                textValue={t("chat.parallelism")}
                title={t("chat.parallelism_hint")}
              >
                <Icon class="composer-runtime-menu-icon" name="workflow" size="medium" />
                <span>{t("chat.parallelism")}</span>
                <output class="composer-runtime-menu-value" aria-live="polite">
                  {props.parallelism ?? "—"}
                </output>
                <Icon class="composer-runtime-menu-chevron" name="chevron" />
              </DropdownMenu.SubTrigger>
              <DropdownMenu.Portal>
                <DropdownMenu.SubContent class="composer-parallelism-menu">
                  <Show when={props.parallelism} keyed>
                    {(parallelism) => {
                      let keyboardValue = parallelism
                      const commitValue = (value: number | undefined) => {
                        if (value !== undefined && value !== parallelism) props.onParallelismChange(value)
                      }
                      return (
                        <Slider.Root
                          class="composer-parallelism-slider"
                          defaultValue={[parallelism]}
                          minValue={1}
                          maxValue={parallelism * 2}
                          step={1}
                          disabled={props.runControlBusy}
                          getValueLabel={({ values }) => String(values[0] ?? parallelism)}
                          onChange={(values) => {
                            keyboardValue = values[0] ?? parallelism
                          }}
                          onChangeEnd={(values) => commitValue(values[0])}
                        >
                          <div class="composer-parallelism-slider-header">
                            <Slider.Label>{t("chat.parallelism")}</Slider.Label>
                            <Slider.ValueLabel />
                          </div>
                          <Slider.Track>
                            <Slider.Fill />
                            <Slider.Thumb onKeyUp={() => commitValue(keyboardValue)}>
                              <Slider.Input />
                            </Slider.Thumb>
                          </Slider.Track>
                          <p>{t("chat.parallelism_hint")}</p>
                        </Slider.Root>
                      )
                    }}
                  </Show>
                </DropdownMenu.SubContent>
              </DropdownMenu.Portal>
            </DropdownMenu.Sub>
            <DropdownMenu.CheckboxItem
              class="composer-attachment-menu-item composer-runtime-menu-item"
              data-ui="composer-unattended-control"
              checked={props.unattended === true}
              disabled={props.unattended === null || props.runControlBusy}
              onChange={props.onUnattendedChange}
              textValue={t("chat.unattended")}
              title={t("chat.unattended_hint")}
            >
              <Icon class="composer-runtime-menu-icon" name="avatar-assistant" size="medium" />
              <span>{t("chat.unattended")}</span>
            </DropdownMenu.CheckboxItem>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  )
}

function chooseAttachmentFilename(original: string | undefined, mime: string): string {
  if (original && SAFE_FILENAME_RE.test(original)) return original
  const ext = PASTE_EXT_BY_MIME[mime] ?? (mime.split("/")[1] ?? "bin").replace(/[^A-Za-z0-9]/g, "")
  // Stamp lets the operator distinguish multiple pastes within one
  // composer session at a glance — sha-style handles all blur together.
  const stamp = new Date().toISOString().replace(/[-:T]/g, "").replace(/\..+/, "")
  return `pasted-${stamp}.${ext || "bin"}`
}

function ComposerAttachmentThumbnail(props: { attachment: ChatAttachment }): JSX.Element {
  const thumbnailUrl = () => `${props.attachment.url}?variant=${SCREENSHOT_BROWSER_THUMBNAIL_VARIANT}`
  const [source] = createResource(thumbnailUrl, (url) => fetchResourceAsObjectUrl(url))
  return (
    <Show
      when={source()}
      fallback={<span class="chat-attachment-icon">{props.attachment.filename.split(".").pop()?.toUpperCase()}</span>}
    >
      {(url) => (
        <PreviewableImage
          src={url()}
          alt={props.attachment.filename}
          triggerClass="composer-attachment-preview-trigger"
          imageClass="chat-attachment-thumb"
          imageDataUI="composer-image-attachment-thumbnail"
          previewLoader={() => fetchResourceAsObjectUrl(props.attachment.url)}
        />
      )}
    </Show>
  )
}

function utf8ByteLength(value: string): number {
  return UTF8_ENCODER.encode(value).byteLength
}

// ── Component ──

export function ChatComposer(props: ChatComposerProps) {
  let textareaRef!: HTMLTextAreaElement
  let mentionPresentationRef: HTMLDivElement | undefined
  let formRef!: HTMLFormElement

  const [text, setText] = createSignal("")
  let loadedDraftKey: string | null = null
  // The message store is the single source for staged attachments. Every
  // manual file/folder/image add, remove and clear operation uses it.
  const attachments = () => messageStore.chatAttachments as ChatAttachment[]
  const setAttachments = (next: ChatAttachment[] | ((prev: ChatAttachment[]) => ChatAttachment[])) => {
    const nextValue =
      typeof next === "function" ? (next as (prev: ChatAttachment[]) => ChatAttachment[])(attachments()) : next
    setChatAttachments(nextValue)
  }
  const [dragover, setDragover] = createSignal(false)
  const [focused, setFocused] = createSignal(false)
  const [caretPosition, setCaretPosition] = createSignal(0)
  const [dismissedMentionQueryKey, setDismissedMentionQueryKey] = createSignal("")
  const [highlightedMentionKey, setHighlightedMentionKey] = createSignal("")
  const [hintText, setHintText] = createSignal("")
  const [submitting, setSubmitting] = createSignal(false)
  const [uploadingCount, setUploadingCount] = createSignal(0)
  const [modelAvailable, setModelAvailable] = createSignal(false)
  const attachmentCounts = createMemo(() => composerAttachmentCounts(attachments()))
  const [savingRunControl, setSavingRunControl] = createSignal<"parallelism" | "unattended" | null>(null)
  const [textareaResizeHeight, setTextareaResizeHeight] = createSignal<number | null>(null)
  const runControlState = createMemo(() => composerRunControlState(appStore.config))
  const activeExpertSquad = createMemo(() => props.expertSquads.find((squad) => squad.id === props.activeExpertSquadID))
  const mentionCatalog = createMemo<ComposerMentionCatalog>(() => ({
    categories: [
      {
        kind: "skill",
        label: t("chat.mention.category_skill"),
        description: t("chat.mention.category_skill_description"),
      },
      {
        kind: "mission-skill",
        label: t("chat.mention.category_mission_skill"),
        description: t("chat.mention.category_mission_skill_description"),
      },
      {
        kind: "squad",
        label: t("chat.mention.category_squad"),
        description: t("chat.mention.category_squad_description"),
      },
    ],
    skills: props.skills.map(
      (skill): ComposerMentionEntity => ({
        kind: "skill",
        id: skill.name,
        label: skill.name,
        description: skill.description,
      }),
    ),
    missionSkills: props.missionSkills.map(
      (skill): ComposerMentionEntity => ({
        kind: "mission-skill",
        id: skill.name,
        label: skill.name,
        description: skill.description,
      }),
    ),
    squads: props.expertSquads.map(
      (squad): ComposerMentionEntity => ({
        kind: "squad",
        id: squad.id,
        label: squad.name,
        description: squad.description,
      }),
    ),
  }))
  const activeMentionQuery = createMemo(() => {
    if (!focused() || !props.enabled || props.busy) return null
    return findComposerMentionQuery(text(), caretPosition())
  })
  createEffect<string>((previousQuery) => {
    const mention = activeMentionQuery()
    const query = mention?.stage === "entity" && mention.kind === "squad" ? mention.query : ""
    if (query !== previousQuery) {
      const selectedExpertSquadIDs = composerMentionDirectiveRanges(text())
        .filter((directive) => directive.kind === "squad")
        .map((directive) => directive.value)
      props.onExpertSquadQuery?.(query, selectedExpertSquadIDs)
    }
    return query
  }, "")
  const activeMentionOptions = createMemo(() => {
    const query = activeMentionQuery()
    return query ? composerMentionOptions(query, mentionCatalog()) : []
  })
  const mentionMenuOpen = createMemo(() => {
    const query = activeMentionQuery()
    if (!query || composerMentionQueryKey(query) === dismissedMentionQueryKey()) return false
    return true
  })
  const selectedMentionOption = createMemo<ComposerMentionOption | null>(() => {
    const options = activeMentionOptions()
    return (
      options.find((option) => option.key === highlightedMentionKey() && !option.disabled) ??
      options.find((option) => !option.disabled) ??
      null
    )
  })
  const mentionPresentation = createMemo(() => composerMentionPresentationSegments(text()))
  const hasMentionPresentation = createMemo(() => mentionPresentation().some((segment) => segment.kind !== undefined))

  async function saveRunControl(owner: "parallelism" | "unattended", diff: Record<string, unknown>) {
    if (savingRunControl()) return
    setSavingRunControl(owner)
    try {
      await patchConfig(diff, currentProjectConfigRequestOptions())
    } catch (error) {
      reportError({
        id: `composer-run-control:${owner}`,
        title: t("chat.run_control_save_failed"),
        message: submitErrorMessage(error),
        details: formatErrorDetails(error),
      })
    } finally {
      setSavingRunControl(null)
    }
  }

  function setUnattended(enabled: boolean) {
    const current = runControlState().unattended
    if (current === null || current === enabled) return
    void saveRunControl("unattended", unattendedConfigPatch(enabled))
  }

  function setParallelism(value: number) {
    const current = runControlState().parallelism
    if (current === null || current === value) return
    void saveRunControl("parallelism", parallelismConfigPatch(value))
  }
  let resizeSession: { pointerID: number; startY: number; startHeight: number } | undefined

  const hasText = createMemo(() => text().trim().length > 0)
  const showLargeRequestWarning = createMemo(() => utf8ByteLength(text()) > REQUEST_PERFORMANCE_WARNING_BYTES)
  const stopping = () => props.stopping === true

  createEffect(() => {
    setComposerAttachmentInputEnabled(props.enabled)
  })
  onCleanup(() => setComposerAttachmentInputEnabled(false))

  function writeText(next: string): void {
    setText(next)
    if (textareaRef && textareaRef.value !== next) textareaRef.value = next
    queueMicrotask(syncMentionPresentationScroll)
  }

  function syncMentionPresentationScroll(): void {
    if (!textareaRef || !mentionPresentationRef) return
    mentionPresentationRef.scrollTop = textareaRef.scrollTop
    mentionPresentationRef.scrollLeft = textareaRef.scrollLeft
  }

  function writeDraftText(next: string): void {
    writeText(next)
    const key = normalizeComposerDraftKey(props.draftKey)
    if (key) setComposerDraft(key, next)
  }

  function resetMentionInteraction(): void {
    setDismissedMentionQueryKey("")
    setHighlightedMentionKey("")
  }

  function updateCaretFromTextarea(): void {
    if (!textareaRef) {
      setCaretPosition(text().length)
      return
    }
    const start = textareaRef.selectionStart ?? text().length
    const end = textareaRef.selectionEnd ?? start
    if (start !== end) {
      const selection = composerMentionAtomicSelection(text(), start, end)
      if (selection.start !== start || selection.end !== end) {
        textareaRef.setSelectionRange(selection.start, selection.end)
      }
      setCaretPosition(selection.start)
      return
    }
    const atomicCaret = composerMentionAtomicCaret(text(), start, "nearest")
    if (atomicCaret !== start) textareaRef.setSelectionRange(atomicCaret, atomicCaret)
    setCaretPosition(atomicCaret)
  }

  function applyAtomicMentionEdit(key: "Backspace" | "Delete"): boolean {
    if (!textareaRef) return false
    const edit = composerMentionAtomicEdit(
      text(),
      textareaRef.selectionStart ?? text().length,
      textareaRef.selectionEnd ?? text().length,
      key,
    )
    if (!edit) return false
    writeDraftText(edit.text)
    setCaretPosition(edit.caret)
    resetMentionInteraction()
    queueMicrotask(() => textareaRef?.setSelectionRange(edit.caret, edit.caret))
    return true
  }

  function applyAtomicMentionNavigation(direction: "left" | "right"): boolean {
    if (!textareaRef) return false
    const start = textareaRef.selectionStart ?? text().length
    const end = textareaRef.selectionEnd ?? start
    if (start !== end) return false
    const caret = composerMentionAtomicNavigation(text(), start, direction)
    if (caret === null) return false
    setCaretPosition(caret)
    textareaRef.setSelectionRange(caret, caret)
    return true
  }

  function selectMentionOption(option: ComposerMentionOption): void {
    if (option.disabled) return
    const query = activeMentionQuery()
    if (!query) return
    const inserted = applyComposerMentionOption(text(), query, option)
    writeDraftText(inserted.text)
    setCaretPosition(inserted.caret)
    resetMentionInteraction()
    textareaRef?.setSelectionRange(inserted.caret, inserted.caret)
    queueMicrotask(() => {
      textareaRef?.focus()
      textareaRef?.setSelectionRange(inserted.caret, inserted.caret)
    })
  }

  function moveMentionHighlight(delta: number): void {
    const options = activeMentionOptions()
    if (options.length === 0) return
    const current = selectedMentionOption()
    const enabledOptions = options.filter((option) => !option.disabled)
    if (enabledOptions.length === 0) return
    const currentIndex = current ? enabledOptions.findIndex((option) => option.key === current.key) : 0
    const nextIndex = (currentIndex + delta + enabledOptions.length) % enabledOptions.length
    setHighlightedMentionKey(enabledOptions[nextIndex]!.key)
  }

  createEffect(() => {
    const key = normalizeComposerDraftKey(props.draftKey)
    const draft = key ? composerDraftText(key) : ""
    const currentText = untrack(text)
    if (loadedDraftKey === key && draft === currentText) return
    loadedDraftKey = key
    writeText(draft)
  })

  let attachmentUploadGeneration = 0
  function invalidateAttachmentUploads(): void {
    attachmentUploadGeneration += 1
    setUploadingCount(0)
  }

  createEffect(
    on(
      () => `${normalizeComposerDraftKey(props.draftKey)}\u0000${activeProjectDirectory()}`,
      invalidateAttachmentUploads,
      { defer: true },
    ),
  )
  onCleanup(invalidateAttachmentUploads)

  function captureAttachmentUploadOwner(): {
    draftKey: string
    directory: string
    generation: number
  } {
    return {
      draftKey: normalizeComposerDraftKey(props.draftKey),
      directory: activeProjectDirectory(),
      generation: attachmentUploadGeneration,
    }
  }

  function ownsAttachmentUpload(owner: { draftKey: string; directory: string; generation: number }): boolean {
    return (
      owner.generation === attachmentUploadGeneration &&
      owner.draftKey === normalizeComposerDraftKey(props.draftKey) &&
      owner.directory === activeProjectDirectory()
    )
  }

  // ── Rotating placeholder ──
  // Cycles through a shuffled list of project-level examples while the
  // composer sits idle (empty + unfocused). One signal write per rotation;
  // no per-character typewriter. The previous 28–60ms typewriter loop wrote
  // 20–70 signal-driven DOM mutations per second the entire time the
  // composer was visible, which dominated idle WebView composition cost on
  // laptops for a purely decorative affordance.
  let rotateTimer: ReturnType<typeof setInterval> | undefined
  let hintOrder: number[] = []
  let hintCursor = 0
  const ROTATE_MS = 7_000

  function shuffleIndices(n: number): number[] {
    const arr = Array.from({ length: n }, (_, i) => i)
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  }

  function stopHint() {
    if (rotateTimer) {
      clearInterval(rotateTimer)
      rotateTimer = undefined
    }
  }

  function startRotate(examples: string[]) {
    stopHint()
    if (examples.length === 0) {
      setHintText("")
      return
    }
    if (hintOrder.length !== examples.length) {
      hintOrder = shuffleIndices(examples.length)
      hintCursor = 0
    }
    setHintText(examples[hintOrder[hintCursor % hintOrder.length]!]!)
    if (examples.length === 1) return
    rotateTimer = setInterval(() => {
      hintCursor = (hintCursor + 1) % hintOrder.length
      setHintText(examples[hintOrder[hintCursor]!]!)
    }, ROTATE_MS)
  }

  const showHint = createMemo(() => props.enabled && !props.busy && text().length === 0)

  createEffect(() => {
    const scopedPlaceholder = props.placeholder?.trim()
    const examples = scopedPlaceholder ? [scopedPlaceholder] : tArray("chat.placeholder_projects")
    if (showHint() && examples.length > 0) {
      startRotate(examples)
    } else {
      stopHint()
      setHintText("")
    }
  })

  // Pause rotation when the overlay window is hidden / minimized — the user
  // is not looking, and Tauri's WebView2 still wakes the JS event loop on
  // setInterval ticks. visibilitychange covers minimize / alt-tab on Windows.
  if (typeof document !== "undefined") {
    const onVisibility = () => {
      if (document.hidden) {
        stopHint()
      } else {
        const scopedPlaceholder = props.placeholder?.trim()
        const examples = scopedPlaceholder ? [scopedPlaceholder] : tArray("chat.placeholder_projects")
        if (showHint() && examples.length > 0) startRotate(examples)
      }
    }
    document.addEventListener("visibilitychange", onVisibility)
    onCleanup(() => document.removeEventListener("visibilitychange", onVisibility))
  }

  onCleanup(() => stopHint())

  // ── Auto-grow textarea ──
  // Content-driven height (capped, then scroll) is owned by the shared
  // <AutoGrowTextarea> primitive. The drag handle below still sets
  // `--chat-textarea-height` as a min-height floor on the wrap, so manual
  // resize remains a hard floor while the primitive handles content height.

  onMount(() => {
    if (!textareaRef) return
    // Park the caret at the start of the input. Click-focus uses the click
    // position, so this only matters for keyboard-driven focus.
    try {
      textareaRef.setSelectionRange(0, 0)
    } catch {
      /* ignore — selection APIs throw on detached elements in some hosts */
    }
  })

  // ── Attachment handling ──

  async function addAttachment(file: File, displayName?: string) {
    if (!canAcceptComposerAttachment()) return
    if (!file) return
    if (composerAttachmentCapacity(attachments(), "file") === 0) {
      showComposerMessage(
        "attachment-file-limit",
        t("chat.attachment_limit.files", { count: COMPOSER_FILE_ATTACHMENT_LIMIT }),
        {
          title: t("chat.attachment_limit.title"),
          kind: "warning",
        },
      )
      return
    }
    const sourceName = displayName || file.name
    const mime = file.type || "application/octet-stream"
    const filename = chooseAttachmentFilename(sourceName, mime)
    setUploadingCount((count) => count + 1)
    let owner: ReturnType<typeof captureAttachmentUploadOwner> | undefined
    try {
      const captured = await captureComposerFile(file)
      const directory = await props.resolveAttachmentDirectory()
      owner = captureAttachmentUploadOwner()
      if (owner.directory !== directory) {
        throw new Error("Attachment Project activation did not establish the resolved directory")
      }
      const reference = await uploadComposerBytes({ ...captured, filename, directory: owner.directory })
      if (!ownsAttachmentUpload(owner)) return
      if (composerAttachmentCapacity(attachments(), "file") === 0) {
        showComposerMessage(
          "attachment-file-limit",
          t("chat.attachment_limit.files", { count: COMPOSER_FILE_ATTACHMENT_LIMIT }),
          {
            title: t("chat.attachment_limit.title"),
            kind: "warning",
          },
        )
        return
      }
      setAttachments((prev) => [...prev, { ...reference, kind: "file" }])
    } catch (err) {
      if (owner && !ownsAttachmentUpload(owner)) return
      console.warn("[ChatComposer] attachment upload failed for", sourceName, err)
      showComposerMessage("attachment-upload-failed", t("chat.attach_upload_failed", { name: sourceName }), {
        title: t("chat.attach_upload_failed_title"),
        kind: "error",
      })
    } finally {
      if (!owner || ownsAttachmentUpload(owner)) setUploadingCount((count) => Math.max(0, count - 1))
    }
  }

  function removeAttachment(index: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== index))
  }

  async function addFiles(files: readonly File[]): Promise<void> {
    const capacity = composerAttachmentCapacity(attachments(), "file")
    const accepted = files.slice(0, capacity)
    // Start every transient clipboard read before any Project activation or upload can suspend the batch.
    await Promise.all(accepted.map((file) => addAttachment(file)))
    if (files.length > accepted.length) {
      showComposerMessage(
        "attachment-file-limit",
        t("chat.attachment_limit.files", { count: COMPOSER_FILE_ATTACHMENT_LIMIT }),
        {
          title: t("chat.attachment_limit.title"),
          kind: "warning",
        },
      )
    }
  }

  async function addFolder(): Promise<void> {
    if (composerAttachmentCapacity(attachments(), "folder") === 0) {
      showComposerMessage(
        "attachment-folder-limit",
        t("chat.attachment_limit.folders", { count: COMPOSER_FOLDER_ATTACHMENT_LIMIT }),
        {
          title: t("chat.attachment_limit.title"),
          kind: "warning",
        },
      )
      return
    }
    let uploadStarted = false
    const pickerOwner = captureAttachmentUploadOwner()
    let owner: ReturnType<typeof captureAttachmentUploadOwner> | undefined
    try {
      const selectedPath = await pickDirectory(pickerOwner.directory || undefined)
      if (!selectedPath) return
      if (!ownsAttachmentUpload(pickerOwner)) return
      setUploadingCount((count) => count + 1)
      uploadStarted = true
      const directory = await props.resolveAttachmentDirectory()
      owner = captureAttachmentUploadOwner()
      if (owner.directory !== directory) {
        throw new Error("Attachment Project activation did not establish the resolved directory")
      }
      const reference = await uploadComposerDirectoryReference(selectedPath, owner.directory)
      if (!ownsAttachmentUpload(owner)) return
      if (composerAttachmentCapacity(attachments(), "folder") === 0) {
        showComposerMessage(
          "attachment-folder-limit",
          t("chat.attachment_limit.folders", { count: COMPOSER_FOLDER_ATTACHMENT_LIMIT }),
          {
            title: t("chat.attachment_limit.title"),
            kind: "warning",
          },
        )
        return
      }
      setAttachments((prev) => [...prev, { ...reference, kind: "folder", mime: DIRECTORY_REFERENCE_MIME }])
    } catch (err) {
      if (owner && !ownsAttachmentUpload(owner)) return
      showComposerMessage(
        "attachment-folder-failed",
        t("chat.attach_folder_failed", { error: composerDialogErrorMessage(err) }),
        {
          title: t("chat.attach_upload_failed_title"),
          kind: "error",
        },
      )
    } finally {
      if (uploadStarted && (!owner || ownsAttachmentUpload(owner))) {
        setUploadingCount((count) => Math.max(0, count - 1))
      }
    }
  }

  // ── Submit ──

  function submitErrorMessage(error: unknown): string {
    if (error instanceof ComposerMentionDirectiveError) {
      if (error.code === "malformed_reference") return error.entity
      if (error.code === "unknown_skill") return t("chat.mention.error_unknown_skill", { name: error.entity })
      if (error.code === "unknown_mission_skill") {
        return t("chat.mention.error_unknown_mission_skill", { name: error.entity })
      }
      if (error.code === "unknown_squad") return t("chat.mention.error_unknown_squad", { name: error.entity })
      return error.entity
    }
    if (error instanceof Error && error.message) return error.message
    return String(error)
  }

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault()
    if (submitting()) return
    if (uploadingCount() > 0) return
    if (!props.enabled) return
    if (!modelAvailable()) return
    const trimmed = text().trim()
    if (!trimmed) return
    const sentAttachments = [...attachments()]
    const submittedDraftKey = props.draftKey
    setSubmitting(true)
    try {
      const directives = resolveComposerMentionDirectives(trimmed, mentionCatalog())
      await props.onSubmit(trimmed, sentAttachments, false, {
        expertSquadIDs: directives.squadIDs,
        missionSkillNames: directives.missionSkillNames,
      })
      setText("")
      setCaretPosition(0)
      resetMentionInteraction()
      clearComposerDraft(submittedDraftKey)
      setAttachments([])
      if (textareaRef) {
        textareaRef.value = ""
        try {
          textareaRef.setSelectionRange(0, 0)
        } catch {
          /* selection APIs may throw if the element has been detached */
        }
      }
    } catch (error) {
      console.error("[ChatComposer] submit failed", error)
      showComposerMessage("send-failed", t("chat.send_failed", { error: submitErrorMessage(error) }), {
        title: t("chat.send_failed_title"),
        kind: "error",
      })
    } finally {
      setSubmitting(false)
    }
  }

  // ── Keyboard: Enter to send, Shift+Enter for newline ──

  function handleKeyDown(e: KeyboardEvent) {
    if (isComposerImeKeyboardEvent(e)) return
    if (mentionMenuOpen()) {
      const query = activeMentionQuery()
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault()
        moveMentionHighlight(e.key === "ArrowDown" ? 1 : -1)
        return
      }
      const confirmOption = selectedMentionOption()
      if ((e.key === "Enter" || e.key === "Tab") && confirmOption) {
        e.preventDefault()
        selectMentionOption(confirmOption)
        return
      }
      if (e.key === "Escape") {
        e.preventDefault()
        if (query) setDismissedMentionQueryKey(composerMentionQueryKey(query))
        return
      }
    }
    if ((e.key === "Backspace" || e.key === "Delete") && applyAtomicMentionEdit(e.key)) {
      e.preventDefault()
      return
    }
    if (
      !e.shiftKey &&
      !e.altKey &&
      !e.ctrlKey &&
      !e.metaKey &&
      (e.key === "ArrowLeft" || e.key === "ArrowRight") &&
      applyAtomicMentionNavigation(e.key === "ArrowLeft" ? "left" : "right")
    ) {
      e.preventDefault()
      return
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (!props.enabled || primaryAction() === "stop") return
      formRef?.requestSubmit()
    }
  }

  // ── Drag-and-drop ──

  function handleDragOver(e: DragEvent) {
    e.preventDefault()
    if (!canAcceptComposerAttachment()) {
      setDragover(false)
      return
    }
    setDragover(true)
  }

  function handleDragLeave(e: DragEvent) {
    if (!(formRef as HTMLElement).contains(e.relatedTarget as Node)) {
      setDragover(false)
    }
  }

  async function handleDrop(e: DragEvent) {
    e.preventDefault()
    setDragover(false)
    if (!canAcceptComposerAttachment()) return
    const files = e.dataTransfer?.files
    if (!files) return
    await addFiles(Array.from(files))
  }

  // ── Paste images ──

  async function handlePaste(e: ClipboardEvent) {
    const files = e.clipboardData?.files
    if (!files || !files.length) return
    e.preventDefault()
    if (!canAcceptComposerAttachment()) return
    await addFiles(Array.from(files))
  }

  // ── Composer resize ──

  function textareaResizeBounds() {
    return composerTextareaResizeBounds(currentUIScale())
  }

  function currentTextareaResizeHeight(): number {
    const bounds = textareaResizeBounds()
    const height = textareaResizeHeight()
    return clampComposerTextareaHeight(height ?? bounds.min, bounds)
  }

  function applyTextareaResizeHeight(height: number) {
    if (!formRef) return
    const nextHeight = clampComposerTextareaHeight(height, textareaResizeBounds())
    setTextareaResizeHeight(nextHeight)
    formRef.style.setProperty("--chat-textarea-height", `${nextHeight}px`)
  }

  function handleResizePointerDown(e: PointerEvent) {
    if (e.button !== 0 || !textareaRef) return
    const handle = e.currentTarget as HTMLElement
    resizeSession = {
      pointerID: e.pointerId,
      startY: e.clientY,
      startHeight: textareaRef.getBoundingClientRect().height,
    }
    handle.setPointerCapture(e.pointerId)
    e.preventDefault()
  }

  function handleResizePointerMove(e: PointerEvent) {
    if (!resizeSession || resizeSession.pointerID !== e.pointerId || !formRef) return
    applyTextareaResizeHeight(resizeSession.startHeight + resizeSession.startY - e.clientY)
  }

  function handleResizePointerEnd(e: PointerEvent) {
    if (!resizeSession || resizeSession.pointerID !== e.pointerId) return
    const handle = e.currentTarget as HTMLElement
    if (handle.hasPointerCapture(e.pointerId)) handle.releasePointerCapture(e.pointerId)
    resizeSession = undefined
  }

  function handleResizeKeyDown(e: KeyboardEvent) {
    const nextHeight = nextComposerTextareaKeyboardHeight(currentTextareaResizeHeight(), e.key, textareaResizeBounds())
    if (nextHeight === undefined) return
    e.preventDefault()
    applyTextareaResizeHeight(nextHeight)
  }

  // ── Send/Stop button rendering (mirrors renderChatComposer SVG logic) ──

  const primaryAction = createMemo(() =>
    composerPrimaryAction({
      activeWork: props.busy,
      hasDraft: hasText(),
    }),
  )
  const stopMode = createMemo(() => primaryAction() === "stop")

  const sendDisabled = createMemo(() => {
    if (stopMode()) return stopping()
    return submitting() || uploadingCount() > 0 || !props.enabled || !modelAvailable() || !hasText()
  })

  // Surface WHY the send button is disabled in its title — operators
  // were left guessing whether grey meant "task busy", "no text yet", or
  // "permissions blocked". Order matches sendDisabled's predicate.
  const sendTitle = () => {
    if (stopMode()) return t("chat.stop_title")
    if (!props.enabled) return t("chat.disabled_unavailable")
    if (uploadingCount() > 0) return t("chat.attachment_loader.uploading", { count: uploadingCount() })
    if (!modelAvailable()) return t("chat.disabled_model_required")
    if (!hasText()) return t("chat.disabled_empty")
    return t("chat.send_title")
  }
  const sendAriaLabel = () => (stopMode() ? t("chat.stop_label") : t("chat.send_label"))
  const sendLabel = () => (stopMode() ? t("chat.stop_label") : t("chat.send_label"))
  const activeComposerIntent = createMemo(() => props.activeComposerIntent ?? props.composerIntent)
  const productPillarOptions = createMemo<ComposerIntentOption<ProductPillar>[]>(() => [
    {
      value: "code",
      label: t("chat.composer_mode_code"),
      description: t("chat.composer_mode_code_description"),
      icon: "terminal",
    },
    {
      value: "work",
      label: t("chat.composer_mode_work"),
      description: t("chat.composer_mode_work_description"),
      icon: "work",
    },
  ])
  const conversationTargetOptions = createMemo<ComposerIntentOption<ConversationTarget>[]>(() => [
    {
      value: "chat",
      label: t("chat.composer_target_chat"),
      description: t("chat.composer_target_chat_description"),
      icon: "message",
    },
    {
      value: "mission",
      label: t("chat.composer_target_mission"),
      description: t("chat.composer_target_mission_description"),
      icon: "mission",
    },
  ])
  const selectedProductPillar = createMemo(
    () => productPillarOptions().find((option) => option.value === props.composerIntent.productPillar) ?? null,
  )
  const selectedConversationTarget = createMemo(
    () =>
      conversationTargetOptions().find((option) => option.value === props.composerIntent.conversationTarget) ?? null,
  )
  const renderIntentValue = <T extends string>(option: ComposerIntentOption<T> | null) => (
    <Show when={option}>
      {(value) => (
        <span class="composer-mode-option">
          <Icon name={value().icon} size="compact" />
          <span>{value().label}</span>
        </span>
      )}
    </Show>
  )
  const renderIntentOption = <T extends string>(option: ComposerIntentOption<T>) => (
    <span class="composer-mode-option composer-mode-menu-option">
      <span class="composer-picker-option-icon" aria-hidden="true">
        <Icon name={option.icon} size="compact" />
      </span>
      <span class="composer-picker-option-label">{option.label}</span>
    </span>
  )

  return (
    <div class="chat-composer-stack">
      {/* Attachments strip */}
      <Show when={canAcceptComposerAttachment() && attachments().length > 0}>
        <div class="chat-attachments" id="chatAttachments">
          <For each={attachments()}>
            {(att, index) => (
              <div class="chat-attachment-item" title={att.filename}>
                <Show
                  when={att.kind === "folder"}
                  fallback={
                    <Show
                      when={att.mime.startsWith("image/")}
                      fallback={
                        <span class="chat-attachment-icon">
                          {att.filename?.split(".").pop()?.toUpperCase() || "FILE"}
                        </span>
                      }
                    >
                      <ComposerAttachmentThumbnail attachment={att} />
                    </Show>
                  }
                >
                  <span class="chat-attachment-icon">
                    <Icon name="folder-open" size="medium" />
                  </span>
                </Show>
                <span class="chat-attachment-name">{att.filename || "file"}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  tone="neutral"
                  type="button"
                  data-ui="chat-attachment-remove"
                  data-chrome="icon-action"
                  aria-label={t("chat.attachment.remove")}
                  onClick={() => removeAttachment(index())}
                >
                  <Icon name="close" size="compact" />
                </Button>
              </div>
            )}
          </For>
        </div>
      </Show>

      <form
        ref={formRef}
        id={props.formID ?? "chatForm"}
        class="chat-input"
        data-dragover={dragover() ? "true" : undefined}
        onSubmit={handleSubmit}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div
          class="chat-resize-handle"
          role="separator"
          aria-orientation="horizontal"
          aria-controls={props.textareaID ?? "chatTextarea"}
          aria-label={t("chat.resize_handle")}
          aria-valuemin={Math.round(textareaResizeBounds().min)}
          aria-valuemax={Math.round(textareaResizeBounds().max)}
          aria-valuenow={currentTextareaResizeHeight()}
          tabIndex={0}
          title={t("chat.resize_handle")}
          onPointerDown={handleResizePointerDown}
          onPointerMove={handleResizePointerMove}
          onPointerUp={handleResizePointerEnd}
          onPointerCancel={handleResizePointerEnd}
          onKeyDown={handleResizeKeyDown}
        />

        {/* Compose row: textarea only; all actions live in the bottom toolbar. */}
        <div class="chat-compose-row">
          <div
            class="chat-textarea-wrap"
            data-has-mention={hasMentionPresentation() ? "true" : undefined}
            title={t("chat.tip")}
          >
            <Show when={hasMentionPresentation()}>
              <div
                ref={mentionPresentationRef}
                class="chat-mention-presentation"
                data-ui="chat-mention-presentation"
                aria-hidden="true"
              >
                <For each={mentionPresentation()}>
                  {(segment) => (
                    <Show when={segment.kind} fallback={segment.text}>
                      {(kind) => (
                        <span class="chat-mention-pill" data-mention-kind={kind()}>
                          {segment.text}
                        </span>
                      )}
                    </Show>
                  )}
                </For>
              </div>
            </Show>
            <AutoGrowTextarea
              surface="composer"
              ref={(el) => {
                textareaRef = el
              }}
              id={props.textareaID ?? "chatTextarea"}
              class="chat-textarea"
              rows={1}
              disabled={!props.enabled}
              placeholder={props.enabled ? "" : t("chat.placeholder_disabled")}
              title={t("chat.tip")}
              value={text()}
              data-ui={props.textareaDataUI}
              aria-autocomplete="list"
              aria-controls={mentionMenuOpen() ? "composerMentionListbox" : undefined}
              aria-expanded={mentionMenuOpen() ? "true" : "false"}
              onInput={(e) => {
                writeDraftText(e.currentTarget.value)
                setCaretPosition(e.currentTarget.selectionStart ?? e.currentTarget.value.length)
                resetMentionInteraction()
              }}
              onScroll={syncMentionPresentationScroll}
              onFocus={() => {
                setFocused(true)
                updateCaretFromTextarea()
              }}
              onBlur={() => setFocused(false)}
              onKeyDown={handleKeyDown}
              onKeyUp={updateCaretFromTextarea}
              onClick={updateCaretFromTextarea}
              onSelect={updateCaretFromTextarea}
              onPaste={handlePaste}
            />
            <Show when={mentionMenuOpen()}>
              <ComposerMentionMenu
                categories={mentionCatalog().categories}
                options={activeMentionOptions()}
                selectedKey={selectedMentionOption()?.key ?? ""}
                error={props.referenceCatalogError}
                onHighlight={(option) => setHighlightedMentionKey(option.key)}
                onSelect={selectMentionOption}
              />
            </Show>
            <Show when={showHint()}>
              <div class="chat-placeholder-float" aria-hidden="true">
                <span class="chat-placeholder-text">
                  <span class="chat-placeholder-mentions">{t("chat.placeholder_mentions")}</span>
                  <span aria-hidden="true"> · </span>
                  {hintText()}
                </span>
                <span class="chat-placeholder-caret" />
              </div>
            </Show>
          </div>
        </div>

        <Show when={showLargeRequestWarning()}>
          <div class="chat-input-warning" role="status" aria-live="polite">
            <Icon name="info-circle" />
            <span>{t("chat.large_input_warning")}</span>
          </div>
        </Show>

        {/* Compose meta. The drag/resize tip is now a
         * native title on the textarea — appears only on hover so the row
         * stays clean. */}
        <div class="chat-compose-meta">
          <div class="chat-compose-meta-left">
            <ComposerAttachmentLoaders
              disabled={!canAcceptComposerAttachment() || uploadingCount() > 0}
              fileCount={attachmentCounts().files}
              folderCount={attachmentCounts().folders}
              uploadingCount={uploadingCount()}
              parallelism={runControlState().parallelism}
              unattended={runControlState().unattended}
              runControlBusy={savingRunControl() !== null || props.busy}
              onFiles={addFiles}
              onFolder={addFolder}
              onParallelismChange={setParallelism}
              onUnattendedChange={setUnattended}
            />
            <Show
              when={props.conversationActive}
              fallback={
                <>
                  <div class="composer-intent-selects" data-ui="composer-intent-selects">
                    <SelectControl<ComposerIntentOption<ProductPillar>>
                      class="composer-intent-select"
                      variant="composer"
                      options={productPillarOptions()}
                      value={selectedProductPillar()}
                      onChange={(option) =>
                        option && props.onComposerIntentChange({ ...props.composerIntent, productPillar: option.value })
                      }
                      optionValue="value"
                      optionTextValue="label"
                      disallowEmptySelection
                      disabled={!props.enabled || props.busy}
                      ariaLabel={t("chat.composer_product_pillar_aria_label")}
                      triggerDataUI="composer-product-pillar-select"
                      renderValue={renderIntentValue}
                      renderOptionLabel={renderIntentOption}
                      renderOptionTooltip={(option) => <span>{option.description}</span>}
                    />
                    <SelectControl<ComposerIntentOption<ConversationTarget>>
                      class="composer-intent-select"
                      variant="composer"
                      options={conversationTargetOptions()}
                      value={selectedConversationTarget()}
                      onChange={(option) =>
                        option &&
                        props.onComposerIntentChange({ ...props.composerIntent, conversationTarget: option.value })
                      }
                      optionValue="value"
                      optionTextValue="label"
                      disallowEmptySelection
                      disabled={!props.enabled || props.busy}
                      ariaLabel={t("chat.composer_target_aria_label")}
                      triggerDataUI="composer-conversation-target-select"
                      renderValue={renderIntentValue}
                      renderOptionLabel={renderIntentOption}
                      renderOptionTooltip={(option) => <span>{option.description}</span>}
                    />
                  </div>
                  <ComposerReferenceSelector
                    text={text()}
                    onTextChange={(next) => {
                      writeDraftText(next)
                      setCaretPosition(next.length)
                      queueMicrotask(() => textareaRef?.setSelectionRange(next.length, next.length))
                    }}
                    skills={props.skills}
                    missionSkills={props.missionSkills}
                    expertSquads={props.expertSquads}
                    onExpertSquadQuery={props.onExpertSquadQuery}
                    onInstallMoreExpertSquads={props.onInstallMoreExpertSquads}
                    launchReferences={visibleComposerReferences(text())}
                    readOnly={false}
                    disabled={!props.enabled || props.busy}
                  />
                </>
              }
            >
              <div class="composer-context-flags" data-ui="composer-context-flags">
                <Badge
                  class="composer-context-flag composer-context-mode-flag"
                  tone="accent"
                  size="md"
                  data-ui="composer-mode-flag"
                  data-mode={activeComposerIntent().productPillar}
                  title={
                    activeComposerIntent().productPillar === "work"
                      ? t("chat.composer_mode_work_description")
                      : t("chat.composer_mode_code_description")
                  }
                >
                  <Icon name={activeComposerIntent().productPillar === "work" ? "work" : "terminal"} size="compact" />
                  <span class="composer-context-flag-label">
                    {activeComposerIntent().productPillar === "work"
                      ? t("chat.composer_mode_work")
                      : t("chat.composer_mode_code")}
                  </span>
                </Badge>
                <Badge
                  class="composer-context-flag composer-context-target-flag"
                  tone="neutral"
                  size="md"
                  data-ui="composer-target-flag"
                  data-target={activeComposerIntent().conversationTarget}
                >
                  <Icon
                    name={activeComposerIntent().conversationTarget === "mission" ? "mission" : "message"}
                    size="compact"
                  />
                  <span class="composer-context-flag-label">
                    {activeComposerIntent().conversationTarget === "mission"
                      ? t("chat.composer_target_mission")
                      : t("chat.composer_target_chat")}
                  </span>
                </Badge>
                <ComposerReferenceSelector
                  text=""
                  skills={props.skills}
                  missionSkills={props.missionSkills}
                  expertSquads={props.expertSquads}
                  activeExpertSquad={activeExpertSquad()}
                  launchReferences={props.launchReferences}
                  readOnly
                />
              </div>
            </Show>
          </div>
          <div class="chat-compose-meta-right">
            <ComposerModelSelector onModelAvailabilityChange={setModelAvailable} />
            <Show when={props.busy && !stopMode()}>
              <Button
                id={props.stopID ?? "btnTaskInterrupt"}
                variant="ghost"
                size="icon"
                tone="danger"
                type="button"
                data-ui="composer-active-stop"
                data-busy="true"
                disabled={stopping()}
                title={t("chat.stop_title")}
                aria-label={t("chat.stop_label")}
                onClick={(event) => {
                  event.preventDefault()
                  props.onStop?.()
                }}
              >
                <span class="chat-send-icon" aria-hidden="true">
                  <Icon name="stop" size="medium" />
                </span>
                <span class="chat-send-label">{t("chat.stop_label")}</span>
              </Button>
            </Show>
            {/* Send / Stop button */}
            <Button
              id={stopMode() ? (props.stopID ?? "btnTaskInterrupt") : (props.sendID ?? "chatSend")}
              variant="solid"
              size="icon"
              tone={stopMode() ? "danger" : "neutral"}
              type={stopMode() ? "button" : "submit"}
              data-ui={props.sendDataUI}
              data-busy={stopMode() ? "true" : undefined}
              data-mode={primaryAction()}
              disabled={sendDisabled()}
              title={sendTitle()}
              aria-label={sendAriaLabel()}
              onClick={(e) => {
                if (stopMode()) {
                  e.preventDefault()
                  props.onStop?.()
                }
              }}
            >
              <span class="chat-send-icon" aria-hidden="true">
                <Show when={stopMode()} fallback={<Icon name="arrow-up" size="medium" />}>
                  <Icon name="stop" size="medium" />
                </Show>
              </span>
              <span class="chat-send-label">{sendLabel()}</span>
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
