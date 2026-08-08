import { lazy } from "@/util/lazy"
import { Instance } from "@/project/instance"
import { Hono } from "hono"
import { describeRoute, resolver, validator } from "hono-openapi"
import z from "zod"
import {
  BrowserPreviewCaptureRequest,
  BrowserPreviewTargetNotFoundError,
  capturePersistedBrowserPreviewTarget,
} from "../../browser-preview/capture"
import {
  readBrowserPreviewEvidenceByID,
  findBrowserPreviewTargetByID,
  persistBrowserPreviewTarget,
  promoteBrowserPreviewTarget,
  publicBrowserPreviewEvidence,
  PublicBrowserPreviewEvidence,
  readBrowserPreviewEvidenceArtifact,
  readBrowserPreviewEvidenceCapture,
} from "../../browser-preview/persist"
import {
  BrowserPreviewTarget,
  resolveBrowserPreviewTarget,
  taskBrowserPreviewTarget,
} from "../../browser-preview/target"
import { canonicalBrowserPreviewUrl } from "../../browser-preview/url-identity"
import { BrowserPreviewVerification } from "../../browser-preview/verification"
import { BrowserPreviewViewportList } from "../../browser-preview/viewport"
import {
  BrowserPreviewRegionComparisonRequest,
  BrowserPreviewRegionComparisonResult,
  compareBrowserPreviewRegions,
} from "../../browser-preview/region-comparison"
import { browserPreviewTaskEvidenceRoot } from "../../browser-preview/task-evidence-root"
import { NotFoundError } from "../../storage/db"
import { errors, namedErrorResponse } from "../error"

const BrowserPreviewTargetSelectionRequest = z.union([
  z
    .object({
      targetID: z.string().min(1),
    })
    .strict(),
  z
    .object({
      url: z
        .string()
        .min(1)
        .refine((value) => canonicalBrowserPreviewUrl(value) !== undefined, "Expected an HTTP(S) browser preview URL."),
      viewports: BrowserPreviewViewportList,
    })
    .strict(),
])

