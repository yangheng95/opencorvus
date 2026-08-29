import { describe, expect, test } from "bun:test"
import {
  assertReleaseMutationTopology,
  readReleaseMutationTree,
  ReleaseMutationTopologyError,
} from "./check-release-mutation-topology"

const frozenIndex = readReleaseMutationTree()

describe("release mutation topology", () => {
  test("maps the immutable index tree to the canonical release authorities", () => {
    const { tree, sources } = frozenIndex
    expect(tree).toMatch(/^[0-9a-f]{40}$/)
    expect(assertReleaseMutationTopology(sources)).toEqual([
      { file: ".github/workflows/build.yml", authority: 'cli:gh:release-upload:"v${VERSION}"' },
      { file: "script/settle-desktop-update-channel.ts", authority: "programmatic:gh:release-upload:this.tag" },
      { file: "script/settle-desktop-update-channel.ts", authority: "rest:release-write" },
      { file: "script/verify-release-identity.ts", authority: "rest:git-ref-write" },
      { file: "script/verify-release-identity.ts", authority: "rest:release-write" },
    ])
  })

  test("maps the legacy gh wrapper writer to the exact topology error contract", () => {
    const sources = new Map(frozenIndex.sources)
    sources.set(
      "packages/opencorvus/script/legacy-release.sh",
      'gh_cmd() { SSL_CERT_FILE="$SSL_CERT_FILE" gh "$@"; }\ngh_cmd release create "v${VERSION}" --repo "$RELEASE_REPO"\n',
    )
    expect(() => assertReleaseMutationTopology(sources)).toThrow(
      expect.objectContaining<Partial<ReleaseMutationTopologyError>>({
        code: "unexpected_release_mutation_topology",
        findings: expect.arrayContaining([
          {
            file: "packages/opencorvus/script/legacy-release.sh",
            authority: 'cli:gh_cmd:release-create:"v${VERSION}"',
          },
        ]),
      }),
    )
  })

  test.each([
    ["git wrapper tag", 'git_cmd() { git "$@"; }\ngit_cmd tag v1.2.3\n', "git:tag-write"],
    ["git wrapper tag push", 'git_cmd() { git "$@"; }\ngit_cmd push origin tag v1.2.3\n', "git:tag-push"],
    ["direct refs tag push", "git push origin refs/tags/v1.2.3\n", "git:tag-push"],
    ["direct shorthand tag push", "git push origin v1.2.3\n", "git:tag-push"],
    ["gh global repository option", "gh -R owner/repository release create v1.2.3\n", "cli:gh:release-create:v1.2.3"],
  ])("maps %s to a typed topology error", (_name, source, authority) => {
    const sources = new Map(frozenIndex.sources)
    sources.set("script/unexpected-release-writer.sh", source)
    expect(() => assertReleaseMutationTopology(sources)).toThrow(
      expect.objectContaining<Partial<ReleaseMutationTopologyError>>({
        code: "unexpected_release_mutation_topology",
        findings: expect.arrayContaining([{ file: "script/unexpected-release-writer.sh", authority }]),
      }),
    )
  })
})
