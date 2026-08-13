import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { describeRoute, resolver, validator } from "hono-openapi"
import z from "zod"
import {
  MailboxDeleteResult,
  MailboxItemNotFoundError,
  MailboxPage,
  MailboxReadAllResult,
  MailboxUpdateAction,
  MailboxView,
  acknowledgeAllMailboxItemsRead,
  acknowledgeMailboxItem,
  deleteMailboxItems,
  listMailbox,
} from "@/engine/mailbox"
import { lazy } from "@/util/lazy"
import { errors } from "../error"

const MailboxListQuery = z
  .object({
    view: MailboxView.optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    cursorCreatedAt: z.coerce.number().int().positive().optional(),
    cursorID: z.string().min(1).optional(),
  })
  .refine((query) => (query.cursorCreatedAt === undefined) === (query.cursorID === undefined), {
    message: "cursorCreatedAt and cursorID must be provided together",
    path: ["cursorCreatedAt"],
  })

const MailboxActionInput = z.object({ action: MailboxUpdateAction })

const MailboxDeleteManyInput = z
  .object({ messageIDs: z.array(z.string().min(1)).min(1) })
  .refine((input) => new Set(input.messageIDs).size === input.messageIDs.length, {
    message: "messageIDs must be unique",
    path: ["messageIDs"],
  })

const MailboxActionResult = z.object({
  changed: z.boolean(),
  eventID: z.string().optional(),
  messageID: z.string().min(1),
  action: MailboxUpdateAction,
})

const MailboxDeleteItemResult = z.object({
  changed: z.boolean(),
  eventID: z.string().optional(),
  messageID: z.string().min(1),
  action: z.literal("delete"),
})

export const MailboxRoutes = lazy(() =>
  new Hono()
    .get(
      "/",
      describeRoute({
        summary: "List the global mailbox",
        description:
          "Return the durable Mailbox projection across registered projects, with each item carrying its owning project directory. Active and archived views fold acknowledgement events over protocol history.",
        operationId: "mailbox.list",
        responses: {
          200: {
            description: "Mailbox page",
            content: { "application/json": { schema: resolver(MailboxPage) } },
          },
          ...errors(400),
        },
      }),
      validator("query", MailboxListQuery),
      async (c) => {
        const query = c.req.valid("query")
        return c.json(
          listMailbox({
            view: query.view,
            limit: query.limit,
            cursor:
              query.cursorCreatedAt !== undefined && query.cursorID
                ? { createdAt: query.cursorCreatedAt, id: query.cursorID }
                : undefined,
          }),
        )
      },
    )
    .patch(
      "/read-all",
      describeRoute({
        summary: "Mark all active mailbox items as read",
        description: "Append read acknowledgements for every active unread item across the registered-project Mailbox.",
        operationId: "mailbox.readAll",
        responses: {
          200: {
            description: "Mailbox read-all result",
            content: { "application/json": { schema: resolver(MailboxReadAllResult) } },
          },
        },
      }),
      async (c) => c.json(acknowledgeAllMailboxItemsRead()),
    )
    .delete(
      "/",
      describeRoute({
        summary: "Delete selected mailbox items",
        description:
          "Append terminal delete acknowledgements for exact project mailbox item IDs while preserving their source Task and protocol history.",
        operationId: "mailbox.deleteMany",
        responses: {
          200: {
            description: "Mailbox batch-delete result",
            content: { "application/json": { schema: resolver(MailboxDeleteResult) } },
          },
          ...errors(400, 404),
        },
      }),
      validator("json", MailboxDeleteManyInput),
      async (c) => {
        try {
          return c.json(
            deleteMailboxItems({
              messageIDs: c.req.valid("json").messageIDs,
            }),
          )
        } catch (error) {
          if (error instanceof MailboxItemNotFoundError) throw new HTTPException(404, { message: error.message })
          throw error
        }
      },
    )
    .delete(
      "/:messageID",
      describeRoute({
        summary: "Delete a mailbox item",
        description:
          "Append a terminal delete acknowledgement for one project mailbox item while preserving its source Task and protocol history.",
        operationId: "mailbox.delete",
        responses: {
          200: {
            description: "Mailbox delete result",
            content: { "application/json": { schema: resolver(MailboxDeleteItemResult) } },
          },
          ...errors(400, 404),
        },
      }),
      validator("param", z.object({ messageID: z.string().min(1) })),
      async (c) => {
        const messageID = c.req.valid("param").messageID
        try {
          const result = deleteMailboxItems({
            messageIDs: [messageID],
          })
          return c.json({ changed: result.changedCount === 1, messageID, action: "delete" as const })
        } catch (error) {
          if (error instanceof MailboxItemNotFoundError) throw new HTTPException(404, { message: error.message })
          throw error
        }
      },
    )
    .patch(
      "/:messageID",
      describeRoute({
        summary: "Update a mailbox item",
        description: "Append a read, archive, or restore acknowledgement for one project mailbox item.",
        operationId: "mailbox.acknowledge",
        responses: {
          200: {
            description: "Mailbox acknowledgement result",
            content: { "application/json": { schema: resolver(MailboxActionResult) } },
          },
          ...errors(400, 404),
        },
      }),
      validator("param", z.object({ messageID: z.string().min(1) })),
      validator("json", MailboxActionInput),
      async (c) => {
        const messageID = c.req.valid("param").messageID
        try {
          return c.json(
            acknowledgeMailboxItem({
              messageID,
              action: c.req.valid("json").action,
            }),
          )
        } catch (error) {
          if (error instanceof MailboxItemNotFoundError) throw new HTTPException(404, { message: error.message })
          throw error
        }
      },
    ),
)
