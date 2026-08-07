import { Hono } from "hono"
import { describeRoute, resolver, validator } from "hono-openapi"
import { HTTPException } from "hono/http-exception"
import { TerminalProfile } from "@/system-terminal/profile"
import { SystemTerminal } from "@/system-terminal"
import { errors } from "../error"

export function TerminalRoutes() {
  return new Hono()
    .get(
      "/profiles",
      describeRoute({
        summary: "List system terminal profiles",
        description: "List shell profiles launchable in the operating system terminal application.",
        operationId: "terminal.profiles",
        responses: {
          200: {
            description: "Terminal profile list",
            content: {
              "application/json": {
                schema: resolver(TerminalProfile.ListResponse),
              },
            },
          },
          ...errors(400),
        },
      }),
      async (c) => {
        const profiles = await TerminalProfile.list().catch((error) => {
          if (error instanceof TerminalProfile.ConfigError) {
            throw new HTTPException(400, { message: error.data.message })
          }
          throw error
        })
        return c.json(profiles)
      },
    )
    .post(
      "/open",
      describeRoute({
        summary: "Open system terminal",
        description: "Open the active project directory in the operating system terminal application.",
        operationId: "terminal.open",
        responses: {
          200: {
            description: "Terminal launch result",
            content: {
              "application/json": {
                schema: resolver(SystemTerminal.OpenResponse),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator("json", SystemTerminal.OpenInput),
      async (c) => {
        const result = await SystemTerminal.open(c.req.valid("json")).catch((error) => {
          if (error instanceof SystemTerminal.ConfigError || error instanceof TerminalProfile.ConfigError) {
            throw new HTTPException(400, { message: error.data.message })
          }
          throw error
        })
        return c.json(result)
      },
    )
}
