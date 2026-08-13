declare const OPENCORVUS_COMPILED_BINARY: boolean | undefined

export function isCompiledBinaryRuntime(): boolean {
  return typeof OPENCORVUS_COMPILED_BINARY === "boolean" && OPENCORVUS_COMPILED_BINARY
}
