import { Hono } from "hono"
import { describeRoute, resolver, validator } from "hono-openapi"
import z from "zod"
import { MissionSkillCatalog } from "@/mission-skill/catalog"
import { MissionSkillRoots } from "@/mission-skill/roots"
import { errors } from "../error"
import { assertActiveProjectSession } from "../active-project-session"

export function MissionSkillRoutes() {
  const scopeQuery = z.object({
    sessionID: z
      .string()
      .optional()
      .meta({ description: "Optional active-project session id used to preserve project scope identity" }),
  })

  return new Hono()
    .get(
      "/catalog",
      describeRoute({
        summary: "List Mission Skills",
        description:
          "Returns the strict built-in, user-global, and current-project Mission Skill summaries available to the native Mission agent.",
        operationId: "missionSkill.catalog",
        responses: {
          200: {
            description: "Mission Skill catalog",
            content: {
              "application/json": {
                schema: resolver(MissionSkillCatalog.Response),
              },
            },
          },
          ...errors(400, 404, 500),
        },
      }),
      validator("query", scopeQuery),
      async (c) => {
        const { sessionID } = c.req.valid("query")
        if (sessionID) await assertActiveProjectSession(sessionID)
        return c.json(await MissionSkillCatalog.summaries({ refresh: true }))
      },
    )
    .get(
      "/settings",
      describeRoute({
        summary: "Inspect Mission Skill Settings",
        description:
          "Returns Mission Skill source metadata and canonical editable roots for the dedicated Settings surface.",
        operationId: "missionSkill.settings",
        responses: {
          200: {
            description: "Mission Skill Settings catalog",
            content: {
              "application/json": {
                schema: resolver(MissionSkillCatalog.SettingsResponse),
              },
            },
          },
          ...errors(400, 404, 500),
        },
      }),
      validator("query", scopeQuery),
      async (c) => {
        const { sessionID } = c.req.valid("query")
        if (sessionID) await assertActiveProjectSession(sessionID)
        return c.json(await MissionSkillCatalog.settings({ refresh: true }))
      },
    )
    .post(
      "/directory",
      describeRoute({
        summary: "Prepare Mission Skill Directory",
        description:
          "Creates one canonical Mission Skill directory on an explicit Settings action and returns its path.",
        operationId: "missionSkill.directory",
        responses: {
          200: {
            description: "Prepared Mission Skill directory",
            content: {
              "application/json": {
                schema: resolver(MissionSkillCatalog.DirectoryResponse),
              },
            },
          },
          ...errors(400, 404, 500),
        },
      }),
      validator("query", scopeQuery),
      validator("json", MissionSkillCatalog.DirectoryRequest),
      async (c) => {
        const { sessionID } = c.req.valid("query")
        if (sessionID) await assertActiveProjectSession(sessionID)
        const { source } = c.req.valid("json")
        return c.json({ path: await MissionSkillRoots.ensure(source) })
      },
    )
}
