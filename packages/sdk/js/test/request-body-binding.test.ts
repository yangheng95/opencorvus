import { expect, test } from "bun:test"
import { buildClientParams } from "../src/gen/core/params.gen"

const bodyFields = [{ args: [{ key: "body", map: "body" as const }] }]

for (const kind of ["Blob", "File"] as const) {
  for (const bytes of [new Uint8Array([0, 255, 13, 10]), new Uint8Array(0)]) {
    test(`generated binding preserves an explicit ${bytes.length}-byte ${kind}`, async () => {
      const body = kind === "Blob" ? new Blob([bytes]) : new File([bytes], "input.bin")
      const params = buildClientParams([{ body }], bodyFields)
      expect(params.body).toBe(body)
      expect(new Uint8Array(await (params.body as Blob).arrayBuffer())).toEqual(bytes)
    })
  }
}

test("generated binding preserves the caller's explicit empty JSON object", () => {
  const body = {}
  const params = buildClientParams([{ body }], bodyFields)
  expect(params.body).toBe(body)
  expect(params.body).toEqual({})
})

test("generated binding retains actual grouped body, header, path and query values", () => {
  const params = buildClientParams(
    [{ model: "owned-model", revision: 3, token: "owned-header", project: "owned-project", limit: 2 }],
    [
      {
        args: [
          { in: "body", key: "model" },
          { in: "body", key: "revision" },
          { in: "headers", key: "token", map: "x-owned-header" },
          { in: "path", key: "project", map: "projectID" },
          { in: "query", key: "limit" },
        ],
      },
    ],
  )
  expect(params).toEqual({
    body: { model: "owned-model", revision: 3 },
    headers: { "x-owned-header": "owned-header" },
    path: { projectID: "owned-project" },
    query: { limit: 2 },
  })
})
