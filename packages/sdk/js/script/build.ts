#!/usr/bin/env bun
import { fileURLToPath } from "url"

const dir = fileURLToPath(new URL("..", import.meta.url))
process.chdir(dir)

import { $ } from "bun"
import fs from "node:fs/promises"
import path from "path"
import { replaceGeneratedArtifactsAfterSuccessfulBuild } from "./generation-transaction"

const sdkRoot = path.resolve(dir, "..")
const routePolicySourcePath = path.resolve(dir, "..", "..", "transport-protocol", "src", "index.ts")
const platformArtifactToolIDsSourcePath = path.resolve(
  dir,
  "..",
  "..",
  "opencorvus",
  "src",
  "tool",
  "platform-artifact-tool-ids.ts",
)

import { createClient } from "@hey-api/openapi-ts"

const defaultsPath = path.resolve(dir, "..", "..", "opencorvus", "server-defaults.json")
const serverDefaults = (await Bun.file(defaultsPath).json()) as { host: string; port: number }
const defaultBaseUrl = `http://${serverDefaults.host}:${serverDefaults.port}`

async function rmWithinPackage(target: string, options: { recursive?: boolean } = {}) {
  const root = path.resolve(dir)
  const resolved = path.resolve(dir, target)
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error(`refusing to delete path outside SDK package: ${resolved}`)
  }

  for (let attempt = 1; attempt <= 20; attempt++) {
    try {
      await fs.rm(resolved, { force: true, recursive: options.recursive ?? false })
      return
    } catch (error) {
      const code =
        error && typeof error === "object" && "code" in error ? String((error as NodeJS.ErrnoException).code) : ""
      if (!["EBUSY", "ENOTEMPTY", "EPERM"].includes(code) || attempt === 20) throw error
      Bun.gc(true)
      await Bun.sleep(100 * attempt)
    }
  }
}

async function writeFileWithRetry(file: string, contents: string) {
  const directory = path.dirname(file)
  await fs.mkdir(directory, { recursive: true })

  for (let attempt = 1; attempt <= 60; attempt++) {
    const tempFile = path.join(directory, `.${path.basename(file)}.${process.pid}.${attempt}.tmp`)
    try {
      await fs.writeFile(tempFile, contents)
      await fs.rename(tempFile, file)
      return
    } catch (error) {
      await fs.rm(tempFile, { force: true }).catch(() => undefined)
      const code =
        error && typeof error === "object" && "code" in error ? String((error as NodeJS.ErrnoException).code) : ""
      if (!["EBUSY", "EUNKNOWN", "EPERM"].includes(code) || attempt === 60) throw error
      Bun.gc(true)
      await Bun.sleep(Math.min(250 * attempt, 2_000))
    }
  }
}

async function waitForGeneratedClient(root: string) {
  const checks = [
    {
      file: path.join(root, "client", "index.ts"),
      text: "ClientOptions",
    },
    {
      file: path.join(root, "client", "types.gen.ts"),
      text: "export interface Config",
    },
    {
      file: path.join(root, "sdk.gen.ts"),
      text: "export class OpenCorvusClient",
    },
  ]

  for (let attempt = 1; attempt <= 50; attempt++) {
    const ready = await Promise.all(
      checks.map(async (check) => {
        const content = await fs.readFile(check.file, "utf8").catch(() => "")
        return content.includes(check.text)
      }),
    )
    if (ready.every(Boolean)) return
    await Bun.sleep(100)
  }

  throw new Error("SDK generation did not materialize the expected client exports")
}

type OpenApiOperation = {
  operationId?: string
  requestBody?: {
    required?: boolean
    content?: Record<string, { schema?: { required?: unknown } }>
  }
}

type OpenApiSpec = {
  paths?: Record<string, Record<string, OpenApiOperation>>
}

function camelCaseIdentifier(value: string): string {
  return value.replace(/_([a-zA-Z0-9])/g, (_match, character: string) => character.toUpperCase())
}

function methodNameFromOperationID(operationID: string): string {
  const parts = operationID.split(".")
  return camelCaseIdentifier(parts[parts.length - 1] || operationID)
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function sdkBodyBindingKeys(block: string, field: string): string[] {
  const keys: string[] = []
  const bindingPattern = /\{\s*in:\s*"body",\s*key:\s*"([^"]+)"(?:,\s*map:\s*"([^"]+)")?\s*,?\s*\}/gs
  let match: RegExpExecArray | null
  while ((match = bindingPattern.exec(block))) {
    const key = match[1]
    const mapped = match[2]
    if (key === field || mapped === field) keys.push(key)
  }
  return keys
}

