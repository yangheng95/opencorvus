import z from "zod"
import { Tool } from "./tool"
import { Recurrence } from "@/scheduler/recurrence"
import { AutomationService } from "@/scheduler/automation-service"
import { EventService } from "@/scheduler/event-service"
import { Instance } from "@/project/instance"

const MatchSchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
const AutomationCreateFields = {
  action: z.literal("create"),
  name: z.string().min(1).describe("Short name for the automation"),
  recurrence: z
    .string()
    .min(1)
    .describe(
      "Anchored RFC 5545 recurrence, for example 'DTSTART;TZID=Asia/Singapore:20260727T090000\\nRRULE:FREQ=DAILY'",
    ),
  prompt: z.string().min(1).describe("The visible instruction to execute when triggered"),
  model: z
    .object({ providerID: z.string().min(1), modelID: z.string().min(1) })
    .optional()
    .describe("Optional provider and model override for each scheduled execution"),
  reasoningEffort: z.string().min(1).optional().describe("Optional model reasoning-effort override"),
  scope: z
    .enum(["session", "project", "global"])
    .default("session")
    .describe("Where the automation runs; session resumes this conversation"),
  projectIds: z
    .array(z.string().min(1))
    .optional()
    .describe("Exact project IDs for project scope; defaults to the current project"),
}
const AutomationUpdateFields = {
  action: z.literal("update"),
  automationId: z.string().describe("Exact Scheduled Automation ID returned by create or list"),
  name: z.string().min(1).optional(),
  recurrence: z.string().min(1).optional(),
  prompt: z.string().min(1).optional(),
  model: z
    .object({ providerID: z.string().min(1), modelID: z.string().min(1) })
    .nullable()
    .optional()
    .describe("Replacement provider and model override, or null to clear it"),
  reasoningEffort: z
    .string()
    .min(1)
    .nullable()
    .optional()
    .describe("Replacement reasoning-effort override, or null to clear it"),
  scope: z.enum(["session", "project", "global"]).optional().describe("Replacement execution scope"),
  projectIds: z.array(z.string().min(1)).optional().describe("Replacement project targets for project scope"),
}

const DESCRIPTION = `Create and manage Scheduled Automations from a user's scheduling request.

This tool and the left-dock Scheduled GUI are two interfaces over the same AutomationService records. Use this tool when a user asks in natural language to run something later or on a recurring schedule; do not redirect the user to the GUI.

Time actions use RFC 5545 recurrence rules:
- **create**: Create a Scheduled Automation. The default session scope resumes this exact conversation. Project scope opens one visible Chat per selected project. Global scope opens a visible global-inbox Chat.
- **list**: List all Scheduled Automations and their explicit targets.
- **update**: Change a Scheduled Automation's name, prompt, recurrence, model, reasoning effort, or target.
- **pause** / **resume**: Change whether a Scheduled Automation is eligible to run.
- **run**: Run a Scheduled Automation immediately without changing its active/paused status.
- **history**: List factual outcomes and visible Sessions for previous runs.
- **delete**: Permanently delete a Scheduled Automation.

Interpret relative dates such as "today" in the user's local time zone, then send one anchored RFC 5545 recurrence with an explicit TZID or UTC DTSTART. For actions that require an automationId, call **list** first when the exact ID is not already present in visible tool results; never guess an ID. Do not implement a scheduling request with shell cron, background sleeps, or task records.

Event actions remain separate because they react to Bus events rather than time:
- **create_event**, **list_event**, **cancel_event** manage event-triggered jobs.`

