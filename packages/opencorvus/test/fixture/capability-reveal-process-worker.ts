import fs from "node:fs/promises"
import path from "node:path"
import { tool } from "ai"
import z from "zod"
import { capabilityRef } from "@opencorvus-ai/util/capability-ref"
import { Instance } from "@/project/instance"
import { bindHarnessProjection, createHarnessGrantSet } from "@/capability/harness-projection"
import { CapabilitySearchInput } from "@/capability/descriptor"
import { CapabilityRevealConflictError, createCapabilityRevealOwner } from "@/capability/reveal-owner"

type WorkerState = {
  occurrenceID: string
  sessionID: string
  messageID: string
  callID: string
  toolPartID: string
  binding: { snapshot_ref: string; snapshot_hash: string }
}

const [projectDirectory, statePath, workerID] = process.argv.slice(2)
if (!projectDirectory || !statePath || !workerID) {
  throw new Error("Capability reveal process worker requires project directory, state path, and worker ID.")
}

const state = JSON.parse(await fs.readFile(statePath, "utf8")) as WorkerState
const readyPath = `${statePath}.${workerID}.ready`
const releasePath = `${statePath}.release`
const searchRef = capabilityRef({
  kind: "tool",
  source: "platform",
  owner_ref: "tool-registry",
  local_ref: "capability_search",
})
const readRef = capabilityRef({
  kind: "tool",
  source: "platform",
  owner_ref: "tool-registry",
  local_ref: "read",
})

await Instance.provide({
  directory: path.resolve(projectDirectory),
  fn: async () => {
    const harness = bindHarnessProjection(
      createHarnessGrantSet({
        context: { kind: "conversation", agent_id: "work" },
        owner_revision: "a".repeat(64),
        grants: [searchRef, readRef].map((ref) => ({ ref, access: "discover_execute" as const })),
      }),
      state.binding,
    )
    const owner = createCapabilityRevealOwner({
      projectID: Instance.project.id,
      model: {} as never,
      occurrenceID: state.occurrenceID,
      harness,
      baseDefinition: {
        definitionDigest: "e".repeat(64),
        payloadChars: 120,
        payloadTokens: 30,
      },
      async materialize(_requestedRef, executableRef) {
        await fs.writeFile(readyPath, workerID)
        const deadline = Date.now() + 20_000
        while (true) {
          try {
            await fs.access(releasePath)
            break
          } catch {
            if (Date.now() >= deadline) throw new Error("Capability reveal process barrier timed out.")
            await new Promise((resolve) => setTimeout(resolve, 20))
          }
        }
        return {
          providerName: executableRef.local_ref,
          executableRef,
          materializerBindingDigest: "d".repeat(64),
          tool: tool({
            description: "Read one exact file.",
            inputSchema: z.object({ path: z.string() }).strict(),
            async execute() {
              return { output: "unused", title: "Read", metadata: {} }
            },
          }),
        }
      },
    })
    const params = CapabilitySearchInput.parse({ queries: ["read"], exact_refs: [readRef] })
    try {
      const result = await owner.execute(params, {
        callID: state.callID,
        messageID: state.messageID,
        sessionID: state.sessionID,
        toolPartID: state.toolPartID,
      })
      process.stdout.write(`CAPABILITY_REVEAL_RESULT=${JSON.stringify({ status: "fulfilled", metadata: result.metadata })}\n`)
    } catch (error) {
      if (!(error instanceof CapabilityRevealConflictError)) throw error
      process.stdout.write(
        `CAPABILITY_REVEAL_RESULT=${JSON.stringify({ status: "conflict", name: error.name, message: error.message })}\n`,
      )
    }
  },
})
