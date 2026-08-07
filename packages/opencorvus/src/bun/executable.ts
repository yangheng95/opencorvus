export namespace BunExecutable {
  export function resolve(processExecutable = process.execPath) {
    // BUN_BE_BUN makes both the Bun development runtime and a Bun-compiled
    // OpenCorvus executable expose the same Bun command-line interface.
    return processExecutable
  }
}
