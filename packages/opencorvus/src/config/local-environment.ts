import { Config } from "./config"

export namespace LocalEnvironment {
  export interface ShellProjection {
    command: string
    variables: Record<string, string>
  }

  export async function projectShellCommand(command: string): Promise<ShellProjection> {
    const environment = (await Config.get()).local_environment
    const setupScript = environment?.setup_script?.trim()
    return {
      command: setupScript ? `${setupScript}\n${command}` : command,
      variables: { ...(environment?.variables ?? {}) },
    }
  }
}
