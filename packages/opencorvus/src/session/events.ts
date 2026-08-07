import { BusEvent } from "@/bus/bus-event"
import z from "zod"
import { SessionStatus } from "./status"
import { Message } from "./message"
import {
  FailureOccurrenceAnchor,
  ProcessorObservationFailure,
  ToolPersistenceConvergenceFailure,
  sameFailureOccurrence,
} from "./tool-failure-cause"

export namespace SessionEvents {
  export const Error = BusEvent.define(
    "session.error",
    z
      .object({
        sessionID: z.string(),
        orderKey: SessionStatus.LifecycleOrderKey,
        channel: z.string().optional(),
        resolvedRole: z.string().optional(),
        parentSessionID: z.string().optional(),
        error: Message.Assistant.shape.error.unwrap(),
        failureOccurrence: FailureOccurrenceAnchor.optional(),
        convergenceFailure: ToolPersistenceConvergenceFailure.optional(),
        observationFailures: z.array(ProcessorObservationFailure).optional(),
        summary: z.string().optional(),
      })
      .strict()
      .superRefine((value, ctx) => {
        const occurrence = value.failureOccurrence
        if (!occurrence) {
          if (value.convergenceFailure || value.observationFailures?.length) {
            ctx.addIssue({
              code: "custom",
              message: "Processor failure event evidence requires a failure occurrence",
              path: ["failureOccurrence"],
            })
          }
          return
        }
        if (occurrence.session_id !== value.sessionID || occurrence.error_name !== value.error.name) {
          ctx.addIssue({
            code: "custom",
            message: "Session error occurrence must match its Session and canonical error",
            path: ["failureOccurrence"],
          })
        }
        if (
          value.convergenceFailure &&
          !sameFailureOccurrence(value.convergenceFailure.failure_occurrence, occurrence)
        ) {
          ctx.addIssue({
            code: "custom",
            message: "Tool convergence event evidence must reference the event failure occurrence",
            path: ["convergenceFailure", "failure_occurrence"],
          })
        }
      }),
    { tier: 1 },
  )
}
