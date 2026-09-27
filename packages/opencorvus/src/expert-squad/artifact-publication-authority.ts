import { CapabilityRefCodec } from "@opencorvus-ai/util/capability-ref"
import { ExpertSquadRegistry } from "./registry"
import type { TaskToolExecutionScope } from "@/tool/task-tool-execution-scope"

export class ArtifactPublisherAuthorityError extends Error {
  readonly code = "PACKAGE_TYPED_PUBLISHER_REQUIRED"

  constructor(
    readonly artifactType: string,
    readonly expectedPublisher: string | null,
    readonly actualPublisher: string | null,
  ) {
    super(
      `Artifact ${artifactType} requires ${expectedPublisher ?? "Host-owned publication"}; received ${actualPublisher ?? "a non-package Tool"}`,
    )
    this.name = "ArtifactPublisherAuthorityError"
  }
}

/** The immutable bound manifest and the Host-validated caller own this relation. */
export async function assertArtifactPublicationAuthority(
  scope: TaskToolExecutionScope,
  artifactType: string,
): Promise<void> {
  const revision = scope.owner.packageRevision
  const manifest = await ExpertSquadRegistry.readPackageRevisionManifest(revision.packageDigest)
  if (
    manifest.id !== revision.id ||
    manifest.namespace !== revision.namespace ||
    manifest.version !== revision.version
  ) {
    throw new Error(`Artifact publication package identity differs from bound revision ${revision.packageDigest}`)
  }
  const publishers = manifest.artifact_publishers
  if (!publishers || !Object.hasOwn(publishers, artifactType)) return
  const declared = publishers[artifactType]!
  const expected = declared === null ? null : CapabilityRefCodec.decode(declared).local_ref
  if (expected === null || scope.packageToolRef !== expected) {
    throw new ArtifactPublisherAuthorityError(artifactType, expected, scope.packageToolRef)
  }
}
