import z from "zod"

export const SchedulerEventWakeReason = z.object({
  source: z.literal("scheduler.event"),
  jobID: z.string(),
  jobName: z.string(),
  fireID: z.string(),
  eventType: z.string(),
  oneShot: z.boolean(),
})

export type SchedulerEventWakeReason = z.infer<typeof SchedulerEventWakeReason>

export function schedulerEventWakeReasonJSONPath(field: keyof SchedulerEventWakeReason): string {
  return `$.extra.wake_reason.${field}`
}
