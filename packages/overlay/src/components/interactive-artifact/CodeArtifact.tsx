import { createSignal } from "solid-js"
import type { InteractiveArtifactPayload } from "../../services/interactive-artifact"
import { t } from "../../utils/i18n"
import { Button } from "../ui/Button"
import { CodeEditor } from "../ui/CodeEditor"
import { ArtifactFrame } from "./ArtifactFrame"

type CodePayload = Extract<InteractiveArtifactPayload, { renderer: "code@1" }>
export type ArtifactCodeLanguage = CodePayload["language"]

const LANGUAGE_EXTENSION: Record<ArtifactCodeLanguage, string> = {
  plaintext: "txt",
  css: "css",
  html: "html",
  javascript: "js",
  json: "json",
  markdown: "md",
  python: "py",
  typescript: "ts",
}

export function artifactCodeFilename(language: ArtifactCodeLanguage, filename?: string): string {
  return filename ?? `artifact.${LANGUAGE_EXTENSION[language]}`
}

export function CodeArtifact(props: { payload: CodePayload }) {
  const [source, setSource] = createSignal(props.payload.source)
  const copy = async () => navigator.clipboard.writeText(source())

  return (
    <ArtifactFrame title={props.payload.title} kind="Code">
      <div class="msg-artifact-code__toolbar">
        <span>{props.payload.filename ?? props.payload.language}</span>
        <Button variant="ghost" size="sm" tone="neutral" onClick={copy}>
          {t("artifact.code.copy")}
        </Button>
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