export const ScheduleTool = Tool.define("schedule", {
  description: DESCRIPTION,
  parameters: z.union([
    z.object({
      ...AutomationCreateFields,
      executionMode: z
        .enum(["local", "worktree"])
        .default("local")
        .describe("For project scope, run in each project directory or an isolated worktree"),
    }),
    z.object({ action: z.literal("list") }),
    z.object({
      ...AutomationUpdateFields,
      executionMode: z
        .enum(["local", "worktree"])
        .optional()
        .describe("Replacement project-directory or isolated-worktree execution mode"),
    }),
    z.object({
      action: z.enum(["pause", "resume", "run", "history", "delete"]),
      automationId: z.string().describe("Exact Scheduled Automation ID returned by create or list"),
    }),
    z.object({
      action: z.literal("create_event"),
      name: z.string().describe("Short name for the event task"),
      eventType: z.string().describe("Bus event type wildcard (for example: 'command.*' or 'session.updated')"),
      prompt: z.string().describe("The instruction to execute when the event matches"),
      match: MatchSchema.optional().describe("Optional event property matcher, e.g. {'properties.name':'init'}"),
      oneShot: z.boolean().default(false).describe("Execute only once"),
      cooldownMs: z.number().int().min(0).optional().describe("Minimum ms between runs for this job"),
    }),
    z.object({ action: z.literal("list_event") }),
    z.object({ action: z.literal("cancel_event"), jobId: z.string().describe("The event task ID") }),
  ]),
  async execute(params, ctx) {
    const projectID = Instance.project.id

    switch (params.action) {
      case "create": {
        const target =
          params.scope === "session"
            ? ({ scope: "session", sessionId: ctx.sessionID } as const)
            : params.scope === "project"
              ? ({ scope: "project", projectIds: params.projectIds ?? [projectID] } as const)
              : ({ scope: "global" } as const)
        const automation = await AutomationService.create({
          name: params.name,
          target,
          recurrence: params.recurrence,
          prompt: params.prompt,
          executionMode: params.scope === "session" ? "local" : params.executionMode,
          model: params.model,
          reasoningEffort: params.reasoningEffort,
        })
        return result(`Scheduled: ${params.name}`, {
          automationId: automation.id,
          name: params.name,
          target,
          executionMode: params.executionMode,
          model: params.model,
          reasoningEffort: params.reasoningEffort,
          recurrence: params.recurrence,
          description: Recurrence.describe(params.recurrence),
          nextRun: new Date(automation.nextRun).toISOString(),
        })
      }
      case "list": {
        const automations = AutomationService.list()
        return result(`${automations.length} scheduled automations`, {
          automations: automations.map((automation) => ({
            ...automation,
            prompt: automation.prompt.slice(0, 200),
            lastRun: automation.lastRun ? new Date(automation.lastRun).toISOString() : null,
            nextRun: new Date(automation.nextRun).toISOString(),
          })),
        })
      }
      case "update": {
        const target =
          params.scope === undefined
            ? undefined
            : params.scope === "session"
              ? ({ scope: "session", sessionId: ctx.sessionID } as const)
              : params.scope === "project"
                ? ({ scope: "project", projectIds: params.projectIds ?? [projectID] } as const)
                : ({ scope: "global" } as const)
        const automation = await AutomationService.update({
          id: params.automationId,
          name: params.name,
          target,
          recurrence: params.recurrence,
          prompt: params.prompt,
          executionMode: params.scope === "session" ? "local" : params.executionMode,
          model: params.model,
          reasoningEffort: params.reasoningEffort,
        })
        return result(`Updated: ${automation.name}`, automation)
      }
      case "pause":
      case "resume": {
        const status = params.action === "pause" ? "paused" : "active"
        const automation = await AutomationService.update({
          id: params.automationId,
          status,
        })
        return result(`${status === "paused" ? "Paused" : "Resumed"}: ${automation.name}`, automation)
      }
      case "run": {
        const run = await AutomationService.runNow(params.automationId)
        return result("Automation run completed", run)
      }
      case "history": {
        const runs = AutomationService.listRuns(params.automationId)
        return result(`${runs.length} automation runs`, { runs })
      }
      case "delete": {
        const deleted = AutomationService.remove(params.automationId)
        return result(`Deleted: ${deleted.name}`, {
          deleted: true,
          automationId: deleted.id,
          name: deleted.name,
        })
      }
      case "create_event": {
        const cooldownMs = params.cooldownMs ?? 0
        const job = await EventService.create({
          projectId: projectID,
          name: params.name,
          eventType: params.eventType,
          prompt: params.prompt,
          match: params.match,
          oneShot: params.oneShot,
          cooldownMs,
        })
        return result(`Event task created: ${params.name}`, {
          jobId: job.id,
          name: params.name,
          eventType: params.eventType,
          oneShot: params.oneShot,
          cooldownMs,
          match: params.match ?? {},
        })
      }
      case "list_event": {
        const jobs = EventService.list(projectID)
        return result(`${jobs.length} event tasks`, {
          jobs: jobs.map((job) => ({
            ...job,
            prompt: job.prompt.slice(0, 200),
            lastRun: job.lastRun ? new Date(job.lastRun).toISOString() : null,
          })),
        })
      }
      case "cancel_event": {
        const job = EventService.list(projectID).find((entry) => entry.id === params.jobId)
        if (!job) return result("Not found", { error: `Event task ${params.jobId} not found` })
        EventService.remove(params.jobId, projectID)
        return result(`Cancelled event task: ${job.name}`, {
          cancelled: true,
          jobId: params.jobId,
          name: job.name,
        })
      }
    }
  },
})

function result(title: string, value: unknown) {
  return { title, output: JSON.stringify(value), metadata: {} }
}
