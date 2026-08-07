import { Hono } from "hono"
import { describeRoute, validator, resolver } from "hono-openapi"
import z from "zod"
import { MCP } from "../../mcp"
import { Config } from "../../config/config"
import { badRequestBody, badRequestOrNamedErrorResponse, errors, namedErrorResponse } from "../error"
import { lazy } from "../../util/lazy"

export const McpRoutes = lazy(() => {
  const app = new Hono()
  return (
    app
      // === core ===
      .get(
        "/",
        describeRoute({
          summary: "Get MCP status",
          description: "Get the status of all Model Context Protocol (MCP) servers.",
          operationId: "mcp.status",
          responses: {
            200: {
              description: "MCP server status",
              content: {
                "application/json": {
                  schema: resolver(z.record(z.string(), MCP.Status)),
                },
              },
            },
          },
        }),
        async (c) => {
          return c.json(await MCP.status())
        },
      )
      .post(
        "/",
        describeRoute({
          summary: "Add MCP server",
          description: "Dynamically add a new Model Context Protocol (MCP) server to the system.",
          operationId: "mcp.add",
          responses: {
            200: {
              description: "MCP server added successfully",
              content: {
                "application/json": {
                  schema: resolver(z.record(z.string(), MCP.Status)),
                },
              },
            },
            ...errors(400),
          },
        }),
        validator("json", MCP.ConfigureRequest),
        async (c) => {
          const input = MCP.ConfigureInput.safeParse(c.req.valid("json"))
          if (!input.success) {
            return c.json(badRequestBody(input.error.issues.map((issue) => issue.message).join("; ")), 400)
          }
          const { name, config, credentialSecret } = input.data
          const result = await MCP.configure(name, config, credentialSecret)
          return c.json(result.status)
        },
      )
      .get(
        "/project",
        describeRoute({
          summary: "Get project-owned MCP status",
          description: "Get live status for MCP server definitions owned by the current project.",
          operationId: "mcp.project.status",
          responses: {
            200: {
              description: "Project-owned MCP server status",
              content: {
                "application/json": {
                  schema: resolver(z.record(z.string(), MCP.Status)),
                },
              },
            },
          },
        }),
        async (c) => c.json(await MCP.projectStatus()),
      )
      .delete(
        "/",
        describeRoute({
          summary: "Remove project MCP servers",
          description:
            "Atomically validates native Chat and Work references, closes live connections, removes OAuth credentials, and deletes the project-owned definitions.",
          operationId: "mcp.remove",
          responses: {
            200: {
              description: "Updated project configuration",
              content: { "application/json": { schema: resolver(Config.Info) } },
            },
            ...errors(400, 404, 500),
          },
        }),
        validator("json", MCP.RemoveConfiguredInput),
        async (c) => {
          try {
            return c.json(await MCP.removeConfigured(c.req.valid("json")))
          } catch (error) {
            const { ConversationCapability } = await import("@/conversation/capability")
            if (ConversationCapability.InvalidAssignmentError.isInstance(error)) {
              return c.json(badRequestBody(error.data.message), 400)
            }
            throw error
          }
        },
      )
      // === auth ===
      .post(
        "/:name/auth",
        describeRoute({
          summary: "Start MCP OAuth",
          description: "Start OAuth authentication flow for a Model Context Protocol (MCP) server.",
          operationId: "mcp.auth.start",
          responses: {
            200: {
              description: "OAuth flow started",
              content: {
                "application/json": {
                  schema: resolver(
                    z.object({
                      authorizationUrl: z.string().describe("URL to open in browser for authorization"),
                    }),
                  ),
                },
              },
            },
            ...errors(400, 404),
            500: namedErrorResponse("MCP OAuth start failed", "UnknownError"),
          },
        }),
        async (c) => {
          const name = c.req.param("name")
          const supportsOAuth = await MCP.supportsOAuth(name)
          if (!supportsOAuth) {
            return c.json(badRequestBody(`MCP server ${name} does not support OAuth`), 400)
          }
          const result = await MCP.startAuth(name)
          return c.json(result)
        },
      )
      .post(
        "/:name/auth/callback",
        describeRoute({
          summary: "Complete MCP OAuth",
          description:
            "Complete OAuth authentication for a Model Context Protocol (MCP) server using the authorization code.",
          operationId: "mcp.auth.callback",
          responses: {
            200: {
              description: "OAuth authentication completed",
              content: {
                "application/json": {
                  schema: resolver(MCP.Status),
                },
              },
            },
            400: badRequestOrNamedErrorResponse("Invalid MCP OAuth callback request", "MCPOAuthStateError"),
            ...errors(404),
            500: namedErrorResponse("MCP OAuth completion failed", "UnknownError"),
          },
        }),
        validator(
          "json",
          z.object({
            code: z.string().describe("Authorization code from OAuth callback"),
            state: z.string().describe("OAuth state parameter from OAuth callback"),
          }),
        ),
        async (c) => {
          const name = c.req.param("name")
          const { code, state } = c.req.valid("json")
          const status = await MCP.finishAuthCallback(name, code, state)
          return c.json(status)
        },
      )
      .post(
        "/:name/auth/authenticate",
        describeRoute({
          summary: "Authenticate MCP OAuth",
          description: "Start OAuth flow and wait for callback (opens browser)",
          operationId: "mcp.auth.authenticate",
          responses: {
            200: {
              description: "OAuth authentication completed",
              content: {
                "application/json": {
                  schema: resolver(MCP.Status),
                },
              },
            },
            ...errors(400, 404),
            500: namedErrorResponse("MCP OAuth completion failed", "UnknownError"),
          },
        }),
        async (c) => {
          const name = c.req.param("name")
          const supportsOAuth = await MCP.supportsOAuth(name)
          if (!supportsOAuth) {
            return c.json(badRequestBody(`MCP server ${name} does not support OAuth`), 400)
          }
          const status = await MCP.authenticate(name)
          return c.json(status)
        },
      )
      .delete(
        "/:name/auth",
        describeRoute({
          summary: "Remove MCP OAuth",
          description: "Remove OAuth credentials for an MCP server",
          operationId: "mcp.auth.remove",
          responses: {
            200: {
              description: "OAuth credentials removed",
              content: {
                "application/json": {
                  schema: resolver(z.object({ success: z.literal(true) })),
                },
              },
            },
            ...errors(404, 500),
          },
        }),
        async (c) => {
          const name = c.req.param("name")
          await MCP.removeAuth(name)
          return c.json({ success: true as const })
        },
      )
      // === connection ===
      .post(
        "/:name/connect",
        describeRoute({
          description: "Connect an MCP server",
          operationId: "mcp.connect",
          responses: {
            200: {
              description: "MCP server connected successfully",
              content: {
                "application/json": {
                  schema: resolver(z.boolean()),
                },
              },
            },
            ...errors(404),
            500: namedErrorResponse("MCP connection failed", "UnknownError"),
          },
        }),
        validator("param", z.object({ name: z.string() })),
        async (c) => {
          const { name } = c.req.valid("param")
          await MCP.connect(name)
          return c.json(true)
        },
      )
      .post(
        "/:name/disconnect",
        describeRoute({
          description: "Disconnect an MCP server",
          operationId: "mcp.disconnect",
          responses: {
            200: {
              description: "MCP server disconnected successfully",
              content: {
                "application/json": {
                  schema: resolver(z.boolean()),
                },
              },
            },
            ...errors(404),
          },
        }),
        validator("param", z.object({ name: z.string() })),
        async (c) => {
          const { name } = c.req.valid("param")
          await MCP.disconnect(name)
          return c.json(true)
        },
      )
  )
})
