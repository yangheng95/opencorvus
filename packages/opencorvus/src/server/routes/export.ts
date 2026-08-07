import { Session } from "@/session"
import { Hono } from "hono"
import { describeRoute, resolver, validator } from "hono-openapi"
import z from "zod"
import { errors } from "../error"
import { lazy } from "../../util/lazy"
import { getActiveProjectSession } from "../active-project-session"

/**
 * Export routes only expose session transcript export. Task JSON/archive
 * export and task archive import were retired with the overlay entry point.
 */
export const ExportRoutes = lazy(() =>
  new Hono().get(
    "/session/:sessionID",
    describeRoute({
      summary: "Export session messages",
      operationId: "export.session",
      responses: {
        200: {
          description: "Session metadata and messages",
          content: {
            "application/json": {
              schema: resolver(
                z.object({
                  session: z.unknown(),
                  messages: z.unknown().array(),
                }),
              ),
            },
          },
        },
        ...errors(404),
      },
    }),
    validator("param", z.object({ sessionID: z.string() })),
    async (c) => {
      const sessionID = c.req.valid("param").sessionID
      const session = await getActiveProjectSession(sessionID)
      const messages = await Session.messages({ sessionID })

      return c.json({
        session: {
          id: session.id,
          title: session.title,
          time: session.time,
        },
        messages,
      })
    },
  ),
)
