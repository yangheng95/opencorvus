import { expect, test } from "bun:test"
import { createOpenCorvusClient } from "../src/client"

for (const baseUrl of ["https://owned.example", "https://owned.example/proxy/api/"]) {
  test(`resource URL shares the actual HTTP transport at ${baseUrl}`, async () => {
    const requests: string[] = []
    const client = createOpenCorvusClient({
      baseUrl,
      fetch: (async (request: Request) => {
        requests.push(request.url)
        return new Response(new Uint8Array([17, 29]), { headers: { "Content-Type": "application/octet-stream" } })
      }) as typeof fetch,
    })
    await client.attachment.get({ projectID: "owned-project", name: "original.bin" }, { parseAs: "arrayBuffer" })
    const expected = `${baseUrl.replace(/\/$/, "")}/attachment/owned-project/original.bin`
    expect(client.resourceUrl("/attachment/owned-project/original.bin")).toBe(expected)
    expect(requests).toEqual([expected])
  })
}

test("resource addresses publish the resource identity with authentication kept in transport configuration", () => {
  const client = createOpenCorvusClient({
    baseUrl: "https://owned-user:owned-password@owned.example/proxy/",
    username: "owned-client", password: "owned-transport-password",
  })
  expect(client.resourceUrl("/attachment/owned-project/original.txt"))
    .toBe("https://owned.example/proxy/attachment/owned-project/original.txt")
})
