import { Config } from "@/config/config"
import { Instance } from "@/project/instance"
import { SessionContext } from "@/session/context"
import { MissingModelConfigError } from "./model-resolution-error"

export namespace EffectiveConfig {
  export const TASK_SNAPSHOT_KEY = "taskConfigSnapshot"

  export async function snapshotCurrent(): Promise<Config.Info> {
    return structuredClone(await Config.get()) as Config.Info
  }

  export async function base(opts?: { taskID?: string; sessionID?: string }): Promise<Config.Info> {
    if (!opts?.taskID && !opts?.sessionID) {
      const ambient = SessionContext.tryUse()
      if (ambient && !ambient.parentID) {
        return Config.get()
      }
    }

    const sessionID = await rootSessionID(opts)
    if (!sessionID) return Config.get()

    const projectDirectory = await capabilityProjectDirectory({ sessionID })
    return Instance.provide({
      directory: projectDirectory,
      fn: () => Config.get(),
    })
  }

  export async function effective(opts?: { taskID?: string; sessionID?: string }): Promise<Config.Info> {
    const [baseConfig, sessionOverlay] = await Promise.all([base(opts), overlay(opts)])
    return Config.mergeOverlay(baseConfig, sessionOverlay ?? {})
  }

  /** Bind only the fixed-role model selectors of a live Task-root Turn. Tool,
   * permission and Provider configuration are still read at each step. */
  export function bindTurnModelSelection(initial: Config.Info): (current: Config.Info) => Config.Info {
    const model = initial.model
    const hadAgents = initial.agent !== undefined
    const agentModels = new Map(Object.entries(initial.agent ?? {}).map(([name, agent]) => [
      name, agent && "model" in agent ? agent.model : undefined,
    ]))
    return (current) => {
      const { model: _model, agent: currentAgents, ...rest } = current
      const live = new Map(Object.entries(currentAgents ?? {}))
      const agent = Object.fromEntries([...new Set([...live.keys(), ...agentModels.keys()])].flatMap((name) => {
        const currentAgent = live.get(name)
        const settings = { ...currentAgent }
        if ("model" in settings) delete settings.model
        const selected = agentModels.get(name)
        if (selected !== undefined) return [[name, { ...settings, model: selected }]]
        if (currentAgent && (agentModels.has(name) || Object.keys(settings).length > 0)) return [[name, settings]]
        return []
      }))
      return {
        ...rest,
        ...(model === undefined ? {} : { model }),
        ...(hadAgents || Object.keys(agent).length > 0 ? { agent } : {}),
      }
    }
  }

  export async function directory(opts?: { taskID?: string; sessionID?: string }): Promise<string> {
    const sessionID = await rootSessionID(opts)
    if (!sessionID) return Instance.directory

    const { Session } = await import("@/session")
    return (await Session.get(sessionID)).directory
  }

  /**
   * Directory that owns project configuration and project-scoped capability
   * packages. This is deliberately distinct from `directory()`, which is the
   * Task execution repository persisted on the root Session.
   */
  export async function capabilityProjectDirectory(opts?: {
    taskID?: string
    sessionID?: string
  }): Promise<string> {
    const sessionID = await rootSessionID(opts)
    if (!sessionID) return Instance.project.worktree

    const [{ Session }, { Project }] = await Promise.all([import("@/session"), import("@/project/project")])
    const session = await Session.get(sessionID)
    const project = Project.get(session.projectID)
    if (!project) throw new Error(`Session ${session.id} belongs to missing project ${session.projectID}.`)
    return project.worktree
  }

  export async function overlay(opts?: { taskID?: string; sessionID?: string }): Promise<Config.Overlay | undefined> {
    if (opts?.taskID) {
      const taskRoot = await taskRootSessionID(opts.taskID)
      if (!taskRoot) {
        throw new MissingModelConfigError({
          message:
            `Task ${opts.taskID} has no bound root session (engine_task.session_id is null); ` +
            `cannot resolve session config overlay. Repair task.session_id — ` +
            `the resolver must not silently fall back to the project base.`,
        })
      }
      if (opts.sessionID) {
        const explicitRoot = await resolveRootSessionID(opts.sessionID)
        if (explicitRoot !== taskRoot) {
          throw new MissingModelConfigError({
            message:
              `Contradictory model-resolution inputs: taskID ${opts.taskID} binds root session ` +
              `${taskRoot} but sessionID ${opts.sessionID} resolves to root ${explicitRoot}.`,
          })
        }
      }
      return loadRootOverlay(taskRoot)
    }
    if (opts?.sessionID) return loadRootOverlay(await resolveRootSessionID(opts.sessionID))
    const ambient = SessionContext.tryUse()
    if (!ambient) return undefined
    if (!ambient.parentID) return parseOverlay(ambient.metadata?.configOverlay)
    return loadRootOverlay(await resolveRootSessionID(ambient.id))
  }

  async function rootSessionID(opts?: { taskID?: string; sessionID?: string }): Promise<string | undefined> {
    if (opts?.taskID) {
      return taskRootSessionID(opts.taskID)
    }
    if (opts?.sessionID) return resolveRootSessionID(opts.sessionID)

    const ambient = SessionContext.tryUse()
    if (!ambient) return undefined
    if (!ambient.parentID) return ambient.id
    return resolveRootSessionID(ambient.id)
  }

  async function resolveRootSessionID(sessionID: string): Promise<string> {
    const { Session } = await import("@/session")
    let current = await Session.get(sessionID)
    for (let hops = 0; current.parentID && hops < 64; hops++) {
      current = await Session.get(current.parentID)
    }
    return current.id
  }

  async function taskRootSessionID(taskID: string): Promise<string | undefined> {
    const { requireTask } = await import("@/engine/store")
    return requireTask(taskID).session_id ?? undefined
  }

  async function loadRootOverlay(rootSessionID: string): Promise<Config.Overlay | undefined> {
    const { Session } = await import("@/session")
    const session = await Session.get(rootSessionID)
    return parseOverlay(session.metadata?.configOverlay)
  }

  function parseOverlay(raw: unknown): Config.Overlay | undefined {
    return raw ? Config.Overlay.parse(raw) : undefined
  }
}
