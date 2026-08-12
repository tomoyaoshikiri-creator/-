// supabase/migrations/0001_init.sql のスキーマに対応する手書きの型定義
// (実プロジェクト作成後は `supabase gen types typescript` で自動生成した内容に置き換えてよい)

export type Role = "一般" | "運営" | "指導者" | "管理者";
export type UserStatus = "アクティブ" | "休止";
export type ScheduleType = "practice" | "game" | "event";
// 種別が"game"の予定にのみ意味を持つ区分。試合記録・試合結果一覧の絞り込みにも使う。
export type GameCategory = "練習試合" | "公式戦";
export type NoticeAudience = "全員" | "指導者のみ" | "運営以上" | "学年指定";
export type AttendanceStatus = "出席" | "欠席";
export type YesNo = "あり" | "なし";
export type CarStatus = "可" | "不可";
export type PlayerStatus = "在籍" | "休部" | "退団" | "OB・OG";
// 選手登録時に選べる学年(在籍中の選手のみ)。OB・OGは年度更新のたびに
// 卒団からの経過年数として6より先の値(文字列)まで内部的に伸びていく。
export type Grade = "0" | "1" | "2" | "3" | "4" | "5" | "6";
export type Position = "PG" | "SG" | "SF" | "PF" | "C";
export type AttachmentKind = "対戦表" | "配車表" | "その他";
export type ReactionType = "thumbs_up" | "ok_gesture" | "bow" | "pray";
export type StatEvent =
  | "fg_make"
  | "fg_miss"
  | "ft_make"
  | "ft_miss"
  | "reb_off"
  | "reb_def"
  | "ast"
  | "stl"
  | "blk"
  | "tov"
  | "fouls";

