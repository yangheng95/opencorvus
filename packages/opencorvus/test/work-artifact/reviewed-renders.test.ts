import { expect, test } from "bun:test"
import { createHash } from "node:crypto"
import sharp from "sharp"
import { reviewedWorkArtifactRenders } from "../../src/work-artifact/reviewed-renders"

// Identities name actual immutable PNG bytes. The native lifecycle and desktop
// checks separately exercise real publication and visual review.
const images = await Promise.all(
  ["#2563eb", "#0f766e", "#b45309", "#6d28d9"].map(async (background) => {
    const bytes = await sharp({ create: { width: 16, height: 16, channels: 4, background } })
      .png()
      .toBuffer()
    const sha = createHash("sha256").update(bytes).digest("hex")
    return { url: `/attachment/project/${sha}.png`, sha }
  }),
)
const reviewed = images.slice(0, 3)

test("the complete ordered reviewed renders return the current delivery references", () => {
  const current = reviewed.map((render, index) => ({
    ...render,
    filename: `slide-${index + 1}.png`,
    mime: "image/png",
  }))
  expect(reviewedWorkArtifactRenders(reviewed, current)).toEqual(current)
})

for (const index of [0, 1, 2]) {
  test(`changed render ${index + 1} maps to the explicit fresh-review error`, () => {
    const current = reviewed.map((render, position) => (position === index ? { ...images[3]! } : { ...render }))
    expect(() => reviewedWorkArtifactRenders(reviewed, current)).toThrow(
      `Final Work Artifact render ${index + 1} differs from the reviewed validation receipt; validate and review the fresh renders before delivery`,
    )
  })
}

test("changed canonical reference maps to the explicit fresh-review error", () => {
  const current = reviewed.map((render, index) => ({
    ...render,
    url: index === 1 ? render.url.replace("/project/", "/another-project/") : render.url,
  }))
  expect(() => reviewedWorkArtifactRenders(reviewed, current)).toThrow(
    "Final Work Artifact render 2 differs from the reviewed validation receipt; validate and review the fresh renders before delivery",
  )
})

test("reordered renders map to the explicit fresh-review error", () => {
  expect(() => reviewedWorkArtifactRenders(reviewed, [...reviewed].reverse())).toThrow(
    "Final Work Artifact render 1 differs from the reviewed validation receipt; validate and review the fresh renders before delivery",
  )
})

for (const count of [2, 4]) {
  test(`${count} final renders map to the explicit complete-review error`, () => {
    const current = Array.from({ length: count }, (_, index) => reviewed[index % reviewed.length]!)
    expect(() => reviewedWorkArtifactRenders(reviewed, current)).toThrow(
      "Final Work Artifact render count differs from the reviewed validation receipt; validate and review the fresh renders before delivery",
    )
  })
}
