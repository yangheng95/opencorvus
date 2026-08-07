/**
 * ArchitectPanel — Architect Agent consensus summary.
 *
 * Shows persisted architecture contracts or an explicit empty hint.
 */
import { For, Show } from "solid-js"
import { Badge } from "./ui/Badge"
import { t } from "../utils/i18n"
import { renderMarkdown } from "../utils/markdown"

interface ArchitectDecision {
  key: string
  value: string
  reason: string
  goalID?: string | null
}

interface ArchitectData {
  summary: string
  contractCount: number
  categories: string[]
  decisions?: ArchitectDecision[]
}

interface ArchitectPanelProps {
  architect: ArchitectData | undefined
}

function readableKey(key: string): string {
  return key.replace(/[_-]+/g, " ").trim() || key
}

function hasMeaningfulSummary(summary: string): boolean {
  return summary.trim().length > 0 && !/^\d+\s+architect decisions across\s+\d+\s+categories$/i.test(summary.trim())
}

export function ArchitectPanel(props: ArchitectPanelProps) {
  const decisions = () => props.architect?.decisions ?? []

  return (
    <div class="arch-panel">
      <Show when={!props.architect}>
        <p class="empty-hint empty-hint--card">{t("task_scope.architect_empty")}</p>
      </Show>
      <Show when={props.architect}>
        <div class="arch-overview">
          <div class="arch-summary">
            <span class="arch-count">{props.architect!.contractCount}</span>
            <span class="arch-count-label">{t("task_scope.architect_contracts")}</span>
          </div>
          <Show when={props.architect!.categories.length > 0}>
            <div class="arch-categories">
              <For each={props.architect!.categories}>
                {(cat) => (
                  <Badge tone="muted" size="sm" title={cat} data-ui="architect-category-badge">
                    {readableKey(cat)}
                  </Badge>
                )}
              </For>
            </div>
          </Show>
        </div>
        <Show when={decisions().length > 0}>
          <div class="arch-decisions">
            <For each={decisions()}>
              {(decision) => (
                <article class="arch-decision">
                  <div class="arch-decision-head">
                    <span class="arch-decision-key">{readableKey(decision.key)}</span>
                    <Show when={decision.goalID}>
                      <span class="arch-decision-goal">{decision.goalID}</span>
                    </Show>
                  </div>
                  <div class="arch-decision-value md-content" innerHTML={renderMarkdown(decision.value)} />
                  <Show when={decision.reason}>
                    <div class="arch-decision-reason md-content" innerHTML={renderMarkdown(decision.reason)} />
                  </Show>
                </article>
              )}
            </For>
          </div>
        </Show>
        <Show when={decisions().length === 0 && hasMeaningfulSummary(props.architect!.summary)}>
          <div class="arch-detail md-content" innerHTML={renderMarkdown(props.architect!.summary)} />
        </Show>
        <Show when={decisions().length === 0 && !hasMeaningfulSummary(props.architect!.summary)}>
          <p class="empty-hint empty-hint--card">{t("task_scope.architect_empty")}</p>
        </Show>
      </Show>
    </div>
  )
}
