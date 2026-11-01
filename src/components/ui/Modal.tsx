"use client";

import { useEffect, useId, useRef } from "react";
import { CONFIRM_CLOSE_MESSAGE, useNavigationGuard } from "@/lib/navigationGuard";
import { PILL_NAV_TAB_HEIGHT_PX } from "@/components/PillNavBar";

export function Modal({
  open,
  onClose,
  title,
  children,
  maxWidthClass = "max-w-[420px]",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  // 選手選択モーダルなど、内容が短く狭い方が見やすい画面では狭いクラスを渡す。
  maxWidthClass?: string;
}) {
  // モーダルを閉じる操作(背景タップなど)はページ遷移を伴わないため<GuardedLink>では捕まえられない。
  // ここで直接、未保存の変更が無いか確認してから閉じる。
  const { isDirty } = useNavigationGuard();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  // 開く直前にフォーカスしていた要素を覚えておき、閉じたときに戻す(スクリーンリーダー
  // ユーザーが元の操作位置を見失わないようにするため)。
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  function handleClose() {
    if (isDirty && !window.confirm(CONFIRM_CLOSE_MESSAGE)) return;
    onClose();
  }

  // Escキーのイベントリスナーは開いている間ずっと同じ関数を使い回す(毎レンダー
  // 付け外ししない)。そのためhandleCloseを直接クロージャに閉じ込めず、
  // 常に最新のisDirty/onCloseを読めるようrefで橋渡しする(refへの書き込みは
  // レンダー中に行えないため、毎レンダー走るeffectで更新する)。
  const handleCloseRef = useRef(handleClose);
  useEffect(() => {
    handleCloseRef.current = handleClose;
  });

  useEffect(() => {
    if (!open) return;
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") handleCloseRef.current();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocusedRef.current?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-heading/50 flex items-end justify-center z-40"
      style={{
        // position:fixedは.app-shell(env(safe-area-inset-left/right)をpaddingで
        // 吸収している)の外側、実際の画面物理端を基準に配置されるため、ここでも
        // 同様にenv()を足しておかないと横向き時にノッチ・ラウンド角の直下に
        // モーダルが来かねない(px-3固定値だけでは不足するケースがある)。
        paddingLeft: "calc(0.75rem + env(safe-area-inset-left))",
        paddingRight: "calc(0.75rem + env(safe-area-inset-right))",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`bg-white w-full ${maxWidthClass} rounded-t-[20px] p-4.5 pb-5.5 max-h-[85%] overflow-y-auto outline-none`}
      >
        <div id={titleId} className="font-display font-extrabold text-lg text-heading mb-3">
          {title}
        </div>
        {children}
      </div>
    </div>
  );
}

export function Fab({ onClick, label = "追加" }: { onClick: () => void; label?: string }) {
  // MASTER SPECIFICATION Visual Refresh: 背景はアプリ全体のPrimary Action色(--orange、
  // teamPrimaryのエイリアス。team未設定時はCIRCLE LINES Brand Blueへfallback)に統一する。
  // 文字色は任意のteamPrimaryでも可読性を確保するため、teamThemeStyle()が算出した
  // コントラスト安全な--on-team-primaryをそのまま使う(SubmitButton等の固定text-whiteとは
  // 異なり、ここは明示的にcontrast機構を利用する)。shadowも旧・緑固定値ではなく、
  // 現在のteamPrimaryと連動する色にする(--orange-shadow-55、src/lib/theme.tsで
  // JS側事前計算。CSSのcolor-mix()はSafariクラッシュ対策のため使わない)。
  //
  // 下部5タブ(TabBar.tsx)がフローティング型のピルになった(Phase 3)ことで、従来の
  // bottom-4(16px固定)だとピルと重なって押せなくなる不具合が実機で確認された。
  // ピル自体の高さ(PILL_NAV_TAB_HEIGHT_PX)とピルの下端オフセット(TabBar.tsxと同じ
  // max(0.875rem, env(safe-area-inset-bottom)))を足し合わせ、さらに12〜16pxの間隔
  // (0.875rem=14px)を空けた位置にFabを置く。固定pxの単純な上移動ではなく、ピルの
  // 実際の位置・高さとの関係から導いた値であるため、将来ピルの高さやセーフエリアの
  // 扱いが変わっても追従する。
  //
  // 横位置も、外側のラッパーをTabBar.tsx/PillNavPositionと同じ
  // inset-x-0 + mx-auto + max-w-[480px] の中央寄せにし、その内側でright-3(ピルの
  // 右端と同じ値)に配置する。これにより、iPhone縦画面だけでなく、app-shell自体が
  // 画面幅いっぱいに広がる700px以上(iPad縦横)でも、ピルの実際の右端(常に
  // max-w-[480px]の内側)とFabの位置が揃う(従来のright-4は画面の実際の右端を
  // 基準にしていたため、iPad幅ではピルの右端と大きくズレていた)。
  return (
    <div
      className="absolute inset-x-0 mx-auto max-w-[480px]"
      style={{
        bottom: `calc(max(0.875rem, env(safe-area-inset-bottom)) + ${PILL_NAV_TAB_HEIGHT_PX}px + 0.875rem)`,
      }}
    >
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className="absolute right-3 bottom-0 w-10 h-10 rounded-full border border-orange flex items-center justify-center text-xl font-bold z-10"
        style={{
          color: "var(--on-team-primary)",
          // SubmitButton/SegButtonと同じ135deg・濃い色(左上)→薄い色(右下)のグラデーション。
          // 薄い方は黒を混ぜず、白を混ぜて明るくする(--orange-light-55/--orange-shadow-55、
          // Safariのcolor-mix()クラッシュ対策でJS側事前計算値に変更済み)。
          background: "linear-gradient(135deg, var(--orange) 0%, var(--orange-light-55) 100%)",
          boxShadow: "0 10px 20px -6px var(--orange-shadow-55)",
        }}
      >
        +
      </button>
    </div>
  );
}
