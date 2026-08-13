import { InvalidToolResultControlError, toolResultControl } from "@/session/tool-result-control"

export type ToolExecutionMode = "ordinary" | "turn_control_exclusive"

const modeByTool = new WeakMap<object, ToolExecutionMode>()

export function bindToolExecutionMode<T extends object>(tool: T, mode: ToolExecutionMode): T {
  modeByTool.set(tool, mode)
  return tool
}

export function toolExecutionModeOf(tool: object): ToolExecutionMode {
  return modeByTool.get(tool) ?? "ordinary"
}

export class ToolTurnExecutionConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ToolTurnExecutionConflictError"
  }
}

export class ToolTurnExecutionCoordinator {
  #ordinary = 0
  #exclusivePending = false
  #sealed = false
  #ordinarySettled: Promise<void> = Promise.resolve()
  #resolveOrdinarySettled: (() => void) | undefined

  async run<T>(mode: ToolExecutionMode, execute: () => Promise<T>): Promise<T> {
    if (this.#sealed) {
      throw new ToolTurnExecutionConflictError("The assistant turn already committed an exclusive Tool result")
    }
    if (mode === "ordinary") {
      if (this.#exclusivePending) {
        throw new ToolTurnExecutionConflictError("An exclusive Tool occurrence is already pending in this assistant turn")
      }
      if (this.#ordinary === 0) {
        this.#ordinarySettled = new Promise<void>((resolve) => (this.#resolveOrdinarySettled = resolve))
      }
      this.#ordinary++
      try {
        try {
          const result = await execute()
          const metadata = result && typeof result === "object" ? (result as { metadata?: unknown }).metadata : undefined
          if (toolResultControl(metadata)) {
            this.#sealed = true
            throw new ToolTurnExecutionConflictError(
              "A Tool that returns turn control must declare turn_control_exclusive execution",
            )
          }
          return result
        } catch (error) {
          if (error instanceof InvalidToolResultControlError && error.committedControl) this.#sealed = true
          throw error
        }
      } finally {
        this.#ordinary--
        if (this.#ordinary === 0) {
          this.#resolveOrdinarySettled?.()
          this.#resolveOrdinarySettled = undefined
        }
      }
    }

    if (this.#exclusivePending) {
      throw new ToolTurnExecutionConflictError("A second exclusive Tool occurrence cannot enter the same assistant turn")
    }
    this.#exclusivePending = true
    try {
      await this.#ordinarySettled
      if (this.#sealed) {
        throw new ToolTurnExecutionConflictError("The assistant turn committed Tool control while exclusive work waited")
      }
      try {
        const result = await execute()
        const metadata = result && typeof result === "object" ? (result as { metadata?: unknown }).metadata : undefined
        if (toolResultControl(metadata)) this.#sealed = true
        return result
      } catch (error) {
        if (error instanceof InvalidToolResultControlError && error.committedControl) this.#sealed = true
        throw error
      }
    } finally {
      this.#exclusivePending = false
    }
  }
}
