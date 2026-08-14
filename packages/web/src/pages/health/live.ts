import type { APIRoute } from "astro"

export const prerender = false

export const GET: APIRoute = () =>
  Response.json({ status: "live" }, { headers: { "cache-control": "no-store" } })
