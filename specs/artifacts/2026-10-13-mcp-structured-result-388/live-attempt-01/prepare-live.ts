import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import { writeExpertSquadPackage } from "../packages/sdk/js/src/expert-squad-authoring"
const root = path.join(import.meta.dir, "live-attempt-01")
const id = "structured-reports-388"
const archive = {
  archive_review_code: "IRIS-388-ARCHIVE",
  record_count: 2400,
  records: Array.from({ length: 2400 }, (_, index) => ({ row: index + 1, description: `Public sample record ${String(index + 1).padStart(4, "0")}`, status: "complete" })),
}
const results = {
  "public-summary": { content: [], structuredContent: { review_code: "LILY-388-SUMMARY", total: 7 } },
  "empty-note": { content: [{ type: "text", text: "Public note: available." }, { type: "resource", resource: { uri: "file:///public/empty.txt", mimeType: "text/plain", text: "" } }], structuredContent: { note: "EMPTY-RESOURCE-IS-VALID" } },
  "report-archive": { content: [], structuredContent: archive },
}
const mcp = { type: "remote", transport: "streamable-http", url: "http://127.0.0.1:18507/mcp", oauth: false, timeout: 15000 }
const method = `capability:skill:package:${id}:${id}%2Fshared%2Fmethod`
const definition = {
  manifest: {
    schema_version: 2, namespace: "qa", id, label: "公开结构化报告核对", description: "Read the three declared public reports using actual source results.",
    version: "2026.10.13.1", product_pillars: ["work"], capability_sets: {}, readme: "README.md",
    selector: { summary: "Read public report facts", selection_guidance: "Use for this public report review.", instructions: "selector.md" },
    capability_projection: {
      scheduler: { base_role: "orchestrator", prompt: "agents/orchestrator/system.md", capability_refs: [
        "capability:capability_set:platform:tool-registry:orchestrator-base", method,
        "capability:mcp_tool:project:default-mcp-registry:default%2Fmcp%2Fpublicreports%2Ftool%2Fpublic-summary",
        `capability:mcp_tool:package:${id}:${id}%2Fshared%2Freports%2Ftool%2Fempty-note`,
        `capability:mcp_tool:package:${id}:${id}%2Fshared%2Freports%2Ftool%2Freport-archive`,
        "capability:tool:platform:tool-registry:manage_task", "capability:tool:platform:tool-registry:read",
      ].sort() },
      agents: { "report-reader": { label: "Report reader", description: "Read public report facts", base_role: "explore", prompt: "agents/report-reader/system.md", capability_refs: [method, "capability:tool:platform:tool-registry:read"].sort() } },
      virtual_workflows: {},
    },
  },
  files: {
    "README.md": "# Public structured reports\nRead the user's requested public report fields using actual source results.\n",
    "selector.md": "# Public reports\nUse for the bounded report review request.\n",
    "agents/orchestrator/system.md": "# Public report owner\nOwn the requested read-only answer using your declared report and reading capabilities. Preserve actual returned evidence and report failures truthfully. Give the requested facts in a visible assistant message. When the request is satisfied, complete the Task with the current lifecycle interface and a truthful summary. No project file mutation or artifact publication is requested.\n",
    "agents/report-reader/system.md": "Read the requested public report facts using actual evidence.\n",
    "skills/method/SKILL.md": "---\nname: public-report-reading\ndescription: Read the declared public reports and answer the user's bounded question.\n---\n# Public report reading\nUse actual returned content. If a response is partial, follow its real recovery information for the sections needed to answer. Preserve missing facts as unknown.\n",
    "mcp/reports.json": JSON.stringify({ ...mcp, capabilities: { tools: ["empty-note", "report-archive"] } }),
  },
}
const directory = path.join(root, "package-source", "qa", id)
const installed = await writeExpertSquadPackage({ directory, definition })
const archiveText = JSON.stringify(archive)
assert(Buffer.byteLength(archiveText) > 51200)
for (const [name, value] of Object.entries({ "public-results.json": results, "mcp-config.json": mcp, "package-definition.json": definition, "package-sdk-receipt.json": { ...installed, directory }, "builtin.json": { kind: "builtin", id: "base", namespace: "builtin" } })) {
  await fs.writeFile(path.join(root, name), JSON.stringify(value, null, 2) + "\n", { flag: "wx" })
}
await fs.writeFile(path.join(root, "archive-output.txt"), archiveText, { flag: "wx" })
await fs.writeFile(path.join(root, "task-request.txt"), "请核对这组公开报告：1）日报摘要的 review_code 和 total；2）空资源检查报告的原文正文行与 note；3）完整存档开头的 archive_review_code 和 record_count。请从三个真实报告读取这些值，结果如果只显示部分正文，就依据实际返回的恢复信息读取所需位置。最后用中文简短列出核对结果，只读、不修改项目文件。\n", { flag: "wx" })
console.log(JSON.stringify({ id, directory, archiveBytes: Buffer.byteLength(archiveText), mcpPort: 18507 }))
