import { tool } from "ai"
import z from "zod"
import { requirementIDsFromAcceptanceSpecs } from "@/requirements/traceability"
import { createCodebaseToolFactory } from "@/engine/codebase-tools"
import { Instance } from "@/project/instance"
import { runGuardedHostCommand, runGuardedTaskCommand } from "@/shell/guarded-command"
import { DEFAULT_BASH_TIMEOUT_MS } from "@/shell/timeout"
import { Filesystem } from "@/util/filesystem"
import {
  integrityEvidenceGoalInfo,
  projectIntegrityEvidenceFacts,
  type IntegrityFactSelection,
} from "./fact-projection"
import { bindStageToolMaterializer } from "@/agent/stage-tool-materializer"
import { materializeExactTool } from "@/agent/exact-tool-factory"

const IntegrityRunCommandMaterializerInput = z
  .object({ taskID: z.string().min(1), projectDirectory: z.string().min(1) })
  .strict()

export function materializeIntegrityRunCommandTool(raw: Record<string, unknown>, signal?: AbortSignal) {
  const materializerInput = IntegrityRunCommandMaterializerInput.parse(raw)
  return bindStageToolMaterializer(
    tool({
      description: "Run a verification shell command in an isolated copy of the project and capture its result.",
      inputSchema: z.object({
        command: z.string().min(1),
        timeout_ms: z.number().int().positive().max(DEFAULT_BASH_TIMEOUT_MS).default(DEFAULT_BASH_TIMEOUT_MS),
        background: z.boolean().default(false),
      }),
      execute: async ({ command, timeout_ms, background }) => {
        try {
          return await runGuardedTaskCommand({
            command,
            timeoutMs: timeout_ms,
            background,
            projectDir: materializerInput.projectDirectory,
            env: process.env,
            signal,
            taskID: materializerInput.taskID,
          })
        } catch (err) {
          return `Error running command: ${err instanceof Error ? err.message : String(err)}`
        }
      },
    }),
    { id: "integrity.run-command", input: materializerInput },
  )
}

/**
 * Integrity acceptance tools are scoped to semantic review. They expose
 * read-only project exploration, guarded command verification, and bounded
 * evidence drilldown; mutation and nested review are intentionally excluded.
 */
export function createIntegrityAcceptanceToolFactory(
  selection?:
    | (IntegrityFactSelection & { instruction: string })
    | (() => IntegrityFactSelection & { instruction: string }),
  options?: { signal?: AbortSignal; onToolMaterialized?: (toolID: string) => void },
) {
  const projectDir = Filesystem.resolve(Instance.directory)
  const resolveSelection = () =>
    typeof selection === "function" ? selection() : selection
  const initialSelection = resolveSelection()
  const codebase = createCodebaseToolFactory(projectDir, options?.onToolMaterialized)
  const toolFactories = {
    run_command: () => initialSelection?.taskID
      ? materializeIntegrityRunCommandTool(
          { taskID: initialSelection.taskID, projectDirectory: projectDir },
          options?.signal,
        )
      : tool({
          description:
            "Run a verification shell command in an isolated copy of the project and capture stdout/stderr/exit code.",
          inputSchema: z.object({
            command: z.string().min(1),
            timeout_ms: z.number().int().positive().max(DEFAULT_BASH_TIMEOUT_MS).default(DEFAULT_BASH_TIMEOUT_MS),
            background: z.boolean().default(false),
          }),
          execute: async ({ command, timeout_ms, background }) => {
            try {
              return await runGuardedHostCommand({
                command,
                timeoutMs: timeout_ms,
                background,
                projectDir,
                env: process.env,
                signal: options?.signal,
              })
            } catch (err) {
              return `Error running command: ${err instanceof Error ? err.message : String(err)}`
            }
          },
        }),
    inspect_integrity_evidence: () => tool({
      description:
        "Inspect scoped integrity evidence on demand. Start from changed_directories, then request exact files or diffs only for directories and files relevant to this review scope.",
      inputSchema: z.object({
        section: z.enum([
          "overview",
          "changed_directories",
          "changed_files_in_directory",
          "diff_for_file",
          "goal_summary",
          "goal_detail",
          "attachments",
        ]),
        directory: z.string().optional(),
        file_path: z.string().optional(),
        goal_id: z.string().optional(),
        max_chars: z.number().int().min(1_000).max(40_000).default(12_000),
      }),
      execute: async ({ section, directory, file_path, goal_id, max_chars }) =>
        truncateIntegrityEvidence(
          renderIntegrityEvidenceSection(
            resolveSelection(),
            section,
            directory,
            file_path,
            goal_id,
          ),
          max_chars,
        ),
    }),
  }
  return {
    materializeExact(toolID: string) {
      return (
        materializeExactTool(toolFactories, toolID, options?.onToolMaterialized) ??
        codebase.materializeExact(toolID)
      )
    },
  }
}


