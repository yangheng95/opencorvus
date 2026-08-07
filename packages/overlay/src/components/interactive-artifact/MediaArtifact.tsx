import { Show } from "solid-js"
import type { InteractiveArtifactPayload } from "../../services/interactive-artifact"
import { FilePart } from "../FilePart"
import { ArtifactFrame } from "./ArtifactFrame"

type MediaPayload = Extract<InteractiveArtifactPayload, { renderer: "media@1" }>

export function MediaArtifact(props: { payload: MediaPayload }) {
  return (
    <ArtifactFrame title={props.payload.title} kind="Media">
      <div class="msg-artifact-media">
        <FilePart
          part={{
            type: "file",
            url: props.payload.source.url,
            mime: props.payload.source.mime,
            filename: props.payload.source.filename,
            alt: props.payload.alt,
          }}
        />
        <Show when={props.payload.caption}>
          {(caption) => <p class="msg-artifact-media__caption">{caption()}</p>}
        </Show>
      </div>
    </ArtifactFrame>
  )
}
