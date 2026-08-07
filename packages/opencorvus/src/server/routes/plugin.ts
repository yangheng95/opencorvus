import { Hono } from "hono"
import { Plugin } from "@/plugin"

function pluginRequest(input: { request: Request; serviceID: string }) {
  const url = new URL(input.request.url)
  const segments = url.pathname.split("/")
  const routePrefixMatches =
    segments.length >= 3 && segments[1] === "plugin" && decodeURIComponent(segments[2]) === input.serviceID
  if (!routePrefixMatches) {
    throw new Error(`Plugin service route prefix mismatch for ${input.serviceID}`)
  }
  const suffix = segments.slice(3).join("/")
  url.pathname = suffix ? `/${suffix}` : "/"
  return new Request(url, input.request)
}

export function PluginRoutes() {
  return new Hono().all("/:id/*", async (c) => {
    const serviceID = c.req.param("id")
    const service = (await Plugin.services()).get(serviceID)
    if (!service) {
      throw new Plugin.PluginServiceNotFoundError({
        message: `Plugin service ${serviceID} is not registered`,
        serviceID,
      })
    }
    return service.app.fetch(pluginRequest({ request: c.req.raw, serviceID }), c.env)
  })
}
