export function isHttpWebpageUrl(input: string): boolean {
  return /^https?:\/\//i.test(input)
}
