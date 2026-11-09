import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { Server } from "@/server/server"
import { tmpdir } from "./fixture/fixture"

async function check(directory: string) {
  const query = new URLSearchParams({ path: directory })
  const response = await Server.App().request(`/global/projects/check-directory?${query}`)
  return { status: response.status, body: await response.json() }
}

test("checking an existing workspace returns its resolved directory", async () => {
  await using fixture = await tmpdir()
  const requested = `${fixture.path}${path.sep}.`
  expect(await check(requested)).toEqual({ status: 200, body: { directory: fixture.path } })
})

test.each(["missing", "not-directory"] as const)("a %s workspace has a typed directory response", async (reason) => {
  await using fixture = await tmpdir()
  const directory = path.join(fixture.path, "selected")
  if (reason === "not-directory") await fs.writeFile(directory, "A regular file cannot be a workspace.")
  expect(await check(directory)).toMatchObject({
    status: 400,
    body: { name: "ProjectDirectoryIntegrityError", data: { directory, reason } },
  })
})

test("relative input returns the directory field validation contract", async () => {
  expect(await check("relative-workspace")).toMatchObject({
    status: 400,
    body: { success: false, error: [{ path: ["path"], message: "Expected an absolute server directory" }] },
  })
})
