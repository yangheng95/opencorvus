import { expect, test } from "bun:test"
import { once } from "node:events"
import { createServer } from "node:http"
import { configure } from "../src/services/api"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import { ensureMissionSkillDirectory } from "../src/services/mission-skill"
import { createTauriTransport } from "../src/services/tauri-transport"
import { appStore, setAppStore } from "../src/store/app"

const directory = "D:/owned/request-media-type"
const preparedPath = `${directory}/.opencorvus/mission-skills`

for (const kind of ["browser", "tauri"] as const) {
  test(`${kind} sends each request body with its one declared wire media type`, async () => {
    const received: { url: string; mediaTypes: string[]; accept: string | undefined; body: Buffer }[] = []
    const server = createServer(async (request, response) => {
      const mediaTypes = request.rawHeaders.flatMap((value, index, pairs) =>
        index % 2 === 0 && value.toLowerCase() === "content-type" ? [pairs[index + 1]!] : [],
      )
      const chunks: Buffer[] = []
      for await (const chunk of request) chunks.push(Buffer.from(chunk))
      received.push({ url: request.url!, mediaTypes, accept: request.headers.accept, body: Buffer.concat(chunks) })
      response.setHeader("Content-Type", "application/json")
      response.end(JSON.stringify({ path: preparedPath }))
    })
    server.listen(0, "127.0.0.1")
    await once(server, "listening")
    const address = server.address()
    if (!address || typeof address === "string") throw new Error("TCP listener receipt required")
    const origin = `http://127.0.0.1:${address.port}`
    const originalConnected = appStore.connected
    try {
      configure({ serverUrl: origin, directory: "", password: "" })
      setAppStore("connected", true)
      const transport = createTauriTransport(kind)
      __setHostTransportForTest(transport)

      expect(await ensureMissionSkillDirectory({ kind: "project", directory }, "project")).toBe(preparedPath)
      await transport.request({ path: "json", method: "POST", body: { kind: "json", value: { state: "ready" } } })
      await transport.request({
        path: "text",
        method: "POST",
        headers: { "cOnTeNt-TyPe": "text/markdown; charset=utf-8" },
        body: { kind: "text", value: "# 原文" },
      })
      await transport.request({
        path: "bytes",
        method: "POST",
        headers: { "content-type": "image/png" },
        body: { kind: "binary", contentType: "application/octet-stream", value: Uint8Array.of(0, 1, 255) },
      })
      const form = new FormData()
      form.set("description", "文件说明")
      await transport.request({ path: "form", method: "POST", body: { kind: "form", value: form } })

      const decoded = received.slice(0, 3).map(({ url, mediaTypes, accept, body }) => ({
        url, mediaTypes, accept, body: body.toString(),
      }))
      expect(decoded).toEqual([
        {
          url: `/mission-skill/directory?directory=${encodeURIComponent(directory)}`,
          mediaTypes: ["application/json"],
          accept: "application/json",
          body: '{"source":"project"}',
        },
        { url: "/json", mediaTypes: ["application/json"], accept: "application/json", body: '{"state":"ready"}' },
        { url: "/text", mediaTypes: ["text/markdown; charset=utf-8"], accept: "application/json", body: "# 原文" },
      ])
      expect({ mediaTypes: received[3]!.mediaTypes, bytes: [...received[3]!.body] }).toEqual({
        mediaTypes: ["image/png"], bytes: [0, 1, 255],
      })
      const [boundaryType] = received[4]!.mediaTypes
      expect(received[4]!.mediaTypes).toEqual([expect.stringMatching(/^multipart\/form-data; boundary=.+$/)])
      const parsed = await new Request(origin + "/form", {
        method: "POST",
        headers: { "Content-Type": boundaryType! },
        body: new Uint8Array(received[4]!.body),
      }).formData()
      expect(parsed.get("description")).toBe("文件说明")
    } finally {
      __setHostTransportForTest(undefined)
      setAppStore("connected", originalConnected)
      configure({ serverUrl: "http://127.0.0.1:7878", directory: "", password: "" })
      await new Promise<void>((resolve, reject) => {
        server.close(error => error ? reject(error) : resolve())
        server.closeAllConnections()
      })
    }
  })
}
