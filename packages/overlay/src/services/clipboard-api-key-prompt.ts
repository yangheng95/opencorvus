import { getCurrentWindow } from "@tauri-apps/api/window"
import { appStore } from "../store/app"
import { dialogStore } from "../store/dialog"
import { t } from "../utils/i18n"
import { dismissAppDialog, showAppDialog } from "./app-dialog"
import { openConfigDialog } from "./config-dialog-control"
import type { HostTransport } from "./host-transport"
import { getHostTransport } from "./host-transport-runtime"

const CLIPBOARD_CHECK_DELAY_MILLISECONDS = 180
const MAX_CLIPBOARD_TEXT_LENGTH = 512
const MAX_REMEMBERED_FINGERPRINTS = 16
const MIN_OPAQUE_TOKEN_LENGTH = 32
const MAX_OPAQUE_TOKEN_LENGTH = 256
const MIN_OPAQUE_TOKEN_ENTROPY = 3.7
const MIN_OPAQUE_TOKEN_UNIQUE_CHARACTERS = 12

const CREDENTIAL_ASSIGNMENT_NAME = /(?:^|_)(?:API_?KEY|ACCESS_?TOKEN|AUTH_?TOKEN|SECRET)(?:$|_)/i
const CREDENTIAL_ASSIGNMENT = /^(?:export\s+)?([A-Z][A-Z0-9_]{2,79})\s*=\s*(["']?)([^\r\n]+?)\2$/i
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const HEX_ONLY = /^[0-9a-f]+$/i
const JSON_WEB_TOKEN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/
const OPAQUE_TOKEN_CHARACTERS = /^[A-Za-z0-9._~+/=-]+$/
const LLM_PROVIDER_KEY_PREFIX = /^(?:sk-(?:ant-|proj-|live-|or-v1-)?|xai-|gsk_|pplx-|hf_|nvapi-|AIzaSy|rk-)/

export type ClipboardApiKeyEvidence = "credential-assignment" | "provider-prefix" | "opaque-token"

export type ClipboardApiKeyClassification =
  | { kind: "candidate"; evidence: ClipboardApiKeyEvidence }
  | {
      kind: "not-candidate"
      reason: "empty" | "oversized" | "multiline" | "structured-text" | "identifier" | "insufficient-structure"
    }

export type ClipboardApiKeyPromptCheck =
  | { status: "unsupported" }
  | { status: "deferred" }
  | { status: "not-candidate"; reason: Extract<ClipboardApiKeyClassification, { kind: "not-candidate" }>["reason"] }
  | { status: "already-prompted" }
  | { status: "prompted"; action: "opened-providers" | "dismissed" }
  | { status: "unavailable" }

function characterClassCount(value: string): number {
  return [/[a-z]/.test(value), /[A-Z]/.test(value), /[0-9]/.test(value), /[^A-Za-z0-9]/.test(value)].filter(Boolean)
    .length
}

function shannonEntropy(value: string): number {
  const frequencies = new Map<string, number>()
  for (const character of value) frequencies.set(character, (frequencies.get(character) ?? 0) + 1)
  let entropy = 0
  for (const count of frequencies.values()) {
    const probability = count / value.length
    entropy -= probability * Math.log2(probability)
  }
  return entropy
}

function isStructurallyOpaqueToken(value: string, minimumLength = MIN_OPAQUE_TOKEN_LENGTH): boolean {
  if (value.length < minimumLength || value.length > MAX_OPAQUE_TOKEN_LENGTH) return false
  if (!OPAQUE_TOKEN_CHARACTERS.test(value)) return false
  if (UUID.test(value) || HEX_ONLY.test(value) || JSON_WEB_TOKEN.test(value)) return false
  if (characterClassCount(value) < 3) return false
  if (new Set(value).size < MIN_OPAQUE_TOKEN_UNIQUE_CHARACTERS) return false
  return shannonEntropy(value) >= MIN_OPAQUE_TOKEN_ENTROPY
}

export function classifyClipboardApiKey(text: string): ClipboardApiKeyClassification {
  const value = text.trim()
  if (!value) return { kind: "not-candidate", reason: "empty" }
  if (value.length > MAX_CLIPBOARD_TEXT_LENGTH) return { kind: "not-candidate", reason: "oversized" }
  if (/\r|\n/.test(value)) return { kind: "not-candidate", reason: "multiline" }
  if (/^(?:https?:\/\/|file:|-----BEGIN\s|\{|\[)/i.test(value)) {
    return { kind: "not-candidate", reason: "structured-text" }
  }
  if (UUID.test(value) || HEX_ONLY.test(value) || JSON_WEB_TOKEN.test(value)) {
    return { kind: "not-candidate", reason: "identifier" }
  }

  const assignment = CREDENTIAL_ASSIGNMENT.exec(value)
  if (assignment && CREDENTIAL_ASSIGNMENT_NAME.test(assignment[1] ?? "")) {
    const assignedValue = (assignment[3] ?? "").trim()
    if (LLM_PROVIDER_KEY_PREFIX.test(assignedValue) || isStructurallyOpaqueToken(assignedValue, 20)) {
      return { kind: "candidate", evidence: "credential-assignment" }
    }
  }

  const unwrapped = value.replace(/^(?:Bearer\s+)/i, "").replace(/^(["'])(.*)\1$/, "$2")
  if (LLM_PROVIDER_KEY_PREFIX.test(unwrapped) && isStructurallyOpaqueToken(unwrapped, 20)) {
    return { kind: "candidate", evidence: "provider-prefix" }
  }
  if (isStructurallyOpaqueToken(unwrapped)) return { kind: "candidate", evidence: "opaque-token" }
  return { kind: "not-candidate", reason: "insufficient-structure" }
}

async function clipboardFingerprint(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

function rememberFingerprint(fingerprints: string[], fingerprint: string): void {
  fingerprints.push(fingerprint)
  if (fingerprints.length > MAX_REMEMBERED_FINGERPRINTS) fingerprints.shift()
}

type ClipboardCandidateInspection =
  | { status: "candidate"; fingerprint: string }
  | { status: "not-candidate"; reason: Extract<ClipboardApiKeyClassification, { kind: "not-candidate" }>["reason"] }
  | { status: "unavailable" }

async function inspectClipboardCandidate(transport: HostTransport): Promise<ClipboardCandidateInspection> {
  let clipboardText: string
  try {
    const result = await transport.native({ kind: "clipboard.readText" })
    if (typeof result !== "string") return { status: "unavailable" }
    clipboardText = result
  } catch {
    return { status: "unavailable" }
  }

  const classification = classifyClipboardApiKey(clipboardText)
  if (classification.kind === "not-candidate") {
    return { status: "not-candidate", reason: classification.reason }
  }
  try {
    return { status: "candidate", fingerprint: await clipboardFingerprint(clipboardText) }
  } catch {
    return { status: "unavailable" }
  }
}

export interface ClipboardApiKeyPromptController {
  checkNow(): Promise<ClipboardApiKeyPromptCheck>
  dispose(): void
}

export function installClipboardApiKeyPrompt(): ClipboardApiKeyPromptController {
  const transport = getHostTransport()
  const promptedFingerprints: string[] = []
  let disposed = false
  let timer: number | undefined
  let inFlight: Promise<ClipboardApiKeyPromptCheck> | null = null
  let removeFocusListener: (() => void) | undefined
  let promptSequence = 0
  let ownedPromptKind: string | null = null

  const canCheck = () =>
    !disposed &&
    appStore.connected &&
    !dialogStore.app.open &&
    !dialogStore.config.open &&
    !dialogStore.session.open &&
    !dialogStore.goal.open

  const runCheck = async (): Promise<ClipboardApiKeyPromptCheck> => {
    if (disposed || !canCheck()) return { status: "deferred" }
    const inspection = await inspectClipboardCandidate(transport)
    if (inspection.status === "unavailable") return inspection
    if (inspection.status === "not-candidate") return inspection
    if (!canCheck()) return { status: "deferred" }

    if (promptedFingerprints.includes(inspection.fingerprint)) return { status: "already-prompted" }

    const promptKind = `clipboard-api-key:${++promptSequence}`
    ownedPromptKind = promptKind
    let answer: Awaited<ReturnType<typeof showAppDialog>>
    try {
      answer = await showAppDialog({
        title: t("provider.clipboard_key_prompt.title"),
        message: t("provider.clipboard_key_prompt.message"),
        kind: promptKind,
        okLabel: t("provider.clipboard_key_prompt.configure"),
        cancelLabel: t("provider.clipboard_key_prompt.dismiss"),
        cancel: true,
        openingGuard: canCheck,
      })
    } catch {
      ownedPromptKind = null
      return { status: "unavailable" }
    }
    ownedPromptKind = null
    if (disposed || dialogStore.app.kind !== promptKind) return { status: "deferred" }
    rememberFingerprint(promptedFingerprints, inspection.fingerprint)
    if (!answer.confirmed) return { status: "prompted", action: "dismissed" }
    if (disposed) return { status: "deferred" }
    await openConfigDialog("providers")
    return { status: "prompted", action: "opened-providers" }
  }

  const checkNow = (): Promise<ClipboardApiKeyPromptCheck> => {
    if (!transport.capabilities.nativeCommands["clipboard.readText"]) return Promise.resolve({ status: "unsupported" })
    if (inFlight) return inFlight
    inFlight = runCheck().finally(() => {
      inFlight = null
    })
    return inFlight
  }

  const scheduleCheck = () => {
    if (disposed) return
    if (timer !== undefined) window.clearTimeout(timer)
    timer = window.setTimeout(() => {
      timer = undefined
      void checkNow()
    }, CLIPBOARD_CHECK_DELAY_MILLISECONDS)
  }

  void getCurrentWindow()
    .onFocusChanged(({ payload: focused }) => {
      if (focused) scheduleCheck()
    })
    .then((unlisten) => {
      if (disposed) unlisten()
      else removeFocusListener = unlisten
    })
    .catch(() => undefined)

  return {
    checkNow,
    dispose() {
      disposed = true
      if (ownedPromptKind && dialogStore.app.open && dialogStore.app.kind === ownedPromptKind) {
        void dismissAppDialog()
      }
      ownedPromptKind = null
      if (timer !== undefined) window.clearTimeout(timer)
      timer = undefined
      removeFocusListener?.()
      removeFocusListener = undefined
    },
  }
}
