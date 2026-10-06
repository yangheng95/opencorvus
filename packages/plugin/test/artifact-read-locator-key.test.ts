import { expect, test } from "bun:test"
import { artifactReadLocatorKey } from "../src/artifact-read-locator-key"
import {
  ArtifactJSONValueSchema,
  ArtifactReadLocatorSchema,
  artifactReadLocatorKey as catalogKey,
} from "../src/artifact-catalog"

const snapshot = {
  schema_version: 2,
  project_id: "prj_hu878TDjnIllZW4pCcHJ",
  task_id: "tsk_g00VXIVZ7600ZoPUE4Is",
  snapshot_id: "99256fdd-6131-5bd0-a6ad-9a88a06fd768",
  manifest_sha256: "e56e0807ab38bfc9078df744f4ef9175cbacf244b7d0c97e4603d065cf3d1dc2",
} as const

test("Host catalog and runtime-neutral consumers share the exact public function owner", () => {
  expect(catalogKey).toBe(artifactReadLocatorKey)
})

test("validated immutable engine, snapshot and resource locators retain their declared identities", () => {
  const locators = [
    { source: "engine_artifact", artifact_id: "art_hfVH4AJXeWvxF7ON7W0Y", catalog_revision: 9,
      expected_sha256: "667d9eb5589006beb6d830f96ee9549414084cf11123735f4ecac232e5be7e83" },
    { source: "task_artifact_snapshot", snapshot },
    { source: "task_artifact_resource", ref: { snapshot, tree: "resources", path: "hello.txt", media_type: "text/plain", bytes: 26,
      sha256: "91d5d1acf4e0de3211d4a9ac6f5f5753ec6cbe6fad377999e8cbe027de86e67e" } },
  ].map((locator) => ArtifactReadLocatorSchema.parse(locator))
  expect(locators.map(artifactReadLocatorKey)).toEqual([
    '{"source":"engine_artifact","artifact_id":"art_hfVH4AJXeWvxF7ON7W0Y","catalog_revision":9,"expected_sha256":"667d9eb5589006beb6d830f96ee9549414084cf11123735f4ecac232e5be7e83"}',
    '{"source":"task_artifact_snapshot","snapshot":{"schema_version":2,"project_id":"prj_hu878TDjnIllZW4pCcHJ","task_id":"tsk_g00VXIVZ7600ZoPUE4Is","snapshot_id":"99256fdd-6131-5bd0-a6ad-9a88a06fd768","manifest_sha256":"e56e0807ab38bfc9078df744f4ef9175cbacf244b7d0c97e4603d065cf3d1dc2"}}',
    '{"source":"task_artifact_resource","ref":{"snapshot":{"schema_version":2,"project_id":"prj_hu878TDjnIllZW4pCcHJ","task_id":"tsk_g00VXIVZ7600ZoPUE4Is","snapshot_id":"99256fdd-6131-5bd0-a6ad-9a88a06fd768","manifest_sha256":"e56e0807ab38bfc9078df744f4ef9175cbacf244b7d0c97e4603d065cf3d1dc2"},"tree":"resources","path":"hello.txt","media_type":"text/plain","bytes":26,"sha256":"91d5d1acf4e0de3211d4a9ac6f5f5753ec6cbe6fad377999e8cbe027de86e67e"}}',
  ])
})

test("canonical Artifact JSON preserves actual nullable and primitive values", () => {
  const value = { empty: null, flag: true, text: "current artifact", nested: [null, false, 26] }
  expect(ArtifactJSONValueSchema.parse(value)).toEqual(value)
})
