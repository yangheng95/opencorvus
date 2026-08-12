import { Hono } from "hono"
import path from "node:path"
import {
  ProjectWorktreeDeleteReceipt,
  ProjectWorktreeList,
  TaskCancellationRequestBody,
} from "@opencorvus-ai/transport-protocol"
import { describeRoute, validator } from "hono-openapi"
import { resolver } from "hono-openapi"
import { Instance } from "../../project/instance"
import { Project } from "../../project/project"
import { Vcs } from "../../project/vcs"
import { Worktree } from "../../worktree"
import { Ownership } from "../../engine/ownership"
import { WorktreeGC } from "../../worktree/gc"
import { deleteProject, ProjectDeleteResult } from "../../project/delete"
import { PersistedProjectContext } from "@/server/persisted-project-context"
import z from "zod"
import { errors } from "../error"
import { requestID as resolveRequestID } from "../error-handler"
import { lazy } from "../../util/lazy"
import { NotFoundError } from "../../storage/db"
import { ImplicitProject } from "../../project/implicit-project"
import { hasProjectOwnedPromptControllers, ownedPromptControllersError } from "../../engine/runtime"
import { ProcessSupervisor } from "../../shell/process-supervisor"

const OwnershipCandidate = z.object({
  taskID: z.string().optional(),
  sessionID: z.string().optional(),
  worktreeDir: z.string().optional(),
  reason: z.enum(["owner-process-dead", "target-missing", "marker-invalid"]),
}).strict()

const WorktreeGCCandidate = z.object({
  projectID: z.string(),
  directory: z.string(),
  reason: z.enum(["old-clean", "old-zombie", "registry-prunable"]),
}).strict()

const WorktreeGCPreservation = z.object({
  projectID: z.string(),
  reason: z.enum([
    "primary-directory-unavailable",
    "managed-state-unavailable",
    "registry-unavailable",
    "durable-sandbox-owner",
  ]),
  operation: z.literal("inspect-worktree-gc"),
  code: z.string(),
}).strict()

const CleanupCandidates = z.object({
  worktreeOrphans: OwnershipCandidate.array(),
  worktreeGCCandidates: WorktreeGCCandidate.array(),
  worktreeGCPreservations: WorktreeGCPreservation.array(),
})

const CurrentProjectUpdateInput = z.object({
  name: z.string().trim().min(1),
})

