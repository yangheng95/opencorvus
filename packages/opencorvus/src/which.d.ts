declare module "which" {
  const whichPkg: {
    (cmd: string, options?: { path?: string; pathExt?: string }): Promise<string>
    sync(
      cmd: string,
      options?: {
        nothrow?: boolean
        path?: string
        pathExt?: string
      },
    ): string | null
  }

  export default whichPkg
}
