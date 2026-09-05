import { describe, expect, test } from "bun:test"
import {
  enforceReleaseIdentity,
  enforceReleasePublication,
  ReleaseIdentityError,
  ReleasePublicationError,
  type GitHubApiRequest,
  type GitHubApiResult,
  verifyExpectedReleaseSource,
  verifyReleaseIdentity,
} from "./verify-release-identity"

const sourceSHA = "1".repeat(40)
const tagObjectSHA = "2".repeat(40)
const repository = "owner/repository"

function responses(...results: GitHubApiResult[]): GitHubApiRequest {
  let index = 0
  return async () => results[index++] ?? { exitCode: 1, stdout: "", stderr: "unexpected request" }
}

function recordingResponses(log: string[][], ...results: GitHubApiResult[]): GitHubApiRequest {
  let index = 0
  return async (args) => {
    log.push(args)
    return results[index++] ?? { exitCode: 1, stdout: "", stderr: "unexpected request" }
  }
}

function response(input: Partial<GitHubApiResult>): GitHubApiResult {
  return { exitCode: 0, stdout: "", stderr: "", ...input }
}

function releaseBody(runID: string, ownerSHA = sourceSHA): string {
  return `<!-- opencorvus-release-owner-v1 run-id=${runID} source-sha=${ownerSHA} -->\n\n## Generated notes`
}

function publicationRecord(runID: string, draft = true, ownerSHA = sourceSHA, prerelease = true) {
  return {
    id: 5601,
    tag_name: "v0.0.57-beta",
    draft,
    prerelease,
    body: releaseBody(runID, ownerSHA),
  }
}

function releaseRecord(runID: string, draft = true, ownerSHA = sourceSHA, prerelease = true): GitHubApiResult {
  return response({
    stdout: JSON.stringify([publicationRecord(runID, draft, ownerSHA, prerelease)]),
  })
}

