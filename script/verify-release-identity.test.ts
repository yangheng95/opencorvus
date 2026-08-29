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

function releaseRecord(runID: string, draft = true, ownerSHA = sourceSHA, prerelease = true): GitHubApiResult {
  return response({
    stdout: JSON.stringify({
      id: 5601,
      tag_name: "v0.0.56-beta.1",
      draft,
      prerelease,
      body: releaseBody(runID, ownerSHA),
    }),
  })
}

describe("immutable release identity", () => {
  test("accepts a lightweight tag owned by the exact build source", async () => {
    await expect(
      verifyReleaseIdentity(
        { repository, version: "0.0.56-beta.1", sourceSHA, eventName: "push" },
        responses(response({ stdout: "HTTP/2.0 200 OK\n" }), response({ stdout: `commit ${sourceSHA}\n` })),
      ),
    ).resolves.toEqual({ kind: "owned", tag: "v0.0.56-beta.1", sourceSHA })
  })

  test("peels an annotated tag to the exact build source", async () => {
    await expect(
      verifyReleaseIdentity(
        { repository, version: "0.0.56-beta.1", sourceSHA, eventName: "push" },
        responses(
          response({ stdout: "HTTP/2.0 200 OK\n" }),
          response({ stdout: `tag ${tagObjectSHA}\n` }),
          response({ stdout: `commit ${sourceSHA}\n` }),
        ),
      ),
    ).resolves.toEqual({ kind: "owned", tag: "v0.0.56-beta.1", sourceSHA })
  })

  test("maps a workflow dispatch 404 to one available immutable identity", async () => {
    await expect(
      verifyReleaseIdentity(
        { repository, version: "0.0.56-beta.1", sourceSHA, eventName: "workflow_dispatch" },
        responses(response({ exitCode: 1, stdout: "HTTP/2.0 404 Not Found\n" })),
      ),
    ).resolves.toEqual({ kind: "available", tag: "v0.0.56-beta.1", sourceSHA })
  })

  test("maps a tag-push 404 to the exact missing-identity error contract", async () => {
    await expect(
      verifyReleaseIdentity(
        { repository, version: "0.0.56-beta.1", sourceSHA, eventName: "push" },
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
        { repository, version: "0.0.56-beta.1", sourceSHA, eventName: "workflow_dispatch" },
        responses(response({ exitCode: 1, stderr: "HTTP/2.0 503 Service Unavailable\n" })),
      ),
    ).rejects.toMatchObject<Partial<ReleaseIdentityError>>({ code: "github_api_failure", status: 503 })
  })

  test("atomically admits one source and rejects a concurrent source for the same version", async () => {
    const competingSHA = "3".repeat(40)
    await expect(
      enforceReleaseIdentity(
        "claim",
        { repository, version: "0.0.56-beta.1", sourceSHA, eventName: "workflow_dispatch" },
        responses(
          response({ stdout: "HTTP/2.0 201 Created\n" }),
          response({ stdout: "HTTP/2.0 200 OK\n" }),
          response({ stdout: `commit ${sourceSHA}\n` }),
        ),
      ),
    ).resolves.toEqual({ kind: "claimed", tag: "v0.0.56-beta.1", sourceSHA })

    await expect(
      enforceReleaseIdentity(
        "claim",
        { repository, version: "0.0.56-beta.1", sourceSHA: competingSHA, eventName: "workflow_dispatch" },
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
        { repository, version: "0.0.56-beta.1", sourceSHA, eventName: "workflow_dispatch" },
        responses(
          response({ exitCode: 1, stdout: "HTTP/2.0 409 Conflict\n" }),
          response({ stdout: "HTTP/2.0 200 OK\n" }),
          response({ stdout: `commit ${sourceSHA}\n` }),
        ),
      ),
    ).resolves.toEqual({ kind: "owned", tag: "v0.0.56-beta.1", sourceSHA })
  })

  test("requires an owned identity at the publication boundary", async () => {
    await expect(
      enforceReleaseIdentity(
        "verify-owned",
        { repository, version: "0.0.56-beta.1", sourceSHA, eventName: "workflow_dispatch" },
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
        { repository, version: "0.0.56-beta.1", sourceSHA, runID: "1001", prerelease: true },
        recordingResponses(
          requests,
          response({ stdout: "HTTP/2.0 201 Created\n" }),
          response({ stdout: "HTTP/2.0 200 OK\n" }),
          releaseRecord("1001"),
        ),
      ),
    ).resolves.toEqual({
      kind: "publication-claimed",
      tag: "v0.0.56-beta.1",
      sourceSHA,
      runID: "1001",
    })
    expect(requests[0]).toEqual([
      "api",
      "--method",
      "POST",
      "--include",
      "--silent",
      `repos/${repository}/releases`,
      "-f",
      "tag_name=v0.0.56-beta.1",
      "-f",
      "name=v0.0.56-beta.1",
      "-f",
      `body=${releaseBody("1001").split("\n", 1)[0]}`,
      "-F",
      "draft=true",
      "-F",
      "prerelease=true",
      "-F",
      "generate_release_notes=true",
    ])
  })

  test("lets the same workflow run resume its draft on a later attempt", async () => {
    await expect(
      enforceReleasePublication(
        "claim-publication",
        { repository, version: "0.0.56-beta.1", sourceSHA, runID: "1001", prerelease: true },
        responses(
          response({ exitCode: 1, stdout: "HTTP/2.0 422 Unprocessable Entity\n" }),
          response({ stdout: "HTTP/2.0 200 OK\n" }),
          releaseRecord("1001"),
        ),
      ),
    ).resolves.toEqual({
      kind: "publication-owned",
      tag: "v0.0.56-beta.1",
      sourceSHA,
      runID: "1001",
    })
  })

  test("rejects an interleaved same-source workflow run before it can write the draft", async () => {
    await expect(
      enforceReleasePublication(
        "claim-publication",
        { repository, version: "0.0.56-beta.1", sourceSHA, runID: "2002", prerelease: true },
        responses(
          response({ exitCode: 1, stdout: "HTTP/2.0 422 Unprocessable Entity\n" }),
          response({ stdout: "HTTP/2.0 200 OK\n" }),
          releaseRecord("1001"),
        ),
      ),
    ).rejects.toMatchObject<Partial<ReleasePublicationError>>({ code: "release_publication_owner_mismatch" })
  })

  test("rejects every asset writer after the owned Release becomes public", async () => {
    await expect(
      enforceReleasePublication(
        "verify-publication",
        { repository, version: "0.0.56-beta.1", sourceSHA, runID: "1001", prerelease: true },
        responses(response({ stdout: "HTTP/2.0 200 OK\n" }), releaseRecord("1001", false)),
      ),
    ).rejects.toMatchObject<Partial<ReleasePublicationError>>({ code: "release_publication_not_draft" })
  })

  test("settles a draft publication and canonically verifies its public terminal receipt", async () => {
    await expect(
      enforceReleasePublication(
        "settle-publication",
        { repository, version: "0.0.56-beta.1", sourceSHA, runID: "1001", prerelease: true },
        responses(
          response({ stdout: "HTTP/2.0 200 OK\n" }),
          releaseRecord("1001"),
          response({ stdout: "HTTP/2.0 200 OK\n" }),
          response({ stdout: "HTTP/2.0 200 OK\n" }),
          releaseRecord("1001", false),
        ),
      ),
    ).resolves.toEqual({
      kind: "publication-settled",
      tag: "v0.0.56-beta.1",
      sourceSHA,
      runID: "1001",
    })
  })

  test("recovers when the public transition response is uncertain but canonical state is public", async () => {
    await expect(
      enforceReleasePublication(
        "settle-publication",
        { repository, version: "0.0.56-beta.1", sourceSHA, runID: "1001", prerelease: true },
        responses(
          response({ stdout: "HTTP/2.0 200 OK\n" }),
          releaseRecord("1001"),
          response({ exitCode: 1, stderr: "connection closed after request" }),
          response({ stdout: "HTTP/2.0 200 OK\n" }),
          releaseRecord("1001", false),
        ),
      ),
    ).resolves.toMatchObject({ kind: "publication-settled", runID: "1001" })
  })

  test("resumes post-publication settlement for the exact owning run", async () => {
    await expect(
      enforceReleasePublication(
        "settle-publication",
        { repository, version: "0.0.56-beta.1", sourceSHA, runID: "1001", prerelease: true },
        responses(response({ stdout: "HTTP/2.0 200 OK\n" }), releaseRecord("1001", false)),
      ),
    ).resolves.toMatchObject({ kind: "publication-settled", runID: "1001" })
  })

  test("rejects a public terminal record whose prerelease identity drifted", async () => {
    await expect(
      enforceReleasePublication(
        "settle-publication",
        { repository, version: "0.0.56-beta.1", sourceSHA, runID: "1001", prerelease: true },
        responses(response({ stdout: "HTTP/2.0 200 OK\n" }), releaseRecord("1001", false, sourceSHA, false)),
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
