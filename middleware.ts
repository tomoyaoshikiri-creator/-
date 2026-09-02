import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// getUser()がトークンをリフレッシュした場合、更新後のCookieはsupabaseResponseにしか
// 乗っていない。素の NextResponse.redirect() をそのまま返すとこの更新分が失われ、
// ブラウザは期限切れのトークンを送り続けることになる。運が悪いタイミングでこれが
// 起きると、ログイン画面とアプリ画面の間を無限リダイレクトする不具合につながるため、
// リダイレクト時も必ずsupabaseResponse側のCookieを引き継ぐ。
function redirectWithCookies(url: URL, supabaseResponse: NextResponse): NextResponse {
  const redirectResponse = NextResponse.redirect(url);
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie);
  });
  return redirectResponse;
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAuthRoute =
    path.startsWith("/login") ||
    path.startsWith("/signup") ||
    path.startsWith("/invite") ||
    path.startsWith("/auth") ||
    path.startsWith("/forgot-password") ||
    path.startsWith("/privacy") ||
    path.startsWith("/terms");

  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return redirectWithCookies(url, supabaseResponse);
  }

  if (user && (path.startsWith("/login") || path.startsWith("/signup"))) {
    const url = request.nextUrl.clone();
    // ナビ再設計v3でログイン後の着地を/scheduleから/homeに変更。
    url.pathname = "/home";
    return redirectWithCookies(url, supabaseResponse);
  }

  return supabaseResponse;
}

// icon$/apple-icon$/icons\/192$/icons\/512$/manifest\.webmanifest$は、CIRCLE LINESの
// favicon/PWAアイコン/manifest(サービスブランドの公開リソース、src/lib/brandIcon.ts・
// src/app/manifest.ts)を未ログイン状態でも配信するための除外。既存の除外(_next/static等・
// 画像拡張子)と同様に、パス末尾に$アンカーを付けて完全一致のみを除外し、
// 拡張子のないパスや他ファイルまで広く除外しないようにしている。
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon$|apple-icon$|icons/192$|icons/512$|manifest\\.webmanifest$|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
