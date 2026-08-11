import { For, Show, createMemo, createSignal } from "solid-js"

import type { CardNode } from "../store/card-tree"
import type { ArtifactReadLocator } from "../services/conversation-artifact"
import { t, tc } from "../utils/i18n"
import { ConversationArtifactInspector } from "./ConversationArtifactInspector"
import { Button } from "./ui/Button"
import { Icon } from "./ui/Icon"

const DEFAULT_VISIBLE_OUTPUT_COUNT = 5

type Summary = NonNullable<CardNode["turnArtifacts"]>[number]
type Entry = Summary["entries"][number]
type DeclaredOutput = Summary["declaredOutputs"][number]
type DeclaredOutputRow =
  | { kind: "resource"; declarations: DeclaredOutput[]; resource: DeclaredOutput["resources"][number] }
  | { kind: "artifact"; declaration: DeclaredOutput }

function artifactIdentity(entry: Entry): string {
  return `${entry.source}:${JSON.stringify(entry.locator)}`
}

function outputIdentity(output: DeclaredOutputRow): string {
  return output.kind === "resource"
    ? `resource:${JSON.stringify({ source: "task_artifact_resource", ref: output.resource })}`
    : `artifact:${JSON.stringify(output.declaration.declarationLocator)}`
}

function artifactTypeLabel(entry: Entry): string {
  return entry.artifact_type || entry.kind
}

function artifactResourceLabel(entry: Entry): string {
  return entry.resource_count > 0
    ? tc("chat.artifacts.resource_count", entry.resource_count)
    : t(entry.source === "engine_artifact" ? "chat.artifacts.structured" : "chat.artifacts.snapshot")
}

function producerLabel(producer: Record<string, unknown> | null): string {
  if (!producer) return t("chat.artifacts.producer_unknown")
  if (
    (producer.owner_kind === "projected-worker" || producer.owner_kind === "projected-scheduler") &&
    typeof producer.agent_id === "string" &&
    producer.agent_id
  ) {
    return producer.agent_id
  }
  if (producer.owner_kind === "mission") return t("chat.artifacts.producer_mission")
  if (producer.owner_kind === "core" && typeof producer.component_id === "string" && producer.component_id) {
    return producer.component_id
  }
  return t("chat.artifacts.producer_unknown")
}

function outputLocator(output: DeclaredOutputRow): ArtifactReadLocator {
  return output.kind === "resource"
    ? ({ source: "task_artifact_resource", ref: output.resource } as ArtifactReadLocator)
    : (output.declaration.declarationLocator as ArtifactReadLocator)
}

function outputPrimaryLabel(output: DeclaredOutputRow): string {
  return output.kind === "resource" ? output.resource.path : output.declaration.label
}

function outputSecondaryLabel(output: DeclaredOutputRow): string {
  if (output.kind === "resource") {
    return [...new Set(output.declarations.map((declaration) => producerLabel(declaration.producer)))].join(", ")
  }
  const producer = producerLabel(output.declaration.producer)
  const declaration = output.declaration.artifactType || t("chat.artifacts.structured")
  return `${producer} · ${declaration}`
}

function outputMeta(output: DeclaredOutputRow): string {
  return output.kind === "resource" ? output.resource.media_type : t("chat.artifacts.structured")
}