async function requireFlatSdkBodyFieldsFromOpenApi(input: { openapiPath: string; sdkPath: string }) {
  const spec = (await Bun.file(input.openapiPath).json()) as OpenApiSpec
  const sdkPath = input.sdkPath
  let source = await Bun.file(sdkPath).text()

  for (const [routePath, pathItem] of Object.entries(spec.paths ?? {})) {
    for (const operation of Object.values(pathItem)) {
      const operationID = operation.operationId
      const schema = operation.requestBody?.content?.["application/json"]?.schema
      const requiredFields = Array.isArray(schema?.required)
        ? schema.required.filter((field): field is string => typeof field === "string")
        : []
      if (!operationID || operation.requestBody?.required !== true || requiredFields.length === 0) continue

      const methodName = methodNameFromOperationID(operationID)
      const methodPattern = new RegExp(`\\n  public ${escapeRegex(methodName)}<`, "g")
      let match: RegExpExecArray | null
      while ((match = methodPattern.exec(source))) {
        const start = match.index
        const rest = source.slice(start + 1)
        const nextMethod = rest.search(/\n  public \w+</)
        const nextClass = rest.search(/\n}\n\nexport class /)
        const endCandidates = [nextMethod, nextClass].filter((value) => value > 0)
        const end = endCandidates.length ? start + 1 + Math.min(...endCandidates) : source.length
        let block = source.slice(start, end)
        if (!block.includes(`url: "${routePath}"`)) continue

        let changed = false
        let hasRequiredBodyBinding = false
        for (const field of requiredFields) {
          const bodyBindingKeys = sdkBodyBindingKeys(block, field)
          if (bodyBindingKeys.length === 0) continue
          hasRequiredBodyBinding = true
          for (const bodyBindingKey of bodyBindingKeys) {
            const fieldPattern = new RegExp(`(\\n\\s*)(${escapeRegex(bodyBindingKey)})(\\?:)`, "g")
            block = block.replace(fieldPattern, (_match, indent: string, key: string) => {
              changed = true
              return `${indent}${key}:`
            })
          }
        }
        if (hasRequiredBodyBinding) {
          block = block.replace(/(\n\s*parameters)\?:\s*(\{)/, (_match, prefix: string, open: string) => {
            changed = true
            return `${prefix}: ${open}`
          })
        }
        if (changed) {
          source = `${source.slice(0, start)}${block}${source.slice(end)}`
        }
        break
      }
    }
  }

  await writeFileWithRetry(sdkPath, source)
}

async function generatedRoutePolicySource() {
  const source = await fs.readFile(routePolicySourcePath, "utf8")
  const startMarker = "// ── Server route directory policy ──"
  const endMarker = "// ── Host native commands ──"
  const start = source.indexOf(startMarker)
  const end = source.indexOf(endMarker)
  if (start < 0 || end <= start) {
    throw new Error("transport protocol route policy block markers were not found")
  }
  const block = source.slice(start, end).trim()
  return (
    "// Auto-generated from packages/transport-protocol/src/index.ts by script/build.ts.\n" +
    "// Do not edit - regenerate via `bun run build`.\n\n" +
    `${block}\n`
  )
}

async function generatedPlatformArtifactToolIDsSource() {
  const source = await fs.readFile(platformArtifactToolIDsSourcePath, "utf8")
  const firstExport = source.indexOf("export const ")
  if (firstExport < 0) {
    throw new Error("platform Artifact tool ID source does not contain exported constants")
  }
  return (
    "// Auto-generated from packages/opencorvus/src/tool/platform-artifact-tool-ids.ts.\n" +
    "// Do not edit - regenerate via `bun run build`.\n\n" +
    source.slice(firstExport)
  )
}

const generatedDefaults =
  `// Auto-generated from packages/opencorvus/server-defaults.json by script/build.ts.\n` +
  `// Do not edit — regenerate via \`bun run build\`.\n\n` +
  `export const DEFAULT_SERVER_HOST = ${JSON.stringify(serverDefaults.host)}\n` +
  `export const DEFAULT_SERVER_PORT = ${serverDefaults.port}\n` +
  `export const DEFAULT_SERVER_URL = \`http://\${DEFAULT_SERVER_HOST}:\${DEFAULT_SERVER_PORT}\`\n`

const generatedRoutePolicy = await generatedRoutePolicySource()
const generatedPlatformArtifactToolIDs = await generatedPlatformArtifactToolIDsSource()
const generatedOpenapi = await $`bun --conditions=source ./script/generate-openapi.ts`
  .cwd(path.resolve(dir, "../../opencorvus"))
  .text()

