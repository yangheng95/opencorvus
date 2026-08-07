import type { PNG } from "pngjs"

export function pngLuminanceVariance(png: PNG): number {
  const data = png.data
  const stride = 64 * 4
  let sum = 0
  let sumSq = 0
  let samples = 0
  for (let i = 0; i + 2 < data.length; i += stride) {
    const lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
    sum += lum
    sumSq += lum * lum
    samples += 1
  }
  if (samples === 0) return 0
  const mean = sum / samples
  return sumSq / samples - mean * mean
}
