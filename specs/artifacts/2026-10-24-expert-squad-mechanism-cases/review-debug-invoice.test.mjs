import assert from "node:assert/strict"
import test from "node:test"
import { invoiceTotalCents } from "../src/invoice.mjs"

const cases = [
  ["mixed fractional prices", [{ unitPrice: "12.50", quantity: 2 }, { unitPrice: "0.75", quantity: 4 }], 2800],
  ["repeated fractional price", [{ unitPrice: "9.99", quantity: 3 }], 2997],
  ["zero price", [{ unitPrice: "0.00", quantity: 2 }], 0],
  ["empty invoice", [], 0],
  ["single cent", [{ unitPrice: "0.01", quantity: 3 }], 3],
  ["twenty-nine cents", [{ unitPrice: "0.29", quantity: 3 }], 87],
  ["one dollar fifteen cents", [{ unitPrice: "1.15", quantity: 1 }], 115],
  ["whole currency units", [{ unitPrice: "10.00", quantity: 2 }], 2000],
  ["zero quantity", [{ unitPrice: "12.50", quantity: 0 }], 0],
]

for (const [name, lines, expected] of cases) {
  test(name, () => {
    const actual = invoiceTotalCents(lines)
    assert.equal(actual, expected)
    assert.ok(Number.isInteger(actual))
  })
}
