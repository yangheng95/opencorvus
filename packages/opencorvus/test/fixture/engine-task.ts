import { budgetRow } from "../../src/engine/helpers"
import {
  buildTaskCreationContractFact,
  buildTaskCreationRequestFact,
  taskCreationCallerRequest,
} from "../../src/engine/task-creation-contract"
import { expertSquadPackageRevisionBinding } from "../../src/engine/expert-squad-package-revision-binding"
import { persistTask, type PersistTaskInput } from "../../src/engine/pipeline"

/**
 * Establish a Task fixture whose creation ingress is outside the test's scope.
 *
 * This used to also call a `retirePendingTaskRootIngressesForOperatorIntent...`
 * helper, whose name promised to keep the creation ingress out of the FIFO head.
 * That function only ever *read* rows — it mutated nothing and its return value
 * was discarded here — so the call was a no-op, and the tests that rely on this
 * helper have always been passing without it. It went with the Retry intent it
 * was written for.
 */
export function persistEstablishedTask(input: Omit<PersistTaskInput, "creationContract">): void {
  const creator = { actor: "user" as const }
  const request = buildTaskCreationRequestFact({
    request: taskCreationCallerRequest({
      caller: {
        source: input.source ?? "api",
        productPillar: input.productPillar,
        title: input.title,
        request: input.request,
        attachments: input.attachments ?? [],
        priority: input.priority ?? "normal",
        budget: input.budget ?? null,
        metadata: input.metadata,
        expectedPackageDigest: input.creationExpectedPackageDigest,
        artifactSources: [],
      },
      creator,
    }),
  })
  const sessionMetadata = (input.rootSession.metadata ?? {}) as Record<string, any>
  const snapshot = (sessionMetadata.taskConfigSnapshot ?? {}) as Record<string, any>
  const overlay = (sessionMetadata.configOverlay ?? {}) as Record<string, any>
  const process = input.executionCapsuleBinding.protocol === "task-native-process-binding-v2"
    ? {
        protocol: input.executionCapsuleBinding.protocol,
        mode: input.executionCapsuleBinding.mode,
        workspace_root: input.executionCapsuleBinding.workspace_root,
        package_revision_sha256: input.executionCapsuleBinding.package_revision_sha256,
      }
    : {
        protocol: input.executionCapsuleBinding.protocol,
        workspace_root: input.executionCapsuleBinding.workspace.root,
        package_revision_sha256: input.executionCapsuleBinding.package_revision_sha256,
        runtime_descriptor_sha256: input.executionCapsuleBinding.runtime_descriptor_sha256,
        runtime_identity_sha256: input.executionCapsuleBinding.runtime_identity_sha256,
        network: input.executionCapsuleBinding.network,
        resources: input.executionCapsuleBinding.resources,
      }
  persistTask({
    ...input,
    creationContract: buildTaskCreationContractFact({
      request,
      resolved: {
        project_id: input.projectID,
        directory: input.rootSession.directory,
        source: input.source ?? "api",
        product_pillar: input.productPillar,
        title: input.title,
        request: input.request,
        attachments: input.attachments ?? [],
        priority: input.priority ?? "normal",
        budget: budgetRow(input.budget) ?? null,
        metadata: input.metadata,
        effective_model: overlay.model ?? snapshot.model ?? null,
        prompt_profile_id: input.packageRevision.id,
        package_revision: expertSquadPackageRevisionBinding(input.packageRevision),
        creation_expected_package_digest: input.creationExpectedPackageDigest ?? null,
        artifact_imports: [],
        process,
        creator,
      },
    }),
  })
}
