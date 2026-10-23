import assert from "node:assert/strict"
import { invoiceTotalCents } from "./src/invoice.mjs"

assert.equal(invoiceTotalCents([{ unitPrice: "12.50", quantity: 2 }, { unitPrice: "0.75", quantity: 4 }]), 2800)
assert.equal(invoiceTotalCents([{ unitPrice: "9.99", quantity: 3 }]), 2997)
assert.equal(invoiceTotalCents([{ unitPrice: "0.00", quantity: 2 }]), 0)
assert.equal(invoiceTotalCents([]), 0)
console.log(JSON.stringify({ status: "passed", mixedCents: 2800, repeatedCents: 2997, zeroCents: 0, emptyCents: 0 }))
