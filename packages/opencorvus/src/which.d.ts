declare module "which" {
  const whichPkg: {
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
