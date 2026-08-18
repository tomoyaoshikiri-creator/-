import type { SportContext } from "./sports/types";

function bulletList(items: string[]): string {
  return items.map((s) => `- ${s}`).join("\n");
}

// SPORT_CONTEXT: 競技ごとの特性・スタッツの読み方・身体テストとの関係・注意事項をまとめて
// 1つのテキストブロックにする。8競技それぞれ独立したSportContextオブジェクトから生成するため、
// 別競技の専門用語が混ざらない。
export function buildSportContext(context: SportContext): string {
  return `【対象競技: ${context.sportName}】

競技特性:
${bulletList(context.characteristics)}

ポジション・役割についての注意:
${bulletList(context.positionNotes)}

主要スタッツ項目の意味(存在するものだけを分析対象とし、他競技のスタッツを混同しないこと):
${bulletList(context.importantStatCategories)}

スタッツの組み合わせで見るべき関係性:
${bulletList(context.statInterpretations)}

この競技が要求する身体能力:
${bulletList(context.physicalDemands)}

スポーツテストと競技パフォーマンスの関係(スポーツテストのデータが提供されている場合のみ参照し、存在しない項目については言及しない):
${bulletList(context.physicalTestRelations)}

この競技・年代で優先すべき育成テーマ:
${bulletList(context.developmentPriorities)}

この競技特有の注意事項:
${bulletList(context.cautions)}`;
}
