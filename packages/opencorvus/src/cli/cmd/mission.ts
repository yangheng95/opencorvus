import type { Argv } from "yargs"
import { EOL } from "os"
import { cmd } from "./cmd"
import { UI } from "../ui"
import { attach, withAttachOptions } from "./attach"

/**
 * Mission and Expert Squad orchestration for hosts that drive a running server
 * over HTTP.
 *
 * A Mission is the Expert Squad surface: it holds an immutable squad snapshot
 * and coordinates the Tasks the squad dispatches. `opencorvus run` never
 * touches it, so without these commands an Agent Skills host can only create
 * bare Tasks and never reach squad orchestration.
 */
export const MissionCommand = cmd({
  command: "mission",
  describe: "create, dispatch, and observe Missions on a running server",
  builder: (yargs: Argv) =>
    yargs
      .command(MissionSquadsCommand)
      .command(MissionListCommand)
      .command(MissionCreateCommand)
      .command(MissionDispatchCommand)
      .command(MissionSendCommand)
      .command(MissionStatusCommand)
      .command(MissionAbortCommand)
      .demandCommand(),
  async handler() {},
})

export const MissionSquadsCommand = cmd({
  command: "squads",
  describe: "list Expert Squad IDs that a Mission can hold",
  builder: (yargs: Argv) =>
    withAttachOptions(yargs)
      .option("pillar", {
        type: "string",
        choices: ["code", "work"] as const,
        describe: "restrict to squads declared for this product pillar",
      })
      .option("query", {
        type: "string",
        describe: "free-text search over squad declarations",
      })
      .option("cursor", {
        type: "string",
        describe: "continue a previous page (search returns at most 20 entries)",
      }),
  handler: async (args) => {
    const server = attach(args)
    const page = await server.result(
      "expert squad search",
      server.client.expertSquad.search({
        productPillar: args.pillar,
        query: args.query,
        cursor: args.cursor,
      }),
    )

    if (args.format === "json") {
      console.log(JSON.stringify(page, null, 2))
      return
    }

    if (page.entries.length === 0) {
      UI.println("No Expert Squads matched")
      return
    }

    const lines = page.entries.map((entry) => {
      const pillars = entry.product_pillars.join("/")
      const origin = entry.built_in ? "built-in" : "installed"
      return `${entry.id}  [${pillars}] (${origin})  ${entry.display_label}`
    })
    // The page is deliberately bounded server-side; saying so keeps a host from
    // reporting a truncated list as the complete inventory.
    lines.push(`${EOL}showing ${page.entries.length} of ${page.total_count}`)
    if (page.next_cursor) lines.push(`next page: --cursor ${page.next_cursor}`)
    console.log(lines.join(EOL))
  },
})

export const MissionListCommand = cmd({
  command: "list",
  aliases: ["ls"],
  describe: "list Missions",
  builder: (yargs: Argv) =>
    withAttachOptions(yargs)
      .option("search", { type: "string", describe: "filter Missions by title" })
      .option("limit", { type: "number", describe: "maximum Missions to return" })
      .option("archived", { type: "boolean", describe: "list archived Missions instead of active ones" }),
  handler: async (args) => {
    const server = attach(args)
    const missions = await server.result(
      "mission list",
      server.client.mission.list({
        search: args.search,
        limit: args.limit,
        archived: args.archived === undefined ? undefined : args.archived ? "true" : "false",
      }),
    )

    if (args.format === "json") {
      console.log(JSON.stringify(missions, null, 2))
      return
    }

    if (missions.length === 0) {
      UI.println("No Missions found")
      return
    }

    console.log(missions.map((mission) => `${mission.missionID}  ${mission.productPillar}  ${mission.title}`).join(EOL))
  },
})

export const MissionCreateCommand = cmd({
  command: "create",
  describe: "create a Mission draft without invoking a model",
  builder: (yargs: Argv) =>
    withAttachOptions(yargs)
      .option("pillar", {
        type: "string",
        choices: ["code", "work"] as const,
        describe: "code for repository work, work for research and knowledge artifacts",
        demandOption: true,
      })
      .option("title", { type: "string", describe: "Mission title", demandOption: true })
      .option("request", {
        type: "string",
        describe: "operator request held as the pending prompt",
        demandOption: true,
      })
      .option("squad", {
        type: "string",
        array: true,
        describe: "Expert Squad ID to hold in the Mission's immutable snapshot (repeatable)",
      }),
  handler: async (args) => {
    const server = attach(args)
    const mission = await server.result(
      "mission create",
      server.client.mission.createDraft({
        productPillar: args.pillar,
        title: args.title,
        request: args.request,
        expertSquadIDs: args.squad,
      }),
    )
    UI.println(`Created Mission draft ${mission.missionID} (${mission.productPillar})`)
    // The draft holds the prompt but invokes nothing; without this the caller
    // can reasonably believe work has started.
    UI.println(`Dispatch it with: opencorvus mission dispatch ${mission.missionID}`)
  },
})

