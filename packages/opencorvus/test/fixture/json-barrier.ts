import { readFile } from "node:fs/promises"
import { Filesystem } from "@/util/filesystem"

export async function publishJSONBarrier(target: string, value: unknown): Promise<void> {
  await Filesystem.writeAtomic(target, JSON.stringify(value))
}

export async function waitForJSONBarrier<T>(target: string, timeout = 10_000): Promise<T> {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    let content: string
    try {
      content = await readFile(target, "utf8")
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error
      await Bun.sleep(25)
      continue
    }
    return JSON.parse(content) as T
  }
  throw new Error(`Timed out waiting for JSON barrier ${target}`)
}

export class FixturePhaseNotReachedError extends Error {
  constructor(
    readonly phase: string,
    readonly responseStatus?: number,
  ) {
    super(`Fixture operation settled before its genuine ${phase} entry`)
    this.name = "FixturePhaseNotReachedError"
  }
}

export function waitForFixturePhase(entered: Promise<void>, operation: Promise<unknown>, phase: string): Promise<void> {
  return Promise.race([
    entered,
    operation.then((result) => {
      if (result instanceof Error) throw result
      throw new FixturePhaseNotReachedError(phase, result instanceof Response ? result.status : undefined)
    }),
  ])
}
