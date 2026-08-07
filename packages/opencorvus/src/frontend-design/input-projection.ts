import type { PromptAttachmentRef } from "@/agent/prompt-projection"
import type { ProjectedAgentWorkScope } from "@/agent/projected-agent-work-scope"
import { requireTask } from "@/engine/store"
import type { FrontendDesignMode } from "./schema"

export interface FrontendDesignInputRefs {
  instruction: string
  mode: FrontendDesignMode
  taskID: string
  workScope: ProjectedAgentWorkScope
  attachments: PromptAttachmentRef[]
}

export interface FrontendDesignPromptProjection {
  instruction: string
  mode: FrontendDesignMode
  taskID: string
  taskTitle: string
  taskRequest: string
  attachments: PromptAttachmentRef[]
  observationSections: string[]
}

/**
 * Project identities and neutral file refs only. The Frontend Design Agent
 * reads the exact DesignResourceManifest itself; the Host does not parse its
 * intent, authority, relationship, or route semantics into a second handoff.
 */
export function projectFrontendDesignInput(input: FrontendDesignInputRefs): FrontendDesignPromptProjection {
  const task = requireTask(input.taskID)
  const observationSections: string[] = []
  observationSections.push(
    [
      "## Durable Artifact discovery",
      "- Search the Task Artifact catalog yourself by exact name, kind, recency, and fuzzy relevance.",
      "- Read every Artifact you use completely with `artifact_read`; no upstream participant selected or copied an Artifact body into this prompt.",
      "- A DesignResourceManifest, when present, is discoverable by its canonical kind/name and is the only authority for file intent and relationships.",
      "- An empty search result is a visible missing-evidence fact; do not infer semantics from MIME, filename, order, or source.",
    ].join("\n"),
  )
  return {
    instruction: input.instruction,
    mode: input.mode,
    taskID: input.taskID,
    taskTitle: task.title,
    taskRequest: task.request,
    attachments: input.attachments,
    observationSections,
  }
}