export interface Database {
  public: {
    Tables: {
      teams: {
        Row: {
          id: string;
          name: string;
          slug: string;
          theme_primary: string | null;
          theme_accent: string | null;
          logo_path: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug?: string;
          theme_primary?: string | null;
          theme_accent?: string | null;
          logo_path?: string | null;
          created_at?: string;
        };
        Update: Partial<{
          name: string;
          theme_primary: string | null;
          theme_accent: string | null;
          logo_path: string | null;
        }>;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          team_id: string;
          name: string;
          role: Role;
          status: UserStatus;
          email: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          team_id: string;
          name: string;
          role?: Role;
          status?: UserStatus;
          email?: string | null;
          created_at?: string;
        };
        Update: Partial<{
          name: string;
          role: Role;
          status: UserStatus;
        }>;
        Relationships: [];
      };
      invites: {
        Row: {
          id: string;
          team_id: string;
          role: "一般" | "指導者";
          token: string;
          created_by: string;
          expires_at: string;
          used_at: string | null;
          used_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          role: "一般" | "指導者";
          created_by: string;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      schedules: {
        Row: {
          id: string;
          team_id: string;
          type: ScheduleType;
          title: string;
          date: string;
          start_time: string | null;
          end_time: string | null;
          place: string | null;
          toban: string | null;
          // 対象学年の下限("○年生以上"のみが出欠登録対象になる)。nullは全員対象。
          target_grade_min: string | null;
          // type="game"の予定にのみ意味を持つ(練習試合/公式戦)。それ以外はnull。
          game_category: GameCategory | null;
          // 4月始まりの自動判定を上書きする年度(nullなら自動判定)。type="game"の予定にのみ意味を持つ。
          fiscal_year_override: number | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          type: ScheduleType;
          title: string;
          date: string;
          start_time?: string | null;
          end_time?: string | null;
          place?: string | null;
          toban?: string | null;
          target_grade_min?: string | null;
          game_category?: GameCategory | null;
          fiscal_year_override?: number | null;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["schedules"]["Insert"]>;
        Relationships: [];
      };
      attendances: {
        Row: {
          id: string;
          schedule_id: string;
          user_id: string;
          player_id: string | null;
          status: AttendanceStatus;
          accompany: YesNo | null;
          accompany_count: number | null;
          car: CarStatus | null;
          seats: number | null;
          note: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          schedule_id: string;
          user_id: string;
          player_id?: string | null;
          status: AttendanceStatus;
          accompany?: YesNo | null;
          accompany_count?: number | null;
          car?: CarStatus | null;
          seats?: number | null;
          note?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["attendances"]["Insert"]>;
        Relationships: [];
      };
      notices: {
        Row: {
          id: string;
          team_id: string;
          title: string;
          body: string | null;
          sender_id: string | null;
          created_at: string;
          audience: NoticeAudience;
          target_grade_min: string | null;
        };
        Insert: {
          id?: string;
          team_id: string;
          title: string;
          body?: string | null;
          sender_id?: string | null;
          audience?: NoticeAudience;
          target_grade_min?: string | null;
        };
        Update: Partial<{
          title: string;
          body: string | null;
          audience: NoticeAudience;
          target_grade_min: string | null;
        }>;
        Relationships: [];
      };
      notice_attachments: {
        Row: {
          id: string;
          notice_id: string;
          kind: AttachmentKind;
          storage_path: string;
          file_name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          notice_id: string;
          kind: AttachmentKind;
          storage_path: string;
          file_name: string;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      reports: {
        Row: {
          id: string;
          team_id: string;
          author_id: string | null;
          date: string;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          author_id?: string | null;
          date: string;
          body: string;
        };
        Update: Partial<{
          date: string;
          body: string;
        }>;
        Relationships: [];
      };
      report_reactions: {
        Row: {
          id: string;
          team_id: string;
          report_id: string;
          profile_id: string;
          reaction_type: ReactionType;
          created_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          report_id: string;
          profile_id: string;
          reaction_type: ReactionType;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      players: {
        Row: {
          id: string;
          team_id: string;
          sei: string;
          mei: string;
          sei_kana: string | null;
          mei_kana: string | null;
          // OB・OGは年度更新のたびに増え続けるため "6" を超える値もあり得る
          grade: string | null;
          number: string | null;
          positions: Position[];
          status: PlayerStatus;
          birthday: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          sei: string;
          mei: string;
          sei_kana?: string | null;
          mei_kana?: string | null;
          grade?: Grade | null;
          number?: string | null;
          positions?: Position[];
          status?: PlayerStatus;
          birthday?: string | null;
        };
        Update: Partial<Omit<Database["public"]["Tables"]["players"]["Insert"], "grade">> & {
          // 編集画面からOB・OGの経過年数(6超)を直接入力できるようUpdateだけ広げる
          grade?: string | null;
          status?: PlayerStatus;
        };
        Relationships: [];
      };
      player_guardians: {
        Row: {
          id: string;
          team_id: string;
          player_id: string;
          profile_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          player_id: string;
          profile_id: string;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      player_notes: {
        Row: {
          id: string;
          team_id: string;
          player_id: string;
          author_id: string | null;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          player_id: string;
          author_id?: string | null;
          body: string;
        };
        Update: Partial<{
          body: string;
        }>;
        Relationships: [];
      };
      player_note_reactions: {
        Row: {
          id: string;
          team_id: string;
          note_id: string;
          profile_id: string;
          reaction_type: ReactionType;
          created_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          note_id: string;
          profile_id: string;
          reaction_type: ReactionType;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      notice_reactions: {
        Row: {
          id: string;
          team_id: string;
          notice_id: string;
          profile_id: string;
          reaction_type: ReactionType;
          created_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          notice_id: string;
          profile_id: string;
          reaction_type: ReactionType;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      game_matches: {
        Row: {
          id: string;
          team_id: string;
          schedule_id: string;
          game_number: number;
          opponent: string | null;
          team_score: number | null;
          opponent_score: number | null;
          score_photo_path: string | null;
          video_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          schedule_id: string;
          game_number: number;
          opponent?: string | null;
          team_score?: number | null;
          opponent_score?: number | null;
          score_photo_path?: string | null;
          video_url?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["game_matches"]["Insert"]>;
        Relationships: [];
      };
      game_opponent_players: {
        Row: {
          id: string;
          team_id: string;
          match_id: string;
          number: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          match_id: string;
          number: string;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      game_opponent_records: {
        Row: {
          id: string;
          team_id: string;
          match_id: string;
          quarter: number;
          starter_opponent_player_ids: string[];
          sub_opponent_player_ids: string[];
          updated_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          match_id: string;
          quarter: number;
          starter_opponent_player_ids?: string[];
          sub_opponent_player_ids?: string[];
        };
        Update: Partial<Database["public"]["Tables"]["game_opponent_records"]["Insert"]>;
        Relationships: [];
      };
      game_opponent_stat_lines: {
        Row: {
          id: string;
          team_id: string;
          match_id: string;
          opponent_player_id: string;
          fg_made: number;
          fg_att: number;
          ft_made: number;
          ft_att: number;
          pts: number;
          reb_off: number;
          reb_def: number;
          ast: number;
          blk: number;
          stl: number;
          tov: number;
          fouls: number;
          reb: number;
          eff: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          match_id: string;
          opponent_player_id: string;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      game_opponent_stat_events: {
        Row: {
          id: string;
          team_id: string;
          match_id: string;
          opponent_player_id: string;
          quarter: number;
          event: StatEvent;
          delta: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          match_id: string;
          opponent_player_id: string;
          quarter: number;
          event: StatEvent;
          delta: number;
        };
        Update: { quarter?: number };
        Relationships: [];
      };
      practice_menus: {
        Row: {
          id: string;
          team_id: string;
          schedule_id: string;
          theme: string | null;
          content: string | null;
          created_by: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          schedule_id: string;
          theme?: string | null;
          content?: string | null;
          created_by?: string | null;
        };
        Update: Partial<{
          theme: string | null;
          content: string | null;
        }>;
        Relationships: [];
      };
      game_records: {
        Row: {
          id: string;
          team_id: string;
          match_id: string;
          quarter: number;
          starter_player_ids: string[];
          sub_player_ids: string[];
          updated_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          match_id: string;
          quarter: number;
          starter_player_ids?: string[];
          sub_player_ids?: string[];
        };
        Update: Partial<Database["public"]["Tables"]["game_records"]["Insert"]>;
        Relationships: [];
      };
      game_player_stat_lines: {
        Row: {
          id: string;
          team_id: string;
          match_id: string;
          player_id: string;
          fg_made: number;
          fg_att: number;
          ft_made: number;
          ft_att: number;
          pts: number;
          reb_off: number;
          reb_def: number;
          ast: number;
          blk: number;
          stl: number;
          tov: number;
          fouls: number;
          reb: number;
          eff: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          match_id: string;
          player_id: string;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      game_stat_events: {
        Row: {
          id: string;
          team_id: string;
          match_id: string;
          player_id: string;
          quarter: number;
          event: StatEvent;
          delta: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          match_id: string;
          player_id: string;
          quarter: number;
          event: StatEvent;
          delta: number;
        };
        Update: { quarter?: number };
        Relationships: [];
      };
      sports_test_records: {
        Row: {
          id: string;
          team_id: string;
          player_id: string;
          fiscal_year: number;
          quarter: number;
          wingspan_cm: number | null;
          sprint20m_1: number | null;
          sprint20m_2: number | null;
          long_jump_1: number | null;
          long_jump_2: number | null;
          lane_agility_1: number | null;
          lane_agility_2: number | null;
          side_step_1: number | null;
          side_step_2: number | null;
          shuttle_20m_x3: number | null;
          ball_throw_1: number | null;
          ball_throw_2: number | null;
          back_fist_right: number | null;
          back_fist_left: number | null;
          ft_golf: number | null;
          beep_test_reps: number | null;
          not_conducted: boolean;
          recorded_by: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          player_id: string;
          fiscal_year: number;
          quarter: number;
          not_conducted?: boolean;
          wingspan_cm?: number | null;
          sprint20m_1?: number | null;
          sprint20m_2?: number | null;
          long_jump_1?: number | null;
          long_jump_2?: number | null;
          lane_agility_1?: number | null;
          lane_agility_2?: number | null;
          side_step_1?: number | null;
          side_step_2?: number | null;
          shuttle_20m_x3?: number | null;
          ball_throw_1?: number | null;
          ball_throw_2?: number | null;
          back_fist_right?: number | null;
          back_fist_left?: number | null;
          ft_golf?: number | null;
          beep_test_reps?: number | null;
          recorded_by?: string | null;
        };
        Update: Partial<Omit<Database["public"]["Tables"]["sports_test_records"]["Insert"], "player_id" | "fiscal_year" | "quarter">>;
        Relationships: [];
      };
      player_growth_records: {
        Row: {
          id: string;
          team_id: string;
          player_id: string;
          measured_on: string;
          height_cm: number | null;
          weight_kg: number | null;
          recorded_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          player_id: string;
          measured_on: string;
          height_cm?: number | null;
          weight_kg?: number | null;
          recorded_by?: string | null;
        };
        Update: Partial<{
          height_cm: number | null;
          weight_kg: number | null;
        }>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_team_and_admin: {
        Args: { team_name: string; admin_name: string };
        Returns: string;
      };
      get_invite_info: {
        Args: { invite_token: string };
        Returns: { team_name: string; role: string; valid: boolean }[];
      };
      accept_invite: {
        Args: { invite_token: string; member_name: string };
        Returns: string;
      };
      advance_academic_year: {
        Args: Record<string, never>;
        Returns: void;
      };
      get_default_team_logo_path: {
        Args: Record<string, never>;
        Returns: string | null;
      };
      get_team_login_branding: {
        Args: { p_slug: string };
        Returns: { name: string; logo_path: string | null }[];
      };
      list_team_members: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          name: string;
          role: Role;
          status: UserStatus;
          email: string | null;
          created_at: string;
        }[];
      };
      list_roster_players: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          sei: string;
          mei: string;
          grade: string | null;
          status: string;
          birthday: string | null;
        }[];
      };
      record_game_stat: {
        Args: {
          p_match_id: string;
          p_player_id: string;
          p_quarter: number;
          p_event: string;
          p_delta: number;
        };
        Returns: {
          line: {
            id: string;
            team_id: string;
            match_id: string;
            player_id: string;
            fg_made: number;
            fg_att: number;
            ft_made: number;
            ft_att: number;
            pts: number;
            reb_off: number;
            reb_def: number;
            ast: number;
            blk: number;
            stl: number;
            tov: number;
            fouls: number;
            reb: number;
            eff: number;
            updated_at: string;
          };
          event_id: string;
        }[];
      };
      record_opponent_game_stat: {
        Args: {
          p_match_id: string;
          p_opponent_player_id: string;
          p_quarter: number;
          p_event: string;
          p_delta: number;
        };
        Returns: {
          line: {
            id: string;
            team_id: string;
            match_id: string;
            opponent_player_id: string;
            fg_made: number;
            fg_att: number;
            ft_made: number;
            ft_att: number;
            pts: number;
            reb_off: number;
            reb_def: number;
            ast: number;
            blk: number;
            stl: number;
            tov: number;
            fouls: number;
            reb: number;
            eff: number;
            updated_at: string;
          };
          event_id: string;
        }[];
      };
      delete_game_stat_event: {
        Args: { p_event_id: string };
        Returns: void;
      };
      delete_opponent_game_stat_event: {
        Args: { p_event_id: string };
        Returns: void;
      };
      reset_match_stats: {
        Args: { p_match_id: string };
        Returns: void;
      };
    };
  };
}

export type Team = Database["public"]["Tables"]["teams"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Invite = Database["public"]["Tables"]["invites"]["Row"];
export type Schedule = Database["public"]["Tables"]["schedules"]["Row"];
export type Attendance = Database["public"]["Tables"]["attendances"]["Row"];
export type Notice = Database["public"]["Tables"]["notices"]["Row"];
export type NoticeAttachment = Database["public"]["Tables"]["notice_attachments"]["Row"];
export type Report = Database["public"]["Tables"]["reports"]["Row"];
export type ReportReaction = Database["public"]["Tables"]["report_reactions"]["Row"];
export type Player = Database["public"]["Tables"]["players"]["Row"];
export type PlayerGuardian = Database["public"]["Tables"]["player_guardians"]["Row"];
export type PlayerNote = Database["public"]["Tables"]["player_notes"]["Row"];
export type PlayerNoteReaction = Database["public"]["Tables"]["player_note_reactions"]["Row"];
export type NoticeReaction = Database["public"]["Tables"]["notice_reactions"]["Row"];
export type GameMatch = Database["public"]["Tables"]["game_matches"]["Row"];
export type GameRecord = Database["public"]["Tables"]["game_records"]["Row"];
export type PracticeMenu = Database["public"]["Tables"]["practice_menus"]["Row"];
export type SportsTestRecord = Database["public"]["Tables"]["sports_test_records"]["Row"];
export type PlayerGrowthRecord = Database["public"]["Tables"]["player_growth_records"]["Row"];
export type GamePlayerStatLine = Database["public"]["Tables"]["game_player_stat_lines"]["Row"];
export type GameStatEvent = Database["public"]["Tables"]["game_stat_events"]["Row"];
export type GameOpponentPlayer = Database["public"]["Tables"]["game_opponent_players"]["Row"];
export type GameOpponentRecord = Database["public"]["Tables"]["game_opponent_records"]["Row"];
export type GameOpponentStatLine = Database["public"]["Tables"]["game_opponent_stat_lines"]["Row"];
export type GameOpponentStatEvent = Database["public"]["Tables"]["game_opponent_stat_events"]["Row"];
export type TeamMember = Database["public"]["Functions"]["list_team_members"]["Returns"][number];
export type RosterPlayer = Database["public"]["Functions"]["list_roster_players"]["Returns"][number];
