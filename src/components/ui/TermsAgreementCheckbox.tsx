// 新規アカウント作成(サインアップ・チーム作成・招待受諾)の各フォームで共通の、
// 利用規約・プライバシーポリシーへの同意チェックボックス。name="agreedTerms"の
// ネイティブcheckbox(required)なので、未チェックだとブラウザが送信をブロックする。
// サーバー側(各actions.ts)でもformData.get("agreedTerms")の有無を必ず検証する。
export function TermsAgreementCheckbox() {
  return (
    <label className="mt-3.5 flex items-start gap-2 text-[11.5px] text-ink-soft leading-relaxed">
      <input type="checkbox" name="agreedTerms" required className="mt-0.5 w-4 h-4 flex-none accent-orange" />
      <span>
        <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-orange underline">
          利用規約
        </a>
        と
        <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-orange underline">
          プライバシーポリシー
        </a>
        に同意します
      </span>
    </label>
  );
}
