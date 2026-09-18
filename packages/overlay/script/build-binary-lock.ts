import fs from "node:fs/promises"

/** Probe the exact linker outputs without changing their bytes or their owners. */
export async function findLockedBuildBinaries(files: readonly string[]): Promise<string[]> {
  const locked: string[] = []
  for (const file of files) {
    try {
      const handle = await fs.open(file, "r+")
      await handle.close()
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code === "ENOENT") continue
      if (["EBUSY", "EPERM", "EACCES", "ETXTBSY"].includes(code ?? "")) locked.push(file)
      else throw error
    }
  }
  return locked
}
