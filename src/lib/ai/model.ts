// AI分析(選手カルテ・チームカルテ)で使うClaudeモデルの設定を一元管理する。
// モデルIDやmax_tokensをここ以外にハードコードしない。
//
// temperatureは意図的に設定していない: Sonnet 5はデフォルトでadaptive thinkingが
// 有効になっており、thinkingが有効な状態でtemperature/top_p/top_kを指定すると
// APIが400エラーを返すため。
export const AI_ANALYSIS_MODEL = "claude-sonnet-5";

// Sonnet 5はadaptive thinkingがデフォルトで有効で、budget_tokensのような別枠指定は
// 廃止されている(指定すると400エラー)。つまり内部思考(thinking)の出力も最終回答の
// テキストも同じmax_tokensの中で共有される。実際に4096では、セクション数の多い構造化
// フォーマット(総合評価/成長点/良好な特徴/課題/横断分析/次のアクション/注目データ、最大3〜5項目
// ずつ)の生成中に出力が途中で打ち切られる事象を確認した(stop_reasonのログは
// api/ai-analysis/route.tsで取得できるようにしてあるが、本セッションからは実際の
// デプロイ環境のログを直接確認できないため、テキストが文末の句読点なしに単語の
// 途中で終わっている、という強い状況証拠から判断している)。
// Anthropicの現行ガイダンスでも、ストリーミングなしのリクエストでmax_tokensを
// 低く見積もりすぎない(目安16,000)ことが推奨されているため、それに合わせて引き上げる。
// (max_tokensは上限であり、実際の生成が短ければそのままの分だけしか課金されない)
export const AI_ANALYSIS_MAX_TOKENS = 16000;
