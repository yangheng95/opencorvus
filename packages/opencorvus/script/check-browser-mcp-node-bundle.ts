import path from "node:path"
import { buildArtifactBrowserMcpNodeBundle } from "./build-artifact"

const result = await buildArtifactBrowserMcpNodeBundle({
  entrypoint: path.resolve(import.meta.dir, "../src/mcp/browser/entry.ts"),
})

if (!result.success) {
  const detail = result.logs.map((item) => item.message).join("; ")
  throw new Error(`Browser Model Context Protocol Node sidecar bundle failed: ${detail}`)
}
if (result.outputs.length !== 1) {
  throw new Error(`Browser Model Context Protocol Node sidecar bundle produced ${result.outputs.length} outputs`)
}
const bytes = (await result.outputs[0]!.arrayBuffer()).byteLength
if (bytes === 0) throw new Error("Browser Model Context Protocol Node sidecar bundle is empty")

console.log(JSON.stringify({ outputs: result.outputs.length, bytes }))
