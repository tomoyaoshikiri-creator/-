import type { TabKey } from "@/lib/permissions";
import {
  CoachNoteIcon,
  GameIcon,
  KarteIcon,
  NoticeIcon,
  PlayersIcon,
  ReportIcon,
  ScheduleIcon,
  SettingsIcon,
  UsersIcon,
} from "@/components/icons";

export const TAB_ICONS: Record<TabKey, (props: { className?: string }) => React.ReactElement> = {
  schedule: ScheduleIcon,
  notice: NoticeIcon,
  report: ReportIcon,
  coachNote: CoachNoteIcon,
  players: PlayersIcon,
  game: GameIcon,
  karte: KarteIcon,
  users: UsersIcon,
  settings: SettingsIcon,
};
