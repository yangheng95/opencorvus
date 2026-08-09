import { describe, expect, test } from "bun:test"

import { releaseVersionMetadata } from "./sync-version"

describe("release version metadata", () => {
  test("projects stable, semantic prerelease, and compact product versions to GitHub release metadata", () => {
    expect(releaseVersionMetadata("0.0.35")).toEqual({ version: "0.0.35", prerelease: false })
    expect(releaseVersionMetadata("v0.0.35-beta.4")).toEqual({ version: "0.0.35-beta.4", prerelease: true })
    expect(releaseVersionMetadata("v0.0.38beta")).toEqual({ version: "0.0.38-beta", prerelease: true })
  })
})