const generate = async (input: string, output: string) =>
  createClient({
    input,
    output: {
      path: output,
      tsConfigPath: path.join(dir, "tsconfig.json"),
      clean: true,
      fileName: { suffix: ".gen" },
    },
    plugins: [
      {
        name: "@hey-api/typescript",
        exportFromIndex: false,
      },
      {
        name: "@hey-api/sdk",
        exportFromIndex: false,
        auth: false,
        paramsStructure: "flat",
        operations: {
          strategy: "single",
          containerName: "OpenCorvusClient",
          methods: "instance",
        },
      },
      {
        name: "@hey-api/client-fetch",
        exportFromIndex: false,
        baseUrl: defaultBaseUrl,
      },
    ],
  })

const transactionRelative = ".tmp-sdk-build"
const transactionRoot = path.join(dir, transactionRelative)
const transactionSrc = path.join(transactionRoot, "src")
const transactionGen = path.join(transactionSrc, "gen")
const transactionOpenapi = path.join(transactionRoot, "openapi.json")
const transactionDefaults = path.join(transactionSrc, "defaults.ts")
const transactionRoutePolicy = path.join(transactionSrc, "route-policy.ts")
const transactionPlatformArtifactToolIDs = path.join(transactionSrc, "platform-artifact-tool-ids.ts")
const transactionTsconfig = path.join(transactionRoot, "tsconfig.json")
const transactionDist = path.join(transactionRoot, "dist")

await rmWithinPackage(transactionRelative, { recursive: true })
try {
  await fs.cp(path.join(dir, "src"), transactionSrc, { recursive: true, force: true })
  await fs.copyFile(path.join(dir, "tsconfig.json"), transactionTsconfig)
  await writeFileWithRetry(transactionDefaults, generatedDefaults)
  await writeFileWithRetry(transactionRoutePolicy, generatedRoutePolicy)
  await writeFileWithRetry(transactionPlatformArtifactToolIDs, generatedPlatformArtifactToolIDs)
  await writeFileWithRetry(transactionOpenapi, generatedOpenapi)
  await generate(transactionOpenapi, transactionGen)
  await waitForGeneratedClient(transactionGen)

  const prettierBin = await Bun.resolve("prettier/bin/prettier.cjs", dir)
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await $`bun ${prettierBin} --write ${transactionSrc}`
      break
    } catch (error) {
      if (attempt === 5) throw error
      Bun.gc(true)
      await Bun.sleep(500 * attempt)
    }
  }
  await requireFlatSdkBodyFieldsFromOpenApi({
    openapiPath: transactionOpenapi,
    sdkPath: path.join(transactionGen, "sdk.gen.ts"),
  })
  await $`bun tsc --project ${transactionTsconfig}`
} catch (error) {
  await rmWithinPackage(transactionRelative, { recursive: true }).catch(() => undefined)
  throw error
}

await replaceGeneratedArtifactsAfterSuccessfulBuild({
  packageRoot: sdkRoot,
  stagingRelative: "js/.tmp-sdk-artifacts",
  artifacts: [
    { stagingRelative: "dist", targetRelative: "js/dist", kind: "directory" },
    { stagingRelative: "gen", targetRelative: "js/src/gen", kind: "directory" },
    { stagingRelative: "defaults.ts", targetRelative: "js/src/defaults.ts", kind: "file" },
    { stagingRelative: "route-policy.ts", targetRelative: "js/src/route-policy.ts", kind: "file" },
    {
      stagingRelative: "platform-artifact-tool-ids.ts",
      targetRelative: "js/src/platform-artifact-tool-ids.ts",
      kind: "file",
    },
    { stagingRelative: "openapi.json", targetRelative: "openapi.json", kind: "file" },
  ],
  build: async (stagingRoot) => {
    await fs.cp(transactionDist, path.join(stagingRoot, "dist"), { recursive: true, force: true })
    await fs.cp(transactionGen, path.join(stagingRoot, "gen"), { recursive: true, force: true })
    await writeFileWithRetry(path.join(stagingRoot, "defaults.ts"), generatedDefaults)
    await writeFileWithRetry(path.join(stagingRoot, "route-policy.ts"), generatedRoutePolicy)
    await writeFileWithRetry(
      path.join(stagingRoot, "platform-artifact-tool-ids.ts"),
      generatedPlatformArtifactToolIDs,
    )
    await writeFileWithRetry(path.join(stagingRoot, "openapi.json"), generatedOpenapi)
  },
})
await rmWithinPackage(transactionRelative, { recursive: true })
