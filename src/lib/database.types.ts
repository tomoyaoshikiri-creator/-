// supabase/migrations/0001_init.sql のスキーマに対応する手書きの型定義
// (実プロジェクト作成後は `supabase gen types typescript` で自動生成した内容に置き換えてよい)

export type Role = "一般" | "役員" | "指導者" | "管理者";
export type UserStatus = "アクティブ" | "休止";
export type ScheduleType = "practice" | "game" | "event";
// 種別が"game"の予定にのみ意味を持つ区分。試合記録・試合結果一覧の絞り込みにも使う。
export type GameCategory = "練習試合" | "公式戦";
export type NoticeAudience = "全員" | "指導者のみ" | "役員以上" | "学年指定";
export type AttendanceStatus = "出席" | "欠席";
export type YesNo = "あり" | "なし";
export type CarStatus = "可" | "不可";
export type PlayerStatus = "在籍" | "休部" | "退団" | "OB・OG";
// 選手登録時に選べる学年(在籍中の選手のみ)。OB・OGは年度更新のたびに
// 卒団からの経過年数として6より先の値(文字列)まで内部的に伸びていく。
export type Grade = "0" | "1" | "2" | "3" | "4" | "5" | "6";
export type Position = "PG" | "SG" | "SF" | "PF" | "C";
export type AttachmentKind = "対戦表" | "配車表" | "その他";

export interface Database {
  public: {
    Tables: {
      teams: {
        Row: {
          id: string;
          name: string;
          theme_primary: string | null;
          theme_accent: string | null;
          logo_path: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
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
export type Player = Database["public"]["Tables"]["players"]["Row"];
export type PlayerGuardian = Database["public"]["Tables"]["player_guardians"]["Row"];
export type PlayerNote = Database["public"]["Tables"]["player_notes"]["Row"];
export type GameMatch = Database["public"]["Tables"]["game_matches"]["Row"];
export type GameRecord = Database["public"]["Tables"]["game_records"]["Row"];
export type TeamMember = Database["public"]["Functions"]["list_team_members"]["Returns"][number];
export type RosterPlayer = Database["public"]["Functions"]["list_roster_players"]["Returns"][number];
