import { Hono } from "hono"
import { describeRoute, resolver, validator } from "hono-openapi"
import { z } from "zod"
import { sessionRole, taskIDForSession } from "@/engine/task-session-lineage"
import { ComputerError } from "@/mcp/computer/errors"
import { computerRuntimeScopeIdentity } from "@/mcp/computer/runtime-scope"
import { ComputerHostRuntime } from "@/mcp/computer/host-runtime"
import { HostSessionMcpRuntime } from "@/mcp/host-session-runtime"
import { badRequestBody, errors } from "../error"

const ComputerOwnershipInput = z
  .object({
    sessionID: z.string().trim().min(1),
    computerID: z.string().trim().min(1),
    displayID: z.string().trim().min(1),
  })
  .strict()

const ComputerOwnershipResponse = z
  .object({
    ownership: z.enum(["human", "agent"]),
    computerId: z.string(),
    displayId: z.string(),
    driverVersion: z.string(),
    desktopPreserved: z.literal(true).optional(),
    freshObservationRequired: z.literal(true).optional(),
  })
  .strict()

export function computerRuntimeScopeForSession(sessionID: string): string {
  const taskID = taskIDForSession(sessionID)
  if (!taskID) return computerRuntimeScopeIdentity({ ownerKind: "session", sessionID })
  return computerRuntimeScopeIdentity({
    ownerKind: sessionRole(sessionID) === "orchestrator" ? "orchestrator" : "worker",
    taskID,
    sessionID,
  })
}

export function ComputerRoutes() {
  return new Hono()
    .post(
      "/status",
      describeRoute({
        summary: "Get Computer desktop ownership",
        description: "Read the exact host-owned desktop session identity and current input owner.",
        operationId: "computer.status",
        responses: {
          200: {
            description: "Current Computer ownership",
            content: { "application/json": { schema: resolver(ComputerOwnershipResponse) } },
          },
          ...errors(400, 500),
        },
      }),
      validator("json", ComputerOwnershipInput),
      async (c) => {
        const input = c.req.valid("json")
        try {
          return c.json(
            ComputerHostRuntime.status({
              runtimeScope: computerRuntimeScopeForSession(input.sessionID),
              computerId: input.computerID,
              displayId: input.displayID,
            }),
          )
        } catch (error) {
          if (error instanceof ComputerError) return c.json(badRequestBody(error.message), 400)
          throw error
        }
      },
    )
    .post(
      "/takeover",
      describeRoute({
        summary: "Take over the current desktop",
        description:
          "Revoke the exact Agent run and disconnect its adapter while preserving the native desktop session for the user.",
        operationId: "computer.takeover",
        responses: {
          200: {
            description: "Human Computer ownership",
            content: { "application/json": { schema: resolver(ComputerOwnershipResponse) } },
          },
          ...errors(400, 500),
        },
      }),
      validator("json", ComputerOwnershipInput),
      async (c) => {
        const input = c.req.valid("json")
        try {
          const runtimeScope = computerRuntimeScopeForSession(input.sessionID)
          const result = await ComputerHostRuntime.takeover({
            runtimeScope,
            computerId: input.computerID,
            displayId: input.displayID,
          })
          await HostSessionMcpRuntime.disconnectComputer(input.sessionID)
          return c.json(result)
        } catch (error) {
          if (error instanceof ComputerError) return c.json(badRequestBody(error.message), 400)
          throw error
        }
      },
    )
    .post(
      "/return",
      describeRoute({
        summary: "Return the current desktop to Agent automation",
        description:
          "Issue a new Agent run capability for the preserved desktop session. The next adapter starts without observation authority.",
        operationId: "computer.return",
        responses: {
          200: {
            description: "New Agent Computer ownership",
            content: { "application/json": { schema: resolver(ComputerOwnershipResponse) } },
          },
          ...errors(400, 500),
        },
      }),
      validator("json", ComputerOwnershipInput),
      async (c) => {
        const input = c.req.valid("json")
        try {
          return c.json(
            ComputerHostRuntime.returnControl({
              runtimeScope: computerRuntimeScopeForSession(input.sessionID),
              computerId: input.computerID,
              displayId: input.displayID,
            }),
          )
        } catch (error) {
          if (error instanceof ComputerError) return c.json(badRequestBody(error.message), 400)
          throw error
        }
      },
    )
}
