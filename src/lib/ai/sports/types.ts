// 競技ごとのAI分析コンテキスト。将来的にSPORT_CONTEXTだけを競技単位で改善・追加できるよう、
// 各競技を独立したファイル(このディレクトリ内)に分離している。
export interface SportContext {
  sportName: string;
  // 競技特性(トランジション・コンタクトの有無等、分析の前提として押さえるべき点)
  characteristics: string[];
  // ポジション・役割ごとの注意点(固定評価の禁止、GK/投手等の分離評価が必要な場合はここで明示)
  positionNotes: string[];
  // 主要スタッツ項目とその意味(存在する場合のみAIに渡る。ここは項目の「読み方」の説明)
  importantStatCategories: string[];
  // 単独スタッツではなく組み合わせて見るべき関係性(AST×TO等)
  statInterpretations: string[];
  // 競技が要求する身体能力(スプリント、コンタクト等)
  physicalDemands: string[];
  // スポーツテスト項目と競技パフォーマンスの関係(Maxのみ使用。存在するデータの範囲でのみ言及させる)
  physicalTestRelations: string[];
  // 育成年代として優先すべきテーマ
  developmentPriorities: string[];
  // この競技特有の注意事項(他競技の基準を流用しない、等)
  cautions: string[];
}
