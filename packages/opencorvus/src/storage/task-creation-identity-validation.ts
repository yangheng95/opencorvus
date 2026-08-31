import { Database as BunDatabase } from "bun:sqlite"
import { createHash } from "node:crypto"
import { Config } from "@/config/config"
import {
  TaskCreationResolutionSeedSchema,
  TaskPackageRevisionBindingPayloadSchema,
  TaskProcessBindingPayloadSchema,
  type TaskProcessBindingPayload,
} from "@/engine/task-creation-facts"
import { PanelCreationFact, panelCreationTargetID } from "@/engine/panel-creation-fact"
import {
  assertGlobalChatAcceptedInputFacts,
  assertGlobalChatAcceptedSession,
  assertGlobalTaskAcceptedResolution,
} from "@/engine/global-creation-target"
import { Identifier } from "@/id/id"
import { PersistedTaskCreationCreator, type PersistedTaskCreationCreator as PersistedCreator } from "@/engine/task-creation-creator"
import {
  DEFAULT_TASK_ROOT_INGRESS_POLICY,
  taskRootIngressID,
  taskRootIngressPolicyID,
} from "@/engine/task-root-ingress-identity"
import {
  assertCurrentGlobalChatStartRequest,
  assertCurrentGlobalTaskAllocationRequest,
  assertCurrentTaskCreationContract,
  taskCreationContractFingerprint,
  type CanonicalJSON,
} from "@/engine/task-creation-request"
import { canonicalJSONValue, compareCanonicalStrings } from "@/util/canonical-digest"

type Row = Record<string, any>

function rows(db: BunDatabase, sql: string, ...params: unknown[]): Row[] {
  const statement = db.query(sql)
  try {
    return statement.all(...(params as never[])) as Row[]
  } finally {
    statement.finalize()
  }
}

function row(db: BunDatabase, sql: string, ...params: unknown[]): Row | undefined {
  const statement = db.query(sql)
  try {
    return statement.get(...(params as never[])) as Row | undefined
  } finally {
    statement.finalize()
  }
}

function json(value: unknown, label: string): any {
  if (value === null || value === undefined) return undefined
  if (typeof value !== "string") return value
  try {
    return JSON.parse(value)
  } catch (cause) {
    throw new Error(`${label} is not valid JSON`, { cause })
  }
}

function equal(left: unknown, right: unknown, label: string): void {
  const actual = canonicalJSONValue(left, `${label} left`)
  const expected = canonicalJSONValue(right, `${label} right`)
  if (actual !== expected) {
    throw new Error(`${label} diverges from its persisted aggregate`)
  }
}

function artifactPayloads(db: BunDatabase, taskID: string, kind: string): Row[] {
  return rows(db, "SELECT payload FROM engine_artifact WHERE task_id=? AND kind=? ORDER BY id", taskID, kind)
    .map((item) => json(item.payload, `${kind} payload for ${taskID}`) as Row)
}

function processEnvelope(payload: TaskProcessBindingPayload) {
  if (payload.protocol === "task-native-process-binding-v1") {
    return {
      protocol: payload.protocol,
      mode: payload.mode,
      workspace_root: payload.workspace_root,
      package_revision_sha256: payload.package_revision_sha256,
    }
  }
  return {
    protocol: payload.protocol,
    workspace_root: payload.workspace.root,
    package_revision_sha256: payload.package_revision_sha256,
    runtime_descriptor_sha256: payload.runtime_descriptor_sha256,
    runtime_identity_sha256: payload.runtime_identity_sha256,
    network: payload.network,
    resources: payload.resources,
  }
}

