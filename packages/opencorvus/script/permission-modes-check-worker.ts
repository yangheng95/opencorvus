import { PrimaryAssistantRegistry } from "@/agent/primary-assistant-registry"
import { sessionRuntimeFromNativeAgent } from "@/agent/session-agent-runtime"
import { ACP } from "@/acp/agent"
import { Config } from "@/config/config"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { InstanceBootstrap } from "@/project/bootstrap"
import type { Provider } from "@/provider/provider"
import { declareNativeTaskProcessDeployment } from "@/runtime/task-process-deployment"
import { RuntimeExecutionSettlement } from "@/runtime/execution-settlement"
import { Scheduler } from "@/scheduler"
import { Session } from "@/session"
import { SessionLoop } from "@/session/loop"
import { SessionProcessor } from "@/session/processor"
import { SessionRuntimeContractStore } from "@/session/runtime-contract"
import { Server } from "@/server/server"
import { Database } from "@/storage/db"
import { PermissionAuthority } from "@/permission/authority"
import { handleMcpAppHostRequest } from "@/interactive-artifact/mcp-app-host"
import { MessageStore } from "@/session/message-store"
import { SessionPrompt } from "@/session/prompt"
import { createExecutionCancellationOrigin } from "@/session/prompt/cancellation"
import { ComputerMCPBuiltin } from "@/mcp/computer/builtin"
import { ComputerHostRuntime } from "@/mcp/computer/host-runtime"
import { MCP } from "@/mcp"
import { createOpenCorvusClient } from "@opencorvus-ai/sdk/client"
import { createManagedTemporaryDirectory, removeManagedDirectoryTree } from "@opencorvus-ai/util/runtime-directories"
import {
  AgentSideConnection,
  ClientSideConnection,
  PROTOCOL_VERSION,
  ndJsonStream,
  type Client,
  type RequestPermissionRequest,
  type SessionNotification,
} from "@agentclientprotocol/sdk"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

const INACTIVITY_MS = 120_000
const POLL_MS = 25
let lastActivity = Date.now()
let lastActivityLabel = "startup"

function markActivity(label = "progress") {
  lastActivity = Date.now()
  lastActivityLabel = label
  process.stdout.write(`${JSON.stringify({ status: "progress", label })}\n`)
}

function acpByteStreamPair() {
  let agentInput!: ReadableStreamDefaultController<Uint8Array>
  let clientInput!: ReadableStreamDefaultController<Uint8Array>
  let closed = false
  const agentReadable = new ReadableStream<Uint8Array>({
    start(controller) {
      agentInput = controller
    },
  })
  const clientReadable = new ReadableStream<Uint8Array>({
    start(controller) {
      clientInput = controller
    },
  })
  const closeController = (controller: ReadableStreamDefaultController<Uint8Array>) => {
    try {
      controller.close()
    } catch {
      // The official ACP connection may already have closed the opposite side.
    }
  }
  return {
    agent: ndJsonStream(
      new WritableStream<Uint8Array>({ write: (chunk) => clientInput.enqueue(chunk) }),
      agentReadable,
    ),
    client: ndJsonStream(
      new WritableStream<Uint8Array>({ write: (chunk) => agentInput.enqueue(chunk) }),
      clientReadable,
    ),
    close() {
      if (closed) return
      closed = true
      closeController(agentInput)
      closeController(clientInput)
    },
  }
}

async function nextStreamItem<T>(stream: AsyncIterable<T>, predicate: (value: T) => boolean): Promise<T> {
  const deadline = Date.now() + INACTIVITY_MS
  for await (const item of stream) {
    if (predicate(item)) return item
    if (Date.now() >= deadline) break
  }
  throw new Error("Permission checker stream closed before the expected hydration event")
}

async function readLineUntil(
  stream: ReadableStream<Uint8Array>,
  predicate: (line: string) => boolean,
): Promise<string> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffered = ""
  try {
    const deadline = Date.now() + INACTIVITY_MS
    while (Date.now() < deadline) {
      const { value, done } = await reader.read()
      if (done) break
      buffered += decoder.decode(value, { stream: true })
      while (true) {
        const newline = buffered.indexOf("\n")
        if (newline < 0) break
        const line = buffered.slice(0, newline).trim()
        buffered = buffered.slice(newline + 1)
        if (predicate(line)) return line
      }
    }
  } finally {
    reader.releaseLock()
  }
  throw new Error(`CLI closed before projecting its durable permission request: ${buffered}`)
}

async function waitForValue<T>(read: () => T | undefined | Promise<T | undefined>, label: string): Promise<T> {
  const deadline = Date.now() + INACTIVITY_MS
  while (Date.now() < deadline) {
    const value = await read()
    if (value !== undefined) {
      markActivity()
      return value
    }
    await Bun.sleep(POLL_MS)
  }
  throw new Error(`Permission checker timed out waiting for ${label}`)
}

