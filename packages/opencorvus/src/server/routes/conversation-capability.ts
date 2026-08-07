import { ConversationCapability, type ConversationAgentID } from "@/conversation/capability"
import { Hono } from "hono"
import { describeRoute, resolver, validator } from "hono-openapi"
import { badRequestBody, errors } from "../error"

function harnessLabel(experience: ConversationAgentID): string {
  return experience === "chat" ? "Chat" : "Work"
}

export function ConversationCapabilityRoutes(experience: ConversationAgentID) {
  const label = harnessLabel(experience)
  const settingsSchema = ConversationCapability.settingsSchema(experience)
  return new Hono()
    .get(
      "/capability",
      describeRoute({
        summary: `Inspect native ${label} capabilities`,
        description: `Returns the fixed native ${label} harness tool declaration and its project-owned Skill and MCP assignments. This route never reads an active Expert Squad or session overlay.`,
        operationId: `${experience}.capability.get`,
        responses: {
          200: {
            description: `Native ${label} capability settings`,
            content: { "application/json": { schema: resolver(settingsSchema) } },
          },
          ...errors(500),
        },
      }),
      async (c) => c.json(await ConversationCapability.settings(experience)),
    )
    .patch(
      "/capability",
      describeRoute({
        summary: `Update native ${label} capability assignments`,
        description: `Atomically assigns or unassigns one project-owned Skill or MCP server reference for the fixed native ${label} harness.`,
        operationId: `${experience}.capability.update`,
        responses: {
          200: {
            description: `Updated native ${label} capability settings`,
            content: { "application/json": { schema: resolver(settingsSchema) } },
          },
          ...errors(400, 500),
        },
      }),
      validator("json", ConversationCapability.Update),
      async (c) => {
        try {
          return c.json(await ConversationCapability.update(experience, c.req.valid("json")))
        } catch (error) {
          if (ConversationCapability.InvalidAssignmentError.isInstance(error)) {
            return c.json(badRequestBody(error.data.message), 400)
          }
          throw error
        }
      },
    )
}
