import { Show, createResource } from "solid-js"
import {
  assertApiAuthorityCurrent,
  captureApiAuthority,
  fetchResourceAsObjectUrl,
  type ApiAuthority,
} from "../services/api"
import { t } from "../utils/i18n"
import { CodeEditor } from "./ui/CodeEditor"
import { Feedback } from "./ui/Feedback"

async function loadText(source: { url: string; authority?: ApiAuthority }): Promise<string> {
  const objectUrl = await fetchResourceAsObjectUrl(source.url, { authority: source.authority })
  const response = await fetch(objectUrl)
  if (!response.ok) throw new Error(`Text preview failed with HTTP ${response.status}`)
  const text = await response.text()
  if (source.authority) assertApiAuthorityCurrent(source.authority)
  return text
}

export function ResourceTextPreview(props: { url: string; filename: string; label: string; authority?: ApiAuthority }) {
  const [text] = createResource(
    () => ({
      url: props.url,
      authority: props.url.startsWith("/") ? (props.authority ?? captureApiAuthority()) : undefined,
    }),
    loadText,
  )
  return (
    <Show
      when={!text.error}
      fallback={<Feedback tone="error" details={String(text.error)}>{t("file.load_failed", { name: props.label })}</Feedback>}
    >
      <Show
        when={text.state === "ready"}
        fallback={<div class="msg-artifact-file__loading">{t("artifact.file.loading_text")}</div>}
      >
        <CodeEditor
          class="msg-artifact-code"
          value={text()!}
          path={props.filename}
          ariaLabel={props.label}
          readOnly
          onValueChange={() => undefined}
        />
      </Show>
    </Show>
  )
}