function openAiCompatibleModelServer() {
  return Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request) {
      const url = new URL(request.url)
      if (!url.pathname.endsWith("/chat/completions")) return new Response("not found", { status: 404 })
      const encoder = new TextEncoder()
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          const emit = (value: unknown) =>
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(value)}\n\n`))
          emit({
            id: "permission-check-completion",
            object: "chat.completion.chunk",
            created: Math.floor(Date.now() / 1000),
            model: "permission-check-model",
            choices: [
              {
                index: 0,
                delta: { role: "assistant", content: "permission transport checked" },
                finish_reason: null,
              },
            ],
          })
          emit({
            id: "permission-check-completion",
            object: "chat.completion.chunk",
            created: Math.floor(Date.now() / 1000),
            model: "permission-check-model",
            choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
          })
          controller.enqueue(encoder.encode("data: [DONE]\n\n"))
          controller.close()
        },
      })
      return new Response(stream, { headers: { "content-type": "text/event-stream" } })
    },
  })
}

async function exerciseTransportClients(input: {
  projectDirectory: string
  sessionID: string
  requestID: string
  toolCallID: string
  target: string
}) {
  markActivity("transport:start")
  const server = Server.listen({ hostname: "127.0.0.1", port: 0, randomPort: true })
  const baseUrl = `http://${server.hostname}:${server.port}`
  const sdk = createOpenCorvusClient({ baseUrl, directory: input.projectDirectory })
  const sseAbort = new AbortController()
  const pair = acpByteStreamPair()
  let cli: ReturnType<typeof Bun.spawn> | undefined
  let cliExited = false
  let acpAgentConnection: AgentSideConnection | undefined
  let acpClientConnection: ClientSideConnection | undefined
  try {
    const sse = await sdk.session.events(
      { sessionID: input.sessionID, directory: input.projectDirectory },
      { signal: sseAbort.signal },
    )
    const sseEvent = await nextStreamItem(sse.stream, (event: any) => {
      return event?.type === "permission.asked" && event?.payload?.id === input.requestID
    })
    markActivity("transport:sse")

    const cliEntry = path.resolve(import.meta.dir, "../src/index.ts")
    cli = Bun.spawn(
      [
        process.execPath,
        cliEntry,
        "run",
        "permission transport hydration",
        "--attach",
        baseUrl,
        "--dir",
        input.projectDirectory,
        "--session",
        input.sessionID,
        "--format",
        "json",
      ],
      {
        cwd: path.resolve(import.meta.dir, ".."),
        env: { ...process.env },
        stdin: "ignore",
        stdout: "pipe",
        stderr: "pipe",
      },
    )
    let cliLine: string
    try {
      cliLine = await readLineUntil(cli.stdout, (line) => {
        try {
          const event = JSON.parse(line)
          return event.type === "permission_requested" && event.permission?.requestID === input.requestID
        } catch {
          return false
        }
      })
    } catch (error) {
      const stderr = await new Response(cli.stderr).text().catch(() => "")
      throw new Error(`${error instanceof Error ? error.message : String(error)}; CLI stderr: ${stderr.trim()}`, {
        cause: error,
      })
    }
    markActivity("transport:cli")

    let acpRequest: RequestPermissionRequest | undefined
    let selectPermission!: () => void
    const selected = new Promise<void>((resolve) => {
      selectPermission = resolve
    })
    const client = {
      async requestPermission(params: RequestPermissionRequest) {
        acpRequest = params
        await selected
        return { outcome: { outcome: "selected" as const, optionId: "allow_once" } }
      },
      async sessionUpdate(_params: SessionNotification) {},
      async readTextFile() {
        throw new Error("ACP permission checker did not authorize a client filesystem read")
      },
      async writeTextFile() {
        throw new Error("ACP permission checker did not authorize a client filesystem write")
      },
    } as Client
    const acp = await ACP.init({ sdk })
    acpAgentConnection = new AgentSideConnection((connection) => acp.create(connection, { sdk }), pair.agent)
    const acpClient = (acpClientConnection = new ClientSideConnection(() => client, pair.client))
    await acpClient.initialize({ protocolVersion: PROTOCOL_VERSION, clientCapabilities: {} })
    await acpClient.loadSession({ cwd: input.projectDirectory, sessionId: input.sessionID, mcpServers: [] })
    markActivity("transport:acp-loaded")
    const hydratedAcpRequest = await waitForValue(() => acpRequest, "ACP durable permission hydration")
    if (
      hydratedAcpRequest.sessionId !== input.sessionID ||
      hydratedAcpRequest.toolCall.toolCallId !== input.toolCallID ||
      !hydratedAcpRequest.options.some((option) => option.optionId === "allow_once")
    ) {
      throw new Error(`ACP permission hydration mismatch: ${JSON.stringify(hydratedAcpRequest)}`)
    }
    selectPermission()
    markActivity("transport:acp-approved")

    await waitForValue(async () => {
      try {
        return (await fs.readFile(input.target, "utf8")) === "transport-approved" ? true : undefined
      } catch {
        return undefined
      }
    }, "transport-approved Tool continuation")

    await waitForValue(async () => {
      const pending = await sdk.permission
        .list({ directory: input.projectDirectory }, { throwOnError: true })
        .then((response) => response.data ?? [])
      return pending.some((request) => request.id === input.requestID) ? undefined : true
    }, "ACP permission settlement")
    const file = await fs.readFile(input.target, "utf8")
    markActivity("transport:continued")

    // The attached CLI owns the prompt HTTP request that produced the hydrated
    // permission event. End that session through the public protocol before
    // closing the checker-owned transports so the request and Instance lease
    // settle in their normal lifecycle.
    await sdk.session.abort({ sessionID: input.sessionID }, { throwOnError: true })
    markActivity("transport:session-aborted")
    await Promise.race([
      cli.exited.then(() => {
        cliExited = true
      }),
      Bun.sleep(10_000).then(() => {
        throw new Error("Attached CLI did not exit after the transport session was aborted")
      }),
    ])
    markActivity("transport:cli-exited")
    await SessionPrompt.waitForFinish(input.sessionID, input.projectDirectory)
    await Instance.provide({
      directory: input.projectDirectory,
      fn: () => SessionRuntimeContractStore.dispose(input.sessionID),
    })
    markActivity("transport:runtime-disposed")

    return {
      sse: (sseEvent as any).payload.id,
      cli: JSON.parse(cliLine).permission.requestID as string,
      acp: hydratedAcpRequest.toolCall.toolCallId,
      file: await file,
    }
  } finally {
    sseAbort.abort()
    pair.close()
    await Promise.all([acpAgentConnection?.closed, acpClientConnection?.closed].filter(Boolean))
    markActivity("transport:acp-closed")
    if (cli) {
      if (!cliExited) {
        cli.kill()
        await Promise.race([cli.exited.catch(() => undefined), Bun.sleep(1_000)])
      }
    }
    markActivity("transport:mcp-disconnect-start")
    await Instance.provide({
      directory: input.projectDirectory,
      fn: async () => {
        await Promise.all([
          MCP.disconnect("permission_check_mcp"),
          MCP.disconnect("permission_task_check_mcp"),
          MCP.disconnect(ComputerMCPBuiltin.ServerName),
        ])
      },
    })
    markActivity("transport:mcp-disconnect-done")
    markActivity("transport:process-settlement-start")
    await server.stop(true)
    markActivity("transport:process-settlement-done")
  }
}

