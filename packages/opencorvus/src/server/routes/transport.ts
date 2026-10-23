import { Hono } from "hono"
import { describeRoute, resolver } from "hono-openapi"
import { z } from "zod"
import { STREAM_SOCKET_METHOD_HEADER, STREAM_SOCKET_TARGET_HEADER } from "@opencorvus-ai/transport-protocol"
import type { StreamSocketTransport } from "../stream-socket"

export function StreamTransportRoutes() {
  return new Hono().post(
    "/stream",
    describeRoute({
      operationId: "global.prepareStream",
      summary: "Prepare a UI event stream",
      description:
        "Authenticate a short-lived, single-use WebSocket ticket. The target GET or POST executes only after the socket opens, through its original HTTP route. The request body and Content-Type are forwarded unchanged. This is a physical transport adapter; public SSE routes remain canonical.",
      parameters: [
        {
          in: "header",
          name: STREAM_SOCKET_METHOD_HEADER,
          required: true,
          schema: { type: "string", enum: ["GET", "POST"] },
        },
        {
          in: "header",
          name: STREAM_SOCKET_TARGET_HEADER,
          required: true,
          schema: { type: "string" },
          description: "Server-relative target path and query",
        },
      ],
      requestBody: {
        required: false,
        content: {
          "application/json": { schema: {} },
          "application/octet-stream": { schema: { type: "string", format: "binary" } },
          "text/plain": { schema: { type: "string" } },
        },
      },
      responses: {
        200: {
          description: "Ticket, consumed through the ticket.<value> WebSocket subprotocol within ten seconds",
          content: { "application/json": { schema: resolver(z.object({ ticket: z.string().uuid() })) } },
        },
        400: { description: "Invalid stream target or method" },
        401: { description: "Server authentication required" },
        503: { description: "This host has no WebSocket listener" },
      },
    }),
    (c) => {
      const transport = (c.env as { streamSockets?: StreamSocketTransport } | undefined)?.streamSockets
      if (!transport)
        return c.json(
          {
            name: "StreamTransportError",
            data: { code: "listener-required", message: "A WebSocket listener is required" },
          },
          503,
        )
      return transport.prepare(c.req.raw)
    },
  )
}
