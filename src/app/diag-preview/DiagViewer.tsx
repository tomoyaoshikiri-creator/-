"use client";

import { useEffect, useState } from "react";

interface DiagEvent {
  t: number;
  k: string;
}

interface DiagSession {
  id: string;
  startedAt: number;
  path: string;
  events: DiagEvent[];
  ended: boolean;
  endReason: string | null;
}

interface DiagData {
  sessions: DiagSession[];
}

function isDiagData(value: unknown): value is DiagData {
  return !!value && typeof value === "object" && Array.isArray((value as DiagData).sessions);
}

// localStorageの読み出し自体はReactのhydrationに依存するため、page.tsx側の
// 生JSによる即時表示(diag-raw-dump)とは別に、整形表示用としてここでも読み出す。
// どちらかが表示できなくても、もう一方で記録内容を確認できるようにする狙い。
export function DiagViewer() {
  const [data, setData] = useState<DiagData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("diag.v1");
      const parsed = raw ? JSON.parse(raw) : { sessions: [] };
      setData(isDiagData(parsed) ? parsed : { sessions: [] });
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  return (
    <div style={{ fontFamily: "monospace", fontSize: 13, padding: 16, background: "#fff", color: "#000" }}>
      <h1 style={{ fontSize: 16, marginBottom: 8 }}>診断ログ(整形表示 / このコンテキストのみ)</h1>
      <p style={{ fontSize: 12, color: "#555", marginBottom: 12, lineHeight: 1.6 }}>
        「終了状態不明」は記録が途切れたことのみを示し、異常終了を断定するものではありません。
        iPadOSの解析データ等、別の証拠と合わせて確認してください。Safari通常タブとホーム画面
        追加アプリの記録は別々に保存されるため、両方を個別にこのページで確認してください。
      </p>
      {loadError && <p style={{ color: "#c00" }}>読み込みエラー: {loadError}</p>}
      {data && data.sessions.length === 0 && <p>記録がありません。</p>}
      {data &&
        data.sessions
          .slice()
          .reverse()
          .map((s) => (
            <div key={s.id} style={{ border: "1px solid #ccc", borderRadius: 4, padding: 10, marginBottom: 10 }}>
              <div>開始: {new Date(s.startedAt).toLocaleString("ja-JP")} / パス: {s.path}</div>
              <div>終了: {s.ended ? `正常終了(${s.endReason ?? "-"})` : "終了状態不明(記録途絶)"}</div>
              <ul style={{ marginTop: 6, paddingLeft: 18 }}>
                {s.events.map((e, i) => (
                  <li key={i}>
                    {new Date(e.t).toLocaleTimeString("ja-JP")} - {e.k}
                  </li>
                ))}
              </ul>
            </div>
          ))}
    </div>
  );
}
