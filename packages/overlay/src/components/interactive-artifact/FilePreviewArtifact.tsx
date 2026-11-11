import { Match, Switch } from "solid-js"
import type { InteractiveArtifact, InteractiveArtifactPayload } from "../../services/interactive-artifact"
import { PdfPreview } from "../PdfPreview"
import { createResourceTextRead, ResourceTextPreview } from "../ResourceTextPreview"
import { ArtifactFrame } from "./ArtifactFrame"

type FilePreviewPayload = Extract<InteractiveArtifactPayload, { renderer: "file-preview@1" }>

export function FilePreviewArtifact(props: {
  payload: FilePreviewPayload
  downloads?: InteractiveArtifact["downloads"]
}) {
  const textRead = createResourceTextRead(() => props.payload.kind === "text" ? { url: props.payload.source.url } : undefined)
  return (
    <ArtifactFrame payload={props.payload} title={props.payload.title} kind="File" downloads={props.downloads}>
      <Switch>
        <Match when={props.payload.kind === "pdf"}>
          <PdfPreview url={props.payload.source.url} label={props.payload.title} />
        </Match>
        <Match when={props.payload.kind === "text"}>
          <ResourceTextPreview
            read={textRead}
            filename={props.payload.source.filename ?? "artifact.txt"}
            label={props.payload.title}
          />
        </Match>
      </Switch>
    </ArtifactFrame>
  )
}