function providerModel(): Provider.Model {
  return {
    id: "permission-check-model",
    providerID: "permission-check-provider",
    name: "Permission checker model",
    limit: { context: 1_000_000, input: 900_000, output: 4_096 },
    cost: { available: true, input: 0, output: 0, cache: { read: 0, write: 0 } },
    capabilities: {
      toolcall: true,
      attachment: false,
      reasoning: false,
      temperature: true,
      input: { text: true, image: false, audio: false, video: false },
      output: { text: true, image: false, audio: false, video: false },
    },
    api: { id: "permission-check", npm: "@ai-sdk/anthropic" },
    options: {},
  } as Provider.Model
}

async function writeMcpFixture(file: string) {
  await fs.writeFile(
    file,
    [
      "import readline from 'node:readline';",
      "const rl=readline.createInterface({input:process.stdin});",
      "const send=(value)=>process.stdout.write(JSON.stringify(value)+'\\n');",
      "const tool={name:'controlled_echo',description:'Echo a harmless value through real MCP stdio and MCP App host',inputSchema:{type:'object',properties:{value:{type:'string'}},required:['value'],additionalProperties:false},_meta:{ui:{resourceUri:'ui://permission-check/controlled-echo'}}};",
      "rl.on('line',(line)=>{const request=JSON.parse(line); if(request.method==='initialize') return send({jsonrpc:'2.0',id:request.id,result:{protocolVersion:'2025-06-18',capabilities:{tools:{},resources:{}},serverInfo:{name:'permission-check-mcp',version:'1'}}}); if(request.method==='notifications/initialized') return; if(request.method==='tools/list') return send({jsonrpc:'2.0',id:request.id,result:{tools:[tool]}}); if(request.method==='resources/list') return send({jsonrpc:'2.0',id:request.id,result:{resources:[{uri:'ui://permission-check/controlled-echo',name:'Permission checker MCP App',mimeType:'text/html;profile=mcp-app'}]}}); if(request.method==='resources/read') return send({jsonrpc:'2.0',id:request.id,result:{contents:[{uri:'ui://permission-check/controlled-echo',mimeType:'text/html;profile=mcp-app',text:'<!doctype html><title>Permission checker MCP App</title><main>controlled echo</main>'}]}}); if(request.method==='tools/call') return send({jsonrpc:'2.0',id:request.id,result:{content:[{type:'text',text:request.params.arguments.value}],structuredContent:{value:request.params.arguments.value}}});});",
    ].join("\n"),
    { flag: "wx" },
  )
}

