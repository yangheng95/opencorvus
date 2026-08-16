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

/**
 * How a Tool's completion enters the durable decision set of its assistant
 * turn. Declaring it lets the coordinator refuse a combination the reduction
 * would later have to treat as an integrity conflict.
 */
export type ToolDecisionDeclaration = {
  command: string
  /** Whether this call, if it completes, commits a decision for the turn. */
  commits: (args: unknown) => boolean
}

const decisionByTool = new WeakMap<object, ToolDecisionDeclaration>()

export function bindToolDecisionDeclaration<T extends object>(tool: T, declaration: ToolDecisionDeclaration): T {
  decisionByTool.set(tool, declaration)
  return tool
}

export function toolDecisionDeclarationOf(tool: object): ToolDecisionDeclaration | undefined {
  return decisionByTool.get(tool)
}

/** Carry both coordination bindings onto a wrapped Tool. Rebinding only the
 * execution mode silently drops the decision rule. */
export function copyToolCoordinationBindings<T extends object>(from: object, to: T): T {
  bindToolExecutionMode(to, toolExecutionModeOf(from))
  const declaration = toolDecisionDeclarationOf(from)
  if (declaration) bindToolDecisionDeclaration(to, declaration)
  return to
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
  #decisionCommand: string | undefined

  /**
   * Refuse a second, different decision in one assistant turn.
   *
   * The durable reduction accepts a decision set only when it is a single
   * `dispatch_agent` fan-out or exactly one other decision; anything mixed is
   * an integrity conflict, and an integrity conflict is absorbing — the ingress
   * blocks permanently and holds every later one behind it. Since a model can
   * emit that combination in ordinary output, it has to be refused while the
   * call is still refusable, before it becomes a durable fact.
   */
  #admitDecision(decision: { command: string; commits: boolean } | undefined): string | undefined {
    if (!decision?.commits) return this.#decisionCommand
    const prior = this.#decisionCommand
    if (prior !== undefined && !(prior === "dispatch_agent" && decision.command === "dispatch_agent")) {
      throw new ToolTurnExecutionConflictError(
        `Decision Tool ${decision.command} cannot join an assistant turn that already committed ${prior}`,
      )
    }
    this.#decisionCommand = decision.command
    return prior
  }

  async run<T>(
    mode: ToolExecutionMode,
    execute: () => Promise<T>,
    decision?: { command: string; commits: boolean },
  ): Promise<T> {
    if (this.#sealed) {
      throw new ToolTurnExecutionConflictError("The assistant turn already committed an exclusive Tool result")
    }
    // A refused call produces no completed receipt, so the model may still
    // choose a different decision in the same turn; restore the prior claim.
    const priorDecision = this.#admitDecision(decision)
    const releaseDecisionOnFailure = () => {
      if (decision?.commits) this.#decisionCommand = priorDecision
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
          releaseDecisionOnFailure()
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
      releaseDecisionOnFailure()
      throw new ToolTurnExecutionConflictError("A second exclusive Tool occurrence cannot enter the same assistant turn")
    }
    this.#exclusivePending = true
    try {
      await this.#ordinarySettled
      if (this.#sealed) {
        releaseDecisionOnFailure()
        throw new ToolTurnExecutionConflictError("The assistant turn committed Tool control while exclusive work waited")
      }
      try {
        const result = await execute()
        const metadata = result && typeof result === "object" ? (result as { metadata?: unknown }).metadata : undefined
        if (toolResultControl(metadata)) this.#sealed = true
        return result
      } catch (error) {
        if (error instanceof InvalidToolResultControlError && error.committedControl) this.#sealed = true
        releaseDecisionOnFailure()
        throw error
      }
    } finally {
      this.#exclusivePending = false
    }
  }
}
