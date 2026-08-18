// AI分析(選手カルテ・チームカルテ)で使うClaudeモデルの設定を一元管理する。
// モデルIDやmax_tokensをここ以外にハードコードしない。
//
// temperatureは意図的に設定していない: Sonnet 5はデフォルトでadaptive thinkingが
// 有効になっており、thinkingが有効な状態でtemperature/top_p/top_kを指定すると
// APIが400エラーを返すため。
export const AI_ANALYSIS_MODEL = "claude-sonnet-5";

// 選手分析・チーム分析とも、今回のセクション数の多い構造化フォーマット
// (総合評価/成長点/強み/課題/横断分析/次のアクション/注目データ、最大3〜5項目ずつ)を
// 日本語で出力すると1,500〜2,500トークン程度になり得るため、余裕を持たせておく。
// (max_tokensは上限であり、実際の生成が短ければそのままの分だけしか課金されない)
export const AI_ANALYSIS_MAX_TOKENS = 4096;
