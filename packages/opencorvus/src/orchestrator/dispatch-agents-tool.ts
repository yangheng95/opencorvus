import { DispatchOutcomeSchema } from "@/agent/dispatch-outcome"
import { Identifier } from "@/id/id"
import { Session } from "@/session"
import { MessageStore } from "@/session/message-store"
import { toolFailureCauseFromUnknown } from "@/session/tool-failure-cause"
import { bindToolDecisionDeclaration } from "@/tool/execution-mode"
import { cloneToolInputForPersistence } from "@/tool/result-attachment-materialization"
import { tool } from "ai"
import { isDeepStrictEqual } from "node:util"
import z from "zod"
import { requireOrchestratorToolExecutionContext } from "./tool-execution-context"

type DispatchAgentTool = {
  inputSchema: unknown
  execute?: (...args: any[]) => any
}

type DispatchAgentsRuntime = {
  parts: typeof MessageStore.parts
  updatePart: typeof Session.updatePart
  afterPrepared?: (input: { outerToolPartID: string; childPartIDs: readonly string[] }) => void | Promise<void>
  afterChildCompleted?: (input: {
    outerToolPartID: string
    childPartID: string
    frontierIndex: number
  }) => void | Promise<void>
}

const productionRuntime: DispatchAgentsRuntime = {
  parts: MessageStore.parts,
  updatePart: Session.updatePart,
}

const MAX_FRONTIER_SIZE = 8

function childPartID(outerToolPartID: string, index: number): string {
  return Identifier.deterministic("part", `dispatch-agents\0${outerToolPartID}\0${index}`)
}

function childCallID(outerToolPartID: string, index: number): string {
  return Identifier.deterministic("call", `dispatch-agents\0${outerToolPartID}\0${index}`)
}

async function settlePreparedChildren(input: {
  children: readonly {
    index: number
    partID: string
    callID: string
    request: unknown
  }[]
  primary: unknown
  originSite: string
  outerToolPartID: string
  orchestratorSessionID: string
  orchestratorMessageID: string
  startedAt: number
  updatePart: typeof Session.updatePart
}): Promise<never> {
  const endedAt = Date.now()
  const cleanup = await Promise.allSettled(
    input.children.map((child) =>
      input.updatePart({
        id: child.partID,
        sessionID: input.orchestratorSessionID,
        messageID: input.orchestratorMessageID,
        type: "tool",
        callID: child.callID,
        tool: "dispatch_agent",
        state: {
          status: "error",
          input: child.request,
          failure: toolFailureCauseFromUnknown({
            error: input.primary,
            originSite: input.originSite,
            classification: "tool-execution",
            kind: "tool-execute-error",
            data: {
              frontierIndex: child.index,
              outerToolPartID: input.outerToolPartID,
            },
          }),
          time: { start: input.startedAt + child.index, end: Math.max(endedAt, input.startedAt + child.index + 1) },
        },
      }),
    ),
  )
  const cleanupFailures = cleanup.flatMap((result) => (result.status === "rejected" ? [result.reason] : []))
  if (cleanupFailures.length > 0) {
    throw new AggregateError([input.primary, ...cleanupFailures], "dispatch_agents failed while settling child Parts")
  }
  throw input.primary
}

/**
 * Compose exact dispatch_agent occurrences into one model decision.
 *
 * The model still chooses every request. This layer only makes the chosen
 * frontier indivisible at the model/Host boundary: all inputs validate and all
 * child Tool Parts become durable before any worker starts. Each child then
 * follows the canonical dispatch_agent implementation and owns its own
 * lineage, Session, messages, recovery, and terminal delivery.
 */
