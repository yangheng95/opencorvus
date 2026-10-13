import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { Config } from "@/config/config"
import { ConfigPaths } from "@/config/paths"
import { FormatError } from "@/cli/error"
import { Global } from "@/global"
import { Instance } from "@/project/instance"
import { Provider } from "@/provider/provider"
import { Server } from "@/server/server"
import { Log } from "@/util/log"
import { memoryProject } from "./fixture/memory"

type Scope = "global" | "project"
const scopes: Scope[] = ["global", "project"]
// Public, fictional inputs in the runner-owned runtime; these are not credentials.
const envName = "OPENCORVUS_TEST_JSONC_DIAGNOSTIC"
const sampleValue = "DUMMY"
const valueFilename = "jsonc-diagnostic-owned-value.txt"
const globalFile = path.join(Global.Path.config, ConfigPaths.CANONICAL_FILE_NAME)
const originalEnv = process.env[envName]
const invalidFile = '{"username":"DUMMY"'
const fileMessage = "CloseBraceExpected at line 1, column 20"
let originalGlobal: string | undefined
let project: Awaited<ReturnType<typeof memoryProject>>
let projectFile: string

function configFile(scope: Scope) {
  return scope === "global" ? globalFile : projectFile
}

function errorBody(source: string, message: string) {
  return { name: "ConfigJsonError", data: { path: source, message } }
}

async function jsonError(run: () => Promise<unknown>) {
  try {
    await run()
  } catch (error) {
    if (error instanceof ConfigPaths.JsonError) return error
    throw error
  }
  throw new Error("Expected the production parser to return ConfigJsonError")
}

async function resetReaders() {
  Config.global.reset()
  await Config.state.resetAll()
  await Provider.resetAll()
}

async function restoreSources() {
  if (originalGlobal === undefined) await rm(globalFile, { force: true })
  else await writeFile(globalFile, originalGlobal)
  await writeFile(projectFile, "{}")
  await resetReaders()
}

async function readConfig(scope: Scope) {
  return scope === "global"
    ? Config.getGlobal()
    : Instance.provideProjectIdentity({ directory: project.path, fn: () => Config.get() })
}

async function writeConfig(scope: Scope, patch: Config.ProjectMergePatch) {
  return scope === "global"
    ? Config.updateGlobalPatch(patch)
    : Instance.provideProjectIdentity({ directory: project.path, fn: () => Config.updateProjectPatch(patch) })
}

async function request(scope: Scope, method: "GET" | "PATCH" = "GET", catalog = false) {
  const route = catalog
    ? scope === "global"
      ? "/global/providers"
      : "/provider"
    : scope === "global"
      ? "/global/config"
      : "/config"
  return Server.App().request(route, {
    method,
    headers: {
      ...(scope === "project" ? { "x-opencorvus-directory": project.path } : {}),
      ...(method === "PATCH" ? { "content-type": "application/json" } : {}),
    },
    ...(method === "PATCH" ? { body: JSON.stringify({ username: "owned-update" }) } : {}),
  })
}

beforeAll(async () => {
  originalGlobal = await readFile(globalFile, "utf8").catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return undefined
    throw error
  })
  project = await memoryProject("config-jsonc-diagnostics")
  projectFile = ConfigPaths.projectFile(project.path)
  for (const file of [globalFile, projectFile]) {
    await mkdir(path.dirname(file), { recursive: true })
    await writeFile(path.join(path.dirname(file), valueFilename), `${sampleValue}\n`)
  }
})

beforeEach(async () => {
  await restoreSources()
  process.env[envName] = sampleValue
})

afterEach(async () => {
  try {
    await restoreSources()
  } finally {
    if (originalEnv === undefined) delete process.env[envName]
    else process.env[envName] = originalEnv
    await Instance.disposeAll()
  }
})

afterAll(async () => {
  // Keep this one project physically present through every global read/write and restoration.
  try {
    await restoreSources()
  } finally {
    await rm(path.join(Global.Path.config, valueFilename), { force: true })
    await project[Symbol.asyncDispose]()
  }
})

