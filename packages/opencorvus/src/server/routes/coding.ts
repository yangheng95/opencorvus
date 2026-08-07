import { Hono } from "hono"
import { describeRoute, resolver, validator } from "hono-openapi"
import { CodingCli } from "@/coding-cli"
import { SystemTerminal } from "@/system-terminal"
import { HTTPException } from "hono/http-exception"
import { errors } from "../error"
import { RightSidebarConversationRoutes } from "./right-sidebar-conversation"

export function CodingRoutes() {
  return new Hono()
    .get(
      "/cli/profiles",
      describeRoute({
        summary: "List installed coding CLIs",
        description: "List installed coding command-line interfaces launchable in the system terminal.",
        operationId: "coding.cli.profiles",
        responses: {
          200: {
            description: "Coding CLI profile list",
            content: {
              "application/json": {
                schema: resolver(CodingCli.ListResponse),
              },
            },
          },
          ...errors(400),
        },
      }),
      async (c) => {
        const profiles = await CodingCli.list().catch((error) => {
          if (error instanceof CodingCli.ConfigError) {
            throw new HTTPException(400, { message: error.data.message })
          }
          throw error
        })
        return c.json(profiles)
      },
    )
    .post(
      "/cli/open",
      describeRoute({
        summary: "Open coding CLI",
        description: "Open an installed coding command-line interface in the operating system terminal application.",
        operationId: "coding.cli.open",
        responses: {
          200: {
            description: "Coding CLI launch result",
            content: {
              "application/json": {
                schema: resolver(CodingCli.OpenResponse),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator("json", CodingCli.OpenInput),
      async (c) => {
        const result = await CodingCli.open(c.req.valid("json")).catch((error) => {
          if (error instanceof CodingCli.ConfigError || error instanceof SystemTerminal.ConfigError) {
            throw new HTTPException(400, { message: error.data.message })
          }
          throw error
        })
        return c.json(result)
      },
    )
    .route("/chat", RightSidebarConversationRoutes("chat"))
    .route("/work", RightSidebarConversationRoutes("work"))
}