async function writePluginFixture(file: string, stateFile: string) {
  await fs.writeFile(
    file,
    [
      "import fs from 'node:fs';",
      `const stateFile=${JSON.stringify(stateFile)};`,
      "const append=(phase,input)=>fs.appendFileSync(stateFile,JSON.stringify({phase,tool:input.tool,callID:input.callID})+'\\n');",
      "export default async function permissionCheckerPlugin(){return {'tool.execute.before':async(input)=>append('before',input),'tool.execute.after':async(input)=>append('after',input)}}",
    ].join("\n"),
    { flag: "wx" },
  )
}

async function writeMcpTaskFixture(file: string, stateFile: string) {
  await fs.writeFile(
    file,
    [
      "import fs from 'node:fs';",
      "import readline from 'node:readline';",
      `const stateFile=${JSON.stringify(stateFile)};`,
      "const rl=readline.createInterface({input:process.stdin});",
      "const send=(value)=>process.stdout.write(JSON.stringify(value)+'\\n');",
      "const task=(status)=>({taskId:'durable-task-1',status,ttl:60000,createdAt:'2026-08-12T00:00:00.000Z',lastUpdatedAt:'2026-08-12T00:00:01.000Z',pollInterval:1});",
      "rl.on('line',(line)=>{const request=JSON.parse(line); if(request.method==='initialize') return send({jsonrpc:'2.0',id:request.id,result:{protocolVersion:'2025-11-25',capabilities:{tools:{},tasks:{requests:{tools:{call:{}}}}},serverInfo:{name:'permission-task-check-mcp',version:'1'}}}); if(request.method==='notifications/initialized') return; if(request.method==='tools/list') return send({jsonrpc:'2.0',id:request.id,result:{tools:[{name:'controlled_task',description:'Durable controlled MCP task',inputSchema:{type:'object',properties:{value:{type:'string'}},required:['value'],additionalProperties:false},execution:{taskSupport:'required'}}]}}); if(request.method==='tools/call'){const existing=fs.existsSync(stateFile)?JSON.parse(fs.readFileSync(stateFile,'utf8')):{calls:0}; existing.calls+=1; existing.value=request.params.arguments.value; fs.writeFileSync(stateFile,JSON.stringify(existing)); return send({jsonrpc:'2.0',id:request.id,result:{task:task('working')}});} if(request.method==='tasks/get'){const existing=JSON.parse(fs.readFileSync(stateFile,'utf8')); existing.polls=(existing.polls??0)+1; fs.writeFileSync(stateFile,JSON.stringify(existing)); if(existing.polls===1) return process.exit(86); return send({jsonrpc:'2.0',id:request.id,result:task('completed')});} if(request.method==='tasks/result'){const existing=JSON.parse(fs.readFileSync(stateFile,'utf8')); return send({jsonrpc:'2.0',id:request.id,result:{content:[{type:'text',text:existing.value}],structuredContent:{calls:existing.calls,polls:existing.polls??0}}});}});",
    ].join("\n"),
    { flag: "wx" },
  )
}

async function resolveSessionTools(title: string) {
  markActivity(`resolve:${title}:start`)
  const model = providerModel()
  const config = await Config.get()
  const nativeAgent = await PrimaryAssistantRegistry.get("coding", { config })
  const agent = sessionRuntimeFromNativeAgent(nativeAgent)
  const session = await Session.create({ kind: "assistant", title })
  const user = await Session.updateMessage({
    id: Identifier.ascending("message"),
    sessionID: session.id,
    role: "user",
    author: "coding",
    time: { created: Date.now() },
    agent: "coding",
    model: { providerID: model.providerID, modelID: model.id },
  })
  await Session.updatePart({
    id: Identifier.ascending("part"),
    sessionID: session.id,
    messageID: user.id,
    type: "text",
    text: title,
  })
  const assistant = await Session.updateMessage({
    id: Identifier.ascending("message"),
    parentID: user.id,
    sessionID: session.id,
    role: "assistant",
    author: "coding",
    agent: "coding",
    path: { cwd: Instance.directory, root: Instance.worktree },
    cost: 0,
    tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
    modelID: model.id,
    providerID: model.providerID,
    time: { created: Date.now() },
  })
  const abort = new AbortController().signal
  const processor = SessionProcessor.create({ assistantMessage: assistant, sessionID: session.id, model, abort })
  const tools = await SessionLoop.resolveTools({
    agent,
    agentID: "coding",
    model,
    session,
    processor,
    messages: await Session.messages({ sessionID: session.id }),
    config,
  })
  markActivity(`resolve:${title}:done`)
  return { session, assistant, tools, abort }
}

