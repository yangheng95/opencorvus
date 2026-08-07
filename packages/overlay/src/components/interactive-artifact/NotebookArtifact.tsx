import { For, Match, Show, Switch } from "solid-js"
import type { InteractiveArtifactPayload } from "../../services/interactive-artifact"
import { FilePart } from "../FilePart"
import { StaticTextPart } from "../TextPart"
import { CodeEditor } from "../ui/CodeEditor"
import { ArtifactFrame } from "./ArtifactFrame"
import { artifactCodeFilename } from "./CodeArtifact"

type NotebookPayload = Extract<InteractiveArtifactPayload, { renderer: "notebook@1" }>

export function NotebookArtifact(props: { payload: NotebookPayload }) {
  return (
    <ArtifactFrame title={props.payload.title} kind="Notebook">
      <div class="msg-artifact-notebook">
        <For each={props.payload.cells}>
          {(cell) => (
            <article class="msg-artifact-notebook__cell" data-cell-kind={cell.kind}>
              <Switch>
                <Match when={cell.kind === "markdown"}>
                  <div class="msg-artifact-notebook__markdown">
                    <StaticTextPart text={cell.kind === "markdown" ? cell.markdown : ""} />
                  </div>
                </Match>
                <Match when={cell.kind === "code"}>
                  <Show when={cell.kind === "code"}>
                    <div class="msg-artifact-notebook__code">
                      <span class="msg-artifact-notebook__prompt">
                        [{cell.kind === "code" ? (cell.executionCount ?? " ") : ""}]
                      </span>
                      <CodeEditor
                        class="msg-artifact-code"
                        value={cell.kind === "code" ? cell.source : ""}
                        path={artifactCodeFilename(cell.kind === "code" ? cell.language : "plaintext")}
                        ariaLabel={`${props.payload.title} code cell`}
                        readOnly
                        onValueChange={() => undefined}
                      />
                    </div>
                    <For each={cell.kind === "code" ? cell.outputs : []}>
                      {(output) => (
                        <div class="msg-artifact-notebook__output" data-output-kind={output.kind}>
                          <Switch>
                            <Match when={output.kind === "text"}>
                              <pre data-stream={output.kind === "text" ? output.name : undefined}>
                                {output.kind === "text" ? output.text : ""}
                              </pre>
                            </Match>
                            <Match when={output.kind === "markdown"}>
                              <StaticTextPart text={output.kind === "markdown" ? output.markdown : ""} />
                            </Match>
                            <Match when={output.kind === "media"}>
                              <Show when={output.kind === "media"}>
                                <FilePart
                                  part={{
                                    type: "file",
                                    url: output.kind === "media" ? output.source.url : undefined,
                                    mime: output.kind === "media" ? output.source.mime : undefined,
                                    filename: output.kind === "media" ? output.source.filename : undefined,
                                    alt: output.kind === "media" ? output.alt : undefined,
                                  }}
                                />
                              </Show>
                            </Match>
                          </Switch>
                        </div>
                      )}
                    </For>
                  </Show>
                </Match>
              </Switch>
            </article>
          )}
        </For>
      </div>
    </ArtifactFrame>
  )
}
