import type { Argv } from "yargs"
import { EOL } from "os"
import { cmd } from "./cmd"
import { UI } from "../ui"
import { attach, withAttachOptions } from "./attach"
import { PermissionDecision } from "../../permission/decision"

/**
 * Operator authorization for hosts that drive a running server over HTTP.
 *
 * Only reachable when the project runs in `permission_mode: ask`. In the
 * default `full_access` mode no request is ever raised and `permission list`
 * stays empty — that empty result is the healthy answer, not a failure.
 */
export const PermissionCommand = cmd({
  command: "permission",
  describe: "review and decide operator permission requests on a running server",
  builder: (yargs: Argv) =>
    yargs
      .command(PermissionListCommand)
      .command(PermissionReplyCommand)
      .command(PermissionGrantsCommand)
      .command(PermissionRevokeCommand)
      .demandCommand(),
  async handler() {},
})

export const PermissionListCommand = cmd({
  command: "list",
  aliases: ["ls"],
  describe: "list durable pending permission requests",
  builder: (yargs: Argv) => withAttachOptions(yargs),
  handler: async (args) => {
    const server = attach(args)
    const requests = await server.result("permission list", server.client.permission.list({}))

    if (args.format === "json") {
      console.log(JSON.stringify(requests, null, 2))
      return
    }

    if (requests.length === 0) {
      UI.println("No pending permission requests")
      return
    }

    const lines: string[] = []
    for (const request of requests) {
      lines.push(`${request.id}  ${request.toolName}  session=${request.sessionID}`)
      lines.push(`  ${request.summary}`)
      // `choices` is the server's authority on what this specific request
      // accepts — allow_project is withheld when the scope is not project
      // grantable, so echo it rather than the full decision enum.
      lines.push(`  decisions: ${request.choices.join(", ")}`)
    }
    console.log(lines.join(EOL))
  },
})

export const PermissionReplyCommand = cmd({
  command: "reply <requestID>",
  describe: "decide a pending permission request",
  builder: (yargs: Argv) =>
    withAttachOptions(yargs)
      .positional("requestID", {
        describe: "permission request ID from `permission list`",
        type: "string",
        demandOption: true,
      })
      .option("decision", {
        type: "string",
        choices: PermissionDecision.options,
        describe: "authorization decision to commit",
        demandOption: true,
      })
      .option("message", {
        type: "string",
        describe: "operator-visible reason recorded with the decision",
      })
      .option("actor", {
        type: "string",
        describe: "actor identity recorded in the permission ledger (default: local-operator)",
      }),
  handler: async (args) => {
    const server = attach(args)
    const resolution = await server.result(
      "permission reply",
      server.client.permission.reply({
        requestID: args.requestID,
        decision: args.decision,
        message: args.message,
        actorID: args.actor,
      }),
    )
    UI.println(`Committed ${resolution.decision} for ${resolution.request.toolName} (${resolution.request.id})`)
  },
})

export const PermissionGrantsCommand = cmd({
  command: "grants",
  describe: "list active permission grants",
  builder: (yargs: Argv) => withAttachOptions(yargs),
  handler: async (args) => {
    const server = attach(args)
    const grants = await server.result("permission grants", server.client.permission.grants({}))

    if (args.format === "json") {
      console.log(JSON.stringify(grants, null, 2))
      return
    }

    if (grants.length === 0) {
      UI.println("No active permission grants")
      return
    }

    console.log(
      grants
        .map((grant) => `${grant.id}  ${grant.tool_name}  scope=${grant.decision_scope ?? "-"}  ${grant.summary}`)
        .join(EOL),
    )
  },
})

export const PermissionRevokeCommand = cmd({
  command: "revoke <grantID>",
  describe: "revoke an active permission grant",
  builder: (yargs: Argv) =>
    withAttachOptions(yargs).positional("grantID", {
      describe: "grant ID from `permission grants`",
      type: "string",
      demandOption: true,
    }),
  handler: async (args) => {
    const server = attach(args)
    await server.result("permission revoke", server.client.permission.revoke({ grantID: args.grantID }))
    UI.println(`Revoked permission grant ${args.grantID}`)
  },
})
