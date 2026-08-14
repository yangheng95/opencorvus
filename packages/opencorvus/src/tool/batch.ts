import z from "zod"
import { Tool } from "./tool"
import DESCRIPTION from "./batch.txt"
import { ToolLiveMetadataSink } from "./live-metadata-sink"
import {
  cloneToolInputForPersistence,
  materializeToolResultInlineAttachments,
  redactToolDiagnosticValue,
} from "./result-attachment-materialization"
import { Instance } from "@/project/instance"
import { Plugin } from "@/plugin"
import { withTaskToolInvocation } from "./task-tool-invocation"

const DISALLOWED = new Set(["batch"])
const FILTERED_FROM_SUGGESTIONS = new Set(["patch", ...DISALLOWED])

type InitializedTool = Awaited<ReturnType<Tool.Info["init"]>> & { id: string }

function createToolCallSchema(tools: InitializedTool[]) {
  const schemas = tools.map((tool) =>
    z.object({
      tool: z.literal(tool.id).describe(`Execute the ${tool.id} tool in this batched call.`),
      parameters: tool.parameters.describe(`Arguments for the ${tool.id} tool. Must match that tool's schema.`),
    }),
  )

  if (schemas.length === 0) throw new Error("batch tool cannot initialize without at least one target tool")
  if (schemas.length === 1) return schemas[0]

  return z.discriminatedUnion(
    "tool",
    schemas as [
      z.ZodObject<{ tool: z.ZodLiteral<string>; parameters: z.ZodType }>,
      z.ZodObject<{ tool: z.ZodLiteral<string>; parameters: z.ZodType }>,
      ...z.ZodObject<{ tool: z.ZodLiteral<string>; parameters: z.ZodType }>[],
    ],
  )
}

