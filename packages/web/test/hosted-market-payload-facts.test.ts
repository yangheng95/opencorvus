import { expect, test } from "bun:test"
import { payloadPackageSources } from "../../opencorvus/generated/expert-squad-payload"
import { repositoryHostedMarketFacts } from "../script/hosted-market-server"

test("hosted Market seeds the exact repository payload revisions", () => {
  const facts = repositoryHostedMarketFacts()
  expect(facts).toHaveLength(115)
  expect(facts.map((entry) => String(entry.identity.id))).toEqual(payloadPackageSources.map((source) => source.id))
  expect(facts.every((entry) => /^[a-f0-9]{64}$/.test(entry.identity.digest))).toBe(true)
})
