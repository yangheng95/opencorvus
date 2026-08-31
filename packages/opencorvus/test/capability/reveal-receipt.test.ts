import { describe, expect, test } from "bun:test"
import { capabilityRef } from "@opencorvus-ai/util/capability-ref"
import { Message } from "../../src/session/message"
import {
  CAPABILITY_REVEAL_RECEIPT_METADATA_KEY,
  ActivatedCapability,
  capabilityRevealMaterializationFingerprint,
  CorruptCapabilityRevealError,
  createCapabilityRevealReceipt,
  foldCapabilityRevealReceipts,
  providerToolDefinitionChars,
  providerToolDefinitionDigest,
  providerToolDefinitionTokens,
  reduceCapabilityRevealCandidate,
} from "../../src/capability/reveal-receipt"

const occurrenceID = "message_reveal_occurrence"
const harnessProjectionHash = "1".repeat(64)
const catalogSnapshotHash = "2".repeat(64)
const catalogSnapshotRef = `/attachment/project_reveal/${catalogSnapshotHash}.json`
const requestedRef = capabilityRef({
  kind: "tool",
  source: "platform",
  owner_ref: "tool-registry",
  local_ref: "read",
})

const definition = {
  name: "read",
  description: "Read one exact file.",
  input_schema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
  strict: false,
} as const

const activation = ActivatedCapability.parse({
  requested_ref: requestedRef,
  executable_ref: requestedRef,
  provider_name: "read",
  definition,
  definition_digest: providerToolDefinitionDigest(definition),
  payload_chars: providerToolDefinitionChars(definition),
  payload_tokens: providerToolDefinitionTokens(definition),
  materializer_binding_digest: "3".repeat(64),
})

const baseDefinition = {
  definitionDigest: "4".repeat(64),
  payloadChars: 120,
  payloadTokens: 30,
}

function emptyState() {
  return foldCapabilityRevealReceipts({
    occurrenceID,
    parts: [],
    harnessProjectionHash,
    catalogSnapshotRef,
    catalogSnapshotHash,
    baseDefinition,
  })
}

function receiptPart(receipt: ReturnType<typeof createCapabilityRevealReceipt>, id: string): Message.ToolPart {
  return Message.ToolPart.parse({
    id,
    sessionID: "session_reveal",
    messageID: occurrenceID,
    type: "tool",
    callID: receipt.search_call_id,
    tool: "capability_search",
    state: {
      status: "completed",
      input: {
        queries: ["read"],
        exact_refs: receipt.activated.map((entry) => entry.requested_ref),
        deactivate_refs: receipt.deactivate_refs,
        limit: 5,
      },
      output: "revealed",
      title: "Capability search",
      metadata: { [CAPABILITY_REVEAL_RECEIPT_METADATA_KEY]: receipt },
      time: { start: receipt.revision * 10, end: receipt.revision * 10 + 1 },
    },
  })
}

function revealFingerprint(input: {
  callID: string
  priorRevision: number
  resultRefs: readonly typeof requestedRef[]
  activated: readonly typeof activation[]
  deactivateRefs: readonly typeof requestedRef[]
  activeRefs: readonly typeof requestedRef[]
  activeDefinitionDigest: string
  activePayloadChars: number
  activePayloadTokens: number
}) {
  return capabilityRevealMaterializationFingerprint({
    occurrenceID,
    callID: input.callID,
    priorRevision: input.priorRevision,
    harnessProjectionHash,
    catalogSnapshotRef,
    catalogSnapshotHash,
    params: {
      queries: ["read"],
      exact_refs: input.activated.map((entry) => entry.requested_ref),
      deactivate_refs: input.deactivateRefs,
      limit: 5,
    },
    resultRefs: input.resultRefs,
    activated: input.activated,
    activeRefs: input.activeRefs,
    activeDefinitionDigest: input.activeDefinitionDigest,
    activePayloadChars: input.activePayloadChars,
    activePayloadTokens: input.activePayloadTokens,
  })
}

