export const GENERATED_FRONTEND_PACKAGE_PROFILE = {
  packageManager: "npm@10.9.0",
  runtimeDependencies: {
    react: "19.2.7",
    reactDom: "19.2.7",
  },
  scripts: {
    viteDev: "vite --host 127.0.0.1",
    viteBuild: "vite build",
    vitePreview: "vite preview --host 127.0.0.1 --strictPort",
    typecheck: "tsc --noEmit",
  },
} as const
