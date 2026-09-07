import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // このアプリはSupabaseクライアントを使ったクライアントサイドのデータ取得(useEffect内でload関数を呼ぶ)を
      // 意図的なパターンとして採用しているため、このルールは無効化する。
      "react-hooks/set-state-in-effect": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // pdf.js(pdfjs-dist)のWorkerスクリプトをそのまま静的配信しているだけの
    // 第三者製 minified ファイル(src/lib/pdfThumbnail.ts参照)。
    "public/pdf.worker.min.mjs",
  ]),
]);

export default eslintConfig;
