import { describe, expect, test } from "bun:test"
import { Hono } from "hono"
import { memoryProject } from "../fixture/memory"
import { Instance } from "../../src/project/instance"
import { ExpertSquadRoutes } from "../../src/server/routes/expert-squad"
import { payloadPackageSources } from "../../generated/expert-squad-payload"
import { expertSquadSearchLocalizations } from "../../generated/expert-squad-search-localization"

interface MarketPage {
  entries: Array<{ id: string; product_pillars: Array<"code" | "work">; installation_scopes: string[] }>
  total_count: number
}

interface CatalogPage {
  entries: Array<{ id: string; product_pillars: Array<"code" | "work"> }>
}

interface InstallReceipt {
  operation: "installed" | "skipped"
  after: { id: string; installationScope: "project" | "global" }
}

async function withMarketRoutes<T>(
  directory: string,
  fn: (call: (route: string, init?: RequestInit) => Promise<unknown>) => Promise<T>,
): Promise<T> {
  return await Instance.provide({
    directory,
    fn: async () => {
      const app = new Hono().route("/expert-squad", ExpertSquadRoutes())
      const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: app.fetch })
      try {
        return await fn(async (route, init) => {
          const response = await fetch(`http://${server.hostname}:${server.port}/expert-squad/${route}`, init)
          const body = await response.text()
          if (response.status !== 200)
            throw new Error(`${init?.method ?? "GET"} ${route} -> ${response.status}: ${body}`)
          return JSON.parse(body)
        })
      } finally {
        await server.stop(true)
      }
    },
  })
}

describe("expert squad market discovery chain", () => {
  test("carries a localized projection for every bundled package", () => {
    for (const source of payloadPackageSources) {
      const localization = expertSquadSearchLocalizations[`${source.namespace}/${source.id}`]
      expect(localization?.primary.length).toBe(3)
      for (const entry of localization?.primary ?? []) expect(entry).toMatch(/\p{Script=Han}/u)
    }
  })

  test("answers a Chinese request, keeps the requested pillar, and stays selectable after install", async () => {
    await using project = await memoryProject()

    await withMarketRoutes(project.path, async (call) => {
      const market = (await call(
        `market?${new URLSearchParams({
          directory: project.path,
          query: "审查一份商务合同",
          availability: "available",
          productPillar: "work",
          limit: "3",
        })}`,
      )) as MarketPage

      expect(market.entries.length).toBeGreaterThan(0)
      expect(market.entries[0]!.id).toBe("commercial-legal")
      for (const entry of market.entries) expect(entry.product_pillars).toContain("work")

      const installation = (await call(`install-payload?directory=${encodeURIComponent(project.path)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: "commercial-legal", installationScope: "project" }),
      })) as InstallReceipt
      expect(installation).toMatchObject({
        operation: "installed",
        after: { id: "commercial-legal", installationScope: "project" },
      })

      const installedMarket = (await call(
        `market?${new URLSearchParams({
          directory: project.path,
          query: "审查一份商务合同",
          availability: "installed",
          productPillar: "work",
          limit: "3",
        })}`,
      )) as MarketPage
      expect(installedMarket.entries.find((entry) => entry.id === "commercial-legal")).toMatchObject({
        id: "commercial-legal",
        installation_scopes: ["project"],
      })

      const catalog = (await call(
        `search?${new URLSearchParams({
          directory: project.path,
          view: "effective",
          query: "审查一份商务合同",
          productPillar: "work",
          limit: "20",
        })}`,
      )) as CatalogPage
      expect(catalog.entries.some((entry) => entry.id === "commercial-legal")).toBe(true)
    })
  }, 60_000)

  test("ranks the package whose own vocabulary is the request above packages that merely mention it", async () => {
    await using project = await memoryProject()

    await withMarketRoutes(project.path, async (call) => {
      const roadmap = (await call(
        `market?${new URLSearchParams({
          directory: project.path,
          query: "plan a product roadmap",
          availability: "available",
          productPillar: "work",
          limit: "3",
        })}`,
      )) as MarketPage
      expect(roadmap.entries.map((entry) => entry.id)).toContain("product-management")

      const landing = (await call(
        `market?${new URLSearchParams({
          directory: project.path,
          query: "build a landing page",
          availability: "available",
          productPillar: "code",
          limit: "3",
        })}`,
      )) as MarketPage
      expect(landing.entries[0]!.id).toBe("frontend-innovate")
    })
  }, 60_000)
})
