import path from "node:path";
import { defineConfig } from "vitest/config";

// tsconfig.jsonの"@/*" -> "./src/*"と同じエイリアスをテスト実行時にも解決する。
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
});
