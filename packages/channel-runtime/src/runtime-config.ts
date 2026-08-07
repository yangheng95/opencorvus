import { permissionForProfile, pickPermissionProfile } from "./permission-profile"

type Config = Record<string, unknown>

function parseConfig(raw: string | undefined): Config {
  if (!raw) return {}
  const parsed = JSON.parse(raw)
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("OPENCORVUS_CONFIG_CONTENT must be a JSON object")
  }
  return parsed as Config
}

function permissionMap(permission: unknown): Config {
  if (!permission || typeof permission !== "object" || Array.isArray(permission)) return {}
  return permission as Config
}

export function resolveRuntimeConfig(raw: string | undefined, profileInput: string | undefined) {
  const config = parseConfig(raw)
  const profile = pickPermissionProfile(profileInput)
  const botPermission = permissionForProfile(profile)
  return {
    config: {
      ...config,
      permission: {
        ...permissionMap(config.permission),
        ...botPermission,
      },
    },
    profile,
  }
}
