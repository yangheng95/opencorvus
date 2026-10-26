declare const __OPENCORVUS_OVERLAY_VERSION__: string
declare const __OPENCORVUS_BUILD_PLATFORM__: "darwin" | "linux" | "win32"

// Moment's typesVersions omit its ESM entry and locale registration modules.
declare module "moment/dist/moment.js" {
  import moment from "moment"
  export default moment
}
declare module "moment/dist/locale/zh-cn.js" {}