function validateTaskCreatorAuthority(
  db: BunDatabase,
  input: {
    taskID: string
    projectID: string
    metadata: Row
    creator: PersistedCreator
    creatorToolPartID: string | null
  },
): void {
  const toolPartID = "tool_part_id" in input.creator ? (input.creator.tool_part_id ?? null) : null
  if (toolPartID !== input.creatorToolPartID || input.metadata.actor !== input.creator.actor) {
    throw new Error(`Task ${input.taskID} creator authority diverges from its accepted aggregate`)
  }
  if (input.creator.actor === "user") return

  const creatorSession = row(db, "SELECT project_id,kind,metadata FROM session WHERE id=?", input.creator.session_id)
  const sessionMetadata = creatorSession
    ? (json(creatorSession.metadata, `Task ${input.taskID} creator Session metadata`) ?? {}) as Row
    : undefined
  const correctSession = creatorSession?.project_id === input.projectID && (
    (input.creator.actor === "mission" && creatorSession.kind === "mission" &&
      sessionMetadata?.mission?.id === input.creator.mission_id &&
      input.metadata.mission?.id === input.creator.mission_id &&
      input.metadata.mission?.session_id === input.creator.session_id) ||
    (input.creator.actor === "orchestrator" && creatorSession.kind === "orchestrator" &&
      input.metadata.actor_session_id === input.creator.session_id) ||
    (input.creator.actor === "right_sidebar_conversation" && creatorSession.kind === "assistant" &&
      sessionMetadata?.conversation?.surface === "right-sidebar" &&
      ["chat", "work"].includes(String(sessionMetadata?.conversation?.experience)) &&
      input.metadata.actor_session_id === input.creator.session_id) ||
    (input.creator.actor === "control_agent" && creatorSession.kind === "assistant" &&
      sessionMetadata?.conversation === undefined && input.metadata.actor_session_id === input.creator.session_id)
  )
  if (!correctSession) throw new Error(`Task ${input.taskID} creator Session authority is not current`)

  if (input.creator.actor === "mission") {
    const opened = row(
      db,
      `SELECT id FROM protocol_event
       WHERE id=? AND aggregate_type='session' AND aggregate_id=?
         AND type='mission.execution.opened' AND correlation_id=?
         AND json_extract(payload,'$.missionID')=?`,
      input.creator.opened_occurrence.event_id,
      input.creator.session_id,
      input.creator.opened_occurrence.operation_id,
      input.creator.mission_id,
    )
    if (!opened) throw new Error(`Task ${input.taskID} Mission creator has no exact opened occurrence`)
  }

  if (!toolPartID) return
  const occurrence = row(
    db,
    `SELECT request.message_id,request.data,message.session_id,message.data AS message_data
     FROM tool_part_request AS request
     JOIN message ON message.id=request.message_id
     WHERE request.id=?`,
    toolPartID,
  )
  const requestData = occurrence ? json(occurrence.data, `Task ${input.taskID} creator Tool request`) as Row : undefined
  const messageData = occurrence ? json(occurrence.message_data, `Task ${input.taskID} creator Message`) as Row : undefined
  if (
    !occurrence || occurrence.message_id !== input.creator.message_id ||
    occurrence.session_id !== input.creator.session_id || messageData?.role !== "assistant" ||
    requestData?.tool !== "panel" || requestData?.callID !== input.creator.tool_call_id ||
    requestData?.input?.action !== "create_task"
  ) {
    throw new Error(`Task ${input.taskID} creator Tool occurrence is not exact`)
  }
  equal(requestData.input, input.creator.tool_input, `Task ${input.taskID} creator Tool input`)
}