export function createBatchTool(visibleTools: InitializedTool[]): Tool.Info {
  return Tool.define("batch", async () => {
    const availableTools = visibleTools.filter(
      (tool) => !DISALLOWED.has(tool.id) && tool.executionMode !== "turn_control_exclusive",
    )
    const toolMap = new Map(availableTools.map((tool) => [tool.id, tool]))

    return {
      description: DESCRIPTION,
      parameters: z.object({
        tool_calls: z
          .array(createToolCallSchema(availableTools))
          .min(1, "Provide at least one tool call")
          .max(25, "Provide at most 25 tool calls")
          .describe("One to twenty-five independent tool calls to execute concurrently."),
      }),
      formatValidationError(error) {
        const formattedErrors = error.issues
          .map((issue) => {
            const path = issue.path.length > 0 ? issue.path.join(".") : "root"
            return `  - ${path}: ${issue.message}`
          })
          .join("\n")

        return `Invalid parameters for tool 'batch':\n${formattedErrors}\n\nExpected payload format:\n  {"tool_calls":[{"tool":"tool_name","parameters":{...}},...]}`
      },
      async execute(params, ctx) {
        const { Session } = await import("../session")
        const { Identifier } = await import("../id/id")
        const { toolFailureCauseFromUnknown } = await import("../session/tool-failure-cause")

        const executeCall = async (call: (typeof params.tool_calls)[number]) => {
          const callStartTime = Date.now()
          const partID = Identifier.ascending("part")

          try {
            if (DISALLOWED.has(call.tool)) {
              throw new Error(
                `Tool '${call.tool}' is not allowed in batch. Disallowed tools: ${Array.from(DISALLOWED).join(", ")}`,
              )
            }

            const tool = toolMap.get(call.tool)
            if (!tool) {
              const availableToolsList = Array.from(toolMap.keys()).filter(
                (name) => !FILTERED_FROM_SUGGESTIONS.has(name),
              )
              throw new Error(
                `Tool '${call.tool}' not in registry. External tools (MCP, environment) cannot be batched - call them directly. Available tools: ${availableToolsList.join(", ")}`,
              )
            }
            const validatedParams = tool.parameters.parse(call.parameters)
            const projectID = typeof ctx.extra?.projectID === "string" ? ctx.extra.projectID : Instance.project.id
            const persistedParams = cloneToolInputForPersistence(validatedParams)

            await Session.updatePart({
              id: partID,
              messageID: ctx.messageID,
              sessionID: ctx.sessionID,
              type: "tool",
              tool: call.tool,
              callID: partID,
              state: {
                status: "running",
                input: persistedParams,
                time: {
                  start: callStartTime,
                },
              },
            })

            const childMetadataSink = new ToolLiveMetadataSink<{
              title?: string
              metadata?: Record<string, any>
            }>(async (value) => {
              await Session.updatePart({
                id: partID,
                messageID: ctx.messageID,
                sessionID: ctx.sessionID,
                type: "tool",
                tool: call.tool,
                callID: partID,
                state: {
                  status: "running",
                  input: persistedParams,
                  title: value.title,
                  metadata: value.metadata,
                  time: {
                    start: callStartTime,
                  },
                },
              })
            })
            let rawResult: Awaited<ReturnType<typeof tool.execute>>
            try {
              rawResult = await withTaskToolInvocation({
                projectID,
                sessionID: ctx.sessionID,
                messageID: ctx.messageID,
                toolCallID: partID,
                toolPartID: partID,
                providerName: call.tool,
                providerKind: "builtin",
                providerID: call.tool,
                args: validatedParams,
              }, ctx.executionSurface, async (invocationAuthority) => {
                const childContext: Tool.Context = {
                  ...ctx,
                  callID: partID,
                  extra: {
                    ...ctx.extra,
                    projectID,
                    toolPartID: partID,
                    invocationAuthority,
                  },
                  metadata(value) {
                    childMetadataSink.update(redactToolDiagnosticValue(value))
                  },
                }
                await Plugin.trigger(
                  "tool.execute.before",
                  {
                    tool: call.tool,
                    sessionID: childContext.sessionID,
                    callID: partID,
                  },
                  { args: validatedParams },
                )
                const output = await tool.execute(validatedParams, childContext)
                await Plugin.trigger(
                  "tool.execute.after",
                  {
                    tool: call.tool,
                    sessionID: childContext.sessionID,
                    callID: partID,
                    args: validatedParams,
                  },
                  output,
                )
                return output
              })
              await childMetadataSink.close()
            } catch (primaryError) {
              try {
                await childMetadataSink.close()
              } catch (metadataError) {
                throw new AggregateError(
                  [primaryError, metadataError],
                  `${call.tool}: batched tool execution and live metadata persistence both failed`,
                )
              }
              throw primaryError
            }
            const result = await materializeToolResultInlineAttachments({
              projectID,
              value: rawResult,
            })
            const attachments = result.attachments?.map((attachment) => ({
              ...attachment,
              id: Identifier.ascending("part"),
              sessionID: ctx.sessionID,
              messageID: ctx.messageID,
            }))

            await Session.updatePart({
              id: partID,
              messageID: ctx.messageID,
              sessionID: ctx.sessionID,
              type: "tool",
              tool: call.tool,
              callID: partID,
              state: {
                status: "completed",
                input: persistedParams,
                output: result.output,
                title: result.title,
                metadata: result.metadata,
                attachments,
                time: {
                  start: callStartTime,
                  end: Date.now(),
                },
              },
            })

            return { success: true as const, tool: call.tool, result }
          } catch (error) {
            await Session.updatePart({
              id: partID,
              messageID: ctx.messageID,
              sessionID: ctx.sessionID,
              type: "tool",
              tool: call.tool,
              callID: partID,
              state: {
                status: "error",
                input: cloneToolInputForPersistence(call.parameters),
                failure: toolFailureCauseFromUnknown({
                  error,
                  originSite: "tool.batch.execute",
                  classification: "tool-execution",
                  kind: "tool-execute-error",
                  data: { toolName: call.tool, callID: partID },
                }),
                time: {
                  start: callStartTime,
                  end: Date.now(),
                },
              },
            })

            return { success: false as const, tool: call.tool, error }
          }
        }

        const results = await Promise.all(params.tool_calls.map((call) => executeCall(call)))

        const successfulCalls = results.filter((result) => result.success).length
        const failedCalls = results.length - successfulCalls

        const outputMessage =
          failedCalls > 0
            ? `Executed ${successfulCalls}/${results.length} tools successfully. ${failedCalls} failed.`
            : `All ${successfulCalls} tools executed successfully.\n\nKeep using the batch tool for optimal performance in your next response!`

        return {
          title: `Batch execution (${successfulCalls}/${results.length} successful)`,
          output: outputMessage,
          attachments: results.filter((result) => result.success).flatMap((result) => result.result.attachments ?? []),
          display: results.filter((result) => result.success).flatMap((result) => result.result.display ?? []),
          metadata: {
            totalCalls: results.length,
            successful: successfulCalls,
            failed: failedCalls,
            tools: params.tool_calls.map((call) => call.tool),
            details: results.map((result) => ({ tool: result.tool, success: result.success })),
          },
        }
      },
    }
  })
}
