import { Log } from "@/util/log"

export type ProjectOpenStageContext = {
  directory: string
  worktree?: string
  projectID?: string
}

type StageLogger = Pick<Log.Logger, "info" | "error">

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function stageFields(stage: string, ctx: ProjectOpenStageContext) {
  return {
    stage,
    platform: process.platform,
    directory: ctx.directory,
    worktree: ctx.worktree,
    projectID: ctx.projectID,
  }
}

export namespace ProjectOpenLifecycle {
  const log = Log.create({ service: "project.open" })

  export async function stage<T>(
    stage: string,
    ctx: ProjectOpenStageContext,
    run: () => Promise<T>,
    logger: StageLogger = log,
  ): Promise<T> {
    const started = Date.now()
    const fields = stageFields(stage, ctx)
    logger.info("project.open.stage", { ...fields, status: "started" })
    try {
      const result = await run()
      logger.info("project.open.stage", { ...fields, status: "completed", duration: Date.now() - started })
      return result
    } catch (error) {
      logger.error("project.open.stage", {
        ...fields,
        status: "failed",
        duration: Date.now() - started,
        error: errorMessage(error),
      })
      throw error
    }
  }
}
