import { Show, createResource } from "solid-js"
import { decodeUnicodeText, TextDecodingError } from "@opencorvus-ai/util/text-decoding"
import {
  assertApiAuthorityCurrent,
  captureApiAuthority,
  fetchResourceAsObjectUrl,
  type ApiAuthority,
} from "../services/api"
import { formatErrorDetails } from "../utils/error-details"
import { t } from "../utils/i18n"
import { CodeEditor } from "./ui/CodeEditor"
import { Feedback } from "./ui/Feedback"
import { Button } from "./ui/Button"

type TextSource = { url: string; authority?: ApiAuthority }
type TextContent = { value: string; focusOrigin?: HTMLButtonElement }

async function loadText(source: TextSource): Promise<string> {
  const objectUrl = await fetchResourceAsObjectUrl(source.url, { authority: source.authority })
  const response = await fetch(objectUrl)
  if (!response.ok) throw new Error(`Text preview failed with HTTP ${response.status}`)
  const text = decodeUnicodeText(new Uint8Array(await response.arrayBuffer()))
  if (source.authority) assertApiAuthorityCurrent(source.authority)
  return text
}

export function ResourceTextPreview(props: { url: string; filename: string; label: string; authority?: ApiAuthority }) {
  const [text, { refetch }] = createResource<TextContent, TextSource, HTMLButtonElement>(
    () => ({
      url: props.url,
      authority: props.url.startsWith("/") ? (props.authority ?? captureApiAuthority()) : undefined,
    }),
    async (source, { refetching }) => {
      const value = await loadText(source)
      const focusOrigin = typeof refetching !== "boolean" && document.activeElement === refetching ? refetching : undefined
      return { value, focusOrigin }
    },
  )
  const decodingError = () => (text.error instanceof TextDecodingError ? text.error : undefined)
  return (
    <Show
      when={!text.error}
      fallback={
        <Feedback
          tone="error"
          details={decodingError() ? undefined : formatErrorDetails(text.error)}
          actions={decodingError()
            ? undefined
            : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                tone="neutral"
                aria-disabled={text.loading || undefined}
                aria-busy={text.loading || undefined}
                aria-label={`${t("file.retry_preview")}: ${props.label}`}
                onClick={(event) => {
                  if (!text.loading) void refetch(event.currentTarget)
                }}
              >
                {t(text.loading ? "common.retrying" : "file.retry_preview")}
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
        when={text.state === "ready" && text()}
        fallback={<div class="msg-artifact-file__loading" role="status">{t("artifact.file.loading_text")}</div>}
      >
        {(content) => (
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
          />
        )}
      </Show>
    </Show>
  )
}
