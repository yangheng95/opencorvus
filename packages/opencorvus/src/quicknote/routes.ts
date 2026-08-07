import { Hono } from "hono"
import { describeRoute, resolver, validator } from "hono-openapi"
import { createNote } from "./service"
import { MAX_CONTENT_LENGTH } from "./text-processor"
import { lazy } from "@/util/lazy"
import z from "zod"
import { errors } from "@/server/error"

const CreateQuickNoteRequest = z
  .object({
    content: z.string().min(1).max(MAX_CONTENT_LENGTH),
  })
  .meta({ ref: "CreateQuickNoteRequest" })

const CreateQuickNoteResponse = z
  .object({
    code: z.literal(200),
    data: z.object({
      note_id: z.string(),
      summary: z.string(),
    }),
  })
  .meta({ ref: "CreateQuickNoteResponse" })

export const QuickNoteRoutes = lazy(() =>
  new Hono().post(
    "/notes",
    describeRoute({
      summary: "Create QuickNote",
      description: "Create a quick note from plain text content.",
      operationId: "quicknote.create",
      responses: {
        200: {
          description: "QuickNote created successfully",
          content: {
            "application/json": {
              schema: resolver(CreateQuickNoteResponse),
            },
          },
        },
        ...errors(400),
      },
    }),
    validator("json", CreateQuickNoteRequest),
    async (c) => {
      const { content } = c.req.valid("json")
      const result = createNote({ content })

      return c.json({ code: 200, data: result })
    },
  ),
)
