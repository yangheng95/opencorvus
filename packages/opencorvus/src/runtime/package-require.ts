import { existsSync } from "fs"
import { createRequire } from "module"
import path from "path"

const sourceRequire = createRequire(import.meta.url)

function isBunExecutable(execPath: string): boolean {
  const base = path.basename(execPath).toLowerCase()
  return base === "bun" || base === "bun.exe"
}

export function runtimePackageRequireForExecPath(execPath: string): NodeJS.Require {
  const packagedPackageJson = path.join(path.dirname(execPath), "package.json")
  if (existsSync(packagedPackageJson)) {
    return createRequire(packagedPackageJson)
  }
  if (isBunExecutable(execPath)) {
    return sourceRequire
  }
  throw new Error(
    `Packaged runtime is incomplete: missing ${packagedPackageJson}. ` +
      "Run the packaged runtime bundle directory or extract the release archive before starting opencorvus. " +
      "Refusing to resolve native runtime packages from parent node_modules.",
  )
}

export function runtimePackageRequire(): NodeJS.Require {
  return runtimePackageRequireForExecPath(process.execPath)
}

export function requireRuntimePackage<T>(specifier: string): T {
  return runtimePackageRequire()(specifier) as T
}
