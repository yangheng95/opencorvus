import { afterAll, describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { Config } from "../../src/config/config"
import { MCP } from "../../src/mcp"
import { BrowserMCPBuiltin } from "../../src/mcp/browser/builtin"
import { BrowserMCPNodeBundleContract } from "../../src/mcp/browser/node-bundle-contract"
import { ComputerMCPBuiltin } from "../../src/mcp/computer/builtin"
import { partitionMcpByRuntimeOwnership } from "../../src/mcp/scoped-builtin-ownership"
import { Instance } from "../../src/project/instance"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterAll(resetMemoryDatabase)

async function writeOrdinaryMcpFixture(file: string) {
  await fs.writeFile(
    file,
    [
      "import readline from 'node:readline';",
      "const rl=readline.createInterface({input:process.stdin});",
      "const send=(value)=>process.stdout.write(JSON.stringify(value)+'\\n');",
      "rl.on('line',(line)=>{",
      "  const request=JSON.parse(line);",
      "  if(request.method==='initialize') return send({jsonrpc:'2.0',id:request.id,result:{protocolVersion:'2025-06-18',capabilities:{tools:{},prompts:{},resources:{}},serverInfo:{name:'ordinary-fixture',version:'1'}}});",
      "  if(request.method==='tools/list') return send({jsonrpc:'2.0',id:request.id,result:{tools:[{name:'ordinary_echo',description:'Ordinary tool projection',inputSchema:{type:'object',properties:{},additionalProperties:false}}]}});",
      "  if(request.method==='prompts/list') return send({jsonrpc:'2.0',id:request.id,result:{prompts:[{name:'ordinary_prompt',description:'Ordinary prompt projection'}]}});",
      "  if(request.method==='resources/list') return send({jsonrpc:'2.0',id:request.id,result:{resources:[{name:'ordinary_resource',uri:'ordinary://resource',description:'Ordinary resource projection',mimeType:'text/plain'}]}});",
      "});",
    ].join("\n"),
    { flag: "wx" },
  )
}

describe("scoped builtin Model Context Protocol ownership", () => {
  test("partitions configured inventory into exact ordinary and scoped builtin projections", () => {
    const ordinaryDeclaration = { type: "remote", url: "https://example.invalid/mcp" } as const
    const browserDeclaration = BrowserMCPBuiltin.localConfig()
    const computerDeclaration = ComputerMCPBuiltin.localConfig()

    expect(
      partitionMcpByRuntimeOwnership({
        ordinary: ordinaryDeclaration,
        [BrowserMCPBuiltin.ServerName]: browserDeclaration,
        [ComputerMCPBuiltin.ServerName]: computerDeclaration,
      }),
    ).toEqual({
      ordinary: { ordinary: ordinaryDeclaration },
      scopedBuiltin: {
        [BrowserMCPBuiltin.ServerName]: browserDeclaration,
        [ComputerMCPBuiltin.ServerName]: computerDeclaration,
      },
    })
  })

  test("publishes one Browser source-export condition for API and CLI bundle builds", () => {
    expect({
      conditions: BrowserMCPNodeBundleContract.sourceExportConditions,
      cli: BrowserMCPNodeBundleContract.bunCliConditionArgs(),
    }).toEqual({
      conditions: ["source"],
      cli: ["--conditions=source"],
    })
  })

  test("projects exact ordinary tools, prompts, and resources through generic MCP entry points", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const fixture = path.join(project.path, "ordinary-mcp.mjs")
        await writeOrdinaryMcpFixture(fixture)
        await Config.updateProjectPatchAtomic(() => ({
          mcp: {
            ordinary: { type: "local", command: [process.execPath, fixture], timeout: 10_000 },
            [BrowserMCPBuiltin.ServerName]: BrowserMCPBuiltin.localConfig(),
            [ComputerMCPBuiltin.ServerName]: ComputerMCPBuiltin.localConfig(),
          },
        }))

        const tools = await MCP.tools(MCP.hostProcessAuthority(project.path))
        const prompts = await MCP.prompts()
        const resources = await MCP.resources()
        const resourceKey = `client:${Buffer.from("ordinary").toString("base64url")}:uri:${Buffer.from(
          "ordinary://resource",
        ).toString("base64url")}`

        expect(Object.keys(tools)).toEqual(["ordinary_ordinary_echo"])
        expect(tools.ordinary_ordinary_echo?.description).toBe("Ordinary tool projection")
        expect(prompts).toEqual({
          "ordinary:ordinary_prompt": {
            name: "ordinary_prompt",
            description: "Ordinary prompt projection",
            client: "ordinary",
          },
        })
        expect(resources).toEqual({
          [resourceKey]: {
            name: "ordinary_resource",
            uri: "ordinary://resource",
            description: "Ordinary resource projection",
            mimeType: "text/plain",
            client: "ordinary",
          },
        })
      },
    })
  }, 60_000)
})