async function resolvePersistedSessionTools(sessionID: string, assistantID: string) {
  markActivity(`resolve-persisted:${sessionID}:start`)
  const model = providerModel()
  const config = await Config.get()
  const nativeAgent = await PrimaryAssistantRegistry.get("coding", { config })
  const agent = sessionRuntimeFromNativeAgent(nativeAgent)
  const session = await Session.get(sessionID)
  const messages = await Session.messages({ sessionID })
  const assistant = messages.map((message) => message.info).find((message) => message.id === assistantID)
  if (!assistant || assistant.role !== "assistant") throw new Error(`Missing persisted assistant ${assistantID}`)
  const abort = new AbortController().signal
  const processor = SessionProcessor.create({ assistantMessage: assistant, sessionID, model, abort })
  const tools = await SessionLoop.resolveTools({
    agent,
    agentID: "coding",
    model,
    session,
    processor,
    messages,
    config,
  })
  markActivity(`resolve-persisted:${sessionID}:done`)
  return { tools, abort }
}

async function executeTool(
  tool: { execute?: (input: any, options: any) => Promise<any> },
  input: unknown,
  callID: string,
  abortSignal: AbortSignal,
) {
  if (!tool.execute) throw new Error(`SessionLoop Tool ${callID} has no execute adapter`)
  markActivity(`execute:${callID}:start`)
  const result = await tool.execute(input, { toolCallId: callID, messages: [], abortSignal })
  markActivity(`execute:${callID}:done`)
  return result
}

