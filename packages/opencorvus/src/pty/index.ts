// Project-bound Pseudo Terminal API schema.
import z from "zod"
import { Bus } from "@/bus"
import { BusEvent } from "@/bus/bus-event"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { PtyHost, type PtyPreparedCommand } from "@/pty/host"
import { TerminalProfile } from "@/system-terminal/profile"
import { Filesystem } from "@/util/filesystem"
import { NamedError } from "@opencorvus-ai/util/error"

export namespace Pty {
  export const Info = z
    .object({
      id: Identifier.schema("pty"),
      title: z.string(),
      command: z.string(),
      args: z.array(z.string()),
      cwd: z.string(),
      status: z.enum(["running", "exited"]),
      pid: z.number(),
    })
    .meta({ ref: "Pty" })

  export type Info = z.infer<typeof Info>

  export const CreateInput = z.object({
    profileID: z.string().min(1),
    cwd: z.string().optional(),
    title: z.string().optional(),
  })

  export type CreateInput = z.infer<typeof CreateInput>

  export const UpdateInput = z
    .object({
      title: z.string().trim().min(1).optional(),
      size: z
        .object({
          rows: z.number().int().min(1).max(200),
          cols: z.number().int().min(1).max(500),
        })
        .optional(),
    })
    .strict()
    .refine((input) => input.title !== undefined || input.size !== undefined, {
      message: "PTY update must include a title or size",
    })

  export type UpdateInput = z.infer<typeof UpdateInput>

  export const Input = z.object({
    data: z.string().max(65_536),
  })

  export type Input = z.infer<typeof Input>

  export const CreateFailedError = NamedError.create(
    "PtyCreateFailedError",
    z.object({
      message: z.string(),
      cwd: z.string(),
      command: z.string().optional(),
      args: z.array(z.string()).optional(),
    }),
  )

  export const Event = {
    Created: BusEvent.define("pty.created", z.object({ info: Info })),
    Updated: BusEvent.define("pty.updated", z.object({ info: Info })),
    Exited: BusEvent.define("pty.exited", z.object({ id: Identifier.schema("pty"), exitCode: z.number().nullable() })),
    Deleted: BusEvent.define("pty.deleted", z.object({ id: Identifier.schema("pty") })),
  }

  function fromHost(info: PtyHost.Info): Info | undefined {
    if (!info.id) return
    return {
      id: info.id,
      title: info.title ?? "Pseudo Terminal",
      command: info.command ?? "",
      args: info.args ?? [],
      cwd: info.directory ?? Instance.directory,
      status: info.status === "running" ? "running" : "exited",
      pid: info.pid ?? 0,
    }
  }

  export function projectCwd(input?: string) {
    if (!input) return Instance.directory
    const cwd = Filesystem.resolve(input)
    if (cwd !== Instance.directory) throw new Error("PTY cwd must match current project directory")
    return cwd
  }

  export function list() {
    return PtyHost.list().flatMap((info) => {
      const mapped = fromHost(info)
      return mapped ? [mapped] : []
    })
  }

  export function get(id: string) {
    const info = fromHost(PtyHost.get(id))
    if (!info || info.id !== id) return
    return info
  }

  export async function create(input: CreateInput) {
    const cwd = projectCwd(input.cwd)
    let command: PtyPreparedCommand | undefined
    let created = false
    let pendingExit: { id: string; exitCode: number | null } | undefined
    try {
      const profile = await TerminalProfile.resolve(input.profileID)
      command = {
        command: profile.command,
        args: profile.args,
        cwd,
        directory: cwd,
        env: profile.env,
      }
      const info = await PtyHost.startPrepared({
        command,
        title: input.title ?? profile.label,
        onExit: (id, event) => {
          const payload = { id, exitCode: event.exitCode }
          if (!created) {
            pendingExit = payload
            return
          }
          Bus.publishOwned(Event.Exited, payload)
        },
      })
      const mapped = fromHost(info)
      if (!mapped) throw new Error("PTY session was not created")
      await Bus.publish(Event.Created, { info: mapped })
      created = true
      if (pendingExit) await Bus.publish(Event.Exited, pendingExit)
      return mapped
    } catch (error) {
      if (error instanceof CreateFailedError) throw error
      throw new CreateFailedError({
        message: error instanceof Error ? error.message : String(error),
        cwd,
        command: command?.command,
        args: command?.args,
      })
    }
  }

  export async function update(id: string, input: UpdateInput) {
    if (!get(id)) return
    let info: PtyHost.Info | undefined
    if (input.title !== undefined) info = PtyHost.rename({ id, title: input.title })
    if (input.size) info = PtyHost.resizePty({ id, ...input.size })
    const mapped = fromHost(info ?? PtyHost.get(id))
    if (mapped) await Bus.publish(Event.Updated, { info: mapped })
    return mapped
  }

  export async function remove(id: string) {
    if (!get(id)) return
    await PtyHost.remove({ id })
    await Bus.publish(Event.Deleted, { id })
  }

  export function input(id: string, data: string) {
    return PtyHost.inputPty({ id, data })
  }

  export function prepareConnect(id: string, cursor?: number) {
    return PtyHost.preparePtyConnect({ id, cursor })
  }
}
