// @ts-check
import { defineConfig } from "astro/config"
import starlight from "@astrojs/starlight"
import solidJs from "@astrojs/solid-js"
import node from "@astrojs/node"
import theme from "toolbeam-docs-theme"
import config from "./config.mjs"
import { rehypeHeadingIds } from "@astrojs/markdown-remark"
import rehypeAutolinkHeadings from "rehype-autolink-headings"

// The plugin and Astro carry separate unified type identities. Normalize that static boundary while
// keeping the direct function import required for Markdown JSX (MDX) plugin inheritance.
const astroRehypeAutolinkHeadings = /** @type {import("@astrojs/markdown-remark").RehypePlugin} */ (
  /** @type {unknown} */ (rehypeAutolinkHeadings)
)
const publicBase = config.base

// https://astro.build/config
export default defineConfig({
  site: config.url,
  base: publicBase,
  output: "static",
  adapter: node({ mode: "standalone" }),
  devToolbar: {
    enabled: false,
  },
  server: {
    host: "0.0.0.0",
  },
  markdown: {
    rehypePlugins: [rehypeHeadingIds, [astroRehypeAutolinkHeadings, { behavior: "wrap" }]],
  },
  /*
   * Retired public surfaces.
   *
   * The public site collapsed from eight surfaces to two (landing + Expert Squad market); see
   * docs/website-restyle-plan.md §4. These twelve URLs are indexed and linked from outside, so they
   * redirect rather than 404. The market's own URLs are unchanged and deliberately absent here.
   *
   * Two destinations, by kind:
   *   - Content that became documentation points at its new docs page.
   *   - Content that became a landing-page section points at that section's anchor.
   */
  redirects: {
    "/download": "/#start",
    "/zh-cn/download": "/zh-cn/#start",
    "/mission": "/concepts/mission/",
    "/zh-cn/mission": "/zh-cn/concepts/mission/",
    "/use-with-agents": "/integrations/agent-hosts/",
    "/zh-cn/use-with-agents": "/zh-cn/integrations/agent-hosts/",
    "/publish": "/expert-squads/publish/",
    "/zh-cn/publish": "/zh-cn/expert-squads/publish/",
    "/trust": "/expert-squads/trust/",
    "/zh-cn/trust": "/zh-cn/expert-squads/trust/",
    "/architecture-explorer": "/concepts/enterprise-architecture/",
    "/zh-cn/architecture-explorer": "/zh-cn/concepts/enterprise-architecture/",
  },
  build: {},
  vite: {
    // esbuild 0.28 no longer lowers destructuring for Safari 14.0. Safari 14.1 is the
    // narrowest target that preserves the site's previous baseline without making
    // Astro's own audit client fail the production build.
    build: { target: ["chrome87", "edge88", "firefox78", "safari14.1"] },
  },
  integrations: [
    solidJs(),
    starlight({
      title: "OpenCorvus",
      defaultLocale: "root",
      locales: {
        root: {
          label: "English",
          lang: "en",
          dir: "ltr",
        },
        "zh-cn": {
          label: "简体中文",
          lang: "zh-CN",
          dir: "ltr",
        },
      },
      favicon: "/favicon.svg",
      lastUpdated: true,
      expressiveCode: { themes: ["github-light", "github-dark"] },
      social: [
        { icon: "github", label: "GitHub", href: config.github },
        { icon: "discord", label: "Discussions", href: config.discord },
      ],
      editLink: {
        baseUrl: `${config.github}/edit/dev/packages/web/`,
      },
      markdown: {
        headingLinks: false,
      },
      customCss: ["./src/styles/custom.css"],
      logo: {
        light: "./src/assets/logo-light.svg",
        dark: "./src/assets/logo-dark.svg",
        replacesTitle: true,
      },
      sidebar: [
        {
          label: "Get Started",
          translations: { en: "Get Started", "zh-CN": "快速开始" },
          items: ["start/install", "start/quickstart"],
        },
        "config",
        "providers",
        "network",
        "troubleshooting",
        {
          label: "Windows",
          translations: { en: "Windows", "zh-CN": "Windows" },
          link: "windows-wsl",
        },
        {
          label: "Concepts",
          translations: { en: "Concepts", "zh-CN": "概念" },
          items: [
            "concepts/architecture",
            "concepts/enterprise-architecture",
            "concepts/agent-loop",
            "concepts/delivery-slice-task",
            "concepts/mission",
            "concepts/long-horizon",
            "concepts/squad-composition",
          ],
        },
        {
          label: "Expert Squads",
          translations: { en: "Expert Squads", "zh-CN": "专家团" },
          items: ["expert-squads/publish", "expert-squads/trust", "expert-squads/evolution"],
        },
        {
          label: "Integrations",
          translations: { en: "Integrations", "zh-CN": "集成" },
          items: ["integrations/agent-hosts"],
        },
        {
          label: "Usage",
          translations: { en: "Usage", "zh-CN": "使用" },
          items: ["cli"],
        },
        {
          label: "Configure",
          translations: { en: "Configure", "zh-CN": "配置" },
          items: [
            "tools",
            "rules",
            "agents",
            "models",
            "commands",
            "formatters",
            "permissions",
            "mcp-servers",
            "acp",
            "skills",
          ],
        },
        {
          label: "Channels",
          translations: { en: "Channels", "zh-CN": "频道" },
          items: [
            "channels/overview",
            "channels/slack",
            "channels/discord",
            "channels/feishu",
            "channels/dingtalk",
            "channels/wecom",
            "channels/qqbot",
            "channels/telegram",
            "channels/whatsapp",
            "channels/line",
            "channels/signal",
            "channels/matrix",
            "channels/mattermost",
            "channels/msteams",
            "channels/googlechat",
          ],
        },
        {
          label: "Overlay",
          translations: { en: "Overlay", "zh-CN": "Overlay 桌面端" },
          items: ["overlay/overview"],
        },
        {
          label: "Operations",
          translations: { en: "Operations", "zh-CN": "运维" },
          items: ["operations/benchmark", "operations/github-action"],
        },
        {
          label: "Develop",
          translations: { en: "Develop", "zh-CN": "开发" },
          items: ["sdk", "server", "plugins"],
        },
        {
          label: "Reference",
          translations: { en: "Reference", "zh-CN": "参考" },
          items: [
            "reference/mission-task",
            "reference/api",
            "reference/cli",
            "reference/sdk",
            "reference/env",
            "reference/evaluator",
          ],
        },
      ],
      components: {
        Head: "./src/components/Head.astro",
        Header: "./src/components/Header.astro",
        Footer: "./src/components/Footer.astro",
        SiteTitle: "./src/components/SiteTitle.astro",
      },
      plugins: [
        theme({
          headerLinks: config.headerLinks,
        }),
      ],
    }),
  ],
})
