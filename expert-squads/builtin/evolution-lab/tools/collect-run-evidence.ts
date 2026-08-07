import { writeFile } from "node:fs/promises"
import path from "node:path"
import { canonicalTaskRunEvidenceJSON, tool } from "@opencorvus-ai/plugin"
export default tool({
  description:
    "Collect one exact terminal Task run as canonical immutable evidence; only explicitly selected Message bodies are disclosed.",
  args: {
    task_id: tool.schema.string().min(1),
    terminal_occurrence: tool.schema.discriminatedUnion("status", [
      tool.schema
        .object({
          status: tool.schema.literal("completed"),
          lifecycle: tool.schema
            .object({
              terminalEventID: tool.schema.string().min(1),
              terminalStatus: tool.schema.literal("completed"),
              timeCompleted: tool.schema.number().int().positive(),
              terminalError: tool.schema.string().min(1).optional(),
              terminalReason: tool.schema.literal("interrupted").optional(),
            })
            .strict(),
          completion_decision_artifact_id: tool.schema.string().min(1),
        })
        .strict(),
      tool.schema
        .object({
          status: tool.schema.enum(["failed", "cancelled"]),
          lifecycle: tool.schema
            .object({
              terminalEventID: tool.schema.string().min(1),
              terminalStatus: tool.schema.enum(["failed", "cancelled"]),
              timeCompleted: tool.schema.number().int().positive(),
              terminalError: tool.schema.string().min(1).optional(),
              terminalReason: tool.schema.literal("interrupted").optional(),
            })
            .strict(),
          completion_decision_artifact_id: tool.schema.null(),
        })
        .strict(),
      tool.schema
        .object({
          status: tool.schema.literal("inactive"),
          last_activity: tool.schema
            .object({
              source: tool.schema.enum([
                "task",
                "session",
                "message",
                "part",
                "engine_artifact",
                "interaction_request",
              ]),
              id: tool.schema.string().min(1),
              time_updated: tool.schema.number().int().nonnegative(),
            })
            .strict(),
        })
        .strict(),
      tool.schema
        .object({
          status: tool.schema.literal("awaiting_interaction"),
          interaction_request_id: tool.schema.string().min(1),
          time_created: tool.schema.number().int().nonnegative(),
        })
        .strict(),
    ]),
    selected_messages: tool.schema.array(
      tool.schema.object({ session_id: tool.schema.string().min(1), message_id: tool.schema.string().min(1) }).strict(),
    ),
  },
  async execute(args, context) {
    const bundle = await context.host.taskRuns.collect({
      taskID: args.task_id,
      terminalOccurrence: args.terminal_occurrence,
      selectedMessageLocators: args.selected_messages,
    })
    const stage = await context.host.taskArtifacts.stage({ trees: ["run-evidence"] })
    const relativePath = "run-evidence.json"
    await writeFile(
      path.join(stage.treeDirectories["run-evidence"]!, relativePath),
      canonicalTaskRunEvidenceJSON(bundle),
    )
    const publication = await context.host.taskArtifacts.publish(stage, {
      snapshot_kind: "catalog",
      files: [{ tree: "run-evidence", path: relativePath, media_type: "application/json" }],
    })
    return JSON.stringify({
      canonical_sha256: bundle.canonical_sha256,
      resource_set: { snapshot: publication.snapshot, tree: "run-evidence" },
      resource: publication.artifacts[0],
    })
  },
})