export const MissionDispatchCommand = cmd({
  command: "dispatch <missionID>",
  describe: "dispatch a Mission draft's pending prompt",
  builder: (yargs: Argv) =>
    withAttachOptions(yargs)
      .positional("missionID", { describe: "Mission ID", type: "string", demandOption: true })
      .option("model", { type: "string", describe: "model to use in the format provider/model" })
      .option("request-id", {
        type: "string",
        describe: "idempotency key; replaying it with changed facts is rejected as a conflict",
      }),
  handler: async (args) => {
    const server = attach(args)
    const result = await server.result(
      "mission dispatch",
      server.client.mission.dispatch({
        missionID: args.missionID,
        model: args.model,
        requestID: args.requestId,
      }),
    )
    UI.println(`Dispatched Mission ${result.missionID} (session ${result.sessionID})`)
    UI.println("Acceptance is not completion — poll `opencorvus mission status` for Mission and Task state.")
  },
})

export const MissionSendCommand = cmd({
  command: "send",
  describe: "start or resume a Mission with a prompt in one step",
  builder: (yargs: Argv) =>
    withAttachOptions(yargs)
      .option("pillar", {
        type: "string",
        choices: ["code", "work"] as const,
        describe: "code for repository work, work for research and knowledge artifacts",
        demandOption: true,
      })
      .option("text", { type: "string", describe: "prompt to deliver to the Mission", demandOption: true })
      .option("mission-id", {
        type: "string",
        describe: "resume this Mission; omit to start a new one",
      })
      .option("squad", {
        type: "string",
        array: true,
        describe: "Expert Squad ID (repeatable); must match the snapshot when resuming",
      })
      .option("model", { type: "string", describe: "model to use in the format provider/model" })
      .option("request-id", {
        type: "string",
        describe: "idempotency key; replaying it with changed facts is rejected as a conflict",
      }),
  handler: async (args) => {
    const server = attach(args)
    const result = await server.result(
      "mission send",
      server.client.mission.wake({
        productPillar: args.pillar,
        text: args.text,
        missionID: args.missionId,
        expertSquadIDs: args.squad,
        model: args.model,
        requestID: args.requestId,
      }),
    )
    const verb = result.created ? "Started" : "Resumed"
    UI.println(`${verb} Mission ${result.missionID} (session ${result.sessionID})`)
    UI.println("Acceptance is not completion — poll `opencorvus mission status` for Mission and Task state.")
  },
})

export const MissionStatusCommand = cmd({
  command: "status <missionID>",
  describe: "read the Mission and Task status snapshot",
  builder: (yargs: Argv) =>
    withAttachOptions(yargs).positional("missionID", {
      describe: "Mission ID",
      type: "string",
      demandOption: true,
    }),
  handler: async (args) => {
    const server = attach(args)
    const status = await server.result("mission status", server.client.mission.status({ missionID: args.missionID }))

    if (args.format === "json") {
      // The durable activity cursor is the honest "is anything still moving"
      // signal; a host polling status alone cannot distinguish a settled
      // Mission from one between turns.
      const activity = await server.result(
        "mission activity cursor",
        server.client.mission.activityCursor({ missionID: args.missionID }),
      )
      console.log(JSON.stringify({ status, activity }, null, 2))
      return
    }

    console.log(JSON.stringify(status, null, 2))
  },
})

export const MissionAbortCommand = cmd({
  command: "abort <missionID>",
  describe: "abort the active Mission session loop",
  builder: (yargs: Argv) =>
    withAttachOptions(yargs)
      .positional("missionID", { describe: "Mission ID", type: "string", demandOption: true })
      .option("reason", {
        type: "string",
        describe: "operator-visible reason recorded with the abort",
        demandOption: true,
      }),
  handler: async (args) => {
    const server = attach(args)
    await server.result(
      "mission abort",
      server.client.mission.abort({
        missionID: args.missionID,
        reason: args.reason,
        surface: "api",
      }),
    )
    UI.println(`Aborted Mission ${args.missionID}`)
  },
})
