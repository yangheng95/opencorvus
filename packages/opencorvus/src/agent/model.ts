/**
 * Model resolution for fixed identities and projected workers, without fallbacks.
 *
 * Fixed Primary/Helper/Host identities use `agent.<id>.model`, then the
 * top-level project model. Projected workers use their exact
 * `expert_squads.<squad-id>.agents.<agent-id>.runtime.model`, then their
 * `runtime_templates.<base-role>.model` seed, then the project model.
 *
 * If neither is set, this function throws `MissingModelConfigError`. We do not
 * fall back to any implicit source (session user-message selection, env vars,
 * provider registry order, recent-model state file). The previous
 * "Provider.defaultModel() reads model.json.recent[0]" chain was a mutable
 * global whose value changed when the operator clicked a model in the overlay
 * UI — that directly caused goal retries to silently switch provider/model
 * between runs (one configured provider/model to another),
 * collapsing prompt cache across retries because Anthropic/GLM caches are
 * physically isolated.
 *
 * opencorvus.jsonc is the single source of truth. If the operator wants to
 * change the model, they edit the config file directly or through the Overlay
 * read/write settings surface. Everything else — env variables, recent-model
 * state, session user-message propagation — is a fallback and forbidden.
 */
import { EffectiveConfig } from "@/config/effective"
import { MissingModelConfigError } from "@/config/model-resolution-error"
import { Provider } from "@/provider/provider"
import type { RuntimeTemplateID } from "@/agent/runtime-template-id"
import { runtimeOverrideLayers, type RuntimeOverrideConfig } from "@/agent/runtime-override"
import { isUniversalBuildAgentID } from "@/agent/universal-build"

type ModelRef = {
  providerID: string
  modelID: string
}

export function configuredProjectedWorkerModelRef(
  config: RuntimeOverrideConfig & { model?: string },
  identity: {
    expertSquadID: string
    agentID: string
    baseRole: RuntimeTemplateID
    capabilityOwner?: "package" | "platform"
  },
): ModelRef | undefined {
  const overrides = runtimeOverrideLayers(config, identity)
  const configured = overrides.projectedAgent?.model ?? overrides.template?.model ?? config.model
  return configured ? Provider.parseModel(configured) : undefined
}

/**
 * THE single model resolver (spec §11.1/§13.1, R5.1 item 3/4/5). Monotone
 * precedence — every other model-derivation path in the codebase funnels
 * here; a new parallel derivation is a rule 8 violation:
 *
 *   1. explicitModel             — per-request, user-specified for THIS call
 *                                  only (the ONLY input outside the resolver).
 *   2. explicit taskID root overlay
 *   3. explicit sessionID overlay (resolved to its root session)
 *   4. ambient SessionContext overlay (resolved to its root session)
 *   5. project base              — agent.<name>.model, then top-level model
 *   6. MissingModelConfigError   — NO history-derived / DEFAULT_MODEL fallback.
 *
 * The session overlay is sourced through the single `EffectiveConfig.overlay`
 * chokepoint (R5.1 item 3) so model and prompt/temperature reuse the exact
 * same overlay. Explicit `taskID` / `sessionID` take precedence over the
 * ambient context (R5.1 item 3); ambient and an explicit task root are NOT a
 * conflict — only contradictory same-call explicit `taskID` vs `sessionID`
 * inputs throw. A `taskID` whose engine task has a null `session_id` is a
 * hard error, never a silent project-base fallback (R5.1 item 4).
 */
