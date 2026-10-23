export function invoiceTotalCents(lines) {
  return lines.reduce((total, line) => total + parseInt(line.unitPrice, 10) * 100 * line.quantity, 0)
}
