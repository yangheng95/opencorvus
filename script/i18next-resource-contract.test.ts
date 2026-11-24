import { expect, test } from "bun:test"
import path from "node:path"

test("website theme resources preserve own inherited-name data and produce the merged translation", () => {
  // A third-party regression can affect process-wide built-ins; keep the real
  // public consumer and its resource merge inside this bounded child process.
  const code = `
    const { createRequire } = require("node:module");
    const { resolve } = require("node:path");
    const web = createRequire(resolve("packages/web/package.json"));
    const theme = createRequire(web.resolve("toolbeam-docs-theme"));
    const starlight = createRequire(theme.resolve("@astrojs/starlight"));
    const instance = starlight("i18next").createInstance();
    await instance.init({ lng: "en", fallbackLng: "en", resources: {
      en: { translation: { release: { title: "OpenCorvus release", status: "Prepared" } } }
    }});
    instance.addResourceBundle("en", "translation", {
      release: { status: "Published" }, hasOwnProperty: { call: "resource-owned-value" }
    }, true, true);
    console.log(JSON.stringify({
      title: instance.t("release.title"), status: instance.t("release.status"),
      resource: instance.getResource("en", "translation", "hasOwnProperty.call"),
      ownResource: Object.hasOwn(instance.getResourceBundle("en", "translation"), "hasOwnProperty"),
      builtInResult: Object.prototype.hasOwnProperty.call({ release: true }, "release")
    }));
  `
  const result = Bun.spawnSync([process.execPath, "--eval", code], {
    cwd: path.resolve(import.meta.dir, ".."),
    stdout: "pipe",
    stderr: "pipe",
    timeout: 10_000,
  })
  if (result.exitCode !== 0) throw new Error(result.stderr.toString() || "Website resource contract child failed")
  expect(result.exitCode).toBe(0)
  expect(JSON.parse(result.stdout.toString())).toEqual({
    title: "OpenCorvus release",
    status: "Published",
    resource: "resource-owned-value",
    ownResource: true,
    builtInResult: true,
  })
})
