import { BusEvent } from "@/bus/bus-event"
import z from "zod"
import { Config } from "../config/config"
import { Instance } from "../project/instance"
import { createInstanceState } from "../project/instance-state"
import { Identifier } from "../id/id"
import PROMPT_INITIALIZE from "./template/initialize.txt"
import PROMPT_REVIEW from "./template/review.txt"
import { MCP } from "../mcp"
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

  const state = createInstanceState(async () => {
    const cfg = await Config.get()

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
    for (const [name, prompt] of entries(await MCP.prompts())) {
      result[name] = {
        name,
        source: "mcp",
        description: prompt.description,
        get template() {
          const args = Object.fromEntries(prompt.arguments?.map((argument, i) => [argument.name, `$${i + 1}`]) ?? [])
          return MCP.getPrompt(prompt.client, prompt.name, args).then((template) =>
            template.messages.map((message) => (message.content.type === "text" ? message.content.text : "")).join("\n"),
          )
        },
        hints: prompt.arguments?.map((_, i) => `$${i + 1}`) ?? [],
      }
    }

    return result
  }, undefined, "command")

  export async function get(name: string) {
    return state().then((x) => x[name])
  }

  export async function list(): Promise<Info[]> {
    const definitions = objectValues(await state())
    const settled = await Promise.allSettled(
      definitions.map(async ({ template, ...command }) => ({ ...command, template: await template })),
    )
    return settled.map((result) => {
      if (result.status === "rejected") throw result.reason
      return result.value
    })
  }
}
