import { execa } from "execa";
import { defineConfig } from "tsup";

export default defineConfig({
  name: "@ponder/core",
  entry: ["src/index.ts", "src/bin/ponder.ts", "src/drizzle/drizzle.ts"],
  outDir: "dist",
  format: ["esm"],
  sourcemap: true,
  dts: true,
  clean: true,
  splitting: true,
  onSuccess: async () => {
    try {
      await execa("pnpm", ["wagmi", "generate"]);
    } catch {}
  },
});
