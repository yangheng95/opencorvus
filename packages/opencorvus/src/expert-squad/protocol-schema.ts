/**
 * The public SDK owns the portable Expert Squad manifest v1 runtime shape.
 * Core re-exports the exact schemas so Registry, OpenAPI, SDK authoring, and
 * runtime projections cannot drift into parallel protocol definitions.
 */
export {
  ExpertSquadAgentProjectionSchema,
  ExpertSquadCapabilityProjectionSchema,
  ExpertSquadConfigurationFieldSchema,
  ExpertSquadConfigurationSchema,
  ExpertSquadProjectionResourcesSchema,
  ProductPillarSchema,
  ProductPillarsSchema,
  ExpertSquadSchedulerProjectionSchema,
  ExpertSquadSystemRoleSchema,
  ExpertSquadVirtualWorkflowNodeSchema,
  ExpertSquadVirtualWorkflowSchema,
  ExpertSquadVirtualWorkflowsSchema,
  type ExpertSquadAgentProjection,
  type ExpertSquadCapabilityProjection,
  type ExpertSquadConfiguration,
  type ExpertSquadConfigurationField,
  type ExpertSquadSchedulerProjection,
  type ExpertSquadSystemRole,
  type ProductPillar,
  type ExpertSquadVirtualWorkflow,
  type ExpertSquadVirtualWorkflows,
} from "@opencorvus-ai/sdk/expert-squad-authoring"