export function ConversationTurnArtifactSummary(props: { summary: Summary; onContentChanged?: () => void }) {
  const [outputsExpanded, setOutputsExpanded] = createSignal(false)
  const [recordsExpanded, setRecordsExpanded] = createSignal(false)
  const [openOutputID, setOpenOutputID] = createSignal("")
  const [openArtifactID, setOpenArtifactID] = createSignal("")
  const outputRows = createMemo<DeclaredOutputRow[]>(() => {
    const rows: DeclaredOutputRow[] = []
    const resources = new Map<string, Extract<DeclaredOutputRow, { kind: "resource" }>>()
    for (const declaration of props.summary.declaredOutputs) {
      if (declaration.resources.length === 0) {
        rows.push({ kind: "artifact", declaration })
        continue
      }
      for (const resource of declaration.resources) {
        const identity = JSON.stringify({ source: "task_artifact_resource", ref: resource })
        const existing = resources.get(identity)
        if (existing) {
          existing.declarations.push(declaration)
          continue
        }
        const row: Extract<DeclaredOutputRow, { kind: "resource" }> = {
          kind: "resource",
          declarations: [declaration],
          resource,
        }
        resources.set(identity, row)
        rows.push(row)
      }
    }
    return rows
  })
  const visibleOutputs = createMemo(() =>
    outputsExpanded() ? outputRows() : outputRows().slice(0, DEFAULT_VISIBLE_OUTPUT_COUNT),
  )
  const remainingOutputs = createMemo(() => Math.max(0, outputRows().length - DEFAULT_VISIBLE_OUTPUT_COUNT))
  const title = createMemo(() =>
    outputRows().length > 0 ? tc("chat.artifacts.count", outputRows().length) : t("chat.artifacts.none_title"),
  )

  return (
    <section
      class="conversation-artifact-summary conversation-turn-artifact-summary"
      data-ui="conversation-turn-artifact-summary"
      data-task-id={props.summary.task.id}
      aria-label={title()}
    >
      <header class="conversation-artifact-summary__header">
        <span class="conversation-artifact-summary__icon" aria-hidden="true">
          <Icon name="file-document" size="medium" />
        </span>
        <div class="conversation-artifact-summary__identity">
          <span class="conversation-artifact-summary__eyebrow">{t("chat.artifacts.label")}</span>
          <strong>{title()}</strong>
          <span class="conversation-artifact-summary__file-total">{props.summary.task.title}</span>
        </div>
      </header>

      <Show when={props.summary.task.status !== "completed"}>
        <div
          class="conversation-artifact-summary__outcome"
          data-status={props.summary.task.status}
          role={props.summary.task.status === "failed" ? "alert" : "status"}
        >
          <strong>
            {t(props.summary.task.status === "failed" ? "chat.artifacts.task_failed" : "chat.artifacts.task_cancelled")}
          </strong>
          <Show when={props.summary.task.reason}>{(reason) => <span>{reason()}</span>}</Show>
        </div>
      </Show>

      <Show when={outputRows().length === 0}>
        <div class="conversation-artifact-summary__empty">{t("chat.artifacts.none")}</div>
      </Show>

      <Show when={outputRows().length > 0}>
        <div class="conversation-artifact-summary__section">
          <div class="conversation-artifact-summary__section-label">{t("chat.artifacts.declared_outputs")}</div>
          <div class="conversation-artifact-summary__artifacts">
            <For each={visibleOutputs()}>
              {(output) => {
                const identity = outputIdentity(output)
                const open = () => openOutputID() === identity
                const title = outputPrimaryLabel(output)
                return (
                  <div class="conversation-artifact-summary__artifact-item">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      tone="neutral"
                      class="conversation-artifact-summary__artifact conversation-artifact-summary__declared-output"
                      data-output-kind={output.kind}
                      data-selected={open() ? "true" : undefined}
                      title={title}
                      aria-expanded={open()}
                      onClick={() => {
                        setOpenOutputID(open() ? "" : identity)
                        setOpenArtifactID("")
                        props.onContentChanged?.()
                      }}
                    >
                      <span class="conversation-artifact-summary__row-icon" aria-hidden="true">
                        <Icon name="file-document" size="compact" />
                      </span>
                      <span class="conversation-artifact-summary__artifact-copy">
                        <strong>{title}</strong>
                        <span>{outputSecondaryLabel(output)}</span>
                      </span>
                      <span class="conversation-artifact-summary__artifact-meta">{outputMeta(output)}</span>
                      <Icon name={open() ? "chevron-down" : "chevron"} size="compact" />
                    </Button>
                    <Show when={open()}>
                      <ConversationArtifactInspector
                        taskID={props.summary.task.id}
                        title={title}
                        locator={outputLocator(output)}
                        onContentChanged={props.onContentChanged}
                      />
                    </Show>
                  </div>
                )
              }}
            </For>
          </div>
          <Show when={remainingOutputs() > 0}>
            <Button
              type="button"
              variant="ghost"
              size="mini"
              tone="neutral"
              class="conversation-artifact-summary__disclosure"
              data-ui="conversation-output-disclosure"
              aria-expanded={outputsExpanded()}
              onClick={() => {
                setOutputsExpanded((value) => !value)
                props.onContentChanged?.()
              }}
            >
              <span>
                {outputsExpanded()
                  ? t("chat.artifacts.show_less")
                  : t("chat.artifacts.show_more", { count: remainingOutputs() })}
              </span>
              <Icon name={outputsExpanded() ? "chevron-down" : "chevron"} size="compact" />
            </Button>
          </Show>
        </div>
      </Show>

      <Show when={props.summary.entries.length > 0}>
        <div class="conversation-artifact-summary__records">
          <Button
            type="button"
            variant="ghost"
            size="mini"
            tone="neutral"
            class="conversation-artifact-summary__disclosure conversation-artifact-summary__records-disclosure"
            aria-expanded={recordsExpanded()}
            onClick={() => {
              setRecordsExpanded((value) => !value)
              props.onContentChanged?.()
            }}
          >
            <span>{t("chat.artifacts.delivery_records", { count: props.summary.entries.length })}</span>
            <Icon name={recordsExpanded() ? "chevron-down" : "chevron"} size="compact" />
          </Button>
          <Show when={recordsExpanded()}>
            <div class="conversation-artifact-summary__artifacts conversation-artifact-summary__record-list">
              <For each={props.summary.entries}>
                {(entry) => {
                  const identity = artifactIdentity(entry)
                  const title = entry.label || artifactTypeLabel(entry)
                  const open = () => openArtifactID() === identity
                  return (
                    <div class="conversation-artifact-summary__artifact-item">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        tone="neutral"
                        class="conversation-artifact-summary__artifact"
                        data-artifact-source={entry.source}
                        data-artifact-id={identity}
                        data-selected={open() ? "true" : undefined}
                        title={title}
                        aria-expanded={open()}
                        onClick={() => {
                          setOpenArtifactID(open() ? "" : identity)
                          setOpenOutputID("")
                          props.onContentChanged?.()
                        }}
                      >
                        <span class="conversation-artifact-summary__row-icon" aria-hidden="true">
                          <Icon name="file-document" size="compact" />
                        </span>
                        <span class="conversation-artifact-summary__artifact-copy">
                          <strong>{title}</strong>
                          <span>{artifactTypeLabel(entry)}</span>
                        </span>
                        <span class="conversation-artifact-summary__artifact-meta">{artifactResourceLabel(entry)}</span>
                        <Icon name={open() ? "chevron-down" : "chevron"} size="compact" />
                      </Button>
                      <Show when={open()}>
                        <ConversationArtifactInspector
                          taskID={props.summary.task.id}
                          title={title}
                          locator={entry.locator as ArtifactReadLocator}
                          onContentChanged={props.onContentChanged}
                        />
                      </Show>
                    </div>
                  )
                }}
              </For>
            </div>
          </Show>
        </div>
      </Show>

      <Show when={props.summary.providerErrors.length > 0}>
        <div class="conversation-artifact-summary__errors" role="alert">
          <For each={props.summary.providerErrors}>
            {(error) => (
              <span>{t("chat.artifacts.provider_error", { source: error.source, error: error.message })}</span>
            )}
          </For>
        </div>
      </Show>
    </section>
  )
}
