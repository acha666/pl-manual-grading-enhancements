import { build, context } from "esbuild";
import { readFile, mkdir, cp } from "node:fs/promises";

const { version } = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);
const watch = process.argv.includes("--watch");
const outdir = "elements/pl-manual-grading-enhancements/dist";
const options = {
  entryPoints: ["src/main.ts", "src/styles.css"],
  outdir,
  bundle: true,
  format: "iife",
  target: "es2022",
  minify: !watch,
  sourcemap: watch ? "inline" : false,
  define: { __VERSION__: JSON.stringify(version) },
  logLevel: "info",
};
if (watch) {
  const ctx = await context(options);
  await ctx.watch();
} else {
  await build(options);
}
if (process.argv.includes("--package")) {
  const destination = "dist/elements/pl-manual-grading-enhancements";
  await mkdir(destination, { recursive: true });
  for (const file of ["controller.py", "info.json", "dist"]) {
    await cp(
      `elements/pl-manual-grading-enhancements/${file}`,
      `${destination}/${file}`,
      { recursive: true },
    );
  }
  await cp("README.md", "dist/README.md");
  await cp("docs", "dist/docs", { recursive: true });
}
