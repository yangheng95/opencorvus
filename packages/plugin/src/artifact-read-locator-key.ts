import type { ArtifactReadLocator } from "./artifact-catalog.js"

export type { ArtifactReadLocator } from "./artifact-catalog.js"

/** Exact declared locator identity shared by Host and browser consumers. */
export function artifactReadLocatorKey(locator: ArtifactReadLocator): string {
  return JSON.stringify(locator)
}
