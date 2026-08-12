"use client";

import Link from "next/link";
import type { ComponentProps, MouseEvent } from "react";
import { useNavigationGuard } from "@/lib/navigationGuard";

// タブバー・サイドバー・戻るボタンなど、アプリ内の主要な移動導線から使う<Link>の代わり。
// 未保存の変更がある場合だけ、移動前に確認ダイアログを挟む。
export function GuardedLink({ href, onClick, ...props }: ComponentProps<typeof Link>) {
  const { isDirty, guardedNavigate } = useNavigationGuard();

  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    onClick?.(e);
    if (e.defaultPrevented) return;
    if (!isDirty) return;
    e.preventDefault();
    guardedNavigate(typeof href === "string" ? href : href.pathname ?? "/");
  }

  return <Link href={href} onClick={handleClick} {...props} />;
}
