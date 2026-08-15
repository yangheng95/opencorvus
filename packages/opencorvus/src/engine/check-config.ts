import z from "zod"

export const NamedCheckFamily = z.enum(["build", "test", "lint", "verify_cmd"])

export const NamedCheckConfig = z
  .object({
    label: z.string().min(1).optional().describe("Human-readable check label."),
    family: NamedCheckFamily.optional().describe("Check result family used for acceptance reporting."),
    commands: z.array(z.string().min(1)).min(1).describe("Executable shell commands for this named check."),
    enabled: z.boolean().optional().describe("Whether this named check is enabled."),
    cwd: z.string().min(1).optional().describe("Optional project-relative working directory for the commands."),
  })
  .strict()

export const CheckConfig = z
  .object({
    build: z
      .union([z.array(z.string().min(1)), z.literal(false)])
      .optional()
      .describe("Explicit build commands, or false to disable discovered build commands."),
    test: z
      .union([z.array(z.string().min(1)), z.literal(false)])
      .optional()
      .describe("Explicit test commands, or false to disable discovered test commands."),
    lint: z
      .union([z.array(z.string().min(1)), z.literal(false)])
      .optional()
      .describe("Explicit lint commands, or false to disable discovered lint commands."),
    verify_cmd: z
      .union([z.array(z.string().min(1)), z.literal(false)])
      .optional()
      .describe("Explicit end-to-end verification commands, or false to disable them."),
    named: z
      .record(z.string(), NamedCheckConfig)
      .optional()
      .describe("Host-authored named check definitions keyed by stable check name."),
    startup: z
      .object({
        command: z.string().min(1),
        ready_url: z.string().url().optional(),
        ready_text: z.string().optional(),
        timeout_ms: z.number().int().positive().optional(),
        warmup_ms: z.number().int().positive().optional(),
        require_exit_zero: z.boolean().optional(),
        mode: z.enum(["soft", "strict"]).optional(),
      })
      .optional(),
    artifact: z
      .object({
        require_changed_files: z.boolean().optional(),
        min_changed_files: z.number().int().min(0).optional(),
        require_diff: z.boolean().optional(),
        require_summary: z.boolean().optional(),
        mode: z.enum(["soft", "strict"]).optional(),
      })
      .optional(),
    visual: z
      .object({
        target: z.literal("web"),
        url: z.string().url(),
        require_text: z.array(z.string()).optional(),
        require_title: z.string().optional(),
        timeout_ms: z.number().int().positive().optional(),
        mode: z.enum(["soft", "strict"]).optional(),
      })
      .optional(),
    playwright: z
      .object({
        target: z.literal("web"),
        url: z.string().url(),
        browser: z.enum(["chrome", "edge", "chromium"]).optional(),
        executable_path: z.string().optional(),
        wait_for_selector: z.string().optional(),
        wait_for_text: z.string().optional(),
        require_text: z.array(z.string()).optional(),
        require_title: z.string().optional(),
        full_page: z.boolean().optional(),
        viewport: z
          .object({
            width: z.number().int().positive().optional(),
            height: z.number().int().positive().optional(),
          })
          .optional(),
        timeout_ms: z.number().int().positive().optional(),
        mode: z.enum(["soft", "strict"]).optional(),
      })
      .optional(),
    ui_review: z
      .object({
        target: z.literal("web"),
        url: z.string().url().optional(),
        prompt: z.string().optional(),
        focus: z
          .array(z.enum(["layout", "hierarchy", "clarity", "navigation", "feedback", "accessibility"]))
          .optional(),
        timeout_ms: z.number().int().positive().optional(),
        mode: z.enum(["soft", "strict"]).optional(),
      })
      .optional(),
    code_quality: z
      .object({
        enabled: z.boolean().optional(),
        prompt: z.string().optional(),
        max_diffs: z.number().int().positive().optional(),
        mode: z.enum(["soft", "strict"]).optional(),
      })
      .optional(),
    code_review: z
      .object({
        enabled: z.boolean().optional(),
        prompt: z.string().optional(),
        max_diffs: z.number().int().positive().optional(),
        mode: z.enum(["soft", "strict"]).optional(),
      })
      .optional(),
    dead_code_review: z
      .object({
        enabled: z.boolean().optional(),
        prompt: z.string().optional(),
        max_diffs: z.number().int().positive().optional(),
        mode: z.enum(["soft", "strict"]).optional(),
      })
      .optional(),
    judge: z
      .object({
        enabled: z.boolean().optional(),
        prompt: z.string().optional(),
        mode: z.enum(["soft", "strict"]).optional(),
      })
      .optional(),
    spec_check: z
      .object({
        enabled: z.boolean().optional(),
        prompt: z.string().optional(),
        mode: z.enum(["soft", "strict"]).optional(),
      })
      .optional(),
    timeout_ms: z.number().int().positive().optional(),
  })
  .strict()
