import { Hono } from "hono"
import { describeRoute, resolver, validator } from "hono-openapi"
import { ChannelIngress, ChannelIngressInput, ChannelIngressResult } from "@/channel/ingress"
import { ChannelRegistry } from "@/channel/registry"
import { ChannelSupervisor } from "@/channel/supervisor"
import { ChannelAttachment } from "@/channel/attachment"
import { lazy } from "../../util/lazy"
import { errors } from "../error"
import z from "zod"
import { NotFoundError } from "../../storage/db"

export const ChannelRoutes = lazy(() =>
  new Hono()
    .get(
      "/",
      describeRoute({
        summary: "List channels",
        description: "Get available channel integrations, configuration status, and runtime status.",
        operationId: "channel.list",
        responses: {
          200: {
            description: "List of channels",
            content: {
              "application/json": {
                schema: resolver(ChannelRegistry.Info.array()),
              },
            },
          },
        },
      }),
      async (c) => {
        return c.json(await ChannelRegistry.list())
      },
    )
    .post(
      "/attachment",
      describeRoute({
        summary: "Create a temporary channel attachment URL",
        description:
          "Store a temporary attachment and return a signed public URL for channels that require remote image URLs.",
        operationId: "channel.attachment.create",
        responses: {
          200: {
            description: "Attachment created",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    id: z.string(),
                    url: z.string(),
                    mime: z.string(),
                    filename: z.string(),
                    expires_at: z.number(),
                  }),
                ),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator("json", ChannelAttachment.Input),
      async (c) => {
        return c.json(await ChannelAttachment.create(c.req.valid("json")))
      },
    )
    .get(
      "/attachment/:id",
      describeRoute({
        summary: "Read a temporary channel attachment",
        description: "Read a previously created temporary channel attachment by signed URL.",
        operationId: "channel.attachment.get",
        responses: {
          200: {
            description: "Attachment content",
            content: {
              "application/octet-stream": {
                schema: resolver(z.string()),
              },
            },
          },
          ...errors(404),
        },
      }),
      async (c) => {
        const id = c.req.param("id")
        if (!(await ChannelAttachment.authorize(id, c.req.query("e") ?? null, c.req.query("s") ?? null))) {
          throw new NotFoundError({ message: `Channel attachment not found: ${id}` })
        }
        const file = await ChannelAttachment.get(id)
        if (!file) throw new NotFoundError({ message: `Channel attachment not found: ${id}` })
        const maxAge = Math.max(0, Math.floor((file.expires_at - Date.now()) / 1000))
        return new Response(file.bytes, {
          headers: {
            "content-type": file.mime,
            "content-disposition": `inline; filename="${file.filename.replace(/"/g, "")}"`,
            "cache-control": `public, max-age=${maxAge}`,
          },
        })
      },
    )
    .post(
      "/message",
      describeRoute({
        summary: "Handle channel message",
        description: "Bridge an external channel message into the task board and panel control workflow.",
        operationId: "channel.message",
        responses: {
          200: {
            description: "Message handled",
            content: {
              "application/json": {
                schema: resolver(ChannelIngressResult),
              },
            },
          },
        },
      }),
      validator("json", ChannelIngressInput),
      async (c) => {
        return c.json(await ChannelIngress.message(c.req.valid("json")))
      },
    )
    .get(
      "/runtime",
      describeRoute({
        summary: "Get managed channel runtime",
        description: "Get managed channel runtime status for configured channel integrations.",
        operationId: "channel.runtime",
        responses: {
          200: {
            description: "Channel runtime status",
            content: {
              "application/json": {
                schema: resolver(
                  ChannelRegistry.Info.pick({ id: true })
                    .omit({ id: true })
                    .extend({
                      status: ChannelRegistry.Info.shape.runtime_status,
                      detail: ChannelRegistry.Info.shape.runtime_detail,
                      channels: ChannelRegistry.Info.shape.id.array(),
                      logs: ChannelRegistry.Info.shape.runtime_detail.array(),
                      running: ChannelRegistry.Info.shape.runtime_status.transform((item) => item === "running"),
                    }),
                ),
              },
            },
          },
        },
      }),
      async (c) => {
        const current = await ChannelSupervisor.status()
        return c.json(current)
      },
    )
    .post(
      "/runtime/restart",
      describeRoute({
        summary: "Restart managed channel runtime",
        description: "Restart the managed channel runtime with the current config.",
        operationId: "channel.runtime.restart",
        responses: {
          200: {
            description: "Restarted channel runtime",
            content: {
              "application/json": {
                schema: resolver(
                  ChannelRegistry.Info.pick({ id: true })
                    .omit({ id: true })
                    .extend({
                      status: ChannelRegistry.Info.shape.runtime_status,
                      detail: ChannelRegistry.Info.shape.runtime_detail,
                      channels: ChannelRegistry.Info.shape.id.array(),
                      logs: ChannelRegistry.Info.shape.runtime_detail.array(),
                      running: ChannelRegistry.Info.shape.runtime_status.transform((item) => item === "running"),
                    }),
                ),
              },
            },
          },
        },
      }),
      async (c) => {
        return c.json(await ChannelSupervisor.restart())
      },
    ),
)
