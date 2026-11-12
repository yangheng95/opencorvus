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

  export const Info = z
    .object({
      name: z.string(),
      description: z.string().optional(),
      agent: z.string().optional(),
      model: z.string().optional(),
      source: z.enum(["command", "mcp", "skill"]).optional(),
      template: z.string(),
      hints: z.array(z.string()),
    })
    .meta({
      ref: "Command",
    })

  export type Info = z.infer<typeof Info>
  type Definition = Omit<Info, "template"> & { template: Promise<string> | string }

  export const ProjectionChangedError = NamedError.create(
    "CommandProjectionChangedError",
    z.object({ command: z.string(), message: z.string() }),
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
      const placeholders = prompt.arguments?.map((_, i) => `$${i + 1}`) ?? []
      result[name] = {
        name,
        source: "mcp",
        description: prompt.description,
        get template() {
          const args = Object.fromEntries(prompt.arguments?.map((argument, i) => [argument.name, placeholders[i]]) ?? [])
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
        hints: placeholders,
      }
    }

    return result
  }

  export async function get(name: string) {
    const available = await definitions()
    if (!Object.hasOwn(available, name)) throw new NotFoundError({ message: `Command not found: ${name}` })
    return available[name]
  }

  export async function list(): Promise<Info[]> {
    const available = objectValues(await definitions())
    const settled = await Promise.allSettled(
      available.map(async ({ template, ...command }) => ({ ...command, template: await template })),
    )
    return settled.map((result) => {
      if (result.status === "rejected") throw result.reason
      return result.value
    })
  }
}