function validateTaskContracts(db: BunDatabase): void {
  const missing = row(
    db,
    `SELECT task.id FROM engine_task AS task
     LEFT JOIN engine_task_creation_contract AS contract ON contract.task_id=task.id
     WHERE contract.task_id IS NULL LIMIT 1`,
  )
  if (missing) throw new Error(`Task ${String(missing.id)} is missing its current creation contract`)

  for (const item of rows(
    db,
    `SELECT contract.task_id,contract.fingerprint,contract.contract,contract.creator_tool_part_id,
            contract.time_created AS contract_time,task.project_id,task.session_id,task.request_id,
            task.global_creation_allocation_id,task.source,task.product_pillar,task.title,task.request,
            task.attachments,task.priority,task.budget,task.metadata,task.time_created AS task_time,
            session.project_id AS session_project_id,session.directory,session.kind AS session_kind,
            session.metadata AS session_metadata
     FROM engine_task_creation_contract AS contract
     JOIN engine_task AS task ON task.id=contract.task_id
     LEFT JOIN session ON session.id=task.session_id
     ORDER BY contract.task_id`,
  )) {
    const taskID = String(item.task_id)
    if (item.session_kind !== "root" || item.session_project_id !== item.project_id) {
      throw new Error(`Task ${taskID} root Session is missing or belongs to another Project`)
    }
    const contract = assertCurrentTaskCreationContract(json(item.contract, `Task ${taskID} creation contract`))
    const request = contract.request as Record<string, CanonicalJSON>
    const resolved = contract.resolved as Row
    if (item.fingerprint !== taskCreationContractFingerprint(request)) {
      throw new Error(`Task ${taskID} has an inconsistent creation request fingerprint`)
    }
    if (item.contract_time !== item.task_time) {
      throw new Error(`Task ${taskID} creation contract has a divergent acceptance time`)
    }
    const caller = request.input as Row
    const creator = PersistedTaskCreationCreator.parse(caller.creator)
    const metadata = (json(item.metadata, `Task ${taskID} metadata`) ?? {}) as Row
    validateTaskCreatorAuthority(db, {
      taskID,
      projectID: String(item.project_id),
      metadata,
      creator,
      creatorToolPartID: item.creator_tool_part_id ?? null,
    })

    const packageRows = artifactPayloads(db, taskID, "task_package_revision_binding")
    const processRows = artifactPayloads(db, taskID, "task_execution_capsule_binding")
    if (packageRows.length !== 1 || processRows.length !== 1) {
      throw new Error(`Task ${taskID} requires one package and process binding; found ${packageRows.length}/${processRows.length}`)
    }
    const packageFact = TaskPackageRevisionBindingPayloadSchema.parse(packageRows[0])
    const processFact = TaskProcessBindingPayloadSchema.parse(processRows[0])
    const processDirectory = processFact.protocol === "task-native-process-binding-v1"
      ? processFact.workspace_root
      : processFact.workspace.root
    const bindingDrift = [
      packageFact.time_created !== item.task_time ? "package-time" : undefined,
      processFact.time_created !== item.task_time ? "process-time" : undefined,
      processFact.task_id !== taskID ? "task" : undefined,
      processFact.project_id !== item.project_id ? "project" : undefined,
      processFact.package_revision_sha256 !== packageFact.package_revision.package_digest ? "package-digest" : undefined,
    ].filter((item): item is string => Boolean(item))
    if (bindingDrift.length > 0) {
      throw new Error(
        `Task ${taskID} package/process binding diverges from its accepted aggregate: ${bindingDrift.join(",")}`,
      )
    }

    const opened = row(
      db,
      `SELECT type,session_id,source,emitted_at,payload FROM protocol_event
       WHERE aggregate_type='task' AND aggregate_id=?
         AND type IN ('task.execution.opened','task.execution.reopened')
       ORDER BY seq LIMIT 1`,
      taskID,
    )
    if (
      !opened || opened.type !== "task.execution.opened" || opened.session_id !== item.session_id ||
      opened.source !== "engine.pipeline" || opened.emitted_at !== item.task_time ||
      json(opened.payload, `Task ${taskID} opened payload`)?.execution_epoch !== 1
    ) {
      throw new Error(`Task ${taskID} has no exact initial execution occurrence`)
    }
    const ingress = row(
      db,
      `SELECT ingress.id,ingress.execution_epoch,ingress.sequence,ingress.source,ingress.source_id,
              ingress.inline_payload,ingress.policy_id,ingress.time_accepted,
              policy.semantic_turn_limit,policy.activation_limit,policy.absolute_deadline,
              policy.time_created AS policy_time_created
       FROM engine_task_root_ingress AS ingress
       JOIN engine_task_root_ingress_policy AS policy ON policy.id=ingress.policy_id
       WHERE ingress.task_id=? ORDER BY ingress.execution_epoch,ingress.sequence LIMIT 1`,
      taskID,
    )
    if (
      !ingress || ingress.execution_epoch !== 1 || ingress.sequence !== 1 || ingress.source !== "task" ||
      ingress.source_id !== taskID || ingress.inline_payload !== null || ingress.time_accepted !== item.task_time ||
      ingress.semantic_turn_limit !== DEFAULT_TASK_ROOT_INGRESS_POLICY.semanticTurnLimit ||
      ingress.activation_limit !== DEFAULT_TASK_ROOT_INGRESS_POLICY.activationLimit ||
      ingress.absolute_deadline !== null || !Number.isSafeInteger(ingress.policy_time_created) ||
      ingress.policy_time_created > item.task_time ||
      ingress.policy_id !== taskRootIngressPolicyID(DEFAULT_TASK_ROOT_INGRESS_POLICY) ||
      ingress.id !== taskRootIngressID({ taskID, source: "task", sourceID: taskID })
    ) {
      throw new Error(`Task ${taskID} has no exact initial root ingress`)
    }

    const sessionMetadata = (json(item.session_metadata, `Task ${taskID} root Session metadata`) ?? {}) as Row
    Config.Info.parse(sessionMetadata.taskConfigSnapshot ?? {})
    Config.Overlay.parse(sessionMetadata.configOverlay ?? {})
    const imports = artifactPayloads(db, taskID, "expert_output")
      .map((payload) => payload.import_lineage as Row | undefined)
      .filter((lineage): lineage is Row => Boolean(lineage))
      .map((lineage) => ({ source_task_id: lineage.source_task_id, locator: lineage.source_locator }))
      .sort((left, right) => compareCanonicalStrings(canonicalJSONValue(left), canonicalJSONValue(right)))
    equal(
      contract.resolved,
      {
        project_id: item.project_id,
        directory: processDirectory,
        source: item.source,
        product_pillar: item.product_pillar,
        title: item.title,
        request: item.request,
        attachments: json(item.attachments, `Task ${taskID} attachments`) ?? [],
        priority: item.priority,
        budget: json(item.budget, `Task ${taskID} budget`) ?? null,
        metadata,
        // The Session overlay is intentionally mutable after acceptance. The
        // creation contract is the immutable first-accept authority for the
        // resolved model; Global allocations additionally bind their initial
        // overlay in the acceptance receipt.
        effective_model: resolved.effective_model,
        prompt_profile_id: packageFact.package_revision.id,
        package_revision: packageFact.package_revision,
        creation_expected_package_digest: packageFact.creation_expected_package_digest,
        artifact_imports: imports,
        process: processEnvelope(processFact),
        creator,
      },
      `Task ${taskID} resolved creation snapshot`,
    )
  }
}

