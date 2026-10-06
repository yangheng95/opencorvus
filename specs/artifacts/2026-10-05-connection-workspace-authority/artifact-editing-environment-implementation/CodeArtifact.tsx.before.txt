import { createSignal } from "solid-js"
import type { InteractiveArtifactPayload } from "../../services/interactive-artifact"
import { CodeEditor } from "../ui/CodeEditor"
import { ArtifactFrame } from "./ArtifactFrame"
import { CODE_EXTENSIONS } from "../../services/artifact-export"

type CodePayload = Extract<InteractiveArtifactPayload, { renderer: "code@1" }>
export type ArtifactCodeLanguage = CodePayload["language"]

export function artifactCodeFilename(language: ArtifactCodeLanguage, filename?: string): string {
  return filename ?? `artifact.${CODE_EXTENSIONS[language]}`
}

export function CodeArtifact(props: { payload: CodePayload }) {
  const [source, setSource] = createSignal(props.payload.source)

  return (
    <ArtifactFrame payload={{ ...props.payload, source: source() }} title={props.payload.title} kind="Code">
      <div class="msg-artifact-code__toolbar">
        <span>{props.payload.filename ?? props.payload.language}</span>
      </div>
      <CodeEditor
        class="msg-artifact-code"
        value={source()}
        path={artifactCodeFilename(props.payload.language, props.payload.filename)}
        ariaLabel={props.payload.title}
        readOnly={!props.payload.editable}
        onValueChange={setSource}
      />
    </ArtifactFrame>
  )
}
