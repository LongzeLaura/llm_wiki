import path from "node:path"
import { defineConfig } from "vite"

export default defineConfig({
  resolve: {
    alias: [
      {
        find: "@/commands/fs",
        replacement: path.resolve(__dirname, "src/commands/fs-node.ts"),
      },
      {
        find: "@",
        replacement: path.resolve(__dirname, "src"),
      },
    ],
  },
  build: {
    target: "node20",
    outDir: "dist-runtime",
    emptyOutDir: true,
    ssr: "src/lib/rpg-runtime/node-worker/run-turn-worker.ts",
    rollupOptions: {
      external: [/^node:/],
      output: {
        entryFileNames: "rpg-runtime-worker.mjs",
        inlineDynamicImports: true,
      },
    },
  },
  ssr: {
    noExternal: true,
  },
})
