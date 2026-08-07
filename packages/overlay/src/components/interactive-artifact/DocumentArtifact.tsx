import type { InteractiveArtifactPayload } from "../../services/interactive-artifact"
import { StaticTextPart } from "../TextPart"
import { ArtifactFrame } from "./ArtifactFrame"

type DocumentPayload = Extract<InteractiveArtifactPayload, { renderer: "document@1" }>

export function DocumentArtifact(props: { payload: DocumentPayload }) {
  return (
    <ArtifactFrame title={props.payload.title} kind="Document">
      <div class="msg-artifact-document">
        <StaticTextPart text={props.payload.markdown} />
      </div>
    </ArtifactFrame>
  )
}
