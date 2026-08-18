/**
 * Minimal ambient typing for `sharp`, used only by generate-brand-assets.ts.
 *
 * sharp 0.35 ships its declarations at lib/index.d.ts but does not list that path in its
 * package.json "exports". Astro's strict preset resolves with moduleResolution "bundler", which
 * honours "exports", so the import lands on `any` and `astro check` fails under noImplicitAny.
 * A tsconfig "paths" entry fixes the types but also redirects Bun's *runtime* resolution to the
 * .d.ts, which then gets executed — so the fix has to be type-only, which is what this is.
 *
 * Scope is deliberately just the calls the generator makes. If sharp's API moves, the generator
 * breaks loudly at build time and test/brand-assets.test.ts fails on the resulting files, which is
 * a better signal than a hand-maintained copy of an upstream type surface silently drifting.
 */
declare module "sharp" {
  type Colour = { r: number; g: number; b: number; alpha: number }

  interface SharpInstance {
    resize(
      width: number,
      height: number,
      options?: { fit?: "contain" | "cover" | "fill" | "inside" | "outside"; background?: Colour },
    ): SharpInstance
    composite(items: { input: Buffer; top?: number; left?: number; gravity?: string }[]): SharpInstance
    ensureAlpha(): SharpInstance
    png(): SharpInstance
    toFile(path: string): Promise<{ width: number; height: number; size: number }>
    toBuffer(): Promise<Buffer>
  }

  type CreateOptions = {
    create: { width: number; height: number; channels: 3 | 4; background: Colour }
  }

  function sharp(input: string | Buffer, options?: { density?: number }): SharpInstance
  function sharp(options: CreateOptions): SharpInstance

  export default sharp
}
