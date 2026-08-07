import { Hono } from "hono"
import { describeRoute, resolver, validator } from "hono-openapi"
import z from "zod"
import { NativeAgentRegistryLifecycle } from "@/agent/native-agent-registry-lifecycle"
import { Auth } from "@/auth"
import { Provider } from "@/provider/provider"
import { errors } from "../error"
import { lazy } from "../../util/lazy"
import { settleProviderRefreshInvalidation } from "../provider-refresh"

const AuthMutationResponse = z
  .object({
    ok: z.literal(true),
    issues: Provider.LoadIssue.array(),
  })
  .strict()

export const AuthRoutes = lazy(() =>
  new Hono()
    .put(
      "/:providerID",
      describeRoute({
        summary: "Set auth credentials",
        description: "Set authentication credentials",
        operationId: "auth.set",
        responses: {
          200: {
            description: "Successfully set authentication credentials",
            content: {
              "application/json": {
                schema: resolver(AuthMutationResponse),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator(
        "param",
        z.object({
          providerID: z.string(),
        }),
      ),
      validator("json", Auth.Info),
      async (c) => {
        const providerID = c.req.valid("param").providerID
        const info = c.req.valid("json")
        await Auth.set(providerID, info)
        const issues = await settleProviderRefreshInvalidation([
          { phase: "cache.provider", run: Provider.resetAll },
          { phase: "cache.native-agents", run: NativeAgentRegistryLifecycle.resetAll },
        ])
        return c.json({ ok: true as const, issues })
      },
    )
    .delete(
      "/:providerID",
      describeRoute({
        summary: "Remove auth credentials",
        description: "Remove authentication credentials",
        operationId: "auth.remove",
        responses: {
          200: {
            description: "Successfully removed authentication credentials",
            content: {
              "application/json": {
                schema: resolver(AuthMutationResponse),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator(
        "param",
        z.object({
          providerID: z.string(),
        }),
      ),
      async (c) => {
        const providerID = c.req.valid("param").providerID
        await Auth.remove(providerID)
        const issues = await settleProviderRefreshInvalidation([
          { phase: "cache.provider", run: Provider.resetAll },
          { phase: "cache.native-agents", run: NativeAgentRegistryLifecycle.resetAll },
        ])
        return c.json({ ok: true as const, issues })
      },
    ),
)
