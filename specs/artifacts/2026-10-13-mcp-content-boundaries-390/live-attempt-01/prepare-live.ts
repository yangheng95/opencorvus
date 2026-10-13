import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import { writeExpertSquadPackage } from "../packages/sdk/js/src/expert-squad-authoring"
const root = path.join(import.meta.dir, "live-attempt-01")
const id = "content-boundaries-390"
const wav = "UklGRjQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YRAAAAAAAAAAAAAAAAAAAAAAAAAA"
assert.equal(Buffer.from(wav, "base64").length, 60)
const results = {
  "report-reference": { content: [{ type: "resource_link", uri: "https://example.com/reports/empty.csv", name: "empty.csv", title: "Public empty report", description: "Zero-row public report", mimeType: "text/csv", size: 0 }] },
  "empty-export": { content: [{ type: "text", text: "Public export succeeded; zero records." }, { type: "resource", resource: { uri: "file:///public/empty.csv", mimeType: "text/csv", blob: "" } }], structuredContent: { records: 0 } },
  "audio-clip": { content: [{ type: "text", text: "Public silent audio generated." }, { type: "audio", mimeType: "audio/wav", data: wav }] },
}
const mcp = { type: "remote", transport: "streamable-http", url: "http://127.0.0.1:18507/mcp", oauth: false, timeout: 15000 }
const method = `capability:skill:package:${id}:${id}%2Fshared%2Fmethod`
const definition = {
  manifest: {
    schema_version: 2, namespace: "qa", id, label: "公开MCP文件与引用核对", description: "Read the three declared public file and reference results using actual source evidence.",
    version: "2026.10.13.1", product_pillars: ["work"], capability_sets: {}, readme: "README.md",
    selector: { summary: "Read public file and reference facts", selection_guidance: "Use for this public result review.", instructions: "selector.md" },
    capability_projection: {
      scheduler: { base_role: "orchestrator", prompt: "agents/orchestrator/system.md", capability_refs: [
        "capability:capability_set:platform:tool-registry:orchestrator-base", method,
        "capability:mcp_tool:project:default-mcp-registry:default%2Fmcp%2Fpublicreports%2Ftool%2Freport-reference",
        `capability:mcp_tool:package:${id}:${id}%2Fshared%2Freports%2Ftool%2Fempty-export`,
        `capability:mcp_tool:package:${id}:${id}%2Fshared%2Freports%2Ftool%2Faudio-clip`,
        "capability:tool:platform:tool-registry:manage_task", "capability:tool:platform:tool-registry:read",
      ].sort() },
      agents: { "report-reader": { label: "Report reader", description: "Read public result facts", base_role: "explore", prompt: "agents/report-reader/system.md", capability_refs: [method, "capability:tool:platform:tool-registry:read"].sort() } },
      virtual_workflows: {},
    },
  },
  files: {
    "README.md": "# Public result reports\nRead the user's requested public result fields using actual source results.\n",
    "selector.md": "# Public results\nUse for the bounded report review request.\n",
    "agents/orchestrator/system.md": "# Public result owner\nOwn the requested read-only answer using your declared report capabilities. Preserve actual returned evidence and report failures truthfully. Give the requested facts in a visible assistant message. When the request is satisfied, complete the Task with the current lifecycle interface and a truthful summary. No project file mutation or artifact publication is requested.\n",
    "agents/report-reader/system.md": "Read the requested public result facts using actual evidence.\n",
    "skills/method/SKILL.md": "---\nname: public-result-reading\ndescription: Read the declared public results and answer the user's bounded question.\n---\n# Public result reading\nUse actual returned content and attachment metadata. Preserve missing facts as unknown and state media transport limitations faithfully.\n",
    "mcp/reports.json": JSON.stringify({ ...mcp, capabilities: { tools: ["empty-export", "audio-clip"] } }),
  },
}
const directory = path.join(root, "package-source", "qa", id)
const installed = await writeExpertSquadPackage({ directory, definition })
for (const [name, value] of Object.entries({ "public-results.json": results, "mcp-config.json": mcp, "package-definition.json": definition, "package-sdk-receipt.json": { ...installed, directory }, "builtin.json": { kind: "builtin", id: "base", namespace: "builtin" } })) {
  await fs.writeFile(path.join(root, name), JSON.stringify(value, null, 2) + "\n", { flag: "wx" })
}
await fs.writeFile(path.join(root, "silent.wav"), Buffer.from(wav, "base64"), { flag: "wx" })
await fs.writeFile(path.join(root, "empty.csv"), Buffer.alloc(0), { flag: "wx" })
await fs.writeFile(path.join(root, "task-request.txt"), "请分别调用一次这组三个只读公开报告：空CSV导出、静音音频、报告资源引用。用中文简短列出：空导出的原文和 records、CSV附件实际字节数；音频的原文、MIME和附件实际字节数，并如实说明当前模型工具结果的音频传输限制；资源引用的原始URI、name、title、description、mimeType、size。仅使用真实返回的正文与附件信息，不需要读取链接内容或听取音频，不修改项目文件。\n", { flag: "wx" })
console.log(JSON.stringify({ id, directory, audioBytes: 60, emptyBytes: 0, mcpPort: 18507 }))
