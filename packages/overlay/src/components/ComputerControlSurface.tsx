import { createResource, createSignal, Show } from "solid-js"
import {
  getComputerOwnership,
  returnComputerControl,
  takeOverComputer,
  type ComputerIdentity,
  type ComputerOwnership,
} from "../services/computer"
import { t } from "../utils/i18n"
import { Button } from "./ui/Button"

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function ComputerControlSurface(props: ComputerIdentity) {
  const identity = () => ({ sessionID: props.sessionID, computerID: props.computerID, displayID: props.displayID })
  const [ownership, { mutate }] = createResource(identity, getComputerOwnership)
  const [operation, setOperation] = createSignal<"takeover" | "return">()
  const [operationError, setOperationError] = createSignal("")

  async function run(kind: "takeover" | "return", action: () => Promise<ComputerOwnership>) {
    setOperation(kind)
    setOperationError("")
    try {
      const result = await action()
      mutate(result)
    } catch (error) {
      setOperationError(message(error))
    } finally {
      setOperation()
    }
  }

  return (
    <section class="computer-control-surface" data-ui="computer-control-surface">
      <div class="computer-control-surface__identity">
        <div>
          <span>{t("computer.control.computer")}</span>
          <strong>{props.computerID}</strong>
        </div>
        <div>
          <span>{t("computer.control.display")}</span>
          <strong>{props.displayID}</strong>
        </div>
      </div>
      <div class="computer-control-surface__status" data-owner={ownership()?.ownership}>
        <span class="computer-control-surface__status-dot" aria-hidden="true" />
        <span>
          {ownership.loading
            ? t("computer.control.loading")
            : ownership()?.ownership === "human"
              ? t("computer.control.human_owned")
              : t("computer.control.agent_owned")}
        </span>
      </div>
      <div class="computer-control-surface__actions">
        <Show
          when={ownership()?.ownership === "human"}
          fallback={
            <Button
              type="button"
              variant="solid"
              size="sm"
              tone="accent"
              disabled={Boolean(operation()) || ownership.loading}
              onClick={() => run("takeover", () => takeOverComputer(identity()))}
            >
              {operation() === "takeover" ? t("computer.control.switching") : t("computer.control.takeover")}
            </Button>
          }
        >
          <Button
            type="button"
            variant="solid"
            size="sm"
            tone="accent"
            disabled={Boolean(operation()) || ownership.loading}
            onClick={() => run("return", () => returnComputerControl(identity()))}
          >
            {operation() === "return" ? t("computer.control.switching") : t("computer.control.return")}
          </Button>
        </Show>
      </div>
      <Show when={ownership.error || operationError()}>
        <div class="computer-control-surface__error" role="status">
          {operationError() || message(ownership.error)}
        </div>
      </Show>
      <Show when={ownership()?.freshObservationRequired}>
        <div class="computer-control-surface__notice">{t("computer.control.fresh_observation")}</div>
      </Show>
    </section>
  )
}
