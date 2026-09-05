import { InvalidToolResultControlError, toolResultControl } from "@/session/tool-result-control"

export type ToolExecutionMode = "ordinary" | "turn_control_exclusive"
export type ToolExecutionModeResolver = (args: unknown) => ToolExecutionMode
export type ToolExecutionModeDeclaration = ToolExecutionMode | ToolExecutionModeResolver

const modeByTool = new WeakMap<object, ToolExecutionModeDeclaration>()

export function bindToolExecutionMode<T extends object>(tool: T, declaration: ToolExecutionModeDeclaration): T {
  modeByTool.set(tool, declaration)
  return tool
}

export function toolExecutionModeOf(tool: object, args?: unknown): ToolExecutionMode {
  const declaration = modeByTool.get(tool)
  return typeof declaration === "function" ? declaration(args) : (declaration ?? "ordinary")
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
  const executionMode = modeByTool.get(from)
  if (executionMode) bindToolExecutionMode(to, executionMode)
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
  readonly #pendingDecisions = new Map<symbol, string>()

  /**
   * An assistant turn is a persisted Message, not a Provider step.
   *
   * One coordinator is created per resolved Tool surface, and a surface is
   * resolved once per Provider step — but a Task-root assistant Message is
   * deterministic in its input Message and is retained across steps whenever a
   * step ended on tool calls. So the claim below used to reset every step while
   * the durable decision facts kept accumulating under one `assistantMessageID`,
   * and the reduction rejected exactly the combination this class exists to
   * refuse. Seeding from the receipts already on that Message restores the scope
   * the guard was written for, and does it from durable evidence, so a Turn that
   * resumes in a different process is guarded the same way.
   */
  constructor(input?: { committedDecision?: string }) {
    this.#decisionCommand = input?.committedDecision
  }

  /** The decision this turn stands on, whether it was seeded from the Message's
   *  durable receipts or committed by a call on this surface. */
  get committedDecision(): string | undefined {
    return this.#decisionCommand
  }

  /**
   * Refuse a second, different decision in one assistant turn.
   *
   * The durable reduction accepts a decision set only when it is a single
   * `dispatch_agent` fan-out or exactly one other decision; anything mixed is
   * an integrity conflict that costs the Turn its effect: the ingress rests in
   * `host_fault`, the reduction returns before any decision can be read, and
   * only a new operator message can redo the abandoned work. Since a model can
   * emit that combination in ordinary output, it has to be refused while the
   * call is still refusable, before it becomes a durable fact.
   */
  #admitDecision(decision: { command: string; commits: boolean } | undefined): symbol | undefined {
    if (!decision?.commits) return undefined
    const prior = this.#decisionCommand ?? this.#pendingDecisions.values().next().value
    if (prior !== undefined && !(prior === "dispatch_agent" && decision.command === "dispatch_agent")) {
      const expected =
        prior === "dispatch_agent" ? "another dispatch_agent, or no further decision Tool" : "no further decision Tool"
      throw new ToolTurnExecutionConflictError(
        `Decision Tool ${decision.command} cannot join an assistant turn that already committed ${prior}. ` +
          `Expected: ${expected}. Received: ${decision.command}. ` +
          `End this Turn without another decision — ${prior} is already recorded as its decision.`,
      )
    }
    const admission = Symbol(decision.command)
    this.#pendingDecisions.set(admission, decision.command)
    return admission
  }

  async run<T>(
    mode: ToolExecutionMode,
    execute: () => Promise<T>,
    decision?: { command: string; commits: boolean },
  ): Promise<T> {
    if (this.#sealed) {
      throw new ToolTurnExecutionConflictError("The assistant turn already committed an exclusive Tool result")
    }
    if (this.#exclusivePending) {
      throw new ToolTurnExecutionConflictError("An exclusive Tool occurrence is already pending in this assistant turn")
    }
    // Each call owns only its in-flight admission. Its failure cannot rewind
    // a successful sibling or resurrect another sibling's failed admission.
    const admission = this.#admitDecision(decision)
    const releaseDecisionOnFailure = () => {
      if (admission) this.#pendingDecisions.delete(admission)
    }
    const commitDecision = () => {
      if (decision?.commits) this.#decisionCommand = decision.command
      releaseDecisionOnFailure()
    }
    if (mode === "ordinary") {
      if (this.#ordinary === 0) {
        this.#ordinarySettled = new Promise<void>((resolve) => (this.#resolveOrdinarySettled = resolve))
      }
      this.#ordinary++
      try {
        try {
          const result = await execute()
          const metadata =
            result && typeof result === "object" ? (result as { metadata?: unknown }).metadata : undefined
          if (toolResultControl(metadata)) {
            this.#sealed = true
            throw new ToolTurnExecutionConflictError(
              "A Tool that returns turn control must declare turn_control_exclusive execution",
            )
          }
          commitDecision()
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

    this.#exclusivePending = true
    try {
      await this.#ordinarySettled
      if (this.#sealed) {
        releaseDecisionOnFailure()
        throw new ToolTurnExecutionConflictError(
          "The assistant turn committed Tool control while exclusive work waited",
        )
      }
      try {
        const result = await execute()
        const metadata = result && typeof result === "object" ? (result as { metadata?: unknown }).metadata : undefined
        if (toolResultControl(metadata)) this.#sealed = true
        commitDecision()
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
