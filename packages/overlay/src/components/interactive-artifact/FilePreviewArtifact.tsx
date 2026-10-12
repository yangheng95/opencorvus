import { Match, Show, Switch, createResource } from "solid-js"
import type { InteractiveArtifactPayload } from "../../services/interactive-artifact"
import {
  assertApiAuthorityCurrent,
  captureApiAuthority,
  fetchResourceAsObjectUrl,
  type ApiAuthority,
} from "../../services/api"
import { t } from "../../utils/i18n"
import { PdfPreview } from "../PdfPreview"
import { CodeEditor } from "../ui/CodeEditor"
import { ArtifactFrame } from "./ArtifactFrame"

type FilePreviewPayload = Extract<InteractiveArtifactPayload, { renderer: "file-preview@1" }>

async function loadText(source: { url: string; authority?: ApiAuthority }): Promise<string> {
  const objectUrl = await fetchResourceAsObjectUrl(source.url, { authority: source.authority })
  const response = await fetch(objectUrl)
  if (!response.ok) throw new Error(`Text preview failed with HTTP ${response.status}`)
  const text = await response.text()
  if (source.authority) assertApiAuthorityCurrent(source.authority)
  return text
}

function TextPreview(props: { payload: FilePreviewPayload }) {
  const [text] = createResource(
    () => ({
      url: props.payload.source.url,
      authority: props.payload.source.url.startsWith("/") ? captureApiAuthority() : undefined,
    }),
    loadText,
  )
  return (
    <Show when={!text.error} fallback={<div class="msg-artifact-render-error">{String(text.error)}</div>}>
      <Show
        when={!text.loading && text()}
        fallback={<div class="msg-artifact-file__loading">{t("artifact.file.loading_text")}</div>}
      >
        {(source) => (
          <CodeEditor
            class="msg-artifact-code"
            value={source()}
            path={props.payload.source.filename ?? "artifact.txt"}
            ariaLabel={props.payload.title}
            readOnly
            onValueChange={() => undefined}
          />
        )}
      </Show>
    </Show>
  )
}


export function FilePreviewArtifact(props: { payload: FilePreviewPayload }) {
  return (
    <ArtifactFrame payload={props.payload} title={props.payload.title} kind="File">
      <Switch>
        <Match when={props.payload.kind === "pdf"}>
          <PdfPreview url={props.payload.source.url} label={props.payload.title} />
        </Match>
        <Match when={props.payload.kind === "text"}>
          <TextPreview payload={props.payload} />
        </Match>
      </Switch>
    </ArtifactFrame>
  )
}
