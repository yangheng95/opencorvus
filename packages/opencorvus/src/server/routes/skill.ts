import { Hono } from "hono"
import { describeRoute, resolver, validator } from "hono-openapi"
import z from "zod"
import { Skill } from "@/skill/skill"
import { SkillManager } from "@/skill/manager"
import { SkillMount } from "@/skill/mounts"
import { assertActiveProjectSession } from "../active-project-session"

async function assertInputSessionInActiveProject(input: object): Promise<void> {
  if ("sessionID" in input && typeof input.sessionID === "string") {
    await assertActiveProjectSession(input.sessionID)
  }
}

export function SkillRoutes() {
  return new Hono()
    .get(
      "/",
      describeRoute({
        summary: "List skills",
        description: "Get a list of all available skills in the OpenCorvus system.",
        operationId: "app.skills",
        responses: {
          200: {
            description: "List of skills",
            content: {
              "application/json": {
                schema: resolver(Skill.Info.array()),
              },
            },
          },
        },
      }),
      async (c) => {
        return c.json(await Skill.all())
      },
    )
    .get(
      "/mounts",
      describeRoute({
        summary: "List agent skill mounts",
        description: "Get the skill pool, known agents, effective per-agent mounts, and unmounted warnings.",
        operationId: "skill.mounts",
        responses: {
          200: {
            description: "Agent skill mount matrix",
            content: {
              "application/json": {
                schema: resolver(SkillMount.Matrix),
              },
            },
          },
        },
      }),
      validator(
        "query",
        z.object({
          sessionID: z.string().optional(),
          expertSquadID: z.string().trim().min(1).optional(),
          refresh: z
            .literal("true")
            .optional()
            .transform((value) => value === "true"),
        }),
      ),
      async (c) => {
        const input = c.req.valid("query")
        await assertInputSessionInActiveProject(input)
        return c.json(await SkillMount.matrix(input))
      },
    )
    .get(
      "/issues",
      describeRoute({
        summary: "List Skill catalog issues",
        description:
          "Returns source-scoped Skill discovery and validation issues without hiding healthy catalog entries.",
        operationId: "skill.issues",
        responses: {
          200: {
            description: "Skill catalog issues",
            content: {
              "application/json": {
                schema: resolver(Skill.Warning.array()),
              },
            },
          },
        },
      }),
      async (c) => {
        return c.json(await Skill.warnings())
      },
    )
    .patch(
      "/mount",
      describeRoute({
        summary: "Set a qualified skill mount override",
        description:
          "Set or delete one project/session operator override qualified by expert squad, projected Skill owner, and default skill ref.",
        operationId: "skill.setMountOverride",
        responses: {
          200: {
            description: "Updated agent skill mount matrix",
            content: {
              "application/json": {
                schema: resolver(SkillMount.Matrix),
              },
            },
          },
        },
      }),
      validator("json", SkillMount.SetOverrideInput),
      async (c) => {
        const input = c.req.valid("json")
        await assertInputSessionInActiveProject(input)
        return c.json(await SkillMount.setOverride(input))
      },
    )
    .get(
      "/installed",
      describeRoute({
        summary: "List installed skills",
        description: "Get installed skills with source classification and effective permission policy.",
        operationId: "skill.installed",
        responses: {
          200: {
            description: "Installed skills",
            content: {
              "application/json": {
                schema: resolver(SkillManager.Installed.array()),
              },
            },
          },
        },
      }),
      async (c) => {
        return c.json(await SkillManager.installed())
      },
    )
    .get(
      "/market",
      describeRoute({
        summary: "List skill markets",
        description: "Get curated skill marketplaces and official registries relevant to OpenCorvus imports.",
        operationId: "skill.market",
        responses: {
          200: {
            description: "Skill market entries",
            content: {
              "application/json": {
                schema: resolver(SkillManager.MarketEntry.array()),
              },
            },
          },
        },
      }),
      async (c) => {
        return c.json(await SkillManager.market())
      },
    )
    .get(
      "/directories",
      describeRoute({
        summary: "Get skill directories",
        description: "Get global config, managed skill install, and remote cache directories.",
        operationId: "skill.directories",
        responses: {
          200: {
            description: "Skill directories",
            content: {
              "application/json": {
                schema: resolver(SkillManager.Directories),
              },
            },
          },
        },
      }),
      async (c) => {
        return c.json(SkillManager.directories())
      },
    )
    .post(
      "/install",
      describeRoute({
        summary: "Install or import a skill source",
        description:
          "Install a skill source from a local path, remote URL, or git repository into the global skill config.",
        operationId: "skill.install",
        responses: {
          200: {
            description: "Installed skill source",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    source: z.string(),
                    path: z.string().optional(),
                    kind: SkillManager.InstallInput.shape.kind,
                  }),
                ),
              },
            },
          },
        },
      }),
      validator("json", SkillManager.InstallInput),
      async (c) => {
        return c.json(await SkillManager.install(c.req.valid("json")))
      },
    )
    .post(
      "/import-file",
      describeRoute({
        summary: "Import a dropped skill source",
        description:
          "Write a dropped SKILL.md file, skill directory, or zip archive into the current project's .opencorvus skill directory.",
        operationId: "skill.importFile",
        responses: {
          200: {
            description: "Imported project skill file",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    name: z.string(),
                    source: z.string(),
                    kind: z.literal("path"),
                    names: z.string().array().optional(),
                    sources: z.string().array().optional(),
                  }),
                ),
              },
            },
          },
        },
      }),
      validator("json", SkillManager.ImportFileInput),
      async (c) => {
        return c.json(await SkillManager.importFile(c.req.valid("json")))
      },
    )
    .post(
      "/remove",
      describeRoute({
        summary: "Remove a skill source",
        description: "Remove a configured skill source from global config and delete managed installs when applicable.",
        operationId: "skill.remove",
        responses: {
          200: {
            description: "Removed skill source",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
        },
      }),
      validator("json", SkillManager.RemoveInput),
      async (c) => {
        return c.json(await SkillManager.remove(c.req.valid("json")))
      },
    )
    .post(
      "/update",
      describeRoute({
        summary: "Update an installed skill",
        description:
          "Refresh a built-in Skill from the current application payload or atomically replace one writable external Skill from the configured update server.",
        operationId: "skill.update",
        responses: {
          200: {
            description: "Updated Skill",
            content: { "application/json": { schema: resolver(SkillManager.UpdateResult) } },
          },
        },
      }),
      validator("json", SkillManager.UpdateInput),
      async (c) => {
        return c.json(await SkillManager.update(c.req.valid("json")))
      },
    )
    .post(
      "/policy",
      describeRoute({
        summary: "Set skill permission policy",
        description: "Set the global allow or deny capability policy for a named skill.",
        operationId: "skill.policy",
        responses: {
          200: {
            description: "Updated skill policy",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
        },
      }),
      validator("json", SkillManager.PolicyInput),
      async (c) => {
        return c.json(await SkillManager.setPolicy(c.req.valid("json")))
      },
    )
}
