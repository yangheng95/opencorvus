import type { WebsiteRegistrySeed } from "./website-registry-contract"
import type { WebsiteRegistry } from "./website-registry"
import { validateWebsiteRegistrySeed } from "./website-registry-seed-validation"

export async function importWebsiteRegistryPublication(
  registry: WebsiteRegistry,
  seed: WebsiteRegistrySeed,
  sourceRoot: string,
) {
  const validated = await validateWebsiteRegistrySeed(seed, sourceRoot)
  return registry.importValidatedPublication(seed, validated)
}
