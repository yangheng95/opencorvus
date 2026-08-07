import { Env } from "../env"
import type { Provider } from "./provider"

function googleVertexVars(options: Record<string, any>) {
  const project =
    options["project"] ??
    Env.get("GOOGLE_VERTEX_PROJECT") ??
    Env.get("GOOGLE_CLOUD_PROJECT") ??
    Env.get("GCP_PROJECT") ??
    Env.get("GCLOUD_PROJECT")
  const location =
    options["location"] ??
    Env.get("GOOGLE_VERTEX_LOCATION") ??
    Env.get("GOOGLE_CLOUD_LOCATION") ??
    Env.get("VERTEX_LOCATION") ??
    "us-central1"
  const endpoint = location === "global" ? "aiplatform.googleapis.com" : `${location}-aiplatform.googleapis.com`

  return {
    GOOGLE_VERTEX_PROJECT: project,
    GOOGLE_VERTEX_LOCATION: location,
    GOOGLE_VERTEX_ENDPOINT: endpoint,
  }
}

export function loadBaseURL(model: Provider.Model, options: Record<string, any>) {
  const raw = options["baseURL"] ?? model.api.url
  if (typeof raw !== "string") return raw
  const vars = model.providerID === "google-vertex" ? googleVertexVars(options) : undefined
  return raw.replace(/\$\{([^}]+)\}/g, (match, key) => {
    const val = Env.get(String(key)) ?? vars?.[String(key) as keyof typeof vars]
    return val ?? match
  })
}