async function main() {
  declareNativeTaskProcessDeployment()
  const root = await createManagedTemporaryDirectory(process.env.OPENCORVUS_TEST_PROCESS_ROOT!, "permission-check-")
  const projectDirectory = path.join(root, "project")
  const mcpTaskState = path.join(root, "permission-task-state.json")
  const pluginState = path.join(root, "permission-plugin-state.ndjson")
  const mcpFixture = path.join(root, "permission-check-mcp.mjs")
  const mcpTaskFixture = path.join(root, "permission-task-check-mcp.mjs")
  const pluginFixture = path.join(root, "permission-check-plugin.mjs")
  const modelServer = openAiCompatibleModelServer()
  await fs.mkdir(projectDirectory, { recursive: true })
  const git = Bun.spawnSync(["git", "init"], { cwd: projectDirectory })
  if (git.exitCode !== 0) throw new Error(git.stderr.toString())
  await writeMcpFixture(mcpFixture)
  await writeMcpTaskFixture(mcpTaskFixture, mcpTaskState)
  await writePluginFixture(pluginFixture, pluginState)

  try {
    await Instance.provide({
      directory: projectDirectory,
      fn: () => Config.updateProjectPatch({ plugin: [`file:///${pluginFixture.replaceAll("\\", "/")}`] }),
    })
    await Instance.disposeAll()
    const evidence = await Instance.provide({
      directory: projectDirectory,
      init: InstanceBootstrap,
      fn: async () => {
        const computerRuntimeScope = `permission-check:${Instance.project.id}`
        const computerAdapter = ComputerHostRuntime.adapter({ runtimeScope: computerRuntimeScope })
        await Config.updateProjectPatch({
          permission_mode: "full_access",
          model: "permission-check-provider/permission-check-model",
          experimental: { batch_tool: true },
          provider: {
            "permission-check-provider": {
              name: "Permission checker provider",
              npm: "@ai-sdk/openai-compatible",
              api: `http://127.0.0.1:${modelServer.port}/permission-check-model`,
              models: {
                "permission-check-model": {
                  name: "Permission checker model",
                  tool_call: true,
                  modalities: { input: ["text"], output: ["text"] },
                  limit: { context: 1_000_000, output: 4_096 },
                },
              },
            },
          },
          mcp: {
            permission_check_mcp: {
              type: "local",
              command: [process.execPath, mcpFixture],
              enabled: true,
              timeout: 10_000,
            },
            permission_task_check_mcp: {
              type: "local",
              command: [process.execPath, mcpTaskFixture],
              enabled: true,
              timeout: 10_000,
            },
            [ComputerMCPBuiltin.ServerName]: ComputerMCPBuiltin.localConfig({ hostAdapter: computerAdapter }),
          },
        })

        const defaultRun = await resolveSessionTools("Permission checker default Full access")
        const defaultTarget = path.join(projectDirectory, "default-full-access.txt")
        await executeTool(
          defaultRun.tools.write,
          { filePath: defaultTarget, content: "default-full-access" },
          "call_permission_check_default",
          defaultRun.abort,
        )

        await Config.updateProjectPatch({ permission_mode: "ask" })
        const askRun = await resolveSessionTools("Permission checker Ask me")
        const askTarget = path.join(projectDirectory, "ask-approved.txt")
        const pending = executeTool(
          askRun.tools.write,
          { filePath: askTarget, content: "approved" },
          "call_permission_check_ask",
          askRun.abort,
        )
        let request: PermissionAuthority.Request | undefined
        const deadline = Date.now() + INACTIVITY_MS
        while (!request && Date.now() < deadline) {
          request = (await PermissionAuthority.list()).find((item) => item.sessionID === askRun.session.id)
          if (!request) await Bun.sleep(POLL_MS)
        }
        if (!request) throw new Error("SessionLoop Ask me invocation did not commit a pending request")
        await PermissionAuthority.reply({
          requestID: request.id,
          decision: "allow_once",
          actorID: "permission-check",
          autoReply: false,
        })
        await pending

        const transportRun = await resolveSessionTools("Permission checker transport hydration")
        const transportTarget = path.join(projectDirectory, "transport-approved.txt")
        const transportExecution = executeTool(
          transportRun.tools.write,
          { filePath: transportTarget, content: "transport-approved" },
          "call_permission_check_transport",
          transportRun.abort,
        )
        transportExecution.catch(() => undefined)
        const transportRequest = await waitForValue(async () => {
          return (await PermissionAuthority.list()).find((request) => request.sessionID === transportRun.session.id)
        }, "transport permission request")

        await Config.updateProjectPatch({ permission_mode: "full_access" })
        const mcpRun = await resolveSessionTools("Permission checker real MCP")
        const mcpTool = mcpRun.tools.permission_check_mcp_controlled_echo
        if (!mcpTool) throw new Error("SessionLoop did not project the controlled MCP Tool")
        const mcpResult = await executeTool(
          mcpTool,
          { value: "controlled" },
          "call_permission_check_mcp",
          mcpRun.abort,
        )
        const mcpArtifactPart = (await MessageStore.parts(mcpRun.assistant.id)).find(
          (part) => part.type === "interactive-artifact",
        )
        if (!mcpArtifactPart || mcpArtifactPart.type !== "interactive-artifact") {
          throw new Error("Real MCP Tool execution did not materialize its MCP App artifact")
        }
        const mcpAppResult = await handleMcpAppHostRequest({
          sessionID: mcpRun.session.id,
          artifactID: mcpArtifactPart.artifactID,
          request: {
            method: "tools/call",
            params: { name: "controlled_echo", arguments: { value: "controlled-mcp-app" } },
          },
        })
        const batchTool = mcpRun.tools.batch
        if (!batchTool) throw new Error("SessionLoop did not project the real batch Tool")
        const batchTarget = path.join(projectDirectory, "batch-child.txt")
        const batchResult = await executeTool(
          batchTool,
          { tool_calls: [{ tool: "write", parameters: { filePath: batchTarget, content: "batch-child" } }] },
          "call_permission_check_batch",
          mcpRun.abort,
        )
        const computerDestroyTool = mcpRun.tools.computer_session_destroy
        if (!computerDestroyTool) throw new Error("SessionLoop did not project the built-in Computer MCP Tool")
        const computerResult = await executeTool(
          computerDestroyTool,
          { computer_id: "permission-check-missing-computer" },
          "call_permission_check_computer",
          mcpRun.abort,
        )
        const browserStatusTool = mcpRun.tools.browser_session_status
        if (!browserStatusTool) throw new Error("SessionLoop did not project the Browser MCP status Tool")
        const browserStatus = await executeTool(
          browserStatusTool,
          { sessionId: "permission-check-missing-session" },
          "call_permission_check_browser_status",
          mcpRun.abort,
        )
        const scheduleTool = mcpRun.tools.schedule
        if (!scheduleTool) throw new Error("SessionLoop did not project the schedule Tool")
        const scheduled = await executeTool(
          scheduleTool,
          {
            action: "create",
            name: "Permission checker future schedule",
            recurrence: "DTSTART:20990101T000000Z\nRRULE:FREQ=DAILY",
            prompt: "Permission checker future schedule",
            scope: "session",
            executionMode: "local",
          },
          "call_permission_check_schedule_create",
          mcpRun.abort,
        )
        const automationId = JSON.parse(String((scheduled as any)?.output ?? "{}"))?.automationId
        if (typeof automationId !== "string") {
          throw new Error(`Schedule Tool did not return its automation identity: ${JSON.stringify(scheduled)}`)
        }
    const scheduleRun = await executeTool(
      scheduleTool,
      { action: "run", automationId },
      "call_permission_check_schedule_run",
      mcpRun.abort,
    )
        markActivity("matrix:scheduler-run-complete")
        const unscheduled = await executeTool(
          scheduleTool,
          { action: "delete", automationId },
          "call_permission_check_schedule_delete",
          mcpRun.abort,
        )
        const mcpTask = mcpRun.tools.permission_task_check_mcp_controlled_task
        if (!mcpTask) throw new Error("SessionLoop did not project the controlled MCP task Tool")
        let interruptedTaskError = ""
        try {
          await executeTool(
            mcpTask,
            { value: "durable-task" },
            "call_permission_check_mcp_task",
            mcpRun.abort,
          )
        } catch (error) {
          interruptedTaskError = error instanceof Error ? error.message : String(error)
        }
        if (!interruptedTaskError) throw new Error("Controlled MCP task did not interrupt its first transport")
        markActivity("matrix:mcp-task-interrupted")
        const beforeRestart = JSON.parse(await fs.readFile(mcpTaskState, "utf8")) as { calls: number; polls?: number }
        if (beforeRestart.calls !== 1 || beforeRestart.polls !== 1) {
          throw new Error(`Controlled MCP task interruption mismatch: ${JSON.stringify(beforeRestart)}`)
        }
        markActivity("matrix:history-start")
        const history = await PermissionAuthority.history()
        markActivity("matrix:history-done")
        // Model a process boundary before the outer Instance lease closes. The
        // pending Ask invocation owns a process-local runtime contract; a real
        // process exit drops that owner while its durable permission request
        // remains available to the restarted transports below.
        const defaultFile = await fs.readFile(defaultTarget, "utf8")
        markActivity("matrix:read-default")
        const askFile = await fs.readFile(askTarget, "utf8")
        markActivity("matrix:read-ask")
        const batchFile = await fs.readFile(batchTarget, "utf8")
        markActivity("matrix:read-batch")
        const pluginEvidence = (await fs.readFile(pluginState, "utf8")).trim().split("\n").map((line) => JSON.parse(line))
        markActivity("matrix:read-plugin")
        const pendingCount = (await PermissionAuthority.list()).length
        markActivity("matrix:list-pending")
        const collected = {
          defaultSessionID: defaultRun.session.id,
          askSessionID: askRun.session.id,
          defaultFile,
          askFile,
          mcpResult,
          mcpAppResult,
          batch: { result: batchResult, file: batchFile },
          computer: computerResult,
          browserStatus,
          schedule: { scheduled, run: scheduleRun, unscheduled },
          plugin: pluginEvidence,
          mcpTaskRecovery: {
            sessionID: mcpRun.session.id,
            assistantID: mcpRun.assistant.id,
            callID: "call_permission_check_mcp_task",
            interruptedTaskError,
          },
          transportRecovery: {
            sessionID: transportRun.session.id,
            requestID: transportRequest.id,
            toolCallID: transportRequest.toolCallID,
            target: transportTarget,
          },
          pending: pendingCount,
          events: history.map((row) => row.event_type),
          providers: history.map((row) => row.provider_kind),
          decisions: history.filter((row) => row.decision_scope).map((row) => row.decision_scope),
        }
        markActivity("matrix:return-evidence")
        return collected
      },
    })
    {
      using runtimeBoundary = RuntimeExecutionSettlement.acquireSettlementGate()
      runtimeBoundary.closeAdmission(["scheduler_automation_fire", "session_wake_loop"])
      runtimeBoundary.requestCancellation(["session_wake_loop"], new Error("Permission checker process boundary"))
      markActivity("matrix:runtime-settlement-start")
      await runtimeBoundary.waitForIdle(["scheduler_automation_fire", "session_wake_loop"], INACTIVITY_MS)
      markActivity("matrix:runtime-settlement-done")
      runtimeBoundary.commit()
    }
    SessionPrompt.cancel(
      evidence.mcpTaskRecovery.sessionID,
      projectDirectory,
      createExecutionCancellationOrigin({
        actor: "runtime",
        source: "process.shutdown",
        surface: "permission-modes-check",
        reason: "Permission checker process boundary",
        targetSessionID: evidence.mcpTaskRecovery.sessionID,
      }),
    )
    markActivity("matrix:prompt-cancelled")
    await SessionPrompt.waitForFinish(evidence.mcpTaskRecovery.sessionID)
    markActivity("matrix:prompt-finished")
    for (const sessionID of [
      evidence.defaultSessionID,
      evidence.askSessionID,
      evidence.transportRecovery.sessionID,
      evidence.mcpTaskRecovery.sessionID,
    ]) {
      SessionPrompt.cancel(
        sessionID,
        projectDirectory,
        createExecutionCancellationOrigin({
          actor: "runtime",
          source: "process.shutdown",
          surface: "permission-modes-check",
          reason: "Permission checker phase completed",
          targetSessionID: sessionID,
        }),
      )
      await SessionPrompt.waitForFinish(sessionID, projectDirectory)
      await SessionPrompt.release(sessionID, projectDirectory)
      markActivity(`matrix:dispose-runtime:${sessionID}`)
      await Instance.provide({ directory: projectDirectory, fn: () => SessionRuntimeContractStore.dispose(sessionID) })
    }
    await Instance.disposeAll()
    markActivity("matrix:process-boundary-complete")
    markActivity("matrix:evidence-collected")
    if (
      evidence.defaultFile !== "default-full-access" ||
      evidence.askFile !== "approved" ||
      !JSON.stringify(evidence.mcpResult).includes("controlled") ||
      !JSON.stringify(evidence.mcpAppResult).includes("controlled-mcp-app") ||
      evidence.batch.file !== "batch-child" ||
      !JSON.stringify(evidence.computer).includes("COMPUTER_SESSION_NOT_FOUND") ||
      !JSON.stringify(evidence.browserStatus).includes("permission-check-missing-session") ||
      !JSON.stringify(evidence.schedule).includes("Permission checker future schedule") ||
      !evidence.plugin.some((entry: any) => entry.phase === "before" && entry.tool === "write") ||
      !evidence.plugin.some((entry: any) => entry.phase === "after" && entry.tool === "write") ||
      evidence.pending !== 1 ||
      !evidence.providers.includes("mcp") ||
      !evidence.providers.includes("mcp_app") ||
      !evidence.providers.includes("browser") ||
      !evidence.providers.includes("computer")
    ) {
      throw new Error(`Permission checker result mismatch: ${JSON.stringify(evidence)}`)
    }
    await Instance.provide({
      directory: projectDirectory,
      fn: async () => {
        await MCP.disconnect(ComputerMCPBuiltin.ServerName)
        await Config.updateProjectPatch({ mcp: { [ComputerMCPBuiltin.ServerName]: { enabled: false } } })
      },
    })
    markActivity("matrix:cleanup-complete")
    for (const required of ["requested", "allowed_once", "full_access", "execution_started", "mcp_task_created", "mcp_task_status", "execution_succeeded"]) {
      if (required === "mcp_task_status") continue
      if (!evidence.events.includes(required)) throw new Error(`Permission checker missed ledger event ${required}`)
    }
    await Instance.provide({
      directory: projectDirectory,
      init: InstanceBootstrap,
      fn: async () => {
        markActivity("matrix:mcp-task-recovery-start")
        const recovered = await resolvePersistedSessionTools(
          evidence.mcpTaskRecovery.sessionID,
          evidence.mcpTaskRecovery.assistantID,
        )
        const taskTool = recovered.tools.permission_task_check_mcp_controlled_task
        if (!taskTool) throw new Error("Restarted SessionLoop did not project the controlled MCP task Tool")
        const result = await executeTool(
          taskTool,
          { value: "durable-task" },
          evidence.mcpTaskRecovery.callID,
          recovered.abort,
        )
        const state = JSON.parse(await fs.readFile(mcpTaskState, "utf8")) as { calls: number; polls?: number }
        const events = (await PermissionAuthority.history()).map((row) => row.event_type)
        if (
          !JSON.stringify(result).includes("durable-task") ||
          state.calls !== 1 ||
          state.polls !== 2 ||
          !events.includes("mcp_task_status")
        ) {
          throw new Error(`MCP task recovery mismatch: ${JSON.stringify({ result, state, events })}`)
        }
        Object.assign(evidence, { mcpTaskResult: result, mcpTaskState: state, events })
      },
    })
    SessionPrompt.cancel(
      evidence.mcpTaskRecovery.sessionID,
      projectDirectory,
      createExecutionCancellationOrigin({
        actor: "runtime",
        source: "process.shutdown",
        surface: "permission-modes-check",
        reason: "Permission checker recovered task completed",
        targetSessionID: evidence.mcpTaskRecovery.sessionID,
      }),
    )
    markActivity("recovery:prompt-cancelled")
    await SessionPrompt.waitForFinish(evidence.mcpTaskRecovery.sessionID, projectDirectory)
    await SessionPrompt.release(evidence.mcpTaskRecovery.sessionID, projectDirectory)
    await Instance.provide({
      directory: projectDirectory,
      fn: () => SessionRuntimeContractStore.dispose(evidence.mcpTaskRecovery.sessionID),
    })
    markActivity("recovery:runtime-disposed")
    const transports = await exerciseTransportClients({
      projectDirectory,
      ...evidence.transportRecovery,
    })
    if (
      transports.sse !== evidence.transportRecovery.requestID ||
      transports.cli !== evidence.transportRecovery.requestID ||
      transports.acp !== evidence.transportRecovery.toolCallID ||
      transports.file !== "transport-approved"
    ) {
      throw new Error(`Permission transport checker mismatch: ${JSON.stringify(transports)}`)
    }
    Object.assign(evidence, { transports })
    markActivity("transport:prompt-finished")
    markActivity()
    process.stdout.write(`${JSON.stringify({ status: "passed", ...evidence })}\n`)
  } finally {
    modelServer.stop(true)
    markActivity("cleanup:dispose-global-scheduler")
    await Scheduler.disposeGlobal({ inactivityTimeoutMilliseconds: INACTIVITY_MS })
    markActivity("cleanup:dispose-instances")
    await Instance.disposeAll()
    markActivity("cleanup:close-database")
    Database.close()
    await removeManagedDirectoryTree(root)
  }
}

async function runWithInactivityWatchdog() {
  let rejectInactive!: (error: Error) => void
  const inactive = new Promise<never>((_, reject) => {
    rejectInactive = reject
  })
  const timer = setInterval(() => {
    const inactiveFor = Date.now() - lastActivity
    if (inactiveFor >= INACTIVITY_MS) {
      rejectInactive(
        new Error(
          `Permission checker inactivity exceeded ${INACTIVITY_MS}ms (idle ${inactiveFor}ms after ${lastActivityLabel})`,
        ),
      )
    }
  }, 1_000)
  timer.unref()
  try {
    await Promise.race([main(), inactive])
  } finally {
    clearInterval(timer)
  }
}

await runWithInactivityWatchdog()
