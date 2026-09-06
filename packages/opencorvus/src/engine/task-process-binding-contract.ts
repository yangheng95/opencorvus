export const TASK_EXECUTION_CAPSULE_BINDING_PROTOCOL = "task-execution-capsule-binding-v2" as const
export const TASK_NATIVE_PROCESS_BINDING_PROTOCOL = "task-native-process-binding-v2" as const

export const TASK_PROCESS_BINDING_INVALID_INDEX = "engine_artifact_invalid_task_process_binding_idx" as const

const SHA256_SQL = (path: string) =>
  `json_type(payload, '${path}') = 'text' AND length(json_extract(payload, '${path}')) = 64 AND json_extract(payload, '${path}') NOT GLOB '*[^a-f0-9]*'`
const NONEMPTY_TEXT_SQL = (path: string) =>
  `json_type(payload, '${path}') = 'text' AND length(json_extract(payload, '${path}')) > 0`
const SAFE_NONNEGATIVE_INTEGER_SQL = (path: string) =>
  `json_type(payload, '${path}') = 'integer' AND json_extract(payload, '${path}') BETWEEN 0 AND 9007199254740991`
const SAFE_POSITIVE_INTEGER_SQL = (path: string) =>
  `json_type(payload, '${path}') = 'integer' AND json_extract(payload, '${path}') BETWEEN 1 AND 9007199254740991`

const NATIVE_PAYLOAD_SQL = `
  json_extract(payload, '$.protocol') = '${TASK_NATIVE_PROCESS_BINDING_PROTOCOL}'
  AND json_remove(
    payload,
    '$.protocol', '$.task_id', '$.project_id', '$.package_revision_sha256', '$.mode',
    '$.logical_workspace_root', '$.workspace_root', '$.initial_tree_sha256', '$.time_created'
  ) = '{}'
  AND ${NONEMPTY_TEXT_SQL("$.task_id")}
  AND ${NONEMPTY_TEXT_SQL("$.project_id")}
  AND ${SHA256_SQL("$.package_revision_sha256")}
  AND json_type(payload, '$.mode') = 'text'
  AND json_extract(payload, '$.mode') = 'native'
  AND ${NONEMPTY_TEXT_SQL("$.logical_workspace_root")}
  AND ${NONEMPTY_TEXT_SQL("$.workspace_root")}
  AND ${SHA256_SQL("$.initial_tree_sha256")}
  AND ${SAFE_NONNEGATIVE_INTEGER_SQL("$.time_created")}
`

const CAPSULE_PAYLOAD_SQL = `
  json_extract(payload, '$.protocol') = '${TASK_EXECUTION_CAPSULE_BINDING_PROTOCOL}'
  AND json_remove(
    payload,
    '$.protocol', '$.task_id', '$.project_id', '$.package_revision_sha256',
    '$.runtime_descriptor_sha256', '$.runtime_identity_sha256', '$.logical_workspace_root',
    '$.workspace', '$.network', '$.resources', '$.time_created'
  ) = '{}'
  AND ${NONEMPTY_TEXT_SQL("$.task_id")}
  AND ${NONEMPTY_TEXT_SQL("$.project_id")}
  AND ${SHA256_SQL("$.package_revision_sha256")}
  AND ${SHA256_SQL("$.runtime_descriptor_sha256")}
  AND ${SHA256_SQL("$.runtime_identity_sha256")}
  AND ${NONEMPTY_TEXT_SQL("$.logical_workspace_root")}
  AND json_type(payload, '$.workspace') = 'object'
  AND json_remove(json_extract(payload, '$.workspace'), '$.root', '$.initial_tree_sha256', '$.access') = '{}'
  AND ${NONEMPTY_TEXT_SQL("$.workspace.root")}
  AND ${SHA256_SQL("$.workspace.initial_tree_sha256")}
  AND json_type(payload, '$.workspace.access') = 'text'
  AND json_extract(payload, '$.workspace.access') = 'read_write'
  AND json_type(payload, '$.network') = 'text'
  AND json_extract(payload, '$.network') = 'none'
  AND json_type(payload, '$.resources') = 'object'
  AND json_remove(
    json_extract(payload, '$.resources'),
    '$.memory_max_bytes', '$.tasks_max', '$.nofile_max', '$.tmpfs_max_bytes', '$.cpu_quota_percent'
  ) = '{}'
  AND ${SAFE_POSITIVE_INTEGER_SQL("$.resources.memory_max_bytes")}
  AND ${SAFE_POSITIVE_INTEGER_SQL("$.resources.tasks_max")}
  AND ${SAFE_POSITIVE_INTEGER_SQL("$.resources.nofile_max")}
  AND ${SAFE_POSITIVE_INTEGER_SQL("$.resources.tmpfs_max_bytes")}
  AND json_type(payload, '$.resources.cpu_quota_percent') IN ('integer', 'real')
  AND json_extract(payload, '$.resources.cpu_quota_percent') > 0
  AND json_extract(payload, '$.resources.cpu_quota_percent') <= 100
  AND ${SAFE_NONNEGATIVE_INTEGER_SQL("$.time_created")}
`

/**
 * One SQLite authority for the current Task process-binding epoch. The same
 * predicate defines the partial invalid-fact index and the startup read, so a
 * valid database performs no scan over historical Engine Artifacts.
 */
export const TASK_PROCESS_BINDING_INVALID_SQL = `
  kind = 'task_execution_capsule_binding'
  AND CASE
    WHEN payload IS NULL OR json_valid(payload) = 0 OR json_type(payload) <> 'object' THEN 1
    WHEN (${NATIVE_PAYLOAD_SQL}) OR (${CAPSULE_PAYLOAD_SQL}) THEN 0
    ELSE 1
  END = 1
` as const
