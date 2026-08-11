import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { canonicalBrandLogoPath, websiteFaviconPath } from "../script/generate-brand-assets"

test("website favicon is the canonical filled OpenCorvus bird", () => {
  expect(readFileSync(websiteFaviconPath)).toEqual(readFileSync(canonicalBrandLogoPath))
})