function validatePanelCreationSessions(db: BunDatabase): void {
  for (const session of rows(
    db,
    `SELECT id,project_id,kind,metadata FROM session
     WHERE json_type(metadata,'$.panelCreation') IS NOT NULL ORDER BY id`,
  )) {
    const metadata = json(session.metadata, `Panel-created Session ${String(session.id)} metadata`) as Row
    const fact = PanelCreationFact.parse(metadata.panelCreation)
    const request = row(
      db,
      `SELECT request.message_id,request.data,assistant.data AS assistant_data,
              creator.project_id AS creator_project_id,caller.id AS caller_id,caller.data AS caller_data
       FROM tool_part_request AS request
       JOIN message AS assistant ON assistant.id=request.message_id
       JOIN session AS creator ON creator.id=assistant.session_id
       LEFT JOIN message AS caller
         ON caller.id=json_extract(assistant.data,'$.parentID') AND caller.session_id=creator.id
       WHERE request.id=?`,
      fact.tool_part_id,
    )
    const requestData = request ? json(request.data, `Panel Tool ${fact.tool_part_id}`) as Row : undefined
    const assistantData = request ? json(request.assistant_data, `Panel assistant ${fact.message_id}`) as Row : undefined
    const callerData = request ? json(request.caller_data, `Panel caller ${fact.caller_user_message_id}`) as Row : undefined
    if (
      !request || request.message_id !== fact.message_id || request.creator_project_id !== session.project_id ||
      requestData?.tool !== "panel" || requestData.callID !== fact.tool_call_id ||
      assistantData?.role !== "assistant" || request.caller_id !== fact.caller_user_message_id ||
      callerData?.role !== "user" || requestData.input?.action !== fact.operation
    ) {
      throw new Error(`Panel-created Session ${String(session.id)} has no exact Tool/Message lineage`)
    }
    equal(fact.input, requestData.input, `Panel-created Session ${String(session.id)} input`)
    if (
      fact.target_id !== panelCreationTargetID(fact.operation, fact.tool_part_id) ||
      (fact.operation === "wake_work"
        ? session.id !== fact.target_id || session.kind !== "assistant" ||
          metadata.conversation?.surface !== "right-sidebar" || metadata.conversation?.experience !== "work"
        : session.kind !== "mission" || metadata.mission?.id !== fact.target_id)
    ) {
      throw new Error(`Panel-created Session ${String(session.id)} has a divergent deterministic target`)
    }
  }
}