export const BrowserPreviewRoutes = lazy(() =>
  new Hono()
    .get(
      "/task/:taskID/browser-preview",
      describeRoute({
        summary: "Resolve task browser preview target",
        description:
          "Return the task-scoped browser preview target. Saved EngineArtifact target records are the only preview target source.",
        operationId: "browserPreview.taskTarget",
        responses: {
          200: {
            description: "Browser preview target",
            content: {
              "application/json": {
                schema: resolver(BrowserPreviewTarget),
              },
            },
          },
          ...errors(400, 404),
          500: namedErrorResponse(
            "Browser preview target or evidence is corrupt",
            "BrowserPreviewTargetCorruptionError",
            "BrowserPreviewEvidenceCorruptionError",
          ),
        },
      }),
      validator(
        "param",
        z.object({
          taskID: z.string().min(1),
        }),
      ),
      async (c) => {
        const { taskID } = c.req.valid("param")
        const projectRoot = browserPreviewTaskEvidenceRoot(taskID)
        const target = await resolveBrowserPreviewTarget({
          projectRoot,
          taskID,
        })
        return c.json(target)
      },
    )
    .get(
      "/task/:taskID/browser-preview/evidence/:evidenceID",
      describeRoute({
        summary: "Read browser preview verification evidence",
        description: "Return the persisted Playwright evidence artifact for a task-scoped browser preview target.",
        operationId: "browserPreview.readTaskEvidence",
        responses: {
          200: {
            description: "Persisted browser preview evidence",
            content: {
              "application/json": {
                schema: resolver(PublicBrowserPreviewEvidence),
              },
            },
          },
          ...errors(400, 404),
          500: namedErrorResponse(
            "Browser preview evidence capture is corrupt",
            "BrowserPreviewEvidenceCorruptionError",
          ),
        },
      }),
      validator("param", z.object({ taskID: z.string().min(1), evidenceID: z.string().min(1) })),
      async (c) => {
        const { taskID, evidenceID } = c.req.valid("param")
        const projectRoot = browserPreviewTaskEvidenceRoot(taskID)
        const loaded = await readBrowserPreviewEvidenceByID({
          projectRoot,
          taskID,
          evidenceID,
        })
        if (!loaded) throw new NotFoundError({ message: `Browser preview evidence not found: ${evidenceID}` })
        const captureAvailable = Boolean(loaded.captureRole && loaded.bytesByRole.has(loaded.captureRole))
        return c.json(publicBrowserPreviewEvidence(loaded.evidence, captureAvailable))
      },
    )
    .get(
      "/task/:taskID/browser-preview/evidence/:evidenceID/capture.png",
      describeRoute({
        summary: "Read browser preview evidence screenshot",
        description: "Return the persisted Playwright PNG screenshot for task-scoped browser preview evidence.",
        operationId: "browserPreview.readTaskEvidenceCapture",
        responses: {
          200: {
            description: "Persisted browser preview PNG screenshot",
            content: {
              "image/png": {
                schema: resolver(z.string().meta({ format: "binary" })),
              },
            },
          },
          ...errors(404),
          500: namedErrorResponse(
            "Browser preview evidence artifact is corrupt",
            "BrowserPreviewEvidenceCorruptionError",
          ),
        },
      }),
      validator("param", z.object({ taskID: z.string().min(1), evidenceID: z.string().min(1) })),
      async (c) => {
        const { taskID, evidenceID } = c.req.valid("param")
        const projectRoot = browserPreviewTaskEvidenceRoot(taskID)
        const bytes = await readBrowserPreviewEvidenceCapture({
          projectRoot,
          taskID,
          evidenceID,
        })
        if (!bytes)
          throw new NotFoundError({ message: `Browser preview evidence capture not found: ${evidenceID}` })
        return new Response(bytes, {
          headers: {
            "content-type": "image/png",
            "cache-control": "no-store",
          },
        })
      },
    )
    .get(
      "/task/:taskID/browser-preview/evidence/:evidenceID/artifact/:artifactName",
      describeRoute({
        summary: "Read browser preview region comparison artifact",
        description:
          "Return a persisted source, implementation, side-by-side, or diff PNG for region comparison evidence.",
        operationId: "browserPreview.readTaskEvidenceArtifact",
        responses: {
          200: {
            description: "Persisted browser preview region comparison PNG artifact",
            content: {
              "image/png": {
                schema: resolver(z.string().meta({ format: "binary" })),
              },
            },
          },
          ...errors(404),
          500: namedErrorResponse("Browser preview evidence is corrupt", "BrowserPreviewEvidenceCorruptionError"),
        },
      }),
      validator(
        "param",
        z.object({
          taskID: z.string().min(1),
          evidenceID: z.string().min(1),
          artifactName: z.enum(["source", "implementation", "side-by-side", "diff"]),
        }),
      ),
      async (c) => {
        const { taskID, evidenceID, artifactName } = c.req.valid("param")
        const projectRoot = browserPreviewTaskEvidenceRoot(taskID)
        const bytes = await readBrowserPreviewEvidenceArtifact({
          projectRoot,
          taskID,
          evidenceID,
          artifactName,
        })
        if (!bytes)
          throw new NotFoundError({
            message: `Browser preview evidence artifact not found: ${evidenceID}/${artifactName}`,
          })
        return new Response(bytes, {
          headers: {
            "content-type": "image/png",
            "cache-control": "no-store",
          },
        })
      },
    )
    .put(
      "/task/:taskID/browser-preview/target",
      describeRoute({
        summary: "Set task browser preview target",
        description:
          "Promote an existing task browser preview target artifact or persist an operator-entered HTTP(S) URL with its explicit task viewport contract.",
        operationId: "browserPreview.selectTaskTarget",
        responses: {
          200: {
            description: "Persisted browser preview target",
            content: {
              "application/json": {
                schema: resolver(BrowserPreviewTarget),
              },
            },
          },
          ...errors(404),
          500: namedErrorResponse("Browser preview target is corrupt", "BrowserPreviewTargetCorruptionError"),
        },
      }),
      validator("param", z.object({ taskID: z.string().min(1) })),
      validator("json", BrowserPreviewTargetSelectionRequest),
      async (c) => {
        const { taskID } = c.req.valid("param")
        const body = c.req.valid("json")
        const projectRoot = browserPreviewTaskEvidenceRoot(taskID)
        if ("url" in body) {
          const url = canonicalBrowserPreviewUrl(body.url)!
          await persistBrowserPreviewTarget({ taskID, url, viewports: body.viewports })
          return c.json(await resolveBrowserPreviewTarget({ projectRoot, taskID }))
        }
        const targetID = body.targetID
        const persisted = await promoteBrowserPreviewTarget({ taskID, targetID })
        if (!persisted) throw new NotFoundError({ message: `Browser preview target not found: ${targetID}` })
        return c.json(
          taskBrowserPreviewTarget({
            id: persisted.id,
            taskID,
            projectRoot,
            url: persisted.url,
            viewports: persisted.viewports,
            diagnostics: [`Selected task browser preview target ${persisted.id}.`],
          }) satisfies BrowserPreviewTarget,
        )
      },
    )
    .post(
      "/task/:taskID/browser-preview/capture",
      describeRoute({
        summary: "Capture browser preview verification evidence",
        description:
          "Capture Playwright-backed screenshot evidence for the task-scoped browser preview target and persist the evidence artifact.",
        operationId: "browserPreview.captureTaskTarget",
        responses: {
          200: {
            description: "Browser preview verification result",
            content: {
              "application/json": {
                schema: resolver(BrowserPreviewVerification),
              },
            },
          },
          ...errors(400, 404),
          500: namedErrorResponse("Browser preview target is corrupt", "BrowserPreviewTargetCorruptionError"),
        },
      }),
      validator("param", z.object({ taskID: z.string().min(1) })),
      validator("json", BrowserPreviewCaptureRequest),
      async (c) => {
        const { taskID } = c.req.valid("param")
        const body = c.req.valid("json")
        try {
          return c.json(
            await capturePersistedBrowserPreviewTarget({
              taskID,
              targetID: body.targetID,
              viewportIDs: body.viewportIDs,
              signal: c.req.raw.signal,
            }),
          )
        } catch (error) {
          if (error instanceof BrowserPreviewTargetNotFoundError) {
            throw new NotFoundError({ message: error.message })
          }
          throw error
        }
      },
    )
    .post(
      "/task/:taskID/browser-preview/compare",
      describeRoute({
        summary: "Compare browser preview regions against source visual evidence",
        description:
          "Capture task-scoped local regions from the persisted preview target and persist source/local side-by-side comparison artifacts.",
        operationId: "browserPreview.compareTaskTargetRegions",
        responses: {
          200: {
            description: "Browser preview region comparison result",
            content: {
              "application/json": {
                schema: resolver(BrowserPreviewRegionComparisonResult),
              },
            },
          },
          ...errors(400, 404),
          500: namedErrorResponse("Browser preview target is corrupt", "BrowserPreviewTargetCorruptionError"),
        },
      }),
      validator("param", z.object({ taskID: z.string().min(1) })),
      validator("json", BrowserPreviewRegionComparisonRequest),
      async (c) => {
        const { taskID } = c.req.valid("param")
        const body = c.req.valid("json")
        const projectRoot = browserPreviewTaskEvidenceRoot(taskID)
        const target = findBrowserPreviewTargetByID({ taskID, targetID: body.targetID })
        if (!target) throw new NotFoundError({ message: `Browser preview target not found: ${body.targetID}` })
        const result = await compareBrowserPreviewRegions({
          projectID: Instance.project.id,
          projectRoot,
          taskID,
          targetID: body.targetID,
          bindings: body.inlineBindings,
          includeDiff: body.output.include_diff,
          signal: c.req.raw.signal,
        })
        return c.json(result)
      },
    ),
)