export async function resolveAgentModelRef(
  name: string,
  opts?: { taskID?: string; sessionID?: string; explicitModel?: ModelRef | null },
): Promise<ModelRef> {
  if (opts?.explicitModel) {
    return { providerID: opts.explicitModel.providerID, modelID: opts.explicitModel.modelID }
  }
  const overlay = await EffectiveConfig.overlay(opts)
  const overlayAgentModel = overlay?.agent?.[name]?.model
  if (overlayAgentModel) return Provider.parseModel(overlayAgentModel)
  if (overlay?.model) return Provider.parseModel(overlay.model)
  const cfg = await EffectiveConfig.base(opts)
  const agent = (cfg.agent as Record<string, { disable?: boolean; model?: string }> | undefined)?.[name]
  if (!agent?.disable && agent?.model) return Provider.parseModel(agent.model)
  if (cfg.model) return Provider.parseModel(cfg.model)
  throw new MissingModelConfigError({
    agent: name,
    message:
      `No model configured for agent "${name}". ` +
      `Set \`agent.${name}.model\` or top-level \`model\` in opencorvus.jsonc.`,
  })
}

/** As resolveAgentModelRef, but returns the loaded Provider.Model. */
export async function resolveAgentModel(
  name: string,
  opts?: { taskID?: string; sessionID?: string; explicitModel?: ModelRef | null },
): Promise<Provider.Model> {
  const ref = await resolveAgentModelRef(name, opts)
  return Provider.getModel(ref.providerID, ref.modelID, { config: await EffectiveConfig.effective(opts) })
}

export async function resolveProjectedWorkerModelRef(
  identity: {
    expertSquadID: string
    agentID: string
    baseRole: RuntimeTemplateID
    capabilityOwner?: "package" | "platform"
  },
  opts?: { taskID?: string; sessionID?: string; explicitModel?: ModelRef | null },
): Promise<ModelRef> {
  if (opts?.explicitModel) {
    return { providerID: opts.explicitModel.providerID, modelID: opts.explicitModel.modelID }
  }
  const config = await EffectiveConfig.effective(opts)
  const configured = configuredProjectedWorkerModelRef(config, identity)
  if (configured) return configured
  throw new MissingModelConfigError({
    agent: identity.agentID,
    message:
      isUniversalBuildAgentID(identity.agentID)
        ? `No model configured for platform capability "${identity.agentID}". Set \`runtime_templates.${identity.baseRole}.model\` or top-level \`model\` in opencorvus.jsonc.`
        : `No model configured for projected agent "${identity.expertSquadID}/${identity.agentID}". Set \`expert_squads.${identity.expertSquadID}.agents.${identity.agentID}.runtime.model\`, \`runtime_templates.${identity.baseRole}.model\`, or top-level \`model\` in opencorvus.jsonc.`,
  })
}

export async function resolveProjectedWorkerModel(
  identity: {
    expertSquadID: string
    agentID: string
    baseRole: RuntimeTemplateID
    capabilityOwner?: "package" | "platform"
  },
  opts?: { taskID?: string; sessionID?: string; explicitModel?: ModelRef | null },
): Promise<Provider.Model> {
  const ref = await resolveProjectedWorkerModelRef(identity, opts)
  return Provider.getModel(ref.providerID, ref.modelID, { config: await EffectiveConfig.effective(opts) })
}

/**
 * Resolve a model ref from one already-materialized effective config snapshot.
 * This is the canonical pure primitive for consumers that must bind model and
 * adjacent settings to the same fenced snapshot.
 */
export function configuredDefaultModelRef(config: { model?: string }): ModelRef {
  if (config.model) return Provider.parseModel(config.model)
  throw new MissingModelConfigError({
    message:
      "No `model` configured (session overlay or opencorvus.jsonc). " +
      "The project must declare a default model — fallbacks are not allowed.",
  })
}

/**
 * Load the effective config for one scope, then resolve its canonical default
 * model without going through an agent.
 *
 * Provider's old parallel defaultModel() is removed; callers that already own
 * an effective snapshot use `configuredDefaultModelRef`, while other callers
 * use this scoped loader.
 */
export async function resolveConfiguredModelRef(opts?: { taskID?: string; sessionID?: string }): Promise<ModelRef> {
  return configuredDefaultModelRef(await EffectiveConfig.effective(opts))
}
