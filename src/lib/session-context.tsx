"use client";

import { createContext, useContext } from "react";
import type { Role } from "@/lib/database.types";

export interface SessionInfo {
  userId: string;
  teamId: string;
  teamName: string;
  teamLogoUrl: string | null;
  name: string;
  role: Role;
}

const SessionContext = createContext<SessionInfo | null>(null);

export function SessionProvider({
  value,
  children,
}: {
  value: SessionInfo;
  children: React.ReactNode;
}) {
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionInfo {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession は SessionProvider の内側で使用してください");
  return ctx;
}
