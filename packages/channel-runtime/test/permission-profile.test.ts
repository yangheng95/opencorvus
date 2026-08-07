import { describe, expect, test } from "bun:test"
import { permissionForProfile, pickPermissionProfile } from "../src/permission-profile"

describe("channel permission profile", () => {
  test("defaults to standard profile", () => {
    const result = pickPermissionProfile(undefined)
    expect(result).toBe("standard")
  })

  test("rejects unknown profile instead of using standard", () => {
    expect(() => pickPermissionProfile("unknown")).toThrow("Unknown OPENCORVUS_CHANNEL_PERMISSION_PROFILE")
  })

  test("restricted blocks write-like tools", () => {
    const permission = permissionForProfile("restricted")
    expect(permission["*"]).toBe("deny")
    expect(permission.bash).toBe("deny")
    expect(permission.edit).toBe("deny")
    expect(permission.write).toBe("deny")
    expect(permission.input).toBe("deny")
  })

  test("standard keeps project tools but denies risky boundaries", () => {
    const permission = permissionForProfile("standard")
    expect(permission.bash).toBe("allow")
    expect(permission.edit).toBe("allow")
    expect(permission.external_directory).toBe("deny")
    expect(permission.doom_loop).toBe("deny")
    expect(permission.question).toBe("deny")
  })

  test("permissive remains fully enabled when selected explicitly", () => {
    const permission = permissionForProfile("permissive")
    expect(permission.bash).toBe("allow")
    expect(permission.edit).toBe("allow")
    expect(permission.external_directory).toBe("allow")
    expect(permission.doom_loop).toBe("allow")
  })

  test("passthrough does not override user permissions", () => {
    const permission = permissionForProfile("passthrough")
    expect(Object.keys(permission)).toHaveLength(0)
  })
})
