import type { TabKey } from "@/lib/permissions";
import {
  GameIcon,
  NoticeIcon,
  NotesIcon,
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
  players: PlayersIcon,
  notes: NotesIcon,
  game: GameIcon,
  users: UsersIcon,
  settings: SettingsIcon,
};
