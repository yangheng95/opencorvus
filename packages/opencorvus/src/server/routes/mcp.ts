import { Hono } from "hono"
import { describeRoute, resolver } from "hono-openapi"
import { validator } from "@/server/validator"
import z from "zod"
import { MCP } from "../../mcp"
import { oauthPageLocale } from "../../mcp/oauth-callback"
import { Config } from "../../config/config"
import { badRequestBody, badRequestOrNamedErrorResponse, errors, namedErrorResponse } from "../error"
import { lazy } from "../../util/lazy"

const connectionConfigurationChanged = {
  description: "MCP configuration changed during the operation",
  content: { "application/json": { schema: resolver(MCP.ConnectionConfigurationChangedError.Schema) } },
}

const ConnectionName = z.strictObject({
  name: z.string().describe("Exact MCP server name as stored in the configuration."),
})

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
          description:
            "Add or update a project Model Context Protocol (MCP) server using its exact name and literal settings. Configuration references that would change the submitted definition return a bad request.",
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
          try {
            const result = await MCP.configure(name, config, credentialSecret)
            return c.json(result.status)
          } catch (error) {
            if (!(error instanceof Config.LiteralPatchProjectionError)) throw error
            return c.json(
              badRequestBody(error.message, [{ code: "mcp_configuration_projection_changed", message: error.message }]),
              400,
            )
          }
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
        "/auth",
        describeRoute({
          summary: "Start MCP OAuth",
          description: "Start OAuth authentication flow for a Model Context Protocol (MCP) server. Accept-Language selects the callback page language.",
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
            409: connectionConfigurationChanged,
            500: namedErrorResponse("MCP OAuth start failed", "UnknownError"),
          },
        }),
        validator("json", ConnectionName),
        async (c) => {
          const { name } = c.req.valid("json")
          const supportsOAuth = await MCP.supportsOAuth(name)
          if (!supportsOAuth) {
            return c.json(badRequestBody(`MCP server ${JSON.stringify(name)} does not support OAuth`), 400)
          }
          const result = await MCP.startAuth(name, oauthPageLocale(c.req.header("accept-language")))
          return c.json(result)
        },
      )
      .post(
        "/auth/callback",
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
          ConnectionName.extend({
            code: z.string().describe("Authorization code from OAuth callback"),
            state: z.string().describe("OAuth state parameter from OAuth callback"),
          }),
        ),
        async (c) => {
          const { name, code, state } = c.req.valid("json")
          const status = await MCP.finishAuthCallback(name, code, state)
          return c.json(status)
        },
      )
      .post(
        "/auth/authenticate",
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
            409: connectionConfigurationChanged,
            500: namedErrorResponse("MCP OAuth completion failed", "UnknownError"),
          },
        }),
        validator("json", ConnectionName),
        async (c) => {
          const { name } = c.req.valid("json")
          const supportsOAuth = await MCP.supportsOAuth(name)
          if (!supportsOAuth) {
            return c.json(badRequestBody(`MCP server ${JSON.stringify(name)} does not support OAuth`), 400)
          }
          const status = await MCP.authenticate(name)
          return c.json(status)
        },
      )
      .delete(
        "/auth",
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
            ...errors(400, 404, 500),
          },
        }),
        validator("json", ConnectionName),
        async (c) => {
          const { name } = c.req.valid("json")
          await MCP.removeAuth(name)
          return c.json({ success: true as const })
        },
      )
      // === connection ===
      .post(
        "/connect",
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
            ...errors(400, 404),
            409: {
              description: "MCP configuration changed, authorization is required, or execution owns the connection",
              content: {
                "application/json": {
                  schema: resolver(z.union([
                    MCP.AuthorizationRequiredError.Schema,
                    MCP.ExecutionConnectionRequiredError.Schema,
                    MCP.ConnectionConfigurationChangedError.Schema,
                  ])),
                },
              },
            },
            500: namedErrorResponse("MCP connection failed", "UnknownError"),
          },
        }),
        validator("json", ConnectionName),
        async (c) => {
          const { name } = c.req.valid("json")
          await MCP.connect(name)
          return c.json(true)
        },
      )
      .post(
        "/disconnect",
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
            ...errors(400, 404),
            409: {
              description: "MCP configuration changed or execution owns the connection",
              content: {
                "application/json": {
                  schema: resolver(z.union([
                    MCP.ExecutionConnectionRequiredError.Schema,
                    MCP.ConnectionConfigurationChangedError.Schema,
                  ])),
                },
              },
            },
          },
        }),
        validator("json", ConnectionName),
        async (c) => {
          const { name } = c.req.valid("json")
          await MCP.disconnect(name)
          return c.json(true)
        },
      )
  )
})
