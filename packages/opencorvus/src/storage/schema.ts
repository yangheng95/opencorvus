import type { AnySQLiteTable } from "drizzle-orm/sqlite-core"
import { ControlAccountTable } from "../control/control.sql"
import { DatabaseAuthorityTable } from "./database.sql"
import { BusPublicationDeliveryTable, BusPublicationOutboxTable } from "../bus/bus.sql"
import { ChannelIngressReceiptTable } from "../channel/channel.sql"
import {
  SessionTable,
  MessageTable,
  PartTable,
  InteractiveArtifactTable,
  SessionControlRecordTable,
  WorkerTurnDescriptorTable,
  TodoTable,
  TodoSnapshotTable,
} from "../session/session.sql"
import { PermissionExecutionResultTable, PermissionLedgerTable, PermissionPolicyTable } from "../permission/permission.sql"
import { SessionShareTable } from "../share/share.sql"
import { ProjectTable } from "../project/project.sql"
import { WorkspaceTable } from "../workspace/workspace.sql"
import { MemoryFileTable, MemoryChunkTable, MemoryEmbeddingTable } from "../memory/memory.sql"
import { AutomationProjectTargetTable, AutomationRunTable, AutomationTable } from "../scheduler/automation.sql"
import { EventJobFireTable, EventJobTable } from "../scheduler/event.sql"
import { TaskPlanTable } from "../memory/task-plan.sql"
import { WorkbenchBriefSnapshotTable } from "../workbench/workbench.sql"
import {
  EngineTaskTable,
  EngineTaskCancellationAuthorityTable,
  EngineBuildObservationCleanupTable,
  EngineGoalTable,
  EngineInteractionRequestTable,
  EngineArtifactTable,
  EngineWorkflowNodeOccurrenceTable,
  EngineBrowserPreviewTargetIdentityTable,
  EngineArtifactCatalogRevisionTable,
  EngineArtifactVersionTable,
  EngineProgressSnapshotTable,
  EngineChannelBindingTable,
} from "../engine/engine.sql"
import { ProtocolAggregateSequenceTable, ProtocolEventTable, ProtocolInboxTable } from "../protocol/protocol.sql"
import { QuickNoteTable } from "../quicknote/quicknote.sql"
import { DecisionLogTable } from "../decision-log/schema"
import { EngineMetricSpecTable, EngineMetricResultTable, EngineIterationTable } from "../metrics/metrics.sql"
import { ProviderUsageEventTable } from "../usage/usage.sql"

export {
  ControlAccountTable,
  DatabaseAuthorityTable,
  BusPublicationDeliveryTable,
  BusPublicationOutboxTable,
  ChannelIngressReceiptTable,
  SessionTable,
  MessageTable,
  PartTable,
  InteractiveArtifactTable,
  SessionControlRecordTable,
  WorkerTurnDescriptorTable,
  TodoTable,
  TodoSnapshotTable,
  PermissionExecutionResultTable,
  PermissionLedgerTable,
  PermissionPolicyTable,
  SessionShareTable,
  ProjectTable,
  WorkspaceTable,
  MemoryFileTable,
  MemoryChunkTable,
  MemoryEmbeddingTable,
  AutomationProjectTargetTable,
  AutomationRunTable,
  AutomationTable,
  EventJobFireTable,
  EventJobTable,
  TaskPlanTable,
  WorkbenchBriefSnapshotTable,
  EngineTaskTable,
  EngineTaskCancellationAuthorityTable,
  EngineBuildObservationCleanupTable,
  EngineGoalTable,
  EngineInteractionRequestTable,
  EngineArtifactTable,
  EngineWorkflowNodeOccurrenceTable,
  EngineBrowserPreviewTargetIdentityTable,
  EngineArtifactCatalogRevisionTable,
  EngineArtifactVersionTable,
  EngineProgressSnapshotTable,
  EngineChannelBindingTable,
  ProtocolAggregateSequenceTable,
  ProtocolEventTable,
  ProtocolInboxTable,
  QuickNoteTable,
  DecisionLogTable,
  EngineMetricSpecTable,
  EngineMetricResultTable,
  EngineIterationTable,
  ProviderUsageEventTable,
}

export const ApplicationSchema = {
  ControlAccountTable,
  DatabaseAuthorityTable,
  BusPublicationDeliveryTable,
  BusPublicationOutboxTable,
  ChannelIngressReceiptTable,
  SessionTable,
  MessageTable,
  PartTable,
  InteractiveArtifactTable,
  SessionControlRecordTable,
  WorkerTurnDescriptorTable,
  TodoTable,
  TodoSnapshotTable,
  PermissionExecutionResultTable,
  PermissionLedgerTable,
  PermissionPolicyTable,
  SessionShareTable,
  ProjectTable,
  WorkspaceTable,
  MemoryFileTable,
  MemoryChunkTable,
  MemoryEmbeddingTable,
  AutomationProjectTargetTable,
  AutomationRunTable,
  AutomationTable,
  EventJobFireTable,
  EventJobTable,
  TaskPlanTable,
  WorkbenchBriefSnapshotTable,
  EngineTaskTable,
  EngineTaskCancellationAuthorityTable,
  EngineBuildObservationCleanupTable,
  EngineGoalTable,
  EngineInteractionRequestTable,
  EngineArtifactTable,
  EngineWorkflowNodeOccurrenceTable,
  EngineBrowserPreviewTargetIdentityTable,
  EngineArtifactCatalogRevisionTable,
  EngineArtifactVersionTable,
  EngineProgressSnapshotTable,
  EngineChannelBindingTable,
  ProtocolAggregateSequenceTable,
  ProtocolEventTable,
  ProtocolInboxTable,
  QuickNoteTable,
  DecisionLogTable,
  EngineMetricSpecTable,
  EngineMetricResultTable,
  EngineIterationTable,
  ProviderUsageEventTable,
} as const satisfies Record<string, AnySQLiteTable>