function renderIntegrityEvidenceSection(
  selection: (IntegrityFactSelection & { instruction: string }) | undefined,
  section:
    | "overview"
    | "changed_directories"
    | "changed_files_in_directory"
    | "diff_for_file"
    | "goal_summary"
    | "goal_detail"
    | "attachments",
  directory?: string,
  filePath?: string,
  goalID?: string,
): string {
  if (!selection) return "No task-backed Integrity fact refs were selected."
  const projection = projectIntegrityEvidenceFacts(selection)
  const goals = projection.goals.map(integrityEvidenceGoalInfo)
  const changedFiles = projection.changedFiles
  const diffs = projection.diffs
  switch (section) {
    case "overview":
      return [
        "# Integrity Evidence Overview",
        `task_id=${selection.taskID}`,
        `goals=${goals.length}`,
        `artifact_locators=${selection.artifactLocators.length}`,
        `host_observation_locators=${projection.hostObservationLocators.length}`,
        `changed_files=${changedFiles.length}`,
        `changed_directories=${pathDirectories(changedFiles).length}`,
        `diffs=${diffs.length}`,
        `attachments=${projection.attachments.length}`,
      ].join("\n")

    case "changed_directories":
      return (
        "# Changed Directories\n\n" +
        (pathDirectories(changedFiles)
          .map((item) => `- ${item}`)
          .join("\n") || "(none)")
      )

    case "changed_files_in_directory": {
      const dir = normalizeDirectory(directory)
      if (!dir) return "changed_files_in_directory requires directory."
      const files = changedFiles.filter((file) => normalizeDirectory(fileDirectory(file)) === dir)
      return `# Changed Files In ${dir}\n\n` + (files.map((file) => `- ${file}`).join("\n") || "(none)")
    }

    case "diff_for_file": {
      const normalized = normalizePath(filePath ?? "")
      if (!normalized) return "diff_for_file requires file_path."
      const diff = diffs.find((item) => normalizePath(item.file) === normalized)
      if (!diff) return `No diff evidence for ${normalized}.`
      return [
        `# Diff For ${diff.file}`,
        `status=${diff.status} additions=${diff.additions} deletions=${diff.deletions} binary=${diff.is_binary}`,
        `[before_git_object]\n${diff.before ? `${diff.before.oid} bytes=${diff.before.bytes}` : "(absent)"}`,
        `[after_git_object]\n${diff.after ? `${diff.after.oid} bytes=${diff.after.bytes}` : "(absent)"}`,
      ]
        .filter(Boolean)
        .join("\n\n")
    }

    case "goal_summary":
      return [
        "# Goal Summary",
        ...(goals.length > 0
          ? goals.map(
              (goal) =>
                `- ${goal.id}: ${goal.title}; priority=${goal.priority}; owned_directories=${
                  pathDirectories(goal.owned_paths).join(", ") || "(none)"
                }; acceptance_specs=${goal.acceptance_spec_count ?? goal.acceptance_specs?.length ?? 0}`,
            )
          : ["(none)"]),
      ].join("\n")

    case "goal_detail": {
      if (!goalID) return "goal_detail requires goal_id."
      const goal = goals.find((candidate) => candidate.id === goalID)
      if (!goal) return `No goal evidence for ${goalID}.`
      return [
        `# Goal Detail: ${goal.id}`,
        `Title: ${goal.title}`,
        `Description: ${goal.description}`,
        `Criteria: ${goal.criteria}`,
        `Priority: ${goal.priority}`,
        `Requirements: ${requirementIDsFromAcceptanceSpecs(goal.acceptance_specs ?? []).join(", ") || "(none)"}`,
        `Owned directories: ${pathDirectories(goal.owned_paths).join(", ") || "(none)"}`,
        `Acceptance spec count: ${goal.acceptance_spec_count ?? goal.acceptance_specs?.length ?? 0}`,
      ].join("\n")
    }

    case "attachments":
      return [
        "# Attachments",
        ...(projection.attachments.length > 0
          ? projection.attachments.map(
              (attachment) =>
                `- ${attachment.filename ?? attachment.sha}: mime=${attachment.mime}; size=${attachment.size}; url=${attachment.url}`,
            )
          : ["(none)"]),
      ].join("\n")
  }
}

function pathDirectories(paths: readonly string[]): string[] {
  return [...new Set(paths.map(fileDirectory))].sort((left, right) => left.localeCompare(right))
}

function fileDirectory(path: string): string {
  const normalized = normalizePath(path)
  const index = normalized.lastIndexOf("/")
  return index > 0 ? normalized.slice(0, index) : "."
}

function normalizeDirectory(path: string | undefined): string {
  if (!path) return ""
  return normalizePath(path).replace(/\/+$/, "") || "."
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\/+/, "").trim()
}

function truncateIntegrityEvidence(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text
  return `${text.slice(0, maxChars)}\n... (truncated by inspect_integrity_evidence at ${maxChars} chars; request a narrower section for more detail)`
}
