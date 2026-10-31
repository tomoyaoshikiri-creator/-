// PR #213(共通ナビゲーション刷新)の実機フィードバックを受けた、A/B比較のための
// 一時的な検証用コード。investigation/pr213-nav-safearea-ab ブランチ専用で、
// PR #213本体には存在しない。同一Previewデプロイ上でURLクエリだけでA/B案を
// 切り替えて実機比較できるようにするためのもの。
//
//   ?navmode=flow を付けるとB案(TabBar.tsxをapp-shellのdvhベースflexレイアウト内の
//   通常要素として配置)になる。指定なし/他の値はA案(現在のPR #213の実装、
//   position:fixed)のまま。
//   ?debug=1 を付けると画面右下にSafe Area診断用の値(SafeAreaDebugOverlay.tsx)を
//   表示する。
//
// useSearchParams()はNext.jsのSuspense境界が絡むため、検証用の最小実装として
// window.location.searchを直接読む方式にしている(ページ再読み込みで切り替える
// 運用を前提とし、クエリ変更への動的な再レンダリング追従は不要)。
export type NavMode = "fixed" | "flow";

export function useNavExperiment(): { navMode: NavMode; debug: boolean } {
  if (typeof window === "undefined") {
    return { navMode: "fixed", debug: false };
  }
  const params = new URLSearchParams(window.location.search);
  return {
    navMode: params.get("navmode") === "flow" ? "flow" : "fixed",
    debug: params.get("debug") === "1",
  };
}
