import { Process } from "@/util/process"
import { gitProcessArgs } from "@/util/git"
import { taskRootDirectory } from "./task-directory"
import { findArtifact, requireTask, viewBuildHostObservationArtifact } from "./store"

export const BUILD_OBSERVATION_CONTENT_CHUNK_BYTES = 256 * 1024

export class BuildObservationContentError extends Error {
  override readonly name = "BuildObservationContentError"

  constructor(
    message: string,
    readonly code: "artifact_not_found" | "file_not_found" | "side_absent" | "invalid_range" | "git_read_failed",
  ) {
    super(message)
  }
}

export interface BuildObservationContentRange {
  bytes: Uint8Array
  objectID: string
  objectBytes: number
  offset: number
  endExclusive: number
  complete: boolean
  isBinary: boolean
}

/**
 * Read one bounded range from an exact Git blob selected through a
 * Task-owned Build Host observation.
 *
 * The Engine Artifact authorizes the Task, file, side, object identity, and
 * byte size. Git remains the only file-content source. The process output is
 * streamed past the requested offset and only the requested range is retained.
 */
export async function readBuildObservationContentRange(input: {
  taskID: string
  artifactID: string
  file: string
  side: "before" | "after"
  offset: number
  length: number
  signal?: AbortSignal
}): Promise<BuildObservationContentRange> {
  const task = requireTask(input.taskID)
  const artifact = findArtifact({ taskID: input.taskID, artifactID: input.artifactID })
  if (!artifact || artifact.kind !== "build_host_observation") {
    throw new BuildObservationContentError(
      `Build Host observation ${input.artifactID} was not found in Task ${input.taskID}`,
      "artifact_not_found",
    )
  }
  const observation = viewBuildHostObservationArtifact(artifact)
  const diff = observation.diffs.find((candidate) => candidate.file === input.file)
  if (!diff) {
    throw new BuildObservationContentError(
      `File ${input.file} was not observed by Build Host observation ${input.artifactID}`,
      "file_not_found",
    )
  }
  const object = diff[input.side]
  if (!object) {
    throw new BuildObservationContentError(
      `File ${input.file} has no ${input.side} content in Build Host observation ${input.artifactID}`,
      "side_absent",
    )
  }
  if (
    !Number.isSafeInteger(input.offset) ||
    input.offset < 0 ||
    input.offset > object.bytes ||
    !Number.isSafeInteger(input.length) ||
    input.length < 1 ||
    input.length > BUILD_OBSERVATION_CONTENT_CHUNK_BYTES
  ) {
    throw new BuildObservationContentError(
      `Invalid Build observation byte range offset=${input.offset} length=${input.length} for ${object.bytes}-byte object`,
      "invalid_range",
    )
  }

  const endExclusive = Math.min(object.bytes, input.offset + input.length)
  if (endExclusive === input.offset) {
    return {
      bytes: new Uint8Array(),
      objectID: object.oid,
      objectBytes: object.bytes,
      offset: input.offset,
      endExclusive,
      complete: true,
      isBinary: diff.is_binary,
    }
  }

  const process = Process.spawnHost(gitProcessArgs(["cat-file", "blob", object.oid]), {
    cwd: taskRootDirectory(task),
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
    abort: input.signal,
    ownership: "process",
  })
  if (!process.stdout || !process.stderr) {
    await process.terminate()
    throw new BuildObservationContentError("git cat-file did not expose output pipes", "git_read_failed")
  }

  const stderrPromise = new Response(process.stderr as unknown as ReadableStream<Uint8Array>).text()
  const chunks: Uint8Array[] = []
  let streamed = 0
  let retained = 0
  let terminatedAfterRange = false
  try {
    for await (const rawChunk of process.stdout) {
      const chunk = Buffer.isBuffer(rawChunk) ? rawChunk : Buffer.from(rawChunk)
      const chunkStart = streamed
      const chunkEnd = chunkStart + chunk.byteLength
      streamed = chunkEnd
      const overlapStart = Math.max(input.offset, chunkStart)
      const overlapEnd = Math.min(endExclusive, chunkEnd)
      if (overlapEnd > overlapStart) {
        const slice = chunk.subarray(overlapStart - chunkStart, overlapEnd - chunkStart)
        chunks.push(slice)
        retained += slice.byteLength
      }
      if (streamed >= endExclusive && endExclusive < object.bytes) {
        terminatedAfterRange = true
        await process.terminate()
        break
      }
    }
    const exitCode = await process.exited
    const stderr = await stderrPromise
    if (!terminatedAfterRange && exitCode !== 0) {
      throw new BuildObservationContentError(
        `git cat-file failed for Build observation object ${object.oid}: ${stderr.trim()}`,
        "git_read_failed",
      )
    }
  } catch (error) {
    if (!terminatedAfterRange) await process.terminate().catch(() => undefined)
    if (error instanceof BuildObservationContentError) throw error
    throw new BuildObservationContentError(
      `git cat-file failed for Build observation object ${object.oid}: ${
        error instanceof Error ? error.message : String(error)
      }`,
      "git_read_failed",
    )
  }
  const bytes = Buffer.concat(chunks, retained)
  if (bytes.byteLength !== endExclusive - input.offset) {
    throw new BuildObservationContentError(
      `Git object ${object.oid} yielded ${bytes.byteLength} bytes for expected range ${
        endExclusive - input.offset
      }`,
      "git_read_failed",
    )
  }
  return {
    bytes,
    objectID: object.oid,
    objectBytes: object.bytes,
    offset: input.offset,
    endExclusive,
    complete: endExclusive === object.bytes,
    isBinary: diff.is_binary,
  }
}