describe("occurrence capability reveal receipts", () => {
  test("folds an activation and explicit deactivation into one exact active Tool state", () => {
    const initial = emptyState()
    expect({ chars: initial.payloadChars, tokens: initial.payloadTokens }).toEqual({
      chars: baseDefinition.payloadChars,
      tokens: baseDefinition.payloadTokens,
    })
    const activatedState = reduceCapabilityRevealCandidate({ prior: initial, deactivateRefs: [], activated: [activation] })
    const first = createCapabilityRevealReceipt({
      occurrence_id: occurrenceID,
      search_call_id: "call_search_1",
      prior_revision: 0,
      revision: 1,
      harness_projection_hash: harnessProjectionHash,
      catalog_snapshot_ref: catalogSnapshotRef,
      catalog_snapshot_hash: catalogSnapshotHash,
      materialization_fingerprint: revealFingerprint({
        callID: "call_search_1",
        priorRevision: 0,
        resultRefs: [requestedRef],
        activated: [activation],
        deactivateRefs: [],
        activeRefs: activatedState.activeRefs,
        activeDefinitionDigest: activatedState.definitionDigest,
        activePayloadChars: activatedState.payloadChars,
        activePayloadTokens: activatedState.payloadTokens,
      }),
      result_refs: [requestedRef],
      deactivate_refs: [],
      activated: [activation],
      active_refs: activatedState.activeRefs,
      active_definition_digest: activatedState.definitionDigest,
      active_payload_chars: activatedState.payloadChars,
      active_payload_tokens: activatedState.payloadTokens,
    })
    const afterFirst = foldCapabilityRevealReceipts({
      occurrenceID,
      parts: [receiptPart(first, "part_search_1")],
      harnessProjectionHash,
      catalogSnapshotRef,
      catalogSnapshotHash,
      baseDefinition,
    })
    expect({
      revision: afterFirst.revision,
      active: [...afterFirst.active.keys()],
      definitions: afterFirst.definitions.map((item) => item.provider_name),
      payloadChars: afterFirst.payloadChars,
    }).toEqual({
      revision: 1,
      active: ["capability:tool:platform:tool-registry:read"],
      definitions: ["read"],
      payloadChars: baseDefinition.payloadChars + providerToolDefinitionChars(definition),
    })

    const deactivatedState = reduceCapabilityRevealCandidate({
      prior: afterFirst,
      deactivateRefs: [requestedRef],
      activated: [],
    })
    const second = createCapabilityRevealReceipt({
      occurrence_id: occurrenceID,
      search_call_id: "call_search_2",
      prior_revision: 1,
      revision: 2,
      harness_projection_hash: harnessProjectionHash,
      catalog_snapshot_ref: catalogSnapshotRef,
      catalog_snapshot_hash: catalogSnapshotHash,
      materialization_fingerprint: revealFingerprint({
        callID: "call_search_2",
        priorRevision: 1,
        resultRefs: [],
        activated: [],
        deactivateRefs: [requestedRef],
        activeRefs: deactivatedState.activeRefs,
        activeDefinitionDigest: deactivatedState.definitionDigest,
        activePayloadChars: deactivatedState.payloadChars,
        activePayloadTokens: deactivatedState.payloadTokens,
      }),
      result_refs: [],
      deactivate_refs: [requestedRef],
      activated: [],
      active_refs: deactivatedState.activeRefs,
      active_definition_digest: deactivatedState.definitionDigest,
      active_payload_chars: deactivatedState.payloadChars,
      active_payload_tokens: deactivatedState.payloadTokens,
    })
    const final = foldCapabilityRevealReceipts({
      occurrenceID,
      parts: [receiptPart(second, "part_search_2"), receiptPart(first, "part_search_1")],
      harnessProjectionHash,
      catalogSnapshotRef,
      catalogSnapshotHash,
      baseDefinition,
    })
    expect({
      revision: final.revision,
      active: final.active.size,
      definitions: final.definitions.length,
      payloadChars: final.payloadChars,
    }).toEqual({
      revision: 2,
      active: 0,
      definitions: 0,
      payloadChars: baseDefinition.payloadChars,
    })
  })

  test("accounts for the permanent search definition in the active Provider payload budget", () => {
    const prior = foldCapabilityRevealReceipts({
      occurrenceID,
      parts: [],
      harnessProjectionHash,
      catalogSnapshotRef,
      catalogSnapshotHash,
      baseDefinition: {
        definitionDigest: "5".repeat(64),
        payloadChars: 31_950,
        payloadTokens: 7_990,
      },
    })
    expect(() =>
      reduceCapabilityRevealCandidate({ prior, deactivateRefs: [], activated: [activation] }),
    ).toThrow("maximum is 32000")
  })

  test("reports typed corruption when a completed search has no receipt", () => {
    const part = Message.ToolPart.parse({
      id: "part_search_missing_receipt",
      sessionID: "session_reveal",
      messageID: occurrenceID,
      type: "tool",
      callID: "call_search_missing_receipt",
      tool: "capability_search",
      state: {
        status: "completed",
        input: { queries: ["read"], exact_refs: [], deactivate_refs: [], limit: 5 },
        output: "invalid",
        title: "Capability search",
        metadata: {},
        time: { start: 1, end: 2 },
      },
    })
    expect(() =>
      foldCapabilityRevealReceipts({
        occurrenceID,
        parts: [part],
        harnessProjectionHash,
        catalogSnapshotRef,
        catalogSnapshotHash,
        baseDefinition,
      }),
    ).toThrow(CorruptCapabilityRevealError)
  })

  test("binds each receipt to its ToolPart call identity and persisted input fingerprint", () => {
    const initial = emptyState()
    const activatedState = reduceCapabilityRevealCandidate({ prior: initial, deactivateRefs: [], activated: [activation] })
    const valid = createCapabilityRevealReceipt({
      occurrence_id: occurrenceID,
      search_call_id: "call_search_bound",
      prior_revision: 0,
      revision: 1,
      harness_projection_hash: harnessProjectionHash,
      catalog_snapshot_ref: catalogSnapshotRef,
      catalog_snapshot_hash: catalogSnapshotHash,
      materialization_fingerprint: revealFingerprint({
        callID: "call_search_bound",
        priorRevision: 0,
        resultRefs: [requestedRef],
        activated: [activation],
        deactivateRefs: [],
        activeRefs: activatedState.activeRefs,
        activeDefinitionDigest: activatedState.definitionDigest,
        activePayloadChars: activatedState.payloadChars,
        activePayloadTokens: activatedState.payloadTokens,
      }),
      result_refs: [requestedRef],
      deactivate_refs: [],
      activated: [activation],
      active_refs: activatedState.activeRefs,
      active_definition_digest: activatedState.definitionDigest,
      active_payload_chars: activatedState.payloadChars,
      active_payload_tokens: activatedState.payloadTokens,
    })
    const validPart = receiptPart(valid, "part_search_bound")
    const movedCall = Message.ToolPart.parse({ ...validPart, callID: "call_search_moved" })
    const movedInput = Message.ToolPart.parse({
      ...validPart,
      state: { ...validPart.state, input: { ...validPart.state.input, queries: ["changed"] } },
    })
    const tamperedReceipt = createCapabilityRevealReceipt({
      ...valid,
      materialization_fingerprint: "0".repeat(64),
    })
    for (const part of [movedCall, movedInput, receiptPart(tamperedReceipt, "part_search_tampered")]) {
      expect(() =>
        foldCapabilityRevealReceipts({
          occurrenceID,
          parts: [part],
          harnessProjectionHash,
          catalogSnapshotRef,
          catalogSnapshotHash,
          baseDefinition,
        }),
      ).toThrow(CorruptCapabilityRevealError)
    }
  })

  test("reports a typed corrupt occurrence when the persisted revision chain skips", () => {
    const initial = emptyState()
    const activatedState = reduceCapabilityRevealCandidate({ prior: initial, deactivateRefs: [], activated: [activation] })
    const skipped = createCapabilityRevealReceipt({
      occurrence_id: occurrenceID,
      search_call_id: "call_search_2",
      prior_revision: 1,
      revision: 2,
      harness_projection_hash: harnessProjectionHash,
      catalog_snapshot_ref: catalogSnapshotRef,
      catalog_snapshot_hash: catalogSnapshotHash,
      materialization_fingerprint: revealFingerprint({
        callID: "call_search_2",
        priorRevision: 1,
        resultRefs: [requestedRef],
        activated: [activation],
        deactivateRefs: [],
        activeRefs: activatedState.activeRefs,
        activeDefinitionDigest: activatedState.definitionDigest,
        activePayloadChars: activatedState.payloadChars,
        activePayloadTokens: activatedState.payloadTokens,
      }),
      result_refs: [requestedRef],
      deactivate_refs: [],
      activated: [activation],
      active_refs: activatedState.activeRefs,
      active_definition_digest: activatedState.definitionDigest,
      active_payload_chars: activatedState.payloadChars,
      active_payload_tokens: activatedState.payloadTokens,
    })
    expect(() =>
      foldCapabilityRevealReceipts({
        occurrenceID,
        parts: [receiptPart(skipped, "part_search_skipped")],
        harnessProjectionHash,
        catalogSnapshotRef,
        catalogSnapshotHash,
        baseDefinition,
      }),
    ).toThrow("expected 1, found 2")
  })
})