describe("immutable release identity", () => {
  test("accepts a lightweight tag owned by the exact build source", async () => {
    await expect(
      verifyReleaseIdentity(
        { repository, version: "0.0.57-beta", sourceSHA, eventName: "push" },
        responses(response({ stdout: "HTTP/2.0 200 OK\n" }), response({ stdout: `commit ${sourceSHA}\n` })),
      ),
    ).resolves.toEqual({ kind: "owned", tag: "v0.0.57-beta", sourceSHA })
  })

  test("peels an annotated tag to the exact build source", async () => {
    await expect(
      verifyReleaseIdentity(
        { repository, version: "0.0.57-beta", sourceSHA, eventName: "push" },
        responses(
          response({ stdout: "HTTP/2.0 200 OK\n" }),
          response({ stdout: `tag ${tagObjectSHA}\n` }),
          response({ stdout: `commit ${sourceSHA}\n` }),
        ),
      ),
    ).resolves.toEqual({ kind: "owned", tag: "v0.0.57-beta", sourceSHA })
  })

  test("maps a workflow dispatch 404 to one available immutable identity", async () => {
    await expect(
      verifyReleaseIdentity(
        { repository, version: "0.0.57-beta", sourceSHA, eventName: "workflow_dispatch" },
        responses(response({ exitCode: 1, stdout: "HTTP/2.0 404 Not Found\n" })),
      ),
    ).resolves.toEqual({ kind: "available", tag: "v0.0.57-beta", sourceSHA })
  })

  test("maps a tag-push 404 to the exact missing-identity error contract", async () => {
    await expect(
      verifyReleaseIdentity(
        { repository, version: "0.0.57-beta", sourceSHA, eventName: "push" },
        responses(response({ exitCode: 1, stdout: "HTTP/2.0 404 Not Found\n" })),
      ),
    ).rejects.toMatchObject<Partial<ReleaseIdentityError>>({
      code: "release_tag_missing_for_tag_push",
      status: 404,
    })
  })

  test("maps an API outage to the exact fail-closed error contract", async () => {
    await expect(
      verifyReleaseIdentity(
        { repository, version: "0.0.57-beta", sourceSHA, eventName: "workflow_dispatch" },
        responses(response({ exitCode: 1, stderr: "HTTP/2.0 503 Service Unavailable\n" })),
      ),
    ).rejects.toMatchObject<Partial<ReleaseIdentityError>>({ code: "github_api_failure", status: 503 })
  })

  test("atomically admits one source and rejects a concurrent source for the same version", async () => {
    const competingSHA = "3".repeat(40)
    await expect(
      enforceReleaseIdentity(
        "claim",
        { repository, version: "0.0.57-beta", sourceSHA, eventName: "workflow_dispatch" },
        responses(
          response({ stdout: "HTTP/2.0 201 Created\n" }),
          response({ stdout: "HTTP/2.0 200 OK\n" }),
          response({ stdout: `commit ${sourceSHA}\n` }),
        ),
      ),
    ).resolves.toEqual({ kind: "claimed", tag: "v0.0.57-beta", sourceSHA })

    await expect(
      enforceReleaseIdentity(
        "claim",
        { repository, version: "0.0.57-beta", sourceSHA: competingSHA, eventName: "workflow_dispatch" },
        responses(
          response({ exitCode: 1, stdout: "HTTP/2.0 422 Unprocessable Entity\n" }),
          response({ stdout: "HTTP/2.0 200 OK\n" }),
          response({ stdout: `commit ${sourceSHA}\n` }),
        ),
      ),
    ).rejects.toMatchObject<Partial<ReleaseIdentityError>>({ code: "release_tag_source_mismatch" })
  })

  test("converges a concurrent same-source claim on exact ownership", async () => {
    await expect(
      enforceReleaseIdentity(
        "claim",
        { repository, version: "0.0.57-beta", sourceSHA, eventName: "workflow_dispatch" },
        responses(
          response({ exitCode: 1, stdout: "HTTP/2.0 409 Conflict\n" }),
          response({ stdout: "HTTP/2.0 200 OK\n" }),
          response({ stdout: `commit ${sourceSHA}\n` }),
        ),
      ),
    ).resolves.toEqual({ kind: "owned", tag: "v0.0.57-beta", sourceSHA })
  })

  test("requires an owned identity at the publication boundary", async () => {
    await expect(
      enforceReleaseIdentity(
        "verify-owned",
        { repository, version: "0.0.57-beta", sourceSHA, eventName: "workflow_dispatch" },
        responses(response({ exitCode: 1, stdout: "HTTP/2.0 404 Not Found\n" })),
      ),
    ).rejects.toMatchObject<Partial<ReleaseIdentityError>>({
      code: "release_tag_missing_for_publication",
      status: 404,
    })
  })

  test("grants draft write authority to the workflow run that atomically creates the Release", async () => {
    const requests: string[][] = []
    await expect(
      enforceReleasePublication(
        "claim-publication",
        { repository, version: "0.0.57-beta", sourceSHA, runID: "1001", prerelease: true },
        recordingResponses(
          requests,
          response({ stdout: "[]" }),
          response({ stdout: "HTTP/2.0 201 Created\n" }),
          releaseRecord("1001"),
        ),
      ),
    ).resolves.toEqual({
      kind: "publication-claimed",
      tag: "v0.0.57-beta",
      sourceSHA,
      runID: "1001",
    })
    expect(requests[0]).toEqual(["api", `repos/${repository}/releases?per_page=100&page=1`])
    expect(requests[1]).toEqual([
      "api",
      "--method",
      "POST",
      "--include",
      "--silent",
      `repos/${repository}/releases`,
      "-f",
      "tag_name=v0.0.57-beta",
      "-f",
      "name=v0.0.57-beta",
      "-f",
      `body=${releaseBody("1001").split("\n", 1)[0]}`,
      "-F",
      "draft=true",
      "-F",
      "prerelease=true",
      "-F",
      "generate_release_notes=true",
    ])
    expect(requests[2]).toEqual(["api", `repos/${repository}/releases?per_page=100&page=1`])
    expect(requests).toHaveLength(3)
  })

  test("waits for a newly created draft to become visible without creating it twice", async () => {
    const delays: number[] = []
    await expect(
      enforceReleasePublication(
        "claim-publication",
        { repository, version: "0.0.57-beta", sourceSHA, runID: "1001", prerelease: true },
        responses(
          response({ stdout: "[]" }),
          response({ stdout: "HTTP/2.0 201 Created\n" }),
          response({ stdout: "[]" }),
          releaseRecord("1001"),
        ),
        async (milliseconds) => {
          delays.push(milliseconds)
        },
      ),
    ).resolves.toEqual({
      kind: "publication-claimed",
      tag: "v0.0.57-beta",
      sourceSHA,
      runID: "1001",
    })
    expect(delays).toEqual([250])
  })

  test("converges one 422 publication claim on the exact concurrent owner without creating twice", async () => {
    const requests: string[][] = []
    const delays: number[] = []
    await expect(
      enforceReleasePublication(
        "claim-publication",
        { repository, version: "0.0.57-beta", sourceSHA, runID: "1001", prerelease: true },
        recordingResponses(
          requests,
          response({ stdout: "[]" }),
          response({ exitCode: 1, stdout: "HTTP/2.0 422 Unprocessable Entity\n" }),
          response({ stdout: "[]" }),
          releaseRecord("1001"),
        ),
        async (milliseconds) => {
          delays.push(milliseconds)
        },
      ),
    ).resolves.toEqual({
      kind: "publication-owned",
      tag: "v0.0.57-beta",
      sourceSHA,
      runID: "1001",
    })
    expect(requests.filter((args) => args.includes("POST"))).toHaveLength(1)
    expect(delays).toEqual([250])
  })

  test("preserves the 422 API failure after bounded inventory visibility is exhausted", async () => {
    const requests: string[][] = []
    const delays: number[] = []
    const missingInventory = [
      response({ stdout: "[]" }),
    ]
    await expect(
      enforceReleasePublication(
        "claim-publication",
        { repository, version: "0.0.57-beta", sourceSHA, runID: "1001", prerelease: true },
        recordingResponses(
          requests,
          ...missingInventory,
          response({ exitCode: 1, stdout: "HTTP/2.0 422 Unprocessable Entity\n" }),
          ...missingInventory,
          ...missingInventory,
          ...missingInventory,
          ...missingInventory,
          ...missingInventory,
          ...missingInventory,
        ),
        async (milliseconds) => {
          delays.push(milliseconds)
        },
      ),
    ).rejects.toMatchObject<Partial<ReleasePublicationError>>({ code: "github_api_failure", status: 422 })
    expect(requests.filter((args) => args.includes("POST"))).toHaveLength(1)
    expect(delays).toEqual([250, 500, 1_000, 2_000, 4_000])
  })

  test("rejects a foreign owner that becomes visible after one 422 publication claim", async () => {
    const requests: string[][] = []
    await expect(
      enforceReleasePublication(
        "claim-publication",
        { repository, version: "0.0.57-beta", sourceSHA, runID: "1001", prerelease: true },
        recordingResponses(
          requests,
          response({ stdout: "[]" }),
          response({ exitCode: 1, stdout: "HTTP/2.0 422 Unprocessable Entity\n" }),
          releaseRecord("2002"),
        ),
      ),
    ).rejects.toMatchObject<Partial<ReleasePublicationError>>({ code: "release_publication_owner_mismatch" })
    expect(requests.filter((args) => args.includes("POST"))).toHaveLength(1)
  })

  test("maps an absent draft in the canonical release inventory to the missing publication contract", async () => {
    await expect(
      enforceReleasePublication(
        "verify-publication",
        { repository, version: "0.0.57-beta", sourceSHA, runID: "1001", prerelease: true },
        responses(response({ stdout: "[]" })),
      ),
    ).rejects.toMatchObject<Partial<ReleasePublicationError>>({ code: "release_publication_missing" })
  })

  test("finds one draft after a full inventory page and rejects the same tag on a later page", async () => {
    const unrelated = Array.from({ length: 100 }, (_, index) => ({ tag_name: `v9.9.${index}-beta` }))
    const requests: string[][] = []
    await expect(
      enforceReleasePublication(
        "verify-publication",
        { repository, version: "0.0.57-beta", sourceSHA, runID: "1001", prerelease: true },
        recordingResponses(
          requests,
          response({ stdout: JSON.stringify(unrelated) }),
          releaseRecord("1001"),
        ),
      ),
    ).resolves.toEqual({
      kind: "publication-owned",
      tag: "v0.0.57-beta",
      sourceSHA,
      runID: "1001",
    })
    expect(requests).toEqual([
      ["api", `repos/${repository}/releases?per_page=100&page=1`],
      ["api", `repos/${repository}/releases?per_page=100&page=2`],
    ])

    await expect(
      enforceReleasePublication(
        "verify-publication",
        { repository, version: "0.0.57-beta", sourceSHA, runID: "1001", prerelease: true },
        responses(
          response({
            stdout: JSON.stringify([publicationRecord("1001"), ...unrelated.slice(1)]),
          }),
          releaseRecord("1001"),
        ),
      ),
    ).rejects.toMatchObject<Partial<ReleasePublicationError>>({ code: "release_publication_invalid" })
  })

  test("maps one failed inventory request to the transport error before draft admission", async () => {
    const requests: string[][] = []
    await expect(
      enforceReleasePublication(
        "claim-publication",
        { repository, version: "0.0.57-beta", sourceSHA, runID: "1001", prerelease: true },
        recordingResponses(requests, response({ exitCode: 1, stderr: "gh: Service Unavailable (HTTP 503)\n" })),
      ),
    ).rejects.toMatchObject<Partial<ReleaseIdentityError>>({ code: "github_api_failure", status: 503 })
    expect(requests).toEqual([["api", `repos/${repository}/releases?per_page=100&page=1`]])
  })

  test.each(["not json", '{"message":"not an inventory"}'])(
    "maps malformed inventory %s to the exact publication contract error",
    async (body) => {
      const requests: string[][] = []
      await expect(
        enforceReleasePublication(
          "claim-publication",
          { repository, version: "0.0.57-beta", sourceSHA, runID: "1001", prerelease: true },
          recordingResponses(requests, response({ stdout: body })),
        ),
      ).rejects.toMatchObject<Partial<ReleasePublicationError>>({ code: "release_publication_invalid" })
      expect(requests).toEqual([["api", `repos/${repository}/releases?per_page=100&page=1`]])
    },
  )

  test("lets the same workflow run resume its draft on a later attempt", async () => {
    await expect(
      enforceReleasePublication(
        "claim-publication",
        { repository, version: "0.0.57-beta", sourceSHA, runID: "1001", prerelease: true },
        responses(releaseRecord("1001")),
      ),
    ).resolves.toEqual({
      kind: "publication-owned",
      tag: "v0.0.57-beta",
      sourceSHA,
      runID: "1001",
    })
  })

  test("rejects an interleaved same-source workflow run before it can write the draft", async () => {
    await expect(
      enforceReleasePublication(
        "claim-publication",
        { repository, version: "0.0.57-beta", sourceSHA, runID: "2002", prerelease: true },
        responses(releaseRecord("1001")),
      ),
    ).rejects.toMatchObject<Partial<ReleasePublicationError>>({ code: "release_publication_owner_mismatch" })
  })

  test("rejects every asset writer after the owned Release becomes public", async () => {
    await expect(
      enforceReleasePublication(
        "verify-publication",
        { repository, version: "0.0.57-beta", sourceSHA, runID: "1001", prerelease: true },
        responses(releaseRecord("1001", false)),
      ),
    ).rejects.toMatchObject<Partial<ReleasePublicationError>>({ code: "release_publication_not_draft" })
  })

  test("settles a draft publication and canonically verifies its public terminal receipt", async () => {
    await expect(
      enforceReleasePublication(
        "settle-publication",
        { repository, version: "0.0.57-beta", sourceSHA, runID: "1001", prerelease: true },
        responses(
          releaseRecord("1001"),
          response({ stdout: "HTTP/2.0 200 OK\n" }),
          releaseRecord("1001", false),
        ),
      ),
    ).resolves.toEqual({
      kind: "publication-settled",
      tag: "v0.0.57-beta",
      sourceSHA,
      runID: "1001",
    })
  })

  test("recovers when the public transition response is uncertain but canonical state is public", async () => {
    await expect(
      enforceReleasePublication(
        "settle-publication",
        { repository, version: "0.0.57-beta", sourceSHA, runID: "1001", prerelease: true },
        responses(
          releaseRecord("1001"),
          response({ exitCode: 1, stderr: "connection closed after request" }),
          releaseRecord("1001", false),
        ),
      ),
    ).resolves.toMatchObject({ kind: "publication-settled", runID: "1001" })
  })

  test("resumes post-publication settlement for the exact owning run", async () => {
    await expect(
      enforceReleasePublication(
        "settle-publication",
        { repository, version: "0.0.57-beta", sourceSHA, runID: "1001", prerelease: true },
        responses(releaseRecord("1001", false)),
      ),
    ).resolves.toMatchObject({ kind: "publication-settled", runID: "1001" })
  })

  test("rejects a public terminal record whose prerelease identity drifted", async () => {
    await expect(
      enforceReleasePublication(
        "settle-publication",
        { repository, version: "0.0.57-beta", sourceSHA, runID: "1001", prerelease: true },
        responses(releaseRecord("1001", false, sourceSHA, false)),
      ),
    ).rejects.toMatchObject<Partial<ReleasePublicationError>>({
      code: "release_publication_prerelease_mismatch",
    })
  })

  test("binds manual dispatch to the exact expected source", () => {
    expect(
      verifyExpectedReleaseSource({
        eventName: "workflow_dispatch",
        sourceSHA,
        expectedSourceSHA: sourceSHA,
      }),
    ).toBe(sourceSHA)
    expect(() =>
      verifyExpectedReleaseSource({
        eventName: "workflow_dispatch",
        sourceSHA,
        expectedSourceSHA: "3".repeat(40),
      }),
    ).toThrow(expect.objectContaining({ code: "release_expected_source_mismatch" }))
  })
})
