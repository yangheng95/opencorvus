import type { InteractiveArtifactPayload } from "../../services/interactive-artifact"
import type { ArtifactExport } from "../../services/artifact-export"
import { StaticTextPart } from "../TextPart"
import { ArtifactFrame } from "./ArtifactFrame"

type DocumentPayload = Extract<InteractiveArtifactPayload, { renderer: "document@1" }>

export function DocumentArtifact(props: { payload: DocumentPayload; exportFiles?: () => ArtifactExport[] }) {
  return (
    <ArtifactFrame payload={props.payload} exportFiles={props.exportFiles} title={props.payload.title} kind="Document">
      <div class="msg-artifact-document">
        <StaticTextPart text={props.payload.markdown} />
      </div>
    </ArtifactFrame>
  )
}
