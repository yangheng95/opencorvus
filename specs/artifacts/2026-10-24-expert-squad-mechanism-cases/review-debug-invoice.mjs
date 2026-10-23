export function invoiceTotalCents(lines) {
  return lines.reduce((total, line) => {
    const [whole, fraction] = line.unitPrice.split(".")
    const unitCents = Number(whole) * 100 + Number(fraction)
    return total + unitCents * line.quantity
  }, 0)
}
