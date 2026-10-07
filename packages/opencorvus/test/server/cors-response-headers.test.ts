import { afterEach, describe, expect, test } from "bun:test"
import { Server } from "../../src/server/server"
import fs from "node:fs/promises"
import path from "node:path"
import { ProjectRuntimePaths } from "../../src/project/runtime-paths"
import { publicUnknownErrorMessage } from "../../src/server/error-handler"
import { Log } from "../../src/util/log"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(async () => {
  Server.resetProjectRoutesAppForTest()
  await Log.close()
  await resetMemoryDatabase()
})

describe("Server cross-origin response contract", () => {
  test("allowed preflight returns its own diagnostic identity and requested method/header contract", async () => {
    const response = await Server.App().request("/attachment?filename=fixture.png", {
      method: "OPTIONS",
      headers: {
        Origin: "http://127.0.0.1:17889",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
      },
    })
    expect(response.status).toBe(204)
    expect(response.headers.get("access-control-allow-origin")).toBe("http://127.0.0.1:17889")
    expect(response.headers.get("access-control-allow-methods")).toBe("GET,HEAD,PUT,POST,DELETE,PATCH,QUERY")
    expect(response.headers.get("access-control-allow-headers")).toBe("content-type")
    expect(response.headers.get("x-opencorvus-request-id")).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    )
    expect(response.headers.get("access-control-expose-headers")).toBe(
      "Content-Disposition,Content-Range,ETag,x-opencorvus-request-id",
    )
  })

  test("real attachment storage error correlates its exposed response with its server log", async () => {
    await using project = await memoryProject()
    await Log.init({ print: false, dev: true, level: "INFO" })
    const obstacle = ProjectRuntimePaths.attachmentBlobRoot(project.path)
    await fs.mkdir(path.dirname(obstacle), { recursive: true })
    await fs.writeFile(obstacle, "owned attachment storage obstruction")
    const response = await Server.App().request(
      `/attachment?filename=fixture.txt&directory=${encodeURIComponent(project.path)}`,
      {
        method: "POST",
        headers: { Origin: "http://127.0.0.1:17889", "Content-Type": "text/plain" },
        body: "correlation fixture",
      },
    )
    expect(response.status).toBe(500)
    const requestID = response.headers.get("x-opencorvus-request-id")
    expect(requestID).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    expect(response.headers.get("access-control-allow-origin")).toBe("http://127.0.0.1:17889")
    expect(response.headers.get("access-control-expose-headers")).toBe(
      "Content-Disposition,Content-Range,ETag,x-opencorvus-request-id",
    )
    expect(await response.json()).toEqual({ name: "UnknownError", data: { message: publicUnknownErrorMessage() } })
    await Log.flush()
    const logs = (await fs.readFile(Log.file(), "utf8")).trim().split("\n").map((line) => JSON.parse(line))
    expect(logs.find((entry) => entry.data?.requestID === requestID && entry.message === "request failed")?.data).toMatchObject({
      requestID,
      method: "POST",
      path: "/attachment",
      statusCode: 500,
    })
  })

  test("exposes the archive filename header to an allowed Overlay origin", async () => {
    const response = await Server.App().request("/global/health", {
      headers: {
        Origin: "http://127.0.0.1:5175",
      },
    })

    expect(response.status).toBe(200)
    expect(response.headers.get("Access-Control-Expose-Headers")?.split(",")).toEqual([
      "Content-Disposition",
      "Content-Range",
      "ETag",
      "x-opencorvus-request-id",
    ])
  })
})
