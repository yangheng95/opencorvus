import { Bus } from "../bus"
import { File } from "../file"
import { Log } from "../util/log"
import path from "path"
import z from "zod"

import * as Formatter from "./formatter"
import { Config } from "../config/config"
import { mergeDeep } from "remeda"
import { Instance } from "../project/instance"
import { createInstanceState } from "../project/instance-state"
import { entries, values as objectValues } from "@/util/object"
import { formatterTimeout, runFormatterProcess, type FormatterProcessAuthority } from "./process"

export namespace Format {
  const log = Log.create({ service: "format" })

  export const Status = z
    .object({
      name: z.string(),
      extensions: z.string().array(),
      enabled: z.boolean(),
    })
    .meta({
      ref: "FormatterStatus",
    })
  export type Status = z.infer<typeof Status>

  const state = createInstanceState(async () => {
    const enabled: Record<string, Record<string, boolean>> = {}
    const cfg = await Config.get()

    const formatters: Record<string, Formatter.Info> = {}
    if (cfg.formatter === false) {
      log.info("all formatters are disabled")
      return {
        enabled,
        formatters,
      }
    }

    for (const item of objectValues(Formatter as Record<string, Formatter.Info>)) {
      formatters[item.name] = item
    }
    for (const [name, item] of entries(
      (cfg.formatter ?? {}) as Exclude<NonNullable<Config.Info["formatter"]>, false>,
    )) {
      if (item.disabled) {
        delete formatters[name]
        continue
      }
      const result = mergeDeep(
        formatters[name] ?? {
          name,
          command: [],
          extensions: [],
          enabled: async () => true,
        },
        item,
      ) as Formatter.Info

      if (result.command.length === 0) continue

      result.enabled = async () => true
      result.name = name
      formatters[name] = result
    }

    return {
      enabled,
      formatters,
    }
  }, undefined, "format")

  function authorityKey(authority: FormatterProcessAuthority) {
    return authority.kind === "task" ? `task:${authority.taskID}:${authority.cwd}` : `host:${authority.cwd}`
  }

  async function isEnabled(item: Formatter.Info, authority: FormatterProcessAuthority) {
    const s = await state()
    const statuses = (s.enabled[item.name] ??= {})
    const key = authorityKey(authority)
    let status = statuses[key]
    if (status === undefined) {
      status = await item.enabled(formatterTimeout(item.timeout), authority)
      statuses[key] = status
    }
    return status
  }

  async function getFormatter(ext: string, authority: FormatterProcessAuthority) {
    const formatters = await state().then((x) => x.formatters)
    const result: Formatter.Info[] = []
    for (const item of objectValues(formatters)) {
      log.info("checking", { name: item.name, ext })
      if (!item.extensions.includes(ext)) continue
      if (!(await isEnabled(item, authority))) continue
      log.info("enabled", { name: item.name, ext })
      result.push(item)
    }
    return result
  }

  export async function status() {
    const s = await state()
    const authority = { kind: "host" as const, cwd: Instance.directory }
    const result: Status[] = []
    for (const formatter of objectValues(s.formatters)) {
      const enabled = await isEnabled(formatter, authority)
      result.push({
        name: formatter.name,
        extensions: formatter.extensions,
        enabled,
      })
    }
    return result
  }

  export function init() {
    log.info("init")
    Bus.subscribe(File.Event.Edited, async (payload) => {
      const file = payload.properties.file
      log.info("formatting", { file })
      const ext = path.extname(file)

      const authority = payload.properties.processAuthority
      for (const item of await getFormatter(ext, authority)) {
        log.info("running", { command: item.command })
        try {
          const command = item.command.map((x) => x.replace("$FILE", file))
          const options = {
            command,
            env: { ...process.env, ...item.environment },
            timeoutMs: formatterTimeout(item.timeout),
          }
          const result = await runFormatterProcess(authority, options)
          if (result.exitCode !== 0)
            log.error("failed", {
              command: item.command,
              ...item.environment,
            })
        } catch (error) {
          log.error("failed to format file", {
            error,
            command: item.command,
            ...item.environment,
            file,
          })
        }
      }
    })
  }
}
