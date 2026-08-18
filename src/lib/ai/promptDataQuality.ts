import type { DataQualityAssessment } from "./types";

// DATA_QUALITY_CONTEXT: 内部的に評価したデータ品質(確信度)をAIに伝え、断定表現の強さを
// 調整させる。ユーザーにはスコア自体を毎回見せないが、重大な制約は「データ上の注意点」等の
// 出力に反映させる。
export function buildDataQualityContext(dq: DataQualityAssessment): string {
  const confidenceInstruction: Record<DataQualityAssessment["confidence"], string> = {
    HIGH: "データ量・データの幅は十分にあります。ただし断定しすぎず、根拠に基づいた範囲で言い切ってください。",
    MEDIUM:
      "データ量はある程度ありますが、傾向を強く断定できるほどではありません。「〜の傾向が見られます」「〜の可能性があります」等、根拠の強さに応じた表現を使ってください。",
    LOW: "データ量が少なく、時系列での傾向判断には向きません。断定的な表現を避け、現時点で分かることに限定して述べてください。特に「継続的な傾向」等、複数時点のデータが必要な表現は使わないでください。",
  };

  const lines = [
    `【データ品質に関する内部情報(この確信度自体をそのまま出力しないこと)】`,
    `このデータの確信度: ${dq.confidence}`,
    confidenceInstruction[dq.confidence],
  ];
  if (dq.notes.length > 0) {
    lines.push("");
    lines.push("具体的な制約:");
    dq.notes.forEach((n) => lines.push(`- ${n}`));
    lines.push("");
    lines.push("これらのうち、分析結果の信頼性に重大な影響を与えるものがあれば、出力の「データ上の注意点」等で簡潔に触れてください。些細なものは無理に触れなくてよいです。");
  }
  return lines.join("\n");
}
