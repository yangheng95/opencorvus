import { generatedFeaturedSquads } from "../content/featured-squads.generated"
import { publicPath, type PublicLocale } from "../content/public-market"

/**
 * Featured squads for the landing page's funnel row.
 *
 * Deliberately reads the generated module rather than the SQLite registry. The landing page is
 * statically prerendered, and the registry imports bun:sqlite, which does not resolve under the
 * Node-flavoured SSR loader that prerendering uses. Keeping the read static also means the most
 * requested page on the site never waits on a database.
 */

export type FeaturedSquad = {
  readonly label: string
  readonly description: string
  readonly href: string
  readonly agentCount: number
  readonly workflowCount: number
}

export function featuredSquadsFor(locale: PublicLocale): FeaturedSquad[] {
  return generatedFeaturedSquads.map((entry) => ({
    label: entry.displayLabel[locale],
    description: entry.description[locale],
    href: publicPath(locale, `/market/${entry.identity.namespace}/${entry.identity.id}/`),
    agentCount: entry.agentCount,
    workflowCount: entry.workflowCount,
  }))
}
