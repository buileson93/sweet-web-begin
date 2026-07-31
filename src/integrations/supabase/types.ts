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
      exam_sessions: {
        Row: {
          answers: Json
          best_streak: number
          birth_year: string
          candidate_name: string
          employee_id: string | null
          expires_at: string
          helpers: Json
          id: string
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
          best_streak?: number
          birth_year?: string
          candidate_name: string
          employee_id?: string | null
          expires_at: string
          helpers?: Json
          id?: string
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
          best_streak?: number
          birth_year?: string
          candidate_name?: string
          employee_id?: string | null
          expires_at?: string
          helpers?: Json
          id?: string
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
          options: string[]
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
          options: string[]
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
          options?: string[]
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
      quizzes: {
        Row: {
          allow_fifty_fifty: boolean
          allow_skip: boolean
          blueprint: Json
          created_at: string
          description: string
          duration_minutes: number
          end_time: string | null
          id: string
          instant_feedback: boolean
          is_active: boolean
          legacy_id: string | null
          max_attempts: number | null
          negative_marking: number
          pass_score: number
          question_count: number
          room_password: string | null
          show_question_map: boolean
          shuffle_options: boolean
          shuffle_questions: boolean
          start_time: string | null
          streak_bonus: boolean
          title: string
          updated_at: string
        }
        Insert: {
          allow_fifty_fifty?: boolean
          allow_skip?: boolean
          blueprint?: Json
          created_at?: string
          description?: string
          duration_minutes?: number
          end_time?: string | null
          id?: string
          instant_feedback?: boolean
          is_active?: boolean
          legacy_id?: string | null
          max_attempts?: number | null
          negative_marking?: number
          pass_score?: number
          question_count?: number
          room_password?: string | null
          show_question_map?: boolean
          shuffle_options?: boolean
          shuffle_questions?: boolean
          start_time?: string | null
          streak_bonus?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          allow_fifty_fifty?: boolean
          allow_skip?: boolean
          blueprint?: Json
          created_at?: string
          description?: string
          duration_minutes?: number
          end_time?: string | null
          id?: string
          instant_feedback?: boolean
          is_active?: boolean
          legacy_id?: string | null
          max_attempts?: number | null
          negative_marking?: number
          pass_score?: number
          question_count?: number
          room_password?: string | null
          show_question_map?: boolean
          shuffle_options?: boolean
          shuffle_questions?: boolean
          start_time?: string | null
          streak_bonus?: boolean
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
          max_points: number
          passed: boolean
          points: number
          quiz_id: string | null
          quiz_title: string
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
          max_points?: number
          passed?: boolean
          points?: number
          quiz_id?: string | null
          quiz_title?: string
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
          max_points?: number
          passed?: boolean
          points?: number
          quiz_id?: string | null
          quiz_title?: string
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
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
