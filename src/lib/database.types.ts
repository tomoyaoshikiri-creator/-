// supabase/migrations/0001_init.sql のスキーマに対応する手書きの型定義
// (実プロジェクト作成後は `supabase gen types typescript` で自動生成した内容に置き換えてよい)

export type Role = "一般" | "運営" | "指導者" | "管理者";
export type UserStatus = "アクティブ" | "休止";
export type ScheduleType = "practice" | "game" | "event";
// 種別が"game"の予定にのみ意味を持つ区分。試合記録・試合結果一覧の絞り込みにも使う。
export type GameCategory = "練習試合" | "公式戦";
// 種別が"game"の予定にのみ意味を持つ。アウェイは車出し、ホームは会場設営のヒアリングになる。
export type VenueType = "ホーム" | "アウェイ";
export type NoticeAudience = "全員" | "指導者のみ" | "運営以上" | "学年指定";
// "Max"は都賀ビクトリーズ専用の非公開プラン(スポーツテスト機能を含む)。
// 一般には販売しないため、Stripeのプラン申し込み導線には出さない。
export type TeamPlan = "お試し" | "中間" | "フル" | "フルプラス" | "Max";
// チーム作成時に選ぶ競技。バスケットボール・ミニバスケットボールは同じ詳細スタッツ機能
// (クォーター制StatPad)を使うが、3ポイントの有無だけが異なる(src/lib/sport.ts参照)。
// それ以外の競技はチームが自由に定義するカスタムスタッツ項目を使う。
export type TeamSport =
  | "バスケットボール"
  | "ミニバスケットボール"
  | "サッカー"
  | "フットサル"
  | "野球"
  | "ハンドボール"
  | "ラグビー"
  | "バレーボール";
// 出欠登録リマインドの種類。baseline_2daysは全種別共通(予定日2日前)、
// deadline_day/week_beforeは試合・イベントでattendance_deadlineを設定した場合のみ発火する。
export type ReminderType = "baseline_2days" | "deadline_day" | "week_before";
// 練習は4択(出席・欠席・遅刻早退・見学)、試合は画面上は出席・欠席の2択のみ(UI側で制御)。
export type AttendanceStatus = "出席" | "欠席" | "遅刻早退" | "見学";
export type YesNo = "あり" | "なし";
export type CarStatus = "可" | "不可";
export type PlayerStatus = "在籍" | "休部" | "退団" | "OB・OG";
// 選手登録時に選べる学年(在籍中の選手のみ)。OB・OGは年度更新のたびに
// 卒団からの経過年数として6より先の値(文字列)まで内部的に伸びていく。
export type Grade = "0" | "1" | "2" | "3" | "4" | "5" | "6";
export type Position =
  | "PG" | "SG" | "SF" | "PF" | "C"                          // バスケットボール・ミニバスケットボール共通
  | "GK" | "DF" | "MF" | "FW"                                  // サッカー・フットサル共通
  | "投" | "捕" | "一" | "二" | "三" | "遊" | "左" | "中" | "右"  // 野球(投手/捕手/一塁/二塁/三塁/遊撃/左翼/中堅/右翼)
  | "S" | "OH" | "MB" | "OP" | "L"                             // バレーボール(セッター/アウトサイドヒッター/ミドルブロッカー/オポジット/リベロ)
  | "LB" | "CB" | "RB" | "LW" | "RW" | "PV"                    // ハンドボール(GKは共通、左右バック/センターバック/左右サイド/ピボット)
  | "PR" | "HO" | "LO" | "FL" | "N8" | "SH" | "SO" | "CTB" | "WTB" | "FB"; // ラグビー(プロップ/フッカー/ロック/フランカー/No8/SH/SO/センター/ウイング/フルバック)
