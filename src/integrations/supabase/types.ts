export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor_email: string
          created_at: string
          details: Json
          entity: string
          entity_id: string | null
          entity_label: string
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          actor_email?: string
          created_at?: string
          details?: Json
          entity: string
          entity_id?: string | null
          entity_label?: string
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          actor_email?: string
          created_at?: string
          details?: Json
          entity?: string
          entity_id?: string | null
          entity_label?: string
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      device_locks: {
        Row: {
          candidate_name: string
          created_at: string
          device_id: string
          employee_id: string
          last_used_at: string
          updated_at: string
        }
        Insert: {
          candidate_name?: string
          created_at?: string
          device_id: string
          employee_id: string
          last_used_at?: string
          updated_at?: string
        }
        Update: {
          candidate_name?: string
          created_at?: string
          device_id?: string
          employee_id?: string
          last_used_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      device_visits: {
        Row: {
          browser: string
          browser_version: string
          created_at: string
          device_type: string
          id: string
          ip: string
          ip_source: string
          is_pwa: boolean
          is_touch: boolean
          language: string
          os: string
          os_version: string
          path: string
          pixel_ratio: number
          referrer_host: string
          screen_h: number
          screen_w: number
          timezone: string
          viewport_h: number
          viewport_w: number
          visitor_key: string
        }
        Insert: {
          browser?: string
          browser_version?: string
          created_at?: string
          device_type?: string
          id?: string
          ip?: string
          ip_source?: string
          is_pwa?: boolean
          is_touch?: boolean
          language?: string
          os?: string
          os_version?: string
          path?: string
          pixel_ratio?: number
          referrer_host?: string
          screen_h?: number
          screen_w?: number
          timezone?: string
          viewport_h?: number
          viewport_w?: number
          visitor_key?: string
        }
        Update: {
          browser?: string
          browser_version?: string
          created_at?: string
          device_type?: string
          id?: string
          ip?: string
          ip_source?: string
          is_pwa?: boolean
          is_touch?: boolean
          language?: string
          os?: string
          os_version?: string
          path?: string
          pixel_ratio?: number
          referrer_host?: string
          screen_h?: number
          screen_w?: number
          timezone?: string
          viewport_h?: number
          viewport_w?: number
          visitor_key?: string
        }
        Relationships: []
      }
      employee_login_attempts: {
        Row: {
          created_at: string
          id: string
          name_key: string
          success: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          name_key: string
          success?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          name_key?: string
          success?: boolean
        }
        Relationships: []
      }
      employees: {
        Row: {
          birth_date: string | null
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          name_key: string
          phone: string | null
          phone_last4: string | null
          position: string | null
          unit_name: string | null
          updated_at: string
        }
        Insert: {
          birth_date?: string | null
          created_at?: string
          full_name: string
          id?: string
          is_active?: boolean
          name_key: string
          phone?: string | null
          phone_last4?: string | null
          position?: string | null
          unit_name?: string | null
          updated_at?: string
        }
        Update: {
          birth_date?: string | null
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          name_key?: string
          phone?: string | null
          phone_last4?: string | null
          position?: string | null
          unit_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      exam_events: {
        Row: {
          created_at: string
          detail: Json
          id: string
          kind: string
          session_id: string | null
          weight: number
        }
        Insert: {
          created_at?: string
          detail?: Json
          id?: string
          kind: string
          session_id?: string | null
          weight?: number
        }
        Update: {
          created_at?: string
          detail?: Json
          id?: string
          kind?: string
          session_id?: string | null
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "exam_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "exam_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_sessions: {
        Row: {
          answers: Json
          answers_seq: number
          best_streak: number
          birth_year: string
          candidate_name: string
          employee_id: string | null
          expires_at: string
          helpers: Json
          id: string
          integrity_score: number
          option_orders: Json
          points: number
          question_ids: string[]
          quiz_id: string
          started_at: string
          status: string
          submit_token: string
          submitted_at: string | null
          unit: string
        }
        Insert: {
          answers?: Json
          answers_seq?: number
          best_streak?: number
          birth_year?: string
          candidate_name: string
          employee_id?: string | null
          expires_at: string
          helpers?: Json
          id?: string
          integrity_score?: number
          option_orders?: Json
          points?: number
          question_ids: string[]
          quiz_id: string
          started_at?: string
          status?: string
          submit_token?: string
          submitted_at?: string | null
          unit?: string
        }
        Update: {
          answers?: Json
          answers_seq?: number
          best_streak?: number
          birth_year?: string
          candidate_name?: string
          employee_id?: string | null
          expires_at?: string
          helpers?: Json
          id?: string
          integrity_score?: number
          option_orders?: Json
          points?: number
          question_ids?: string[]
          quiz_id?: string
          started_at?: string
          status?: string
          submit_token?: string
          submitted_at?: string | null
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_sessions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_sessions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      player_profiles: {
        Row: {
          avatar_image: string
          avatar_url: string
          best_streak: number
          created_at: string
          display_name: string
          employee_id: string
          exams_passed: number
          exams_taken: number
          level: number
          title: string
          unit: string
          updated_at: string
          xp: number
        }
        Insert: {
          avatar_image?: string
          avatar_url?: string
          best_streak?: number
          created_at?: string
          display_name?: string
          employee_id: string
          exams_passed?: number
          exams_taken?: number
          level?: number
          title?: string
          unit?: string
          updated_at?: string
          xp?: number
        }
        Update: {
          avatar_image?: string
          avatar_url?: string
          best_streak?: number
          created_at?: string
          display_name?: string
          employee_id?: string
          exams_passed?: number
          exams_taken?: number
          level?: number
          title?: string
          unit?: string
          updated_at?: string
          xp?: number
        }
        Relationships: []
      }
      questions: {
        Row: {
          accepted_answers: string[]
          correct_index: number
          correct_indices: number[]
          correct_order: number[]
          created_at: string
          difficulty: Database["public"]["Enums"]["question_difficulty"]
          explanation: string
          id: string
          image_url: string | null
          is_archived: boolean
          kind: Database["public"]["Enums"]["question_kind"]
          option_images: string[]
          options: string[]
          order_index: number
          pairs: Json
          points: number
          question: string
          quiz_id: string
          tags: string[]
          time_limit_seconds: number | null
          updated_at: string
        }
        Insert: {
          accepted_answers?: string[]
          correct_index?: number
          correct_indices?: number[]
          correct_order?: number[]
          created_at?: string
          difficulty?: Database["public"]["Enums"]["question_difficulty"]
          explanation?: string
          id?: string
          image_url?: string | null
          is_archived?: boolean
          kind?: Database["public"]["Enums"]["question_kind"]
          option_images?: string[]
          options: string[]
          order_index?: number
          pairs?: Json
          points?: number
          question: string
          quiz_id: string
          tags?: string[]
          time_limit_seconds?: number | null
          updated_at?: string
        }
        Update: {
          accepted_answers?: string[]
          correct_index?: number
          correct_indices?: number[]
          correct_order?: number[]
          created_at?: string
          difficulty?: Database["public"]["Enums"]["question_difficulty"]
          explanation?: string
          id?: string
          image_url?: string | null
          is_archived?: boolean
          kind?: Database["public"]["Enums"]["question_kind"]
          option_images?: string[]
          options?: string[]
          order_index?: number
          pairs?: Json
          points?: number
          question?: string
          quiz_id?: string
          tags?: string[]
          time_limit_seconds?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_assets: {
        Row: {
          created_at: string
          created_by: string | null
          height: number
          id: string
          kind: string
          size_bytes: number
          storage_path: string
          tags: string[]
          title: string
          updated_at: string
          width: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          height?: number
          id?: string
          kind?: string
          size_bytes?: number
          storage_path: string
          tags?: string[]
          title?: string
          updated_at?: string
          width?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          height?: number
          id?: string
          kind?: string
          size_bytes?: number
          storage_path?: string
          tags?: string[]
          title?: string
          updated_at?: string
          width?: number
        }
        Relationships: []
      }
      quiz_audiences: {
        Row: {
          created_at: string
          id: string
          quiz_id: string
          unit_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          quiz_id: string
          unit_id: string
        }
        Update: {
          created_at?: string
          id?: string
          quiz_id?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_audiences_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_audiences_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          allow_fifty_fifty: boolean
          allow_skip: boolean
          blueprint: Json
          cover_fit: string
          cover_url: string
          created_at: string
          description: string
          disqualify_threshold: number
          double_points_after: number
          duration_minutes: number
          end_time: string | null
          id: string
          instant_feedback: boolean
          intro_markdown: string
          is_active: boolean
          legacy_id: string | null
          max_attempts: number | null
          negative_marking: number
          pass_percent: number
          peek_rewards: string[]
          question_count: number
          room_password: string | null
          show_question_map: boolean
          shuffle_options: boolean
          shuffle_questions: boolean
          start_time: string | null
          status: string
          streak_bonus: boolean
          streak_max_bonus: number
          streak_step: number
          strict_mode: boolean
          title: string
          updated_at: string
        }
        Insert: {
          allow_fifty_fifty?: boolean
          allow_skip?: boolean
          blueprint?: Json
          cover_fit?: string
          cover_url?: string
          created_at?: string
          description?: string
          disqualify_threshold?: number
          double_points_after?: number
          duration_minutes?: number
          end_time?: string | null
          id?: string
          instant_feedback?: boolean
          intro_markdown?: string
          is_active?: boolean
          legacy_id?: string | null
          max_attempts?: number | null
          negative_marking?: number
          pass_percent?: number
          peek_rewards?: string[]
          question_count?: number
          room_password?: string | null
          show_question_map?: boolean
          shuffle_options?: boolean
          shuffle_questions?: boolean
          start_time?: string | null
          status?: string
          streak_bonus?: boolean
          streak_max_bonus?: number
          streak_step?: number
          strict_mode?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          allow_fifty_fifty?: boolean
          allow_skip?: boolean
          blueprint?: Json
          cover_fit?: string
          cover_url?: string
          created_at?: string
          description?: string
          disqualify_threshold?: number
          double_points_after?: number
          duration_minutes?: number
          end_time?: string | null
          id?: string
          instant_feedback?: boolean
          intro_markdown?: string
          is_active?: boolean
          legacy_id?: string | null
          max_attempts?: number | null
          negative_marking?: number
          pass_percent?: number
          peek_rewards?: string[]
          question_count?: number
          room_password?: string | null
          show_question_map?: boolean
          shuffle_options?: boolean
          shuffle_questions?: boolean
          start_time?: string | null
          status?: string
          streak_bonus?: boolean
          streak_max_bonus?: number
          streak_step?: number
          strict_mode?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      results: {
        Row: {
          best_streak: number
          birth_year: string
          breakdown: Json
          candidate_name: string
          disqualified: boolean
          disqualify_reason: string | null
          employee_id: string | null
          id: string
          integrity_score: number | null
          late_submit: boolean
          max_points: number
          passed: boolean
          points: number
          quiz_id: string | null
          quiz_title: string
          restored_at: string | null
          restored_by: string | null
          score: number
          session_id: string | null
          submitted_at: string
          time_seconds: number
          total: number
          unit: string
        }
        Insert: {
          best_streak?: number
          birth_year?: string
          breakdown?: Json
          candidate_name: string
          disqualified?: boolean
          disqualify_reason?: string | null
          employee_id?: string | null
          id?: string
          integrity_score?: number | null
          late_submit?: boolean
          max_points?: number
          passed?: boolean
          points?: number
          quiz_id?: string | null
          quiz_title?: string
          restored_at?: string | null
          restored_by?: string | null
          score?: number
          session_id?: string | null
          submitted_at?: string
          time_seconds?: number
          total?: number
          unit?: string
        }
        Update: {
          best_streak?: number
          birth_year?: string
          breakdown?: Json
          candidate_name?: string
          disqualified?: boolean
          disqualify_reason?: string | null
          employee_id?: string | null
          id?: string
          integrity_score?: number | null
          late_submit?: boolean
          max_points?: number
          passed?: boolean
          points?: number
          quiz_id?: string | null
          quiz_title?: string
          restored_at?: string | null
          restored_by?: string | null
          score?: number
          session_id?: string | null
          submitted_at?: string
          time_seconds?: number
          total?: number
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "results_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "results_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "results_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "exam_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      award_player_xp: {
        Args: {
          p_best_streak: number
          p_display_name: string
          p_employee_id: string
          p_gain: number
          p_passed: boolean
          p_unit: string
        }
        Returns: {
          gained: number
          level: number
          xp: number
        }[]
      }
      claim_exam_device: {
        Args: {
          p_candidate_name: string
          p_cooldown_minutes?: number
          p_device_id: string
          p_employee_id: string
        }
        Returns: {
          allowed: boolean
          holder_name: string
          wait_seconds: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      set_player_avatar: {
        Args: {
          p_avatar_image: string
          p_avatar_url: string
          p_employee_id: string
        }
        Returns: undefined
      }
      start_exam_session_tx: {
        Args: {
          p_birth_year: string
          p_candidate_name: string
          p_employee_id: string
          p_expires_at: string
          p_max_attempts: number
          p_option_orders: Json
          p_question_ids: string[]
          p_quiz_id: string
          p_unit: string
        }
        Returns: {
          attempts: number
          session_id: string
          submit_token: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user" | "staff" | "editor"
      question_difficulty: "easy" | "medium" | "hard"
      question_kind:
        | "single"
        | "true_false"
        | "multi"
        | "fill_blank"
        | "matching"
        | "ordering"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user", "staff", "editor"],
      question_difficulty: ["easy", "medium", "hard"],
      question_kind: [
        "single",
        "true_false",
        "multi",
        "fill_blank",
        "matching",
        "ordering",
      ],
    },
  },
} as const
