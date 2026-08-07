type ExportMap = Record<string, unknown>

export type SdkPackageJson = {
  exports: Record<string, unknown>
  [key: string]: unknown
}

function clonePackageJson<T extends SdkPackageJson>(pkg: T): T {
  return JSON.parse(JSON.stringify(pkg)) as T
}

function sourceTargetToDistType(value: string, label: string): string {
  if (value.startsWith("./dist/") && value.endsWith(".d.ts")) return value
  throw new Error(`${label} must point to a generated dist declaration, got ${value}`)
}

function sourceTargetToDistModule(value: string, label: string): string {
  if (value.startsWith("./dist/") && value.endsWith(".js")) return value
  throw new Error(`${label} must point to a generated dist module, got ${value}`)
}

function transformExportConditions(value: unknown, label: string): ExportMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be a conditional export map`)
  }

  const output: ExportMap = {}
  for (const [condition, target] of Object.entries(value as ExportMap)) {
    if (condition === "types") {
      if (typeof target !== "string") throw new Error(`${label}.${condition} must be a string target`)
      output[condition] = sourceTargetToDistType(target, `${label}.${condition}`)
      continue
    }
    if (condition === "import" || condition === "default") {
      if (typeof target !== "string") throw new Error(`${label}.${condition} must be a string target`)
      output[condition] = sourceTargetToDistModule(target, `${label}.${condition}`)
      continue
    }
    if (target && typeof target === "object" && !Array.isArray(target)) {
      output[condition] = transformExportConditions(target, `${label}.${condition}`)
      continue
    }
    throw new Error(`${label}.${condition} is not a supported SDK publish export condition`)
  }
  return output
}

export function buildPublishPackageJson<T extends SdkPackageJson>(pkg: T): T {
  const next = clonePackageJson(pkg)
  next.exports = Object.fromEntries(
    Object.entries(pkg.exports).map(([subpath, value]) => [
      subpath,
      transformExportConditions(value, `exports.${subpath}`),
    ]),
  )
  return next
}