function createDispatchAgentsToolWithRuntime(
  dispatchAgentTool: DispatchAgentTool,
  runtime: DispatchAgentsRuntime,
) {
  if (!dispatchAgentTool.execute) throw new Error("dispatch_agents requires an executable dispatch_agent Tool")
  const childInputSchema = dispatchAgentTool.inputSchema as z.ZodType
  const teamMemberSchema = z
    .object({
      name: z.string().min(1).max(96).describe("Task-local member name used only in this visible frontier."),
      target: z.string().min(1).describe("Exact projected Agent target used by the aligned dispatch item."),
      responsibility: z.string().min(1).describe("One non-overlapping responsibility."),
      boundary: z.string().min(1).describe("Explicit owned facts, files, or effects and prohibited overlap."),
      expected_result: z.string().min(1).describe("Visible result and evidence duty expected from this member."),
      depends_on: z
        .array(z.string().min(1))
        .describe("Settled predecessor member names. Members in this same ready frontier cannot appear here."),
    })
    .strict()

  const inputSchema = z
    .object({
      team: z
        .array(teamMemberSchema)
        .min(1)
        .max(MAX_FRONTIER_SIZE)
        .describe("Visible structured description of the exact members in this frontier, aligned with dispatches."),
      dispatches: z
        .array(childInputSchema)
        .min(1)
        .max(MAX_FRONTIER_SIZE)
        .describe(
          "The complete dependency-ready frontier. Each item is one exact dispatch_agent request. " +
            "Include every currently independent member once; keep dependent or conflicting work for a later frontier.",
        ),
    })
    .strict()
    .superRefine((input, context) => {
      if (input.team.length !== input.dispatches.length) {
        context.addIssue({
          code: "custom",
          path: ["team"],
          message: "team and dispatches must describe the same frontier size",
        })
        return
      }
      const names = new Set<string>()
      input.team.forEach((member, index) => {
        if (names.has(member.name)) {
          context.addIssue({ code: "custom", path: ["team", index, "name"], message: "member names must be unique" })
        }
        names.add(member.name)
        const request = input.dispatches[index]
        const target =
          request && typeof request === "object" && !Array.isArray(request)
            ? (request as { dispatch?: { target?: unknown } }).dispatch?.target
            : undefined
        if (member.target !== target) {
          context.addIssue({
            code: "custom",
            path: ["team", index, "target"],
            message: "member target must equal the aligned dispatch target",
          })
        }
      })
      input.team.forEach((member, index) => {
        if (member.depends_on.some((dependency) => names.has(dependency))) {
          context.addIssue({
            code: "custom",
            path: ["team", index, "depends_on"],
            message: "a dependency-ready frontier cannot depend on another member in the same frontier",
          })
        }
      })
    })

  const frontierTool = tool({
    description:
      "Describe and submit one complete dependency-ready Agent frontier in this visible Tool call. team is the structured Task-local team/workflow description and aligns by index with dispatches. The Host validates identity consistency, persists one visible dispatch_agent Tool occurrence per item, and starts all items concurrently through the canonical dispatch runtime. The Host does not choose members, infer dependencies, or add work. Use one call for all currently independent members; use a later call only after real predecessor evidence opens another frontier.",
    inputSchema,
    execute: async (rawInput, options) => {
      const parsed = inputSchema.parse(rawInput)
      const outer = requireOrchestratorToolExecutionContext(options, "dispatch_agents")
      const outerOptions =
        options && typeof options === "object" ? (options as unknown as Record<string, unknown>) : {}
      const outerMeta =
        outerOptions.opencorvus && typeof outerOptions.opencorvus === "object" && !Array.isArray(outerOptions.opencorvus)
          ? (outerOptions.opencorvus as Record<string, unknown>)
          : {}
      const callerSignal =
        outerOptions.abortSignal &&
        typeof outerOptions.abortSignal === "object" &&
        "throwIfAborted" in outerOptions.abortSignal
          ? (outerOptions.abortSignal as AbortSignal)
          : undefined
      const startedAt = Date.now()
      const children = parsed.dispatches.map((request, index) => ({
        index,
        partID: childPartID(outer.toolPartID, index),
        callID: childCallID(outer.toolPartID, index),
        request: cloneToolInputForPersistence(request),
        target:
          request && typeof request === "object" && !Array.isArray(request)
            ? String((request as { dispatch?: { target?: unknown } }).dispatch?.target ?? "unknown")
            : "unknown",
      }))

      const existingByID = new Map((await runtime.parts(outer.orchestratorMessageID)).map((part) => [part.id, part]))
      const prepared: typeof children = []
      try {
        for (const child of children) {
          const existing = existingByID.get(child.partID)
          if (existing) {
            if (
              existing.type !== "tool" ||
              existing.tool !== "dispatch_agent" ||
              existing.callID !== child.callID ||
              !isDeepStrictEqual(existing.state.input, child.request)
            ) {
              throw new Error(`dispatch_agents child ${child.index} durable identity or input drift`)
            }
            continue
          }
          await runtime.updatePart({
            id: child.partID,
            sessionID: outer.orchestratorSessionID,
            messageID: outer.orchestratorMessageID,
            type: "tool",
            callID: child.callID,
            tool: "dispatch_agent",
            state: {
              status: "running",
              input: child.request,
              time: { start: startedAt + child.index },
            },
          })
          prepared.push(child)
        }
      } catch (error) {
        return await settlePreparedChildren({
          children: prepared,
          primary: error,
          originSite: "orchestrator.dispatch-agents.preflight",
          outerToolPartID: outer.toolPartID,
          orchestratorSessionID: outer.orchestratorSessionID,
          orchestratorMessageID: outer.orchestratorMessageID,
          startedAt,
          updatePart: runtime.updatePart,
        })
      }
      await runtime.afterPrepared?.({
        outerToolPartID: outer.toolPartID,
        childPartIDs: children.map((child) => child.partID),
      })

      const runChild = async (child: (typeof children)[number]) => {
        const existing = existingByID.get(child.partID)
        if (existing?.type === "tool" && existing.state.status === "completed") {
          return DispatchOutcomeSchema.parse(JSON.parse(existing.state.output))
        }
        if (existing?.type === "tool" && existing.state.status === "error") {
          throw new Error(`dispatch_agents child ${child.index} already settled as error`)
        }
        const childStartedAt =
          existing?.type === "tool" &&
          (existing.state.status === "pending" || existing.state.status === "running")
            ? existing.state.time.start
            : startedAt + child.index
        const childOptions = {
          ...outerOptions,
          toolCallId: child.callID,
          opencorvus: {
            ...outerMeta,
            sessionID: outer.orchestratorSessionID,
            messageID: outer.orchestratorMessageID,
            toolCallID: child.callID,
            toolPartID: child.partID,
            visibleToolName: "dispatch_agent",
          },
        }
        try {
          const outcome = DispatchOutcomeSchema.parse(
            await dispatchAgentTool.execute!(child.request, childOptions),
          )
          await runtime.updatePart({
            id: child.partID,
            sessionID: outer.orchestratorSessionID,
            messageID: outer.orchestratorMessageID,
            type: "tool",
            callID: child.callID,
            tool: "dispatch_agent",
            state: {
              status: "completed",
              input: child.request,
              output: JSON.stringify(outcome),
              title: `Dispatched ${child.target}`,
              metadata: {
                target: child.target,
                frontier_index: child.index,
                frontier_size: children.length,
                frontier_tool_part_id: outer.toolPartID,
              },
              time: { start: childStartedAt, end: Math.max(Date.now(), childStartedAt + 1) },
            },
          })
          await runtime.afterChildCompleted?.({
            outerToolPartID: outer.toolPartID,
            childPartID: child.partID,
            frontierIndex: child.index,
          })
          return outcome
        } catch (error) {
          callerSignal?.throwIfAborted()
          const settled = await Promise.allSettled([
            runtime.updatePart({
              id: child.partID,
              sessionID: outer.orchestratorSessionID,
              messageID: outer.orchestratorMessageID,
              type: "tool",
              callID: child.callID,
              tool: "dispatch_agent",
              state: {
                status: "error",
                input: child.request,
                failure: toolFailureCauseFromUnknown({
                  error,
                  originSite: "orchestrator.dispatch-agents.execute",
                  classification: "tool-execution",
                  kind: "tool-execute-error",
                  data: {
                    target: child.target,
                    frontierIndex: child.index,
                    outerToolPartID: outer.toolPartID,
                  },
                }),
                time: { start: childStartedAt, end: Math.max(Date.now(), childStartedAt + 1) },
              },
            }),
          ])
          const settlementFailure = settled[0]?.status === "rejected" ? settled[0].reason : undefined
          if (settlementFailure) {
            throw new AggregateError([error, settlementFailure], `dispatch_agents child ${child.index} settlement failed`)
          }
          throw error
        }
      }

      const settled = await Promise.allSettled(children.map((child) => runChild(child)))
      callerSignal?.throwIfAborted()
      const failures = settled.filter((result): result is PromiseRejectedResult => result.status === "rejected")
      if (failures.length > 0) {
        throw new AggregateError(
          failures.map((failure) => failure.reason),
          `dispatch_agents failed ${failures.length}/${children.length} exact dispatch occurrences`,
        )
      }
      const outcomes = settled.map((result) => (result as PromiseFulfilledResult<z.infer<typeof DispatchOutcomeSchema>>).value)
      return {
        title: `Dispatched frontier (${outcomes.length}/${children.length})`,
        output: JSON.stringify({ dispatches: outcomes }),
        metadata: {
          frontier_size: children.length,
          member_names: parsed.team.map((member) => member.name),
          targets: children.map((child) => child.target),
          dispatches: outcomes,
        },
      }
    },
  })

  // The durable decision remains the set of child dispatch_agent Parts. This
  // declaration lets the current Turn coordinator reserve that same decision
  // before the children are executed, so no different lifecycle decision can
  // join the Turn while the frontier is in flight.
  return bindToolDecisionDeclaration(frontierTool, {
    command: "dispatch_agent",
    commits: () => true,
  })
}

export function createDispatchAgentsTool(dispatchAgentTool: DispatchAgentTool) {
  return createDispatchAgentsToolWithRuntime(dispatchAgentTool, productionRuntime)
}

export const DispatchAgentsToolTestHooks = Object.freeze({
  create(
    dispatchAgentTool: DispatchAgentTool,
    input: Partial<DispatchAgentsRuntime>,
  ) {
    return createDispatchAgentsToolWithRuntime(dispatchAgentTool, { ...productionRuntime, ...input })
  },
})
