import { PermissionAuthority } from "@/permission/authority"
import { Hono } from "hono"
import { describeRoute, resolver, validator } from "hono-openapi"
import z from "zod"
import { errors } from "../error"
import { lazy } from "../../util/lazy"

export const PermissionRoutes = lazy(() =>
  new Hono()
    .post(
      "/:requestID/reply",
      describeRoute({
        summary: "Decide a pending permission request",
        operationId: "permission.reply",
        responses: {
          200: {
            description: "Committed permission decision",
            content: { "application/json": { schema: resolver(PermissionAuthority.Resolution) } },
          },
          ...errors(400, 404),
        },
      }),
      validator("param", z.object({ requestID: PermissionAuthority.Identity })),
      validator("json", PermissionAuthority.UserReply.omit({ requestID: true, userInput: true })),
      async (c) => {
        const requestID = c.req.valid("param").requestID
        const input = c.req.valid("json")
        return c.json(
          await PermissionAuthority.replyUser({
            requestID,
            ...input,
            userInput: {
              surface: "http.permission",
              text: input.message?.trim() || `Permission decision: ${input.decision}`,
              structured: { decision: input.decision },
            },
          }),
        )
      },
    )
    .get(
      "/",
      describeRoute({
        summary: "List durable pending permission requests",
        operationId: "permission.list",
        responses: {
          200: {
            description: "Pending permission requests",
            content: { "application/json": { schema: resolver(PermissionAuthority.Request.array()) } },
          },
        },
      }),
      async (c) => c.json(await PermissionAuthority.list()),
    )
    .get(
      "/history",
      describeRoute({
        summary: "List permission ledger history",
        operationId: "permission.history",
        responses: {
          200: {
            description: "Append-only permission ledger",
            content: { "application/json": { schema: resolver(PermissionAuthority.LedgerEvent.array()) } },
          },
        },
      }),
      async (c) => c.json(await PermissionAuthority.history()),
    )
    .get(
      "/grants",
      describeRoute({
        summary: "List active permission grants",
        operationId: "permission.grants",
        responses: {
          200: {
            description: "Active exact-scope grants",
            content: { "application/json": { schema: resolver(PermissionAuthority.LedgerEvent.array()) } },
          },
        },
      }),
      async (c) => c.json(await PermissionAuthority.grants()),
    )
    .post(
      "/grants/:grantID/revoke",
      describeRoute({
        summary: "Revoke an active permission grant",
        operationId: "permission.revoke",
        responses: {
          200: { description: "Grant revoked", content: { "application/json": { schema: resolver(z.boolean()) } } },
          ...errors(404),
        },
      }),
      validator("param", z.object({ grantID: PermissionAuthority.Identity })),
      async (c) => {
        await PermissionAuthority.revoke(c.req.valid("param").grantID)
        return c.json(true)
      },
    ),
)
