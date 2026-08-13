import { afterEach, describe, expect, test } from "bun:test"
import { createServer, type Server as HttpServer } from "node:http"
import { access, mkdir, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { Auth } from "@/auth"
import { Config } from "@/config/config"
import { Global } from "@/global"
import { Instance } from "@/project/instance"
import { Provider } from "@/provider/provider"
import { Server } from "@/server/server"
import { ExpertSquadPackageManager } from "@/expert-squad/manager"
import { memoryProject } from "./fixture/memory"

const authFile = path.join(Global.Path.data, "auth.json")
const publicError = {
  name: "AuthReadError",
  data: {
    operation: "read_saved_credentials",
    reason: "malformed_json",
    message: "Saved Provider credentials contain malformed JSON",
  },
}

async function resetReaders() {
  await Config.state.resetAll()
  await Provider.resetAll()
}

async function writeAuth(value: string) {
  await rm(authFile, { recursive: true, force: true })
  await mkdir(path.dirname(authFile), { recursive: true })
  await writeFile(authFile, value, { encoding: "utf8", mode: 0o600 })
  await resetReaders()
}

async function readConfigError(directory: string) {
  const error = await Instance.provide({ directory, fn: () => Config.get() }).catch((cause) => cause)
  const authError = Auth.findReadError(error)
  if (!authError) throw new Error("Expected Config.get to preserve an AuthReadError", { cause: error })
  return authError.toObject()
}

async function closeServer(server: HttpServer) {
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
}

afterEach(async () => {
  delete process.env.CS035_WELLKNOWN_TOKEN
  await Instance.disposeAll()
  await resetReaders()
  await rm(authFile, { recursive: true, force: true })
})

describe.serial("saved Auth and Config read authority", () => {
  test("malformed JSON is one typed Config failure and one safe HTTP 503", async () => {
    await using project = await memoryProject()
    await writeAuth('{"secret":"credential-fragment"')

    expect(await readConfigError(project.path)).toEqual(publicError)
    const response = await Server.App().request("/config", {
      headers: { "x-opencorvus-directory": project.path },
    })
    expect({ status: response.status, body: await response.json() }).toEqual({ status: 503, body: publicError })

    const patchResponse = await Server.App().request("/config", {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-opencorvus-directory": project.path },
      body: JSON.stringify({ disabled_providers: ["cs035-patch"] }),
    })
    expect({ status: patchResponse.status, body: await patchResponse.json() }).toEqual({
      status: 503,
      body: publicError,
    })

    const providerRemovalResponse = await Server.App().request("/provider/cs035-provider", {
      method: "DELETE",
      headers: { "x-opencorvus-directory": project.path },
    })
    expect({ status: providerRemovalResponse.status, body: await providerRemovalResponse.json() }).toEqual({
      status: 503,
      body: publicError,
    })

    const globalProviderRemovalResponse = await Server.App().request("/global/providers/cs035-provider", {
      method: "DELETE",
    })
    expect({ status: globalProviderRemovalResponse.status, body: await globalProviderRemovalResponse.json() }).toEqual({
      status: 503,
      body: publicError,
    })

    const installed = await ExpertSquadPackageManager.installPayloadPackage({
      projectDirectory: project.path,
      id: "frontend-replica",
      installationScope: "global",
    })
    const uninstallResponse = await Server.App().request("/expert-squad/uninstall", {
      method: "POST",
      headers: { "content-type": "application/json", "x-opencorvus-directory": project.path },
      body: JSON.stringify({
        id: "frontend-replica",
        installationScope: "global",
        replacementID: "base",
      }),
    })
    await access(installed.after.targetRoot)
    expect({ status: uninstallResponse.status, body: await uninstallResponse.json(), target: installed.after.targetRoot }).toEqual({
      status: 503,
      body: publicError,
      target: installed.after.targetRoot,
    })
  }, 90_000)

  test("a schema-invalid credential remains distinct from missing auth", async () => {
    await using project = await memoryProject()
    await writeAuth(JSON.stringify({ "https://organization.invalid": { type: "wellknown", key: "TOKEN" } }))
    const expected = {
      name: "AuthReadError",
      data: {
        operation: "read_saved_credentials",
        reason: "invalid_credential",
        message: "Saved Provider credentials do not satisfy the credential schema",
      },
    }

    expect(await readConfigError(project.path)).toEqual(expected)
    const response = await Server.App().request("/config", {
      headers: { "x-opencorvus-directory": project.path },
    })
    expect({ status: response.status, body: await response.json() }).toEqual({ status: 503, body: expected })
  }, 90_000)

  test("a non-record saved-auth document is one typed invalid-credential result", async () => {
    await using project = await memoryProject()
    await writeAuth("42")
    const expected = {
      name: "AuthReadError",
      data: {
        operation: "read_saved_credentials",
        reason: "invalid_credential",
        message: "Saved Provider credentials do not satisfy the credential schema",
      },
    }

    expect(await readConfigError(project.path)).toEqual(expected)
    const response = await Server.App().request("/config", {
      headers: { "x-opencorvus-directory": project.path },
    })
    expect({ status: response.status, body: await response.json() }).toEqual({ status: 503, body: expected })
  }, 90_000)

  test("a filesystem observation failure remains a typed io result", async () => {
    await using project = await memoryProject()
    await rm(authFile, { recursive: true, force: true })
    await mkdir(authFile, { recursive: true })
    await resetReaders()
    const expected = {
      name: "AuthReadError",
      data: {
        operation: "read_saved_credentials",
        reason: "io",
        message: "Saved Provider credentials could not be read",
      },
    }

    expect(await readConfigError(project.path)).toEqual(expected)
    const response = await Server.App().request("/config", {
      headers: { "x-opencorvus-directory": project.path },
    })
    expect({ status: response.status, body: await response.json() }).toEqual({ status: 503, body: expected })
  }, 90_000)

  test("a valid well-known credential merges the real remote configuration", async () => {
    await using project = await memoryProject()
    const requests: string[] = []
    const server = createServer((request, response) => {
      requests.push(request.url ?? "")
      response.writeHead(200, { "content-type": "application/json" })
      response.end(JSON.stringify({ config: { disabled_providers: ["cs035-remote-provider"] } }))
    })
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject)
      server.listen(0, "127.0.0.1", () => resolve())
    })
    try {
      const address = server.address()
      if (!address || typeof address === "string") throw new Error("Well-known fixture did not bind a TCP port")
      const origin = `http://127.0.0.1:${address.port}`
      await writeAuth(
        JSON.stringify({
          [origin]: { type: "wellknown", key: "CS035_WELLKNOWN_TOKEN", token: "remote-token" },
        }),
      )

      const config = await Instance.provide({ directory: project.path, fn: () => Config.get() })
      const response = await Server.App().request("/config", {
        headers: { "x-opencorvus-directory": project.path },
      })
      expect({
        disabledProviders: config.disabled_providers,
        token: process.env.CS035_WELLKNOWN_TOKEN,
        requests,
        status: response.status,
        routeDisabledProviders: (await response.json() as Config.Info).disabled_providers,
      }).toEqual({
        disabledProviders: ["cs035-remote-provider"],
        token: "remote-token",
        requests: ["/.well-known/opencorvus"],
        status: 200,
        routeDisabledProviders: ["cs035-remote-provider"],
      })
    } finally {
      await closeServer(server)
    }
  }, 90_000)

  test("the Provider catalog keeps its explicit partial-success issue contract", async () => {
    await using project = await memoryProject()
    await writeAuth("{")

    const response = await Server.App().request("/provider", {
      headers: { "x-opencorvus-directory": project.path },
    })
    const body = (await response.json()) as { all: unknown[]; issues: Array<{ phase: string; message: string }> }
    expect({
      status: response.status,
      catalogAvailable: body.all.length > 0,
      authIssues: body.issues.filter((issue) => issue.phase === "auth.read"),
    }).toEqual({
      status: 200,
      catalogAvailable: true,
      authIssues: [
        {
          phase: "auth.read",
          message: "AuthReadError: Saved Provider credentials contain malformed JSON",
        },
      ],
    })
  }, 90_000)

  test("a missing saved-auth file remains a valid empty authority", async () => {
    await using project = await memoryProject()
    await rm(authFile, { recursive: true, force: true })
    await resetReaders()

    const config = await Instance.provide({ directory: project.path, fn: () => Config.get() })
    const response = await Server.App().request("/config", {
      headers: { "x-opencorvus-directory": project.path },
    })

    expect({ config: Config.Info.parse(config), status: response.status }).toMatchObject({
      config: { plugin: expect.any(Array), agent: expect.any(Object) },
      status: 200,
    })
  }, 90_000)
})
