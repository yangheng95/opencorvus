import { Match, Switch } from "solid-js"
import type { InteractiveArtifact, InteractiveArtifactPayload } from "../../services/interactive-artifact"
import { artifactExports } from "../../services/artifact-export"
import { PdfPreview } from "../PdfPreview"
import { ResourceTextPreview } from "../ResourceTextPreview"
import { ArtifactFrame } from "./ArtifactFrame"

type FilePreviewPayload = Extract<InteractiveArtifactPayload, { renderer: "file-preview@1" }>

export function FilePreviewArtifact(props: {
  payload: FilePreviewPayload
  downloads?: InteractiveArtifact["downloads"]
}) {
  return (
    <ArtifactFrame
      payload={props.payload}
      title={props.payload.title}
      kind="File"
      exportFiles={() => artifactExports(props.payload, props.downloads)}
    >
      <Switch>
        <Match when={props.payload.kind === "pdf"}>
          <PdfPreview url={props.payload.source.url} label={props.payload.title} />
        </Match>
        <Match when={props.payload.kind === "text"}>
          <ResourceTextPreview
            url={props.payload.source.url}
            filename={props.payload.source.filename ?? "artifact.txt"}
            label={props.payload.title}
          />
        </Match>
      </Switch>
    </ArtifactFrame>
  )
}
