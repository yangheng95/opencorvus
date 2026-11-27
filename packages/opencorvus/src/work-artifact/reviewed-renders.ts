type RenderIdentity = { url: string; sha: string }

export function reviewedWorkArtifactRenders<T extends RenderIdentity>(
  reviewed: readonly RenderIdentity[],
  current: T[],
): T[] {
  if (reviewed.length !== current.length) {
    throw new Error(
      "Final Work Artifact render count differs from the reviewed validation receipt; validate and review the fresh renders before delivery",
    )
  }
  for (const [index, render] of current.entries()) {
    if (render.url !== reviewed[index]!.url || render.sha !== reviewed[index]!.sha) {
      throw new Error(
        `Final Work Artifact render ${index + 1} differs from the reviewed validation receipt; validate and review the fresh renders before delivery`,
      )
    }
  }
  return current
}
