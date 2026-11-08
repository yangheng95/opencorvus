import { Hono } from "hono"
import { createMiddleware } from "hono/factory"
import { Readable } from "node:stream"
import { describeRoute, resolver } from "hono-openapi"
import { validator } from "@/server/validator"
import z from "zod"
import { File } from "../../file"
import { Ripgrep } from "../../file/ripgrep"
import { Instance } from "../../project/instance"
import { BAD_REQUEST_SCHEMA, errors } from "../error"
import { lazy } from "../../util/lazy"
import { Plugin } from "../../plugin"
import { NamedError } from "@opencorvus-ai/util/error"
import { GitSourceEnumerationError } from "../../util/git-source-paths"

function fileErrorResponse(description: string, schema: z.ZodType) {
  return { description, content: { "application/json": { schema: resolver(schema) } } }
}

const fileMutationErrors = {
  400: fileErrorResponse("Invalid file request", z.union([BAD_REQUEST_SCHEMA, File.InvalidPathError.Schema])),
  404: fileErrorResponse("File entry not found", File.EntryNotFoundError.Schema),
  409: fileErrorResponse("File destination already exists", File.ConflictError.Schema),
  500: fileErrorResponse("File operation failed", NamedError.Unknown.Schema),
}

const initializeFileMutationPlugins = createMiddleware(async (_c, next) => {
  await Plugin.init()
  await next()
})

