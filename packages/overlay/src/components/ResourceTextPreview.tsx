import { Show, createResource, createSignal } from "solid-js"
import { decodeText, TextDecodingError } from "@opencorvus-ai/util/text-decoding"
import {
  assertApiAuthorityCurrent,
  captureApiAuthority,
  fetchResourceAsObjectUrl,
  type ApiAuthority,
} from "../services/api"
import { formatErrorDetails } from "../utils/error-details"
import { t } from "../utils/i18n"
import { CodeEditor, type CodeEditorNavigation } from "./ui/CodeEditor"
import { Feedback } from "./ui/Feedback"
import { Button } from "./ui/Button"
import { DownloadLink } from "./OriginalFileDownload"

type TextSource = { url: string; mime: string; authority?: ApiAuthority }
type TextContent = { href: string; value: string | TextDecodingError; focusOrigin?: HTMLButtonElement }

async function loadText(source: TextSource): Promise<TextContent> {
  const href = await fetchResourceAsObjectUrl(source.url, { authority: source.authority })
  const response = await fetch(href)
  if (!response.ok) throw new Error(`Text preview failed with HTTP ${response.status}`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (source.authority) assertApiAuthorityCurrent(source.authority)
  try {
    return { href, value: decodeText(bytes, source.mime) }
  } catch (error) {
    if (!(error instanceof TextDecodingError)) throw error
    return { href, value: error }
  }
}

export function createResourceTextRead(source: () => TextSource | undefined) {
  const [text, { refetch }] = createResource<TextContent, TextSource, HTMLButtonElement>(
    () => {
      const input = source()
      if (!input) return undefined
      return {
        url: input.url,
        mime: input.mime,
        authority: input.url.startsWith("/") ? (input.authority ?? captureApiAuthority()) : undefined,
      }
    },
    async (input, { refetching }) => {
      const content = await loadText(input)
      const focusOrigin = typeof refetching !== "boolean" && document.activeElement === refetching ? refetching : undefined
      return { ...content, focusOrigin }
    },
  )
  const content = () => source() && text.state === "ready" ? text() : undefined
  return {
    content,
    error: () => text.error,
    loading: () => text.loading,
    retry(trigger: HTMLButtonElement) {
      if (!text.loading) void refetch(trigger)
    },
    originalHref() {
      const url = source()?.url
      return url?.startsWith("/") ? content()?.href : url
    },
  }
}

type TextRead = ReturnType<typeof createResourceTextRead>

export function ResourceTextDownload(props: { read: TextRead; filename: string; label?: string }) {
  return (
    <Show when={props.read.originalHref()}>
      {(href) => <DownloadLink href={href()} name={props.filename} displayLabel={props.label} />}
    </Show>
  )
}

export function ResourceTextPreview(props: { read: TextRead; filename: string; label: string }) {
  const [navigation, setNavigation] = createSignal<CodeEditorNavigation>()
  const decodingError = () => {
    const value = props.read.content()?.value
    return value instanceof TextDecodingError ? value : undefined
  }
  const decoded = () => {
    const content = props.read.content()
    if (content && typeof content.value === "string") return { value: content.value, focusOrigin: content.focusOrigin }
  }
  return (
    <Show
      when={!props.read.error() && !decodingError()}
      fallback={
        <Feedback
          tone="error"
          details={decodingError() ? undefined : formatErrorDetails(props.read.error())}
          actions={decodingError()
            ? undefined
            : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                tone="neutral"
                aria-disabled={props.read.loading() || undefined}
                aria-busy={props.read.loading() || undefined}
                aria-label={`${t("file.retry_preview")}: ${props.label}`}
                onClick={(event) => props.read.retry(event.currentTarget)}
              >
                {t(props.read.loading() ? "common.retrying" : "file.retry_preview")}
              </Button>
            )}
        >
          {decodingError()
            ? t("file.text_encoding_failed", { name: props.label, encoding: decodingError()!.encoding.toUpperCase() })
            : t("file.load_failed", { name: props.label })}
        </Feedback>
      }
    >
      <Show
        when={decoded()}
        fallback={<div class="msg-artifact-file__loading" role="status">{t("artifact.file.loading_text")}</div>}
      >
        {(content) => (
          <>
            <div class="resource-text-preview__toolbar">
              <Button type="button" variant="ghost" size="sm" tone="neutral" disabled={!navigation()}
                title={`${t("code_editor.find")} (Ctrl/Cmd+F)`}
                aria-label={`${t("code_editor.find")}: ${props.label}`}
                onClick={() => navigation()?.find()}>
                {t("code_editor.find")}
              </Button>
              <Button type="button" variant="ghost" size="sm" tone="neutral" disabled={!navigation()}
                title={`${t("code_editor.go_to_line")} (Ctrl/Cmd+Alt+G)`}
                aria-label={`${t("code_editor.go_to_line")}: ${props.label}`}
                onClick={() => navigation()?.goToLine()}>
                {t("code_editor.go_to_line")}
              </Button>
            </div>
            <CodeEditor
              class="msg-artifact-code resource-text-preview"
              value={content().value}
              path={props.filename}
              ariaLabel={props.label}
              readOnly
              shouldFocusOnMount={() => {
                const origin = content().focusOrigin
                return !!origin && (
                  document.activeElement === origin || (!origin.isConnected && document.activeElement === document.body)
                )
              }}
              onValueChange={() => undefined}
              onNavigationReady={setNavigation}
            />
          </>
        )}
      </Show>
    </Show>
  )
}
