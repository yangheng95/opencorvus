/** Canonical identifier for the built-in Base expert squad. */
export const BASE_EXPERT_SQUAD_ID = "base"
/** Canonical identifier for the built-in Advanced expert squad. */
export const ADVANCED_EXPERT_SQUAD_ID = "advanced"
/** Canonical identifier for the built-in Research Studio expert squad. */
export const RESEARCH_STUDIO_EXPERT_SQUAD_ID = "research-studio"
/** Canonical identifier for the built-in Generate Expert Squads Software Development Kit (SDK) expert squad. */
export const SQUAD_SDK_EXPERT_SQUAD_ID = "squad-sdk"
/** Default Task-local expert generation capability package. */
export const DYNAMIC_EXPERT_SQUAD_ID = "dynamic"

export const EMBEDDED_EXPERT_SQUAD_IDS = [
  DYNAMIC_EXPERT_SQUAD_ID,
  BASE_EXPERT_SQUAD_ID,
  ADVANCED_EXPERT_SQUAD_ID,
  RESEARCH_STUDIO_EXPERT_SQUAD_ID,
  SQUAD_SDK_EXPERT_SQUAD_ID,
] as const
