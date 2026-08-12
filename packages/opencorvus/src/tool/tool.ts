import z from "zod"
import type { Message } from "../session/message"
import type { CapabilityRules } from "../capability/rules"
import type { Config } from "../config/config"
import type { ResolvedSkillSurface } from "../skill/surface"
import type { PromptInput } from "../session/prompt/schema"
import { Truncate } from "./truncation"
import { createToolExecutionSurface, type ToolExecutionSurface } from "./execution-surface"
import { materializeToolResultInlineAttachments } from "./result-attachment-materialization"
import { Instance } from "@/project/instance"
import type { SessionExecutionAuthority } from "@/engine/task-session-lineage"

/**
 * Coerce string values that LLMs sometimes produce for non-string fields.
 * Only converts unambiguous cases: "true"/"false" to boolean.
 * Number coercion is intentionally skipped to avoid breaking string IDs.
 */
function coerceArgs(args: unknown): unknown {
  if (args === null || args === undefined || typeof args !== "object" || Array.isArray(args)) return args
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(args as Record<string, unknown>)) {
    if (v === "true") out[k] = true
    else if (v === "false") out[k] = false
    else out[k] = v
  }
  return out
}

export namespace Tool {
  export function executionSurface(
    toolIDs: Iterable<string>,
    permission: CapabilityRules.Ruleset,
  ): ToolExecutionSurface {
    return createToolExecutionSurface({ toolIDs, permission })
  }

  interface Metadata {
    [key: string]: any
  }

  export interface InitContext {
    agentID?: string
    config?: Config.Info
    skillSurface?: ResolvedSkillSurface
  }

  export type Context<M extends Metadata = Metadata> = {
    sessionID: string
    messageID: string
    agent: string
    abort: AbortSignal
    callID?: string
    extra?: { [key: string]: any }
    messages: Message.WithParts[]
    executionAuthority?: SessionExecutionAuthority
    executionSurface: ToolExecutionSurface
    prompt?(input: PromptInput): Promise<Message.WithParts>
    metadata(input: { title?: string; metadata?: M }): void
  }

  export function requireExecutionAuthority(ctx: Pick<Context, "executionAuthority">): SessionExecutionAuthority {
    if (!ctx.executionAuthority) {
      throw new Error("This tool requires a Session-bound execution authority.")
    }
    return ctx.executionAuthority
  }
  export interface Info<Parameters extends z.ZodType = z.ZodType, M extends Metadata = Metadata> {
    id: string
    init: (ctx?: InitContext) => Promise<{
      description: string
      parameters: Parameters
      execute(
        args: z.infer<Parameters>,
        ctx: Context,
      ): Promise<{
        title: string
        metadata: M
        output: string
        attachments?: Omit<Message.FilePart, "id" | "sessionID" | "messageID">[]
        sources?: Message.SourcePayload[]
        display?: Omit<Message.InteractiveArtifactPart, "id" | "sessionID" | "messageID" | "orderKey">[]
      }>
      formatValidationError?(error: z.ZodError): string
    }>
  }

  export type InferParameters<T extends Info> = T extends Info<infer P> ? z.infer<P> : never
  export type InferMetadata<T extends Info> = T extends Info<any, infer M> ? M : never

  export function define<Parameters extends z.ZodType, Result extends Metadata>(
    id: string,
    init: Info<Parameters, Result>["init"] | Awaited<ReturnType<Info<Parameters, Result>["init"]>>,
  ): Info<Parameters, Result> {
    return {
      id,
      init: async (initCtx) => {
        const toolInfo = init instanceof Function ? await init(initCtx) : init
        const execute = toolInfo.execute
        const wrappedExecute: typeof toolInfo.execute = async (args, ctx) => {
          const asError = (e: unknown) => {
            if (e instanceof Error) return e
            return new Error(typeof e === "string" ? e : JSON.stringify(e))
          }
          let parsed: typeof args
          try {
            parsed = toolInfo.parameters.parse(coerceArgs(args))
          } catch (error) {
            if (error instanceof z.ZodError && toolInfo.formatValidationError) {
              throw new Error(toolInfo.formatValidationError(error), { cause: error })
            }
            const err = asError(error)
            throw new Error(
              `The ${id} tool was called with invalid arguments: ${err.message}.\nPlease rewrite the input so it satisfies the expected schema.`,
              { cause: err },
            )
          }
          let result: Awaited<ReturnType<typeof execute>>
          try {
            // Use parsed args (with preprocessed/transformed values) instead of raw args.
            // The AI SDK may pass strings for numbers (e.g. x: "500" instead of x: 500);
            // Zod preprocess/coerce transforms fix these, but only in the parse result.
            result = await materializeToolResultInlineAttachments({
              projectID: () =>
                typeof ctx.extra?.projectID === "string" ? ctx.extra.projectID : Instance.project.id,
              value: await execute(parsed, ctx),
            })
          } catch (e) {
            // Ensure thrown value is always a proper Error object.
            // Some native addons throw non-Error values which causes
            // "TypeError: First argument must be an Error object" in Bun/Node.
            if (e instanceof Error) throw e
            throw new Error(`Tool ${id} failed: ${asError(e).message}`)
          }
          // skip truncation for tools that handle it themselves
          if (result.metadata.truncated !== undefined) {
            return result
          }
          const truncated = await Truncate.output(
            result.output,
            { sessionID: ctx.sessionID, executionAuthority: ctx.executionAuthority },
            ctx.executionSurface,
          )
          return {
            ...result,
            output: truncated.content,
            metadata: {
              ...result.metadata,
              truncated: truncated.truncated,
              ...(truncated.truncated && { outputPath: truncated.outputPath }),
            },
          }
        }
        return {
          ...toolInfo,
          execute: wrappedExecute,
        }
      },
    }
  }
}