function validateAllocations(db: BunDatabase): void {
  const missingChat = row(
    db,
    `SELECT session.id FROM session
     WHERE json_extract(session.metadata,'$.globalChatStart.version')=2
       AND NOT EXISTS (
         SELECT 1 FROM global_creation_allocation AS allocation
         WHERE allocation.kind='global_chat_start'
           AND allocation.request_id=json_extract(session.metadata,'$.globalChatStart.requestID')
           AND allocation.accepted_project_id=session.project_id
           AND allocation.accepted_target_id=session.id
       ) LIMIT 1`,
  )
  if (missingChat) throw new Error(`Global Chat Session ${String(missingChat.id)} is missing its accepted allocation`)
  const missingTask = row(
    db,
    `SELECT task.id FROM engine_task AS task
     WHERE task.global_creation_allocation_id IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM global_creation_allocation AS allocation
         WHERE allocation.id=task.global_creation_allocation_id
           AND allocation.kind='global_task'
           AND allocation.accepted_project_id=task.project_id
           AND allocation.accepted_target_id=task.id
       ) LIMIT 1`,
  )
  if (missingTask) throw new Error(`Global Task ${String(missingTask.id)} is missing its accepted allocation`)

  for (const allocation of rows(db, "SELECT * FROM global_creation_allocation ORDER BY id")) {
    const requestContract = allocation.kind === "global_task"
      ? assertCurrentGlobalTaskAllocationRequest(json(allocation.request_contract, `Global allocation ${String(allocation.id)}`))
      : assertCurrentGlobalChatStartRequest(json(allocation.request_contract, `Global allocation ${String(allocation.id)}`))
    if (taskCreationContractFingerprint(requestContract) !== allocation.request_fingerprint) {
      throw new Error(`Global creation allocation ${String(allocation.id)} has an inconsistent request fingerprint`)
    }
    Config.Info.parse(json(allocation.resolution_seed, `Global allocation ${String(allocation.id)} resolution seed`))
    if (allocation.kind === "global_task") {
      TaskCreationResolutionSeedSchema.parse(
        json(allocation.task_resolution, `Global Task ${String(allocation.id)} resolution`),
      )
    }
    if (allocation.kind === "global_chat_start" && allocation.task_resolution !== null) {
      throw new Error(`Global Chat allocation ${String(allocation.id)} has a Task resolution`)
    }
    const expectedID = `gca_${createHash("sha256")
      .update(`${String(allocation.kind)}\0${String(allocation.request_id)}`)
      .digest("hex")}`
    if (allocation.id !== expectedID) throw new Error(`Global creation allocation ${String(allocation.id)} has a divergent identity`)

    const project = allocation.materialized_project_id
      ? row(db, "SELECT generation FROM project WHERE id=?", allocation.materialized_project_id)
      : undefined
    const terminal = allocation.accepted_target_id !== null || allocation.rejected_error !== null
    if (
      (project && project.generation !== allocation.materialized_project_generation) ||
      (!project && allocation.materialized_project_id && (!terminal || allocation.time_project_retained === null)) ||
      (project && allocation.time_project_retained !== null)
    ) {
      throw new Error(`Global creation allocation ${String(allocation.id)} has no exact carrying Project occurrence`)
    }
    if (allocation.accepted_project_id !== null && allocation.accepted_project_id !== allocation.materialized_project_id) {
      throw new Error(`Global creation allocation ${String(allocation.id)} accepted outside its carrying Project`)
    }
    if (allocation.accepted_target_id === null) continue

    if (allocation.kind === "global_task") {
      const target = row(
        db,
        `SELECT task.project_id,task.request_id,task.global_creation_allocation_id,task.metadata,
                creation.contract,root_session.metadata AS root_session_metadata
         FROM engine_task AS task
         JOIN engine_task_creation_contract AS creation ON creation.task_id=task.id
         JOIN session AS root_session ON root_session.id=task.session_id
         WHERE task.id=?`,
        allocation.accepted_target_id,
      )
      if (!target) {
        if (project || allocation.time_project_retained === null) {
          throw new Error(`Global Task allocation ${String(allocation.id)} is missing its accepted Task`)
        }
        continue
      }
      const targetContract = assertCurrentTaskCreationContract(json(target.contract, `Global Task ${String(allocation.accepted_target_id)} contract`))
      if (
        target.project_id !== allocation.accepted_project_id || target.request_id !== allocation.request_id ||
        target.global_creation_allocation_id !== allocation.id
      ) {
        throw new Error(`Global Task allocation ${String(allocation.id)} does not match its accepted Task`)
      }
      const taskMetadata = (json(target.metadata, `Global Task ${String(allocation.accepted_target_id)} metadata`) ?? {}) as Row
      assertGlobalTaskAcceptedResolution({
        requestContract,
        resolutionSeed: json(allocation.resolution_seed, `Global allocation ${String(allocation.id)} resolution seed`),
        taskResolution: json(allocation.task_resolution, `Global Task ${String(allocation.id)} resolution`),
        taskContract: targetContract,
        taskMetadata,
        rootSessionMetadata: json(
          target.root_session_metadata,
          `Global Task ${String(allocation.accepted_target_id)} root Session metadata`,
        ),
        initialConfigOverlay: json(
          allocation.accepted_initial_config_overlay,
          `Global Task ${String(allocation.id)} initial config overlay`,
        ),
      })
      const channel = requestContract.channel_binding as Row | null
      if (channel) {
        const binding = row(
          db,
          `SELECT payload FROM engine_channel_binding
           WHERE task_id=? AND platform=? AND channel=? AND thread=?`,
          allocation.accepted_target_id,
          channel.platform,
          channel.channel,
          channel.thread,
        )
        if (!binding) throw new Error(`Global Task allocation ${String(allocation.id)} is missing its channel claim`)
        equal(json(binding.payload, `Global Task ${String(allocation.accepted_target_id)} channel`), channel.payload ?? {}, `Global Task allocation ${String(allocation.id)} channel`)
      }
      continue
    }

    const target = row(db, "SELECT id,project_id,kind,metadata FROM session WHERE id=?", allocation.accepted_target_id)
    if (!target) {
      if (project || allocation.time_project_retained === null) {
        throw new Error(`Global Chat allocation ${String(allocation.id)} is missing its accepted Session`)
      }
      continue
    }
    if (target.project_id !== allocation.accepted_project_id) {
      throw new Error(`Global Chat allocation ${String(allocation.id)} does not match its accepted Session`)
    }
    assertGlobalChatAcceptedSession({
      requestID: String(allocation.request_id),
      requestFingerprint: String(allocation.request_fingerprint),
      requestContract,
      resolutionSeed: json(allocation.resolution_seed, `Global allocation ${String(allocation.id)} resolution seed`),
      initialConfigOverlay: json(
        allocation.accepted_initial_config_overlay,
        `Global Chat ${String(allocation.id)} initial config overlay`,
      ),
      session: {
        id: target.id,
        kind: target.kind,
        metadata: json(target.metadata, `Global Chat ${String(allocation.accepted_target_id)} metadata`),
      },
    })
    const material = `global.chat.start.v1\0${String(allocation.request_id)}`
    const messageID = Identifier.deterministic("message", `${material}\0message`)
    const controlID = Identifier.deterministic("session_control", `${material}\0control`)
    const message = row(db, "SELECT id,session_id,data FROM message WHERE id=?", messageID)
    const partRows = rows(db, "SELECT id,data FROM part WHERE message_id=? ORDER BY id", messageID)
    const control = row(
      db,
      "SELECT id,session_id,kind,source,payload FROM session_control_record WHERE id=?",
      controlID,
    )
    const controlTerminal = row(
      db,
      "SELECT kind,payload FROM session_control_event WHERE control_id=? AND kind='consumed'",
      controlID,
    )
    assertGlobalChatAcceptedInputFacts({
      requestID: String(allocation.request_id),
      requestFingerprint: String(allocation.request_fingerprint),
      requestContract,
      projectID: String(target.project_id),
      sessionID: String(target.id),
      message: message
        ? {
            id: message.id,
            sessionID: message.session_id,
            data: json(message.data, `Global Chat ${messageID} Message`),
          }
        : undefined,
      parts: partRows.map((part) => ({
        id: part.id,
        data: json(part.data, `Global Chat ${messageID} Part ${String(part.id)}`),
      })),
      control: control
        ? {
            id: control.id,
            sessionID: control.session_id,
            kind: control.kind,
            source: control.source,
            payload: json(control.payload, `Global Chat ${controlID} control`),
          }
        : undefined,
      controlTerminal: controlTerminal
        ? {
            kind: controlTerminal.kind,
            payload: controlTerminal.payload === null
              ? null
              : json(controlTerminal.payload, `Global Chat ${controlID} terminal`),
          }
        : undefined,
    })
  }
}

/** Validate only the exact current portable schema. Historical databases are
 * reset and never interpreted or upgraded by this module. */
export function validateTaskCreationIdentitySnapshot(db: BunDatabase): void {
  validateTaskContracts(db)
  validatePanelCreationSessions(db)
  validateAllocations(db)
}
