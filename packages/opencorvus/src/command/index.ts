import { BusEvent } from "@/bus/bus-event"
import z from "zod"
import { NamedError } from "@opencorvus-ai/util/error"
import { Config } from "../config/config"
import { Instance } from "../project/instance"
import { Identifier } from "../id/id"
import PROMPT_INITIALIZE from "./template/initialize.txt"
import PROMPT_REVIEW from "./template/review.txt"
import { MCP } from "../mcp"
import { NotFoundError } from "../storage/db"
import { entries, values as objectValues } from "@/util/object"

export namespace Command {
  export const Event = {
    Executed: BusEvent.define(
      "command.executed",
      z.object({
        name: z.string(),
        sessionID: Identifier.schema("session"),
        arguments: z.string(),
        messageID: Identifier.schema("message"),
      }),
    ),
  }

  const Metadata = z.object({
    name: z.string(),
    description: z.string().optional(),
    agent: z.string().optional(),
    model: z.string().optional(),
    hints: z.array(z.string()),
  })
  const LocalInfo = Metadata.extend({ source: z.enum(["command", "skill"]).optional(), template: z.string() })
  const PromptArgument = z.object({
    name: z.string(),
    description: z.string().optional(),
    required: z.boolean().optional(),
  })
  const McpInfo = Metadata.extend({
    source: z.literal("mcp"),
    arguments: z.array(PromptArgument),
    template: z.string().optional().describe("Template text for a remote prompt that takes no arguments"),
  })
  export const Info = z.union([LocalInfo, McpInfo]).meta({ ref: "Command" })

  export type Info = z.infer<typeof Info>
  export type McpDefinition = Omit<z.infer<typeof McpInfo>, "template"> & {
    readTemplate(args: Record<string, string>): Promise<string>
  }
  type Definition = z.infer<typeof LocalInfo> | McpDefinition

  export const ProjectionChangedError = NamedError.create(
    "CommandProjectionChangedError",
    z.object({ command: z.string(), message: z.string() }),
  )
  export const ArgumentsError = NamedError.create(
    "CommandArgumentsError",
    z.object({
      command: z.string(),
      reason: z.enum(["missing_required", "invalid"]),
      missing: z.array(z.string()).optional(),
      message: z.string(),
    }),
  )

  export function hints(template: string): string[] {
    const result: string[] = []
    const numbered = template.match(/\$\d+/g)
    if (numbered) {
      for (const match of [...new Set(numbered)].sort()) result.push(match)
    }
    if (template.includes("$ARGUMENTS")) result.push("$ARGUMENTS")
    return result
  }

  export const Default = {
    INIT: "init",
    REVIEW: "review",
  } as const

  async function definitions() {
    const cfg = await Config.getForProjectRuntime()

    const result: Record<string, Definition> = {
      [Default.INIT]: {
        name: Default.INIT,
        description: "create/update AGENTS.md",
        source: "command",
        get template() {
          return PROMPT_INITIALIZE.replace("${path}", Instance.worktree)
        },
        hints: hints(PROMPT_INITIALIZE),
      },
      [Default.REVIEW]: {
        name: Default.REVIEW,
        description: "review changes [commit|branch|pr], defaults to uncommitted",
        source: "command",
        get template() {
          return PROMPT_REVIEW.replace("${path}", Instance.worktree)
        },
        hints: hints(PROMPT_REVIEW),
      },
    }

    for (const [name, command] of entries((cfg.command ?? {}) as NonNullable<Config.Info["command"]>)) {
      result[name] = {
        name,
        agent: command.agent,
        model: command.model,
        description: command.description,
        source: "command",
        get template() {
          return command.template
        },
        hints: hints(command.template),
      }
    }
    for (const [name, prompt] of entries(await MCP.prompts(cfg))) {
      const argumentsInfo = prompt.arguments ?? []
      result[name] = {
        name,
        source: "mcp",
        description: prompt.description,
        arguments: argumentsInfo,
        readTemplate(args) {
          return prompt.read(args).then(
            (template) =>
              template.messages.map((message) => (message.content.type === "text" ? message.content.text : "")).join("\n"),
            (error) => {
              if (!(error instanceof MCP.CatalogBindingStaleError)) throw error
              throw new ProjectionChangedError(
                { command: name, message: `Command ${JSON.stringify(name)} changed while its template was being read.` },
                { cause: error },
              )
            },
          )
        },
        hints: argumentsInfo.map((_, i) => `$${i + 1}`),
      }
    }

    return result
  }

  export async function get(name: string) {
    const available = await definitions()
    if (!Object.hasOwn(available, name)) throw new NotFoundError({ message: `Command not found: ${name}` })
    return available[name]
  }

  export async function catalog() {
    return objectValues(await definitions()).map((definition) => ({
      name: definition.name,
      description: definition.description,
      hints: definition.hints,
      arguments: definition.source === "mcp" ? definition.arguments : undefined,
    }))
  }

  export async function list(): Promise<Info[]> {
    const available = objectValues(await definitions())
    const settled = await Promise.allSettled(
      available.map(async (definition) => {
        if (definition.source !== "mcp") return { ...definition }
        const { readTemplate, ...command } = definition
        if (command.arguments.length === 0) return { ...command, template: await readTemplate({}) }
        return command
      }),
    )
    return settled.map((result) => {
      if (result.status === "rejected") throw result.reason
      return result.value
    })
  }
}