export const ProjectRoutes = lazy(() =>
  new Hono()
    .get(
      "/",
      describeRoute({
        summary: "List all projects",
        description: "Get a list of projects that have been opened with OpenCorvus.",
        operationId: "project.list",
        responses: {
          200: {
            description: "List of projects",
            content: {
              "application/json": {
                schema: resolver(Project.Info.array()),
              },
            },
          },
        },
      }),
      async (c) => {
        const projects = await Project.list()
        return c.json(projects)
      },
    )
    .get(
      "/current",
      describeRoute({
        summary: "Get current project",
        description: "Retrieve the currently active project that OpenCorvus is working with.",
        operationId: "project.current",
        responses: {
          200: {
            description: "Current project information",
            content: {
              "application/json": {
                schema: resolver(Project.Info),
              },
            },
          },
        },
      }),
      async (c) => {
        return c.json(Instance.project)
      },
    )
    .delete(
      "/current",
      describeRoute({
        summary: "Delete current project",
        description:
          "Delete the current project's OpenCorvus state, task history, and project-local runtime directory. Source files in the workspace are not deleted.",
        operationId: "project.current.delete",
        responses: {
          200: {
            description: "Project deleted",
            content: {
              "application/json": {
                schema: resolver(ProjectDeleteResult),
              },
            },
          },
          ...errors(400, 404, 409),
        },
      }),
      validator("json", TaskCancellationRequestBody),
      async (c) => {
        const body = c.req.valid("json")
        return c.json(
          await deleteProject(PersistedProjectContext.currentProject(), {
            actor: "user",
            source: "project.delete",
            surface: body.surface,
            requestID: resolveRequestID(c),
            reason: body.reason,
          }),
        )
      },
    )
    .patch(
      "/current",
      describeRoute({
        summary: "Update current project",
        description: "Rename the currently active project record. The source directory on disk is not renamed.",
        operationId: "project.current.update",
        responses: {
          200: {
            description: "Updated current project information",
            content: {
              "application/json": {
                schema: resolver(Project.Info),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator("json", CurrentProjectUpdateInput),
      async (c) => {
        const body = c.req.valid("json")
        const project = await Project.update({ projectID: Instance.project.id, name: body.name })
        await Instance.refresh()
        return c.json(project)
      },
    )
    .post(
      "/current/promote-anonymous",
      describeRoute({
        summary: "Convert current anonymous project to a named project",
        description:
          "Move the complete dated anonymous project into a named destination while preserving its project identity, sessions, tasks, and attachments.",
        operationId: "project.current.promoteAnonymous",
        responses: {
          200: {
            description: "Anonymous project converted",
            content: {
              "application/json": {
                schema: resolver(ImplicitProject.PromotionResult),
              },
            },
          },
          ...errors(400, 404, 409),
        },
      }),
      validator("json", ImplicitProject.PromotionInput),
      async (c) => {
        if (hasProjectOwnedPromptControllers()) {
          throw ownedPromptControllersError("anonymous project conversion")
        }
        const project = Instance.project
        const body = c.req.valid("json")
        return c.json(
          await ImplicitProject.promote({
            ...body,
            project,
            beforeMove: async () => {
              await Instance.dispose()
              await ProcessSupervisor.disposeLiveProcessesUnder(project.worktree)
            },
          }),
        )
      },
    )
    .post(
      "/current/init-git",
      describeRoute({
        summary: "Initialize git in current directory",
        description: "Run git init in the current working directory and refresh the active project context.",
        operationId: "project.current.initGit",
        responses: {
          200: {
            description: "Git initialized",
            content: {
              "application/json": {
                schema: resolver(Project.InitGitResult),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      async (c) => {
        const result = await Project.initGit(Instance.directory)
        if (result.created) {
          const { hasProjectOwnedPromptControllers } = await import("@/engine/runtime")
          if (hasProjectOwnedPromptControllers()) {
            // Active sessions prevent a full dispose.  Refresh the cached
            // project in-place so downstream reads see the new worktree/sandboxes,
            // then discard the stale VCS state so the next GET /vcs re-initialises
            // the branch tracker against the newly-created repo.
            // (Project.isGitRepo probes disk directly — no cache to invalidate.)
            await Instance.refresh()
            await Vcs.resetState()
          } else {
            await Instance.dispose()
          }
        }
        return c.json(result)
      },
    )
    .get(
      "/current/worktrees",
      describeRoute({
        summary: "List current project worktrees",
        description: "List Git worktrees registered for the current project with Task and Session execution identity.",
        operationId: "project.current.worktrees",
        responses: {
          200: {
            description: "Project worktrees",
            content: {
              "application/json": {
                schema: resolver(ProjectWorktreeList),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      async (c) => {
        return c.json(await Worktree.listProjectWorktrees(Instance.project.id))
      },
    )
    .get(
      "/current/cleanup-candidates",
      describeRoute({
        summary: "Inspect current project cleanup candidates",
        description:
          "Read-only inspection of orphan worktree ownership markers and worktree GC candidates. This route does not delete files or mutate markers.",
        operationId: "project.current.cleanupCandidates",
        responses: {
          200: {
            description: "Cleanup candidates",
            content: {
              "application/json": {
                schema: resolver(CleanupCandidates),
              },
            },
          },
          ...errors(400, 404, 503),
        },
      }),
      async (c) => {
        const [worktreeOrphans, gcPlan] = await Promise.all([
          Ownership.Worktree.orphans({ primaryWorktreeDir: Instance.directory }),
          WorktreeGC.inspect(),
        ])
        const current = path.resolve(Instance.directory)
        return c.json({
          worktreeOrphans,
          worktreeGCCandidates: gcPlan.candidates
            .filter((candidate) => path.resolve(candidate.primaryDir) === current)
            .map((candidate) => ({
              projectID: candidate.projectID,
              directory: candidate.directory,
              reason: candidate.reason,
            })),
          worktreeGCPreservations: gcPlan.preservations
            .filter((preservation) => path.resolve(preservation.primaryDir) === current)
            .map((preservation) => ({
              projectID: preservation.projectID,
              reason: preservation.reason,
              operation: "inspect-worktree-gc" as const,
              code: preservation.reason.replaceAll("-", "_").toUpperCase(),
            })),
        })
      },
    )
    .delete(
      "/current/worktrees",
      describeRoute({
        summary: "Delete a current project worktree",
        description: "Remove a git worktree registered for the current project.",
        operationId: "project.current.worktrees.delete",
        responses: {
          200: {
            description: "Worktree removed",
            content: {
              "application/json": {
                schema: resolver(ProjectWorktreeDeleteReceipt),
              },
            },
          },
          ...errors(400, 404, 503),
        },
      }),
      validator("json", Worktree.RemoveInput),
      async (c) => {
        const body = c.req.valid("json")
        const result = await Worktree.removeProjectWorktree(body)
        return c.json(ProjectWorktreeDeleteReceipt.parse(result.receipt))
      },
    )
    .patch(
      "/:projectID",
      describeRoute({
        summary: "Update project",
        description: "Update project properties such as name, icon, and commands.",
        operationId: "project.update",
        responses: {
          200: {
            description: "Updated project information",
            content: {
              "application/json": {
                schema: resolver(Project.Info),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator("param", z.object({ projectID: z.string() })),
      validator("json", Project.update.schema.omit({ projectID: true })),
      async (c) => {
        const projectID = c.req.valid("param").projectID
        const body = c.req.valid("json")
        if (projectID !== Instance.project.id) {
          throw new NotFoundError({ message: `Project not found: ${projectID}` })
        }
        const project = await Project.update({ ...body, projectID })
        await Instance.refresh()
        return c.json(project)
      },
    ),
)
