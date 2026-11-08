import GithubSlugger from "github-slugger"

/** Labels belong to one rendered document; fragment is its encoded component without #. */
export function markdownSectionIndex(labels: readonly string[], fragment: string): number | undefined {
  let target: string
  try {
    target = decodeURIComponent(fragment)
  } catch {
    return undefined
  }
  const slugger = new GithubSlugger()
  const index = labels.findIndex((label) => slugger.slug(label) === target)
  return index < 0 ? undefined : index
}
