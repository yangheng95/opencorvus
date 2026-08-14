import type { Argv } from "yargs"
import { UI } from "../ui"
import * as prompts from "@clack/prompts"
import { Installation } from "../../installation"

export const UpgradeCommand = {
  command: "upgrade [target]",
  describe: "upgrade opencorvus to the latest or a specific version",
  builder: (yargs: Argv) => {
    return yargs.positional("target", {
      describe: "version to upgrade to, for ex '0.1.48' or 'v0.1.48'",
      type: "string",
    })
  },
  handler: async (args: { target?: string }) => {
    UI.empty()
    UI.println(UI.logo("  "))
    UI.empty()
    prompts.intro("Upgrade")
    const method = await Installation.method()
    if (method === "unknown") {
      prompts.log.error(`opencorvus is not running from a native installation: ${process.execPath}`)
      prompts.outro("Done")
      return
    }
    prompts.log.info("Using method: " + method)
    const target = args.target ? args.target.replace(/^v/, "") : await Installation.latest()

    if (Installation.VERSION === target) {
      prompts.log.warn(`opencorvus upgrade skipped: ${target} is already installed`)
      prompts.outro("Done")
      return
    }

    prompts.log.info(`From ${Installation.VERSION} → ${target}`)
    const spinner = prompts.spinner()
    spinner.start("Upgrading...")
    const outcome = await Installation.upgrade(method, target).then(
      (receipt) => ({ ok: true as const, receipt }),
      (error: unknown) => ({ ok: false as const, error }),
    )
    if (!outcome.ok) {
      spinner.stop("Upgrade failed", 1)
      if (outcome.error instanceof Installation.UpgradeFailedError) {
        prompts.log.error(outcome.error.data.stderr || outcome.error.data.message)
      } else if (outcome.error instanceof Error) prompts.log.error(outcome.error.message)
      else prompts.log.error(String(outcome.error))
      prompts.outro("Done")
      return
    }
    spinner.stop(`Upgrade complete (${outcome.receipt.observedVersion})`)
    prompts.outro("Done")
  },
}