export type AttachmentKind = "対戦表" | "配車表" | "その他";
export type ReactionType = "thumbs_up" | "ok_gesture" | "bow" | "pray";
export type StatEvent =
  | "fg_make"
  | "fg_miss"
  | "three_make"
  | "three_miss"
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
          plan: TeamPlan;
          sport: TeamSport;
          storage_limit_bytes: number;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          // StripeのSubscription.statusをそのまま保持する
          // (active/trialing/past_due/canceled/unpaid/incomplete/incomplete_expired等)。
          subscription_status: string | null;
          // 退会申請日時(nullなら通常運用中)。設定後7日間は取り消し可能で、
          // 経過後は日次バッチが完全削除する。書き込みはservice_role経由のみ。
          deletion_requested_at: string | null;
          deletion_requested_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug?: string;
          theme_primary?: string | null;
          theme_accent?: string | null;
          logo_path?: string | null;
          plan?: TeamPlan;
          sport?: TeamSport;
          storage_limit_bytes?: number;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          subscription_status?: string | null;
          deletion_requested_at?: string | null;
          deletion_requested_by?: string | null;
          created_at?: string;
        };
        Update: Partial<{
          name: string;
          theme_primary: string | null;
          theme_accent: string | null;
          logo_path: string | null;
          plan: TeamPlan;
          sport: TeamSport;
          storage_limit_bytes: number;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          subscription_status: string | null;
          deletion_requested_at: string | null;
          deletion_requested_by: string | null;
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
          // type="game"の予定にのみ意味を持つ(ホーム/アウェイ)。それ以外はnull。
          venue_type: VenueType | null;
          // 練習・イベントの予定で、任意で車出し(乗り合わせ)のヒアリングを集約するかどうか。
          // 試合はvenue_typeでヒアリング内容が決まるため、この列は無視する。
          collect_car_info: boolean;
          // 試合・イベントのみ任意で設定できる出欠登録の期限日。未設定でも予定日2日前の
          // 共通リマインドでカバーされる(src/app/api/cron/attendance-reminders/route.ts参照)。
          attendance_deadline: string | null;
          // 出欠登録リマインドをこの予定で送るかどうか(既定true、全種別対象)。
          send_attendance_reminders: boolean;
          // 4月始まりの自動判定を上書きする年度(nullなら自動判定)。type="game"の予定にのみ意味を持つ。
          fiscal_year_override: number | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
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
          venue_type?: VenueType | null;
          collect_car_info?: boolean;
          attendance_deadline?: string | null;
          send_attendance_reminders?: boolean;
          fiscal_year_override?: number | null;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["schedules"]["Insert"] & { updated_at: string }>;
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
          setup_available: YesNo | null;
          setup_count: number | null;
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
          setup_available?: YesNo | null;
          setup_count?: number | null;
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
          size_bytes: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          notice_id: string;
          kind: AttachmentKind;
          storage_path: string;
          file_name: string;
          size_bytes?: number;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      daily_report_attachments: {
        Row: {
          id: string;
          daily_report_id: string;
          storage_path: string;
          file_name: string;
          size_bytes: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          daily_report_id: string;
          storage_path: string;
          file_name: string;
          size_bytes?: number;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      report_attachments: {
        Row: {
          id: string;
          report_id: string;
          storage_path: string;
          file_name: string;
          size_bytes: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          report_id: string;
          storage_path: string;
          file_name: string;
          size_bytes?: number;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      library_categories: {
        Row: {
          id: string;
          team_id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          name: string;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      library_items: {
        Row: {
          id: string;
          team_id: string;
          uploader_id: string | null;
          category_id: string | null;
          title: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          uploader_id?: string | null;
          category_id?: string | null;
          title: string;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      library_files: {
        Row: {
          id: string;
          library_item_id: string;
          storage_path: string;
          file_name: string;
          size_bytes: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          library_item_id: string;
          storage_path: string;
          file_name: string;
          size_bytes?: number;
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
          updated_at: string;
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
          updated_at: string;
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
      report_comments: {
        Row: {
          id: string;
          team_id: string;
          report_id: string;
          profile_id: string;
          body: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          report_id: string;
          profile_id: string;
          body: string;
        };
        Update: Partial<{
          body: string;
          updated_at: string;
        }>;
        Relationships: [];
      };
      daily_reports: {
        Row: {
          id: string;
          team_id: string;
          author_id: string | null;
          date: string;
          body: string;
          created_at: string;
          updated_at: string;
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
          updated_at: string;
        }>;
        Relationships: [];
      };
      daily_report_reactions: {
        Row: {
          id: string;
          team_id: string;
          daily_report_id: string;
          profile_id: string;
          reaction_type: ReactionType;
          created_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          daily_report_id: string;
          profile_id: string;
          reaction_type: ReactionType;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      daily_report_comments: {
        Row: {
          id: string;
          team_id: string;
          daily_report_id: string;
          profile_id: string;
          body: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          daily_report_id: string;
          profile_id: string;
          body: string;
        };
        Update: Partial<{
          body: string;
          updated_at: string;
        }>;
        Relationships: [];
      };
      report_comment_reactions: {
        Row: {
          id: string;
          team_id: string;
          comment_id: string;
          profile_id: string;
          reaction_type: ReactionType;
          created_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          comment_id: string;
          profile_id: string;
          reaction_type: ReactionType;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      daily_report_comment_reactions: {
        Row: {
          id: string;
          team_id: string;
          comment_id: string;
          profile_id: string;
          reaction_type: ReactionType;
          created_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          comment_id: string;
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
          updated_at: string;
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
          updated_at: string;
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
          three_made: number;
          three_att: number;
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
          position: number;
        };
        Insert: {
          id?: string;
          team_id: string;
          schedule_id: string;
          theme?: string | null;
          content?: string | null;
          created_by?: string | null;
          position?: number;
        };
        Update: Partial<{
          theme: string | null;
          content: string | null;
          position: number;
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
          three_made: number;
          three_att: number;
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
      team_stat_categories: {
        Row: {
          id: string;
          team_id: string;
          name: string;
          position: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          name: string;
          position?: number;
        };
        Update: Partial<{
          name: string;
          position: number;
        }>;
        Relationships: [];
      };
      game_player_stat_entries: {
        Row: {
          id: string;
          team_id: string;
          match_id: string;
          player_id: string;
          category_id: string;
          value: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          match_id: string;
          player_id: string;
          category_id: string;
          value?: number;
        };
        Update: Partial<{
          value: number;
        }>;
        Relationships: [];
      };
      skill_tests: {
        Row: {
          id: string;
          team_id: string;
          name: string;
          kyu_count: number;
          dan_count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          name: string;
          kyu_count?: number;
          dan_count?: number;
        };
        Update: Partial<{
          name: string;
          kyu_count: number;
          dan_count: number;
        }>;
        Relationships: [];
      };
      player_skill_test_progress: {
        Row: {
          id: string;
          team_id: string;
          player_id: string;
          skill_test_id: string;
          level_index: number;
          level_label: string;
          achieved_on: string;
          recorded_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          player_id: string;
          skill_test_id: string;
          level_index: number;
          level_label?: string;
          achieved_on?: string;
          recorded_by?: string | null;
        };
        Update: Record<string, never>;
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
      team_analysis_notes: {
        Row: {
          id: string;
          team_id: string;
          author_id: string | null;
          body: string;
          source: "staff" | "ai";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          author_id?: string | null;
          body: string;
          source?: "staff" | "ai";
        };
        Update: Partial<{
          body: string;
          updated_at: string;
        }>;
        Relationships: [];
      };
      player_analysis_notes: {
        Row: {
          id: string;
          team_id: string;
          player_id: string;
          author_id: string | null;
          body: string;
          source: "staff" | "ai";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          player_id: string;
          author_id?: string | null;
          body: string;
          source?: "staff" | "ai";
        };
        Update: Partial<{
          body: string;
          updated_at: string;
        }>;
        Relationships: [];
      };
      team_analysis_note_reactions: {
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
      player_analysis_note_reactions: {
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
      tab_last_seen: {
        Row: {
          user_id: string;
          tab: string;
          seen_at: string;
        };
        Insert: {
          user_id: string;
          tab: string;
          seen_at?: string;
        };
        Update: Partial<{
          seen_at: string;
        }>;
        Relationships: [];
      };
      item_last_seen: {
        Row: {
          user_id: string;
          item_type: string;
          item_id: string;
          seen_at: string;
        };
        Insert: {
          user_id: string;
          item_type: string;
          item_id: string;
          seen_at?: string;
        };
        Update: Partial<{
          seen_at: string;
        }>;
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          team_id: string;
          endpoint: string;
          p256dh: string;
          auth_key: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          team_id: string;
          endpoint: string;
          p256dh: string;
          auth_key: string;
          created_at?: string;
        };
        Update: Partial<{
          endpoint: string;
          p256dh: string;
          auth_key: string;
        }>;
        Relationships: [];
      };
      attendance_reminder_log: {
        Row: {
          id: string;
          schedule_id: string;
          reminder_type: ReminderType;
          sent_at: string;
        };
        Insert: {
          id?: string;
          schedule_id: string;
          reminder_type: ReminderType;
          sent_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      birthday_reminder_log: {
        Row: {
          id: string;
          player_id: string;
          notified_date: string;
          sent_at: string;
        };
        Insert: {
          id?: string;
          player_id: string;
          notified_date: string;
          sent_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_team_and_admin: {
        Args: { team_name: string; admin_name: string; team_sport?: TeamSport };
        Returns: string;
      };
      get_invite_info: {
        Args: { invite_token: string };
        Returns: { team_name: string; role: string; valid: boolean }[];
      };
      get_invite_players: {
        Args: { invite_token: string };
        Returns: { id: string; sei: string; mei: string; grade: string | null; number: string | null }[];
      };
      accept_invite: {
        Args: { invite_token: string; member_name: string; player_ids?: string[] };
        Returns: string;
      };
      advance_academic_year: {
        Args: Record<string, never>;
        Returns: void;
      };
      team_storage_usage_bytes: {
        Args: Record<string, never>;
        Returns: number;
      };
      team_stat_category_averages: {
        Args: { p_fiscal_year: number };
        Returns: {
          category_id: string;
          category_name: string;
          position: number;
          player_count: number;
          avg_value: number;
        }[];
      };
      team_game_stat_averages: {
        Args: { p_fiscal_year: number };
        Returns: {
          player_count: number;
          pts: number | null;
          fg_pct: number | null;
          ft_pct: number | null;
          ast: number | null;
          reb_off: number | null;
          reb_def: number | null;
          stl: number | null;
          blk: number | null;
          tov: number | null;
          eff: number | null;
          fg_made_total: number;
          fg_att_total: number;
          ft_made_total: number;
          ft_att_total: number;
          three_made_total: number;
          three_att_total: number;
        }[];
      };
      team_sports_test_averages: {
        Args: { p_fiscal_year: number; p_quarter: number };
        Returns: {
          record_count: number;
          wingspan_cm: number | null;
          sprint20m: number | null;
          lane_agility: number | null;
          side_step: number | null;
          shuttle_20m_x3: number | null;
          long_jump: number | null;
          ball_throw: number | null;
          back_fist_right: number | null;
          back_fist_left: number | null;
          ft_golf: number | null;
          beep_test_reps: number | null;
        }[];
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
          number: string | null;
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
            three_made: number;
            three_att: number;
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
            three_made: number;
            three_att: number;
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
export type ReportComment = Database["public"]["Tables"]["report_comments"]["Row"];
export type DailyReport = Database["public"]["Tables"]["daily_reports"]["Row"];
export type DailyReportReaction = Database["public"]["Tables"]["daily_report_reactions"]["Row"];
export type DailyReportComment = Database["public"]["Tables"]["daily_report_comments"]["Row"];
export type ReportCommentReaction = Database["public"]["Tables"]["report_comment_reactions"]["Row"];
export type DailyReportCommentReaction = Database["public"]["Tables"]["daily_report_comment_reactions"]["Row"];
export type DailyReportAttachment = Database["public"]["Tables"]["daily_report_attachments"]["Row"];
export type ReportAttachment = Database["public"]["Tables"]["report_attachments"]["Row"];
export type LibraryCategory = Database["public"]["Tables"]["library_categories"]["Row"];
export type LibraryItem = Database["public"]["Tables"]["library_items"]["Row"];
export type LibraryFile = Database["public"]["Tables"]["library_files"]["Row"];
export type Player = Database["public"]["Tables"]["players"]["Row"];
export type PlayerGuardian = Database["public"]["Tables"]["player_guardians"]["Row"];
export type PlayerNote = Database["public"]["Tables"]["player_notes"]["Row"];
export type PlayerNoteReaction = Database["public"]["Tables"]["player_note_reactions"]["Row"];
export type TeamAnalysisNote = Database["public"]["Tables"]["team_analysis_notes"]["Row"];
export type PlayerAnalysisNote = Database["public"]["Tables"]["player_analysis_notes"]["Row"];
export type TeamAnalysisNoteReaction = Database["public"]["Tables"]["team_analysis_note_reactions"]["Row"];
export type PlayerAnalysisNoteReaction = Database["public"]["Tables"]["player_analysis_note_reactions"]["Row"];
export type NoticeReaction = Database["public"]["Tables"]["notice_reactions"]["Row"];
export type TabLastSeen = Database["public"]["Tables"]["tab_last_seen"]["Row"];
export type SkillTest = Database["public"]["Tables"]["skill_tests"]["Row"];
export type PlayerSkillTestProgress = Database["public"]["Tables"]["player_skill_test_progress"]["Row"];
export type ItemLastSeen = Database["public"]["Tables"]["item_last_seen"]["Row"];
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
export type TeamStatCategory = Database["public"]["Tables"]["team_stat_categories"]["Row"];
export type GamePlayerStatEntry = Database["public"]["Tables"]["game_player_stat_entries"]["Row"];
export type TeamMember = Database["public"]["Functions"]["list_team_members"]["Returns"][number];
export type RosterPlayer = Database["public"]["Functions"]["list_roster_players"]["Returns"][number];