describe.serial("Config JSONC diagnostic projection", () => {
  for (const [label, value] of [
    ["literal", sampleValue],
    ["environment", `{env:${envName}}`],
    ["file", `{file:${valueFilename}}`],
  ] as const) {
    test(`${label} input produces the exact syntax, named-error and CLI diagnostics`, async () => {
      const source = `{"provider":{"owned":{"options":{"apiKey":"${value}"}}}`
      const message = "CloseBraceExpected at line 1, column 53"
      const error = await jsonError(() => ConfigPaths.parseText(source, projectFile))
      expect({ body: error.toObject(), message: error.message, cli: FormatError(error) }).toEqual({
        body: errorBody(projectFile, message),
        message: `ConfigJsonError: ${message}`,
        cli: `Config file at ${projectFile} is not valid JSON(C): ${message}`,
      })
    })
  }

  for (const [label, newline] of [
    ["LF", "\n"],
    ["CRLF", "\r\n"],
    ["CR", "\r"],
  ] as const) {
    test(`${label} source reports its one-based final line and column`, async () => {
      const source = ["{", '  "provider": {"owned": {"options": {"apiKey": "DUMMY"}}}', ""].join(newline)
      const error = await jsonError(() => ConfigPaths.parseText(source, projectFile))
      expect(error.toObject()).toEqual(errorBody(projectFile, "CloseBraceExpected at line 3, column 1"))
    })
  }

  test("Unicode positions use the parser's UTF-16 offsets", async () => {
    const error = await jsonError(() => ConfigPaths.parseText('{"username":"甲🔑"', projectFile))
    expect(error.toObject()).toEqual(errorBody(projectFile, "CloseBraceExpected at line 1, column 18"))
  })

  test("multiple syntax errors retain the parser's diagnostic order", async () => {
    const error = await jsonError(() => ConfigPaths.parseText('{"username":', projectFile))
    expect(error.toObject()).toEqual(
      errorBody(projectFile, "ValueExpected at line 1, column 13\nCloseBraceExpected at line 1, column 13"),
    )
  })

  test("valid comments, trailing commas and both substitutions produce their actual values", async () => {
    const source = `{
      // Deliberately fictional values.
      "literal": "DUMMY",
      "environment": "{env:${envName}}",
      "file": "{file:${valueFilename}}",
    }`
    expect(await ConfigPaths.parseText(source, projectFile)).toEqual({
      literal: sampleValue,
      environment: sampleValue,
      file: sampleValue,
    })
  })

  for (const scope of scopes) {
    for (const [label, value, column] of [
      ["environment", `{env:${envName}}`, 86],
      ["file", `{file:${valueFilename}}`, 87],
    ] as const) {
      test(`${scope} malformed ${label} source preserves distinct reader and writer coordinates`, async () => {
        await writeFile(configFile(scope), `{"provider":{"owned":{"options":{"apiKey":"${value}"}}}`)
        const readerError = await jsonError(() => readConfig(scope))
        const writerError = await jsonError(() => writeConfig(scope, { username: "owned-update" }))
        expect({ reader: readerError.toObject(), writer: writerError.toObject() }).toEqual({
          reader: errorBody(configFile(scope), "CloseBraceExpected at line 1, column 53"),
          writer: errorBody(configFile(scope), `CloseBraceExpected at line 1, column ${column}`),
        })
      })
    }

    test(`${scope} canonical reader reports the exact stored-file syntax error`, async () => {
      await writeFile(configFile(scope), invalidFile)
      const error = await jsonError(() => readConfig(scope))
      expect(error.toObject()).toEqual(errorBody(configFile(scope), fileMessage))
    })

    test(`${scope} canonical writer reports the exact existing-file syntax error`, async () => {
      await writeFile(configFile(scope), invalidFile)
      const error = await jsonError(() => writeConfig(scope, { username: "owned-update" }))
      expect(error.toObject()).toEqual(errorBody(configFile(scope), fileMessage))
    })

    test(`${scope} public Config reads and writes return the named 500 contract`, async () => {
      await writeFile(configFile(scope), invalidFile)
      for (const method of ["GET", "PATCH"] as const) {
        const response = await request(scope, method)
        expect({ status: response.status, body: await response.json() }).toEqual({
          status: 500,
          body: errorBody(configFile(scope), fileMessage),
        })
        expect(response.headers.get("x-opencorvus-request-id")).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
        )
      }
    })

    test(`${scope} Provider catalog publishes the exact partial-success configuration issue`, async () => {
      await writeFile(configFile(scope), invalidFile)
      const response = await request(scope, "GET", true)
      const body = await response.json()
      const catalog = scope === "global" ? body.catalog : body
      expect({
        status: response.status,
        issues: catalog.issues.filter((issue: { phase: string }) => issue.phase === "config.read"),
      }).toEqual({
        status: 200,
        issues: [{ phase: "config.read", message: `ConfigJsonError: ${fileMessage}` }],
      })
    })

    test(`${scope} writer preserves literal references while its reader expands them`, async () => {
      const username = `{env:${envName}}`
      const instructions = [`{file:${valueFilename}}`]
      await writeFile(configFile(scope), JSON.stringify({ username, instructions }))
      await writeConfig(scope, { autoupdate: false })
      const persisted = JSON.parse(await readFile(configFile(scope), "utf8"))
      const effective = await readConfig(scope)
      expect({
        persisted: {
          username: persisted.username,
          instructions: persisted.instructions,
          autoupdate: persisted.autoupdate,
        },
        effective: {
          username: effective.username,
          instructions: effective.instructions,
          autoupdate: effective.autoupdate,
        },
      }).toEqual({
        persisted: { username, instructions, autoupdate: false },
        effective: { username: sampleValue, instructions: [sampleValue], autoupdate: false },
      })
    })
  }

  test("the actual HTTP failure log retains the same canonical syntax diagnostic", async () => {
    await writeFile(globalFile, invalidFile)
    const response = await request("global")
    await response.json()
    const requestID = response.headers.get("x-opencorvus-request-id")
    await Log.flush()
    const records = (await Log.read({ lines: 200 })).lines.map((line) => JSON.parse(line))
    const record = records.find((entry) => entry.message === "request failed" && entry.data?.requestID === requestID)
    if (!record) throw new Error("Expected the actual HTTP request's persisted failure log")
    expect({
      level: record.level,
      service: record.service,
      message: record.message,
      data: record.data,
    }).toEqual({
      level: "error",
      service: "server",
      message: "request failed",
      data: {
        requestID,
        method: "GET",
        path: "/global/config",
        statusCode: 500,
        error: {
          type: "ConfigJsonError",
          name: "ConfigJsonError",
          message: `ConfigJsonError: ${fileMessage}`,
          stack: expect.stringMatching(/^ConfigJsonError: ConfigJsonError: CloseBraceExpected at line 1, column 20\n/),
          data: { type: "Object", stack: "", path: globalFile, message: fileMessage },
        },
      },
    })
  })
})
