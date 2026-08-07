import { For, Show, createMemo, createSignal } from "solid-js"

import type { CardNode } from "../store/card-tree"
import type { ArtifactReadLocator } from "../services/conversation-artifact"
import { t, tc } from "../utils/i18n"
import { ConversationArtifactInspector } from "./ConversationArtifactInspector"
import { Button } from "./ui/Button"
import { Icon } from "./ui/Icon"

const DEFAULT_VISIBLE_ARTIFACT_COUNT = 3

type Summary = NonNullable<CardNode["turnArtifacts"]>[number]
type Entry = Summary["entries"][number]

function artifactIdentity(entry: Entry): string {
  return `${entry.source}:${JSON.stringify(entry.locator)}`
}

function artifactTypeLabel(entry: Entry): string {
  return entry.artifact_type || entry.kind
}

function artifactResourceLabel(entry: Entry): string {
  return entry.resource_count > 0
    ? tc("chat.artifacts.resource_count", entry.resource_count)
    : t(entry.source === "engine_artifact" ? "chat.artifacts.structured" : "chat.artifacts.snapshot")
}

export function ConversationTurnArtifactSummary(props: { summary: Summary; onContentChanged?: () => void }) {
  const [expanded, setExpanded] = createSignal(false)
  const [openArtifactID, setOpenArtifactID] = createSignal("")
  const visibleArtifacts = createMemo(() =>
    expanded() ? props.summary.entries : props.summary.entries.slice(0, DEFAULT_VISIBLE_ARTIFACT_COUNT),
  )
  const remaining = createMemo(() => Math.max(0, props.summary.entries.length - DEFAULT_VISIBLE_ARTIFACT_COUNT))
  const title = createMemo(() =>
    props.summary.entries.length > 0
      ? tc("chat.artifacts.count", props.summary.entries.length)
      : t("chat.artifacts.none_title"),
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

      <Show when={props.summary.entries.length === 0}>
        <div class="conversation-artifact-summary__empty">{t("chat.artifacts.none")}</div>
      </Show>

      <Show when={props.summary.entries.length > 0}>
        <div class="conversation-artifact-summary__section">
          <div class="conversation-artifact-summary__section-label">{t("chat.artifacts.outputs")}</div>
          <div class="conversation-artifact-summary__artifacts">
            <For each={visibleArtifacts()}>
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

      <Show when={remaining() > 0}>
        <Button
          type="button"
          variant="ghost"
          size="mini"
          tone="neutral"
          class="conversation-artifact-summary__disclosure"
          data-ui="conversation-artifact-disclosure"
          aria-expanded={expanded()}
          onClick={() => {
            setExpanded((value) => !value)
            props.onContentChanged?.()
          }}
        >
          <span>
            {expanded() ? t("chat.artifacts.show_less") : t("chat.artifacts.show_more", { count: remaining() })}
          </span>
          <Icon name={expanded() ? "chevron-down" : "chevron"} size="compact" />
        </Button>
      </Show>
    </section>
  )
}