export const FileRoutes = lazy(() =>
  new Hono()
    .get(
      "/find",
      describeRoute({
        summary: "Find text",
        description: "Search for text patterns across files in the project using ripgrep.",
        operationId: "find.text",
        responses: {
          200: {
            description: "Matches",
            content: {
              "application/json": {
                schema: resolver(Ripgrep.Match.shape.data.array()),
              },
            },
          },
          ...errors(400),
          500: fileMutationErrors[500],
        },
      }),
      validator(
        "query",
        z.object({
          pattern: z.string(),
        }),
      ),
      async (c) => {
        const pattern = c.req.valid("query").pattern
        const result = await Ripgrep.searchHost({
          cwd: Instance.directory,
          pattern,
          limit: 10,
        })
        return c.json(result)
      },
    )
    .get(
      "/find/file",
      describeRoute({
        summary: "Find files",
        description: "Search for files or directories by name or pattern in the project directory.",
        operationId: "find.files",
        responses: {
          200: {
            description: "File paths",
            content: {
              "application/json": {
                schema: resolver(z.string().array()),
              },
            },
          },
          ...errors(400),
          500: fileMutationErrors[500],
        },
      }),
      validator(
        "query",
        z.object({
          query: z.string(),
          dirs: z.enum(["true", "false"]).optional(),
          type: z.enum(["file", "directory"]).optional(),
          limit: z.coerce.number().int().min(1).max(200).optional(),
        }),
      ),
      async (c) => {
        const query = c.req.valid("query").query
        const dirs = c.req.valid("query").dirs
        const type = c.req.valid("query").type
        const limit = c.req.valid("query").limit
        const results = await File.search({
          query,
          limit: limit ?? 10,
          dirs: dirs !== "false",
          type,
        })
        return c.json(results)
      },
    )
    .get(
      "/file",
      describeRoute({
        summary: "List files",
        description: "List files and directories in a specified path.",
        operationId: "file.list",
        responses: {
          200: {
            description: "Directory entries with current in-scope directory targets",
            content: {
              "application/json": {
                schema: resolver(File.ListingNode.array()),
              },
            },
          },
          ...errors(400),
          500: fileMutationErrors[500],
        },
      }),
      validator(
        "query",
        z.object({
          path: z.string(),
        }),
      ),
      async (c) => {
        const path = c.req.valid("query").path
        const content = await File.list(path)
        return c.json(content)
      },
    )
    .get(
      "/file/content",
      describeRoute({
        summary: "Read file",
        description: "Read the content of a specified file.",
        operationId: "file.read",
        responses: {
          200: {
            description: "File content",
            content: {
              "application/json": {
                schema: resolver(File.Content),
              },
            },
          },
          ...errors(400),
          404: fileMutationErrors[404],
          500: fileMutationErrors[500],
        },
      }),
      validator(
        "query",
        z.object({
          path: z.string(),
        }),
      ),
      async (c) => {
        const path = c.req.valid("query").path
        const content = await File.read(path)
        return c.json(content)
      },
    )
    .get(
      "/file/download",
      describeRoute({
        summary: "Download an original project file",
        description:
          "Stream the original bytes of a project-relative file as application/octet-stream, with its canonical filename in Content-Disposition, without preview conversion or execution model initialization.",
        operationId: "file.download",
        responses: {
          200: {
            description: "Original file bytes with the canonical filename in Content-Disposition",
            content: { "application/octet-stream": { schema: { type: "string", format: "binary" } } },
          },
          400: fileMutationErrors[400],
          404: fileMutationErrors[404],
          500: fileMutationErrors[500],
        },
      }),
      validator("query", z.object({ path: z.string() })),
      async (c) => {
        const download = await File.openDownload(c.req.valid("query").path, c.req.raw.signal)
        try {
          const filename = encodeURIComponent(download.filename).replace(
            /[!'()*]/g,
            (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
          )
          // Node and Bun declare separate ambient types for the same Web stream.
          const body = Readable.toWeb(download.stream) as unknown as ReadableStream<Uint8Array>
          return c.body(body, 200, {
            "Content-Type": "application/octet-stream",
            "Content-Disposition": `attachment; filename*=UTF-8''${filename}`,
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
          })
        } catch (error) {
          download.stream.destroy()
          throw error
        }
      },
    )
    .get(
      "/file/source-content",
      describeRoute({
        summary: "Read an absolute source file",
        description: "Read the exact absolute file represented by a persisted source-file citation.",
        operationId: "file.readSource",
        responses: {
          200: {
            description: "Read-only source file content",
            content: {
              "application/json": {
                schema: resolver(File.Content),
              },
            },
          },
          400: fileMutationErrors[400],
          404: fileMutationErrors[404],
          500: fileMutationErrors[500],
        },
      }),
      validator(
        "query",
        z.object({
          path: z.string(),
        }),
      ),
      async (c) => {
        const path = c.req.valid("query").path
        const content = await File.readSource(path)
        return c.json(content)
      },
    )
    .patch(
      "/file/content",
      describeRoute({
        summary: "Write file",
        description:
          "Write text content to an existing editable file only when expectedRevision matches its loaded content and physical identity.",
        operationId: "file.write",
        responses: {
          200: {
            description: "Updated file content",
            content: {
              "application/json": {
                schema: resolver(File.Content),
              },
            },
          },
          400: fileMutationErrors[400],
          404: fileMutationErrors[404],
          409: fileErrorResponse("File changed since it was loaded", File.WriteConflictError.Schema),
          500: fileMutationErrors[500],
        },
      }),
      validator(
        "json",
        z.object({
          path: z.string(),
          content: z.string(),
          expectedRevision: File.ContentRevision,
        }),
      ),
      initializeFileMutationPlugins,
      async (c) => {
        const input = c.req.valid("json")
        const content = await File.writeText(input.path, input.content, input.expectedRevision)
        return c.json(content)
      },
    )
    .post(
      "/file/item",
      describeRoute({
        summary: "Create file item",
        description: "Create one file or directory under an existing project directory without overwriting.",
        operationId: "file.create",
        responses: {
          200: {
            description: "Created file node",
            content: {
              "application/json": {
                schema: resolver(File.Node),
              },
            },
          },
          ...fileMutationErrors,
        },
      }),
      validator("json", File.CreateRequest),
      initializeFileMutationPlugins,
      async (c) => {
        const input = c.req.valid("json")
        const node = await File.create(input)
        return c.json(node)
      },
    )
    .post(
      "/file/item/copy",
      describeRoute({
        summary: "Copy file item",
        description: "Copy one file or directory within the project directory without overwriting.",
        operationId: "file.copy",
        responses: {
          200: {
            description: "Copied file node",
            content: {
              "application/json": {
                schema: resolver(File.CopyResult),
              },
            },
          },
          ...fileMutationErrors,
        },
      }),
      validator("json", File.CopyRequest),
      initializeFileMutationPlugins,
      async (c) => {
        const input = c.req.valid("json")
        const result = await File.copy(input)
        return c.json(result)
      },
    )
    .patch(
      "/file/item",
      describeRoute({
        summary: "Move file item",
        description: "Move or rename one file or directory within the project directory without overwriting.",
        operationId: "file.move",
        responses: {
          200: {
            description: "Moved file node",
            content: {
              "application/json": {
                schema: resolver(File.MoveResult),
              },
            },
          },
          ...fileMutationErrors,
        },
      }),
      validator("json", File.MoveRequest),
      initializeFileMutationPlugins,
      async (c) => {
        const input = c.req.valid("json")
        const result = await File.move(input)
        return c.json(result)
      },
    )
    .delete(
      "/file/item",
      describeRoute({
        summary: "Delete file item",
        description: "Delete one project file or directory recursively. The project root cannot be deleted.",
        operationId: "file.delete",
        responses: {
          200: {
            description: "Deleted file path",
            content: {
              "application/json": {
                schema: resolver(File.DeleteResult),
              },
            },
          },
          400: fileMutationErrors[400],
          404: fileMutationErrors[404],
          500: fileMutationErrors[500],
        },
      }),
      validator(
        "query",
        z.object({
          path: z.string(),
        }),
      ),
      initializeFileMutationPlugins,
      async (c) => {
        const path = c.req.valid("query").path
        const result = await File.remove({ path })
        return c.json(result)
      },
    )
    .post(
      "/file/upload",
      describeRoute({
        summary: "Upload files",
        description: "Write dropped files into an existing project directory without overwriting existing files.",
        operationId: "file.upload",
        responses: {
          200: {
            description: "Uploaded files",
            content: {
              "application/json": {
                schema: resolver(File.UploadResult.array()),
              },
            },
          },
          400: fileErrorResponse(
            "Invalid upload request",
            z.union([
              BAD_REQUEST_SCHEMA,
              File.UploadInvalidTargetError.Schema,
              File.UploadInvalidNameError.Schema,
              File.UploadInvalidContentError.Schema,
            ]),
          ),
          409: fileErrorResponse("Upload destination already exists", File.UploadConflictError.Schema),
          500: fileMutationErrors[500],
        },
      }),
      validator("json", File.UploadRequest),
      initializeFileMutationPlugins,
      async (c) => {
        const input = c.req.valid("json")
        const result = await File.upload(input)
        return c.json(result)
      },
    )
    .get(
      "/file/status",
      describeRoute({
        summary: "Get file status",
        description: "Get the git status of all files in the project.",
        operationId: "file.status",
        responses: {
          200: {
            description: "File status",
            content: {
              "application/json": {
                schema: resolver(File.Info.array()),
              },
            },
          },
          500: fileErrorResponse(
            "File status failed",
            z.union([NamedError.Unknown.Schema, GitSourceEnumerationError.Schema]),
          ),
        },
      }),
      async (c) => {
        const content = await File.status()
        return c.json(content)
      },
    ),
)
