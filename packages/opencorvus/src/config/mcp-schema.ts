import z from "zod"

export namespace McpConfigSchema {
  export const McpLocal = z
    .object({
      type: z.literal("local").describe("Type of MCP server connection"),
      command: z.string().array().describe("Command and arguments to run the MCP server"),
      environment: z
        .record(z.string(), z.string())
        .optional()
        .describe("Environment variables to set when running the MCP server"),
      enabled: z.boolean().optional().describe("Enable or disable the MCP server on startup"),
      timeout: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("Timeout in ms for MCP server requests. Defaults to 30000 (30 seconds) if not specified."),
    })
    .strict()
    .meta({
      ref: "McpLocalConfig",
    })

  export const McpOAuth = z
    .object({
      clientId: z
        .string()
        .optional()
        .describe("OAuth client ID. If not provided, dynamic client registration (RFC 7591) will be attempted."),
      clientSecret: z.string().optional().describe("OAuth client secret (if required by the authorization server)"),
      scope: z.string().optional().describe("OAuth scopes to request during authorization"),
    })
    .strict()
    .meta({
      ref: "McpOAuthConfig",
    })
  export type McpOAuth = z.infer<typeof McpOAuth>

  export const McpStaticCredential = z.discriminatedUnion("type", [
    z
      .object({
        type: z.literal("query").describe("Place the stored credential in a URL query parameter"),
        name: z.string().trim().min(1).describe("Query parameter name"),
      })
      .strict(),
    z
      .object({
        type: z.literal("bearer").describe("Send the stored credential as an HTTP Bearer token"),
      })
      .strict(),
    z
      .object({
        type: z.literal("header").describe("Place the stored credential in a custom HTTP header"),
        name: z.string().trim().min(1).describe("HTTP header name"),
      })
      .strict(),
  ])
  export type McpStaticCredential = z.infer<typeof McpStaticCredential>

  export const McpRemote = z
    .object({
      type: z.literal("remote").describe("Type of MCP server connection"),
      url: z.string().describe("URL of the remote MCP server"),
      transport: z
        .enum(["streamable-http", "sse"])
        .describe(
          "Remote MCP transport. Use streamable-http for standard remote MCP endpoints or sse for SSE-only servers.",
        ),
      enabled: z.boolean().optional().describe("Enable or disable the MCP server on startup"),
      headers: z.record(z.string(), z.string()).optional().describe("Headers to send with the request"),
      oauth: z
        .union([McpOAuth, z.literal(false)])
        .optional()
        .describe(
          "OAuth authentication configuration for the MCP server. Set to false to disable OAuth auto-detection.",
        ),
      credential: McpStaticCredential.optional().describe(
        "Static credential placement. The secret is stored in the user-owned MCP auth store, never in project config.",
      ),
      timeout: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("Timeout in ms for MCP server requests. Defaults to 30000 (30 seconds) if not specified."),
    })
    .strict()
    .meta({
      ref: "McpRemoteConfig",
    })

  export const Mcp = z.discriminatedUnion("type", [McpLocal, McpRemote]).superRefine((mcp, context) => {
    if (mcp.type === "remote" && mcp.credential && mcp.oauth !== false) {
      context.addIssue({
        code: "custom",
        path: ["oauth"],
        message: "Static MCP credentials require oauth: false",
      })
    }
  })
  export type Mcp = z.infer<typeof Mcp>
}
