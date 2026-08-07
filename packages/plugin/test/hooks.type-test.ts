import type { Hooks, ToolContext } from "../src/index"

type RemovedPluginHook =
  | "permission.ask"
  | "evaluation.checks"
  | "evaluation.result"
  | "evaluation.analysis"
  | "acceptance.ready"

type ExpectNoMembers<T extends never> = T
type ExpectTrue<T extends true> = T

export type RemovedPluginHooksStayAbsent = ExpectNoMembers<Extract<RemovedPluginHook, keyof Hooks>>
export type PackageToolPermissionPromptStaysAbsent = ExpectNoMembers<Extract<"ask", keyof ToolContext>>
export type PackageToolMetadataStaysAvailable = ExpectTrue<"metadata" extends keyof ToolContext ? true : false>
export type PackageEngineIdempotencyStaysHostOwned = ExpectNoMembers<
  Extract<"idempotent", keyof Parameters<ToolContext["host"]["engineArtifacts"]["publish"]>[0]>
>
export type PackageTaskIdempotencyStaysHostOwned = ExpectNoMembers<
  Extract<"idempotent", keyof Parameters<ToolContext["host"]["taskArtifacts"]["publish"]>[1]>
>
