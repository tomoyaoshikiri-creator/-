import type { TabKey } from "@/lib/permissions";
import {
  CoachNoteIcon,
  GameIcon,
  HomeIcon,
  KarteIcon,
  LibraryIcon,
  NoticeIcon,
  PlayersIcon,
  ReportIcon,
  ScheduleIcon,
  SettingsIcon,
  TeamIcon,
  UsersIcon,
} from "@/components/icons";

export const TAB_ICONS: Record<TabKey, (props: { className?: string }) => React.ReactElement> = {
  home: HomeIcon,
  schedule: ScheduleIcon,
  notice: NoticeIcon,
  report: ReportIcon,
  coachNote: CoachNoteIcon,
  players: PlayersIcon,
  game: GameIcon,
  karte: KarteIcon,
  library: LibraryIcon,
  users: UsersIcon,
  settings: SettingsIcon,
  team: TeamIcon,
};
