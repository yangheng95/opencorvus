import { expect, test } from "bun:test"
import { deriveTitle } from "@/title/derive"

test("an opening sequence of visible references gives its title space to the outcome", () => {
  expect(deriveTitle('  @squad("base") @skill("review")\n @mission(“research”)\n核对本地订单\n说明计算依据')).toBe(
    "核对本地订单",
  )
})

test("references within the actual title remain part of the topic", () => {
  expect(deriveTitle('说明 @squad("base") 的选择方式')).toBe('说明 @squad("base") 的选择方式')
})

test("a reference-only request uses its actual reference as the title", () => {
  expect(deriveTitle(' @squad("base") ')).toBe('@squad("base")')
})

test("an invalid prefix remains literal title content", () => {
  expect(deriveTitle(String.raw`@squad("\q")` + "\n核对本地订单")).toBe(String.raw`@squad("\q")`)
})

test.each(['@squad("")', '@skill(" ")'])("an empty reference identity remains the literal title: %s", (prefix) => {
  expect(deriveTitle(prefix + "\n核对本地订单")).toBe(prefix)
})
