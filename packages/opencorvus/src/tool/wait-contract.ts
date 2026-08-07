import z from "zod"

export const WAIT_MIN_MS = 1_000
export const WAIT_MAX_MS = 20 * 60 * 1000

export const WaitToolParameters = z.object({
  duration_ms: z
    .number()
    .int()
    .min(WAIT_MIN_MS)
    .max(WAIT_MAX_MS)
    .describe(
      `Pause length in milliseconds. Minimum ${WAIT_MIN_MS}, maximum ${WAIT_MAX_MS}. ` +
        "Derive the duration from the concrete external event. When the Task, campaign, benchmark, or supervisor exposes an inactivity deadline, schedule the wake strictly before that deadline and leave time for wake dispatch plus evidence production. The maximum is a bound, not a default.",
    ),
  reason: z
    .string()
    .min(1)
    .describe("Concrete external event you are waiting for and why no in-task dispatch is responsible until it lands."),
})

export const WaitToolDescription =
  "One-shot deliberate nonblocking pause. Schedules a durable wake for the stated number of milliseconds and returns immediately; the future wake re-enters the Task Session with a fresh visible message. Derive the duration from the concrete external event. If the Task, campaign, benchmark, or supervisor exposes an inactivity deadline, the wake must occur strictly before it with enough remaining time to dispatch and publish real evidence; the maximum duration is never a default. If neither the external event nor a governing inactivity window justifies an exact duration, waiting is not the responsible action. USE WHEN: evidence shows there is nothing dispatchable RIGHT NOW, AND the unblocking event is a concretely external event. NOT a polling primitive — never chain wait calls to re-inspect state on a fixed cadence. NOT a substitute for asking the user, reporting a blocker, or refreshing available evidence when those actions are responsible."
