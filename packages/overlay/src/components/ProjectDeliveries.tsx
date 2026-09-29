import { createEffect, createMemo, createResource, createSignal, For, Show } from "solid-js"
import { parseConversationInteractiveArtifactMessagePart } from "@opencorvus-ai/transport-protocol"
import { boardStore } from "../store/board"
import { cardTreeStore } from "../store/card-tree"
import type { ArtifactReadLocator } from "../services/conversation-artifact"
import { loadSessionInteractiveArtifact } from "../services/interactive-artifact"
import { activeProjectDirectory } from "../services/project-directory"
import { t } from "../utils/i18n"
import { ArtifactResourceDownload } from "./ArtifactResourceDownload"
import { ConversationArtifactInspector } from "./ConversationArtifactInspector"
import { InteractiveArtifactPart } from "./InteractiveArtifactPart"
import { Section } from "./ui/Section"
import { Dialog } from "./ui/Dialog"
import { Button } from "./ui/Button"
import { Icon } from "./ui/Icon"

type Delivery = { id: string; title: string; description: string } & (
  | { kind: "resource"; taskID: string; locator: ArtifactReadLocator }
  | { kind: "interactive"; part: any }
)

/** The floating inventory derives from the same current conversation records
 * as message deliveries. It never re-registers or copies Artifact authority. */
export function createProjectDeliveries(props: { onOpen: () => void }) {
  const [selected, setSelected] = createSignal<Delivery>()
  createEffect(() => {
    void boardStore.selectedSource?.id
    setSelected(undefined)
  })
  const deliveries = createMemo(() => {
    const rows = new Map<string, Delivery>()
    for (const card of Object.values(cardTreeStore.cards)) {
      for (const summary of card.turnArtifacts ?? []) {
        for (const output of summary.declaredOutputs) {
          for (const resource of output.resources) {
            const locator = { source: "task_artifact_resource", ref: resource }
            const id = JSON.stringify(locator)
            rows.set(id, {
              id,
              kind: "resource",
              title: resource.path,
              description: summary.task.title,
              taskID: summary.task.id,
              locator,
            })
          }
        }
      }
      for (const part of card.parts) {
        if (part.type !== "interactive-artifact") continue
        const artifact = parseConversationInteractiveArtifactMessagePart(part)
        const id = `${part.sessionID}:${artifact.artifactID}`
        rows.set(id, {
          id,
          kind: "interactive",
          title: t("project_runtime.interactive_delivery"),
          description: t("project_runtime.interactive_delivery"),
          part,
        })
      }
    }
    return [...rows.values()]
  })
  const Inventory = () => (
    <Show when={deliveries().length > 0}>
      <Section
        title={t("project_runtime.deliveries", { count: deliveries().length })}
        indicatorPosition="end"
        class="project-runtime-category"
        defaultOpen
      >
        <div class="project-runtime-bounded-list" data-runtime-list="deliveries">
          <For each={deliveries()}>
            {(delivery) => {
              const [artifact] = createResource(
                () =>
                  delivery.kind === "interactive"
                    ? {
                        sessionID: delivery.part.sessionID,
                        artifactID: parseConversationInteractiveArtifactMessagePart(delivery.part).artifactID,
                        directory: activeProjectDirectory(),
                      }
                    : undefined,
                loadSessionInteractiveArtifact,
              )
              const title = () =>
                artifact.error ? t("artifact.load_failed") : artifact()?.payload.title || delivery.title
              return (
                <div class="project-runtime-delivery-row">
                  <Button
                    type="button"
                    variant="ghost"
                    tone="neutral"
                    size="sm"
                    class="project-runtime-delivery-open"
                    title={title()}
                    onClick={() => {
                      setSelected({ ...delivery, title: title() })
                      props.onOpen()
                    }}
                  >
                    <Icon name="file-document" size="compact" />
                    <span>
                      <strong>{title().split(/[\\/]/).at(-1)}</strong>
                      <small>{delivery.description}</small>
                    </span>
                  </Button>
                  <Show when={delivery.kind === "resource" ? delivery : undefined}>
                    {(resource) => (
                      <ArtifactResourceDownload
                        taskID={resource().taskID}
                        locator={resource().locator}
                        filename={resource().title}
                      />
                    )}
                  </Show>
                </div>
              )
            }}
          </For>
        </div>
      </Section>
    </Show>
  )
  const Preview = () => (
    <Dialog open={Boolean(selected())} onClose={() => setSelected(undefined)} title={selected()?.title ?? ""} wider>
      <Show when={selected()}>
        {(delivery) => (
          <>
            <Show
              when={
                delivery().kind === "resource" ? (delivery() as Extract<Delivery, { kind: "resource" }>) : undefined
              }
            >
              {(resource) => (
                <ConversationArtifactInspector
                  taskID={resource().taskID}
                  locator={resource().locator}
                  title={resource().title}
                />
              )}
            </Show>
            <Show
              when={
                delivery().kind === "interactive"
                  ? (delivery() as Extract<Delivery, { kind: "interactive" }>)
                  : undefined
              }
            >
              {(interactive) => <InteractiveArtifactPart part={interactive().part} />}
            </Show>
          </>
        )}
      </Show>
    </Dialog>
  )
  return { Inventory, Preview }
}
