import whichPkg from "which"

function options(env?: NodeJS.ProcessEnv) {
  return {
    path: env?.PATH ?? env?.Path ?? process.env.PATH ?? process.env.Path,
    pathExt: env?.PATHEXT ?? env?.PathExt ?? process.env.PATHEXT ?? process.env.PathExt,
  }
}

export function which(cmd: string, env?: NodeJS.ProcessEnv) {
  const result = whichPkg.sync(cmd, { ...options(env), nothrow: true })
  return typeof result === "string" ? result : null
}

export async function whichAsync(cmd: string, env?: NodeJS.ProcessEnv): Promise<string | null> {
  try {
    return await whichPkg(cmd, options(env))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null
    throw error
  }
}
