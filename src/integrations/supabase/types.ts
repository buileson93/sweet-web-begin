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
      arena_settings: {
        Row: {
          default_rounds: number
          default_seconds: number
          enabled: boolean
          id: boolean
          tower_enabled: boolean
          tower_locked_until: string | null
          updated_at: string
        }
        Insert: {
          default_rounds?: number
          default_seconds?: number
          enabled?: boolean
          id?: boolean
          tower_enabled?: boolean
          tower_locked_until?: string | null
          updated_at?: string
        }
        Update: {
          default_rounds?: number
          default_seconds?: number
          enabled?: boolean
          id?: boolean
          tower_enabled?: boolean
          tower_locked_until?: string | null
          updated_at?: string
        }
        Relationships: []
      }
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
      badges: {
        Row: {
          code: string
          description: string
          icon: string
          name: string
          sort_order: number
        }
        Insert: {
          code: string
          description?: string
          icon?: string
          name: string
          sort_order?: number
        }
        Update: {
          code?: string
          description?: string
          icon?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      bug_reports: {
        Row: {
          admin_note: string
          contact: string
          created_at: string
          description: string
          device: Json
          employee_id: string | null
          employee_unit: string
          id: string
          ip: string
          ip_source: string
          kind: string
          path: string
          reporter_name: string
          resolved_at: string | null
          shot_path: string
          status: string
          title: string
          user_agent: string
        }
        Insert: {
          admin_note?: string
          contact?: string
          created_at?: string
          description?: string
          device?: Json
          employee_id?: string | null
          employee_unit?: string
          id?: string
          ip?: string
          ip_source?: string
          kind?: string
          path?: string
          reporter_name?: string
          resolved_at?: string | null
          shot_path?: string
          status?: string
          title?: string
          user_agent?: string
        }
        Update: {
          admin_note?: string
          contact?: string
          created_at?: string
          description?: string
          device?: Json
          employee_id?: string | null
          employee_unit?: string
          id?: string
          ip?: string
          ip_source?: string
          kind?: string
          path?: string
          reporter_name?: string
          resolved_at?: string | null
          shot_path?: string
          status?: string
          title?: string
          user_agent?: string
        }
        Relationships: [
          {
            foreignKeyName: "bug_reports_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_quiz_stats: {
        Row: {
          attempt_count: number | null
          candidate_name: string | null
          employee_id: string
          last_updated_at: string | null
          quiz_id: string
          submitted_count: number | null
          unit: string | null
        }
        Insert: {
          attempt_count?: number | null
          candidate_name?: string | null
          employee_id: string
          last_updated_at?: string | null
          quiz_id: string
          submitted_count?: number | null
          unit?: string | null
        }
        Update: {
          attempt_count?: number | null
          candidate_name?: string | null
          employee_id?: string
          last_updated_at?: string | null
          quiz_id?: string
          submitted_count?: number | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_quiz_stats_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      carousel_events: {
        Row: {
          card_labels: string[]
          clicked: boolean
          clicked_index: number
          clicked_label: string
          created_at: string
          device_type: string
          dwell_ms: number
          employee_id: string | null
          employee_name: string
          employee_unit: string
          id: string
          label: string
          max_index: number
          path: string
          swipes: number
          total_cards: number
          viewed_cards: number
          visitor_key: string
        }
        Insert: {
          card_labels?: string[]
          clicked?: boolean
          clicked_index?: number
          clicked_label?: string
          created_at?: string
          device_type?: string
          dwell_ms?: number
          employee_id?: string | null
          employee_name?: string
          employee_unit?: string
          id?: string
          label?: string
          max_index?: number
          path?: string
          swipes?: number
          total_cards?: number
          viewed_cards?: number
          visitor_key?: string
        }
        Update: {
          card_labels?: string[]
          clicked?: boolean
          clicked_index?: number
          clicked_label?: string
          created_at?: string
          device_type?: string
          dwell_ms?: number
          employee_id?: string | null
          employee_name?: string
          employee_unit?: string
          id?: string
          label?: string
          max_index?: number
          path?: string
          swipes?: number
          total_cards?: number
          viewed_cards?: number
          visitor_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "carousel_events_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
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
          architecture: string
          browser: string
          browser_version: string
          cpu_cores: number
          created_at: string
          device_model: string
          device_type: string
          downlink: number
          employee_id: string | null
          employee_name: string
          employee_unit: string
          id: string
          ip: string
          ip_source: string
          is_pwa: boolean
          is_touch: boolean
          language: string
          memory_gb: number
          network_type: string
          os: string
          os_version: string
          path: string
          pixel_ratio: number
          platform_version: string
          referrer_host: string
          save_data: boolean
          screen_h: number
          screen_w: number
          timezone: string
          user_agent: string
          viewport_h: number
          viewport_w: number
          visitor_key: string
        }
        Insert: {
          architecture?: string
          browser?: string
          browser_version?: string
          cpu_cores?: number
          created_at?: string
          device_model?: string
          device_type?: string
          downlink?: number
          employee_id?: string | null
          employee_name?: string
          employee_unit?: string
          id?: string
          ip?: string
          ip_source?: string
          is_pwa?: boolean
          is_touch?: boolean
          language?: string
          memory_gb?: number
          network_type?: string
          os?: string
          os_version?: string
          path?: string
          pixel_ratio?: number
          platform_version?: string
          referrer_host?: string
          save_data?: boolean
          screen_h?: number
          screen_w?: number
          timezone?: string
          user_agent?: string
          viewport_h?: number
          viewport_w?: number
          visitor_key?: string
        }
        Update: {
          architecture?: string
          browser?: string
          browser_version?: string
          cpu_cores?: number
          created_at?: string
          device_model?: string
          device_type?: string
          downlink?: number
          employee_id?: string | null
          employee_name?: string
          employee_unit?: string
          id?: string
          ip?: string
          ip_source?: string
          is_pwa?: boolean
          is_touch?: boolean
          language?: string
          memory_gb?: number
          network_type?: string
          os?: string
          os_version?: string
          path?: string
          pixel_ratio?: number
          platform_version?: string
          referrer_host?: string
          save_data?: boolean
          screen_h?: number
          screen_w?: number
          timezone?: string
          user_agent?: string
          viewport_h?: number
          viewport_w?: number
          visitor_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_visits_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      duel_answers: {
        Row: {
          created_at: string
          damage: number
          duel_id: string
          employee_id: string
          first_correct: boolean
          id: string
          is_correct: boolean
          ms_taken: number
          points: number
          round_index: number
          skill: string
          value: Json | null
        }
        Insert: {
          created_at?: string
          damage?: number
          duel_id: string
          employee_id: string
          first_correct?: boolean
          id?: string
          is_correct?: boolean
          ms_taken?: number
          points?: number
          round_index: number
          skill?: string
          value?: Json | null
        }
        Update: {
          created_at?: string
          damage?: number
          duel_id?: string
          employee_id?: string
          first_correct?: boolean
          id?: string
          is_correct?: boolean
          ms_taken?: number
          points?: number
          round_index?: number
          skill?: string
          value?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "duel_answers_duel_id_fkey"
            columns: ["duel_id"]
            isOneToOne: false
            referencedRelation: "duels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duel_answers_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      duel_invites: {
        Row: {
          created_at: string
          duel_id: string
          expires_at: string
          from_employee_id: string
          from_name: string
          id: string
          status: string
          to_employee_id: string
        }
        Insert: {
          created_at?: string
          duel_id: string
          expires_at?: string
          from_employee_id: string
          from_name?: string
          id?: string
          status?: string
          to_employee_id: string
        }
        Update: {
          created_at?: string
          duel_id?: string
          expires_at?: string
          from_employee_id?: string
          from_name?: string
          id?: string
          status?: string
          to_employee_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "duel_invites_duel_id_fkey"
            columns: ["duel_id"]
            isOneToOne: false
            referencedRelation: "duels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duel_invites_from_employee_id_fkey"
            columns: ["from_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duel_invites_to_employee_id_fkey"
            columns: ["to_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      duel_players: {
        Row: {
          biggest_hit: number
          class_id: string
          correct: number
          damage_dealt: number
          device_hash: string
          display_name: string
          duel_id: string
          duel_status: string
          elo_after: number | null
          elo_before: number
          employee_id: string
          hp: number
          id: string
          joined_at: string
          left_at: string | null
          lowest_hp: number
          misses: number
          ready: boolean
          score: number
          seat: number
          total_ms: number
          unit: string
          used_fifty_fifty: boolean
        }
        Insert: {
          biggest_hit?: number
          class_id?: string
          correct?: number
          damage_dealt?: number
          device_hash?: string
          display_name?: string
          duel_id: string
          duel_status?: string
          elo_after?: number | null
          elo_before?: number
          employee_id: string
          hp?: number
          id?: string
          joined_at?: string
          left_at?: string | null
          lowest_hp?: number
          misses?: number
          ready?: boolean
          score?: number
          seat?: number
          total_ms?: number
          unit?: string
          used_fifty_fifty?: boolean
        }
        Update: {
          biggest_hit?: number
          class_id?: string
          correct?: number
          damage_dealt?: number
          device_hash?: string
          display_name?: string
          duel_id?: string
          duel_status?: string
          elo_after?: number | null
          elo_before?: number
          employee_id?: string
          hp?: number
          id?: string
          joined_at?: string
          left_at?: string | null
          lowest_hp?: number
          misses?: number
          ready?: boolean
          score?: number
          seat?: number
          total_ms?: number
          unit?: string
          used_fifty_fifty?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "duel_players_duel_id_fkey"
            columns: ["duel_id"]
            isOneToOne: false
            referencedRelation: "duels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duel_players_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      duels: {
        Row: {
          created_at: string
          created_by: string | null
          current_round: number
          finished_at: string | null
          hp_start: number
          id: string
          is_bot: boolean
          is_ranked: boolean
          last_result: Json | null
          note: string
          option_orders: Json
          question_ids: string[]
          quiz_id: string | null
          round_count: number
          round_served_at: string | null
          seconds_per_round: number
          started_at: string | null
          status: string
          version: number
          winner_employee_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          current_round?: number
          finished_at?: string | null
          hp_start?: number
          id?: string
          is_bot?: boolean
          is_ranked?: boolean
          last_result?: Json | null
          note?: string
          option_orders?: Json
          question_ids?: string[]
          quiz_id?: string | null
          round_count?: number
          round_served_at?: string | null
          seconds_per_round?: number
          started_at?: string | null
          status?: string
          version?: number
          winner_employee_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          current_round?: number
          finished_at?: string | null
          hp_start?: number
          id?: string
          is_bot?: boolean
          is_ranked?: boolean
          last_result?: Json | null
          note?: string
          option_orders?: Json
          question_ids?: string[]
          quiz_id?: string | null
          round_count?: number
          round_served_at?: string | null
          seconds_per_round?: number
          started_at?: string | null
          status?: string
          version?: number
          winner_employee_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "duels_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
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
          device_info: Json
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
          device_info?: Json
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
          device_info?: Json
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
      learner_cards: {
        Row: {
          box: number
          employee_id: string
          lapses: number
          last_reviewed_at: string
          next_due_at: string
          question_id: string
          reps: number
        }
        Insert: {
          box?: number
          employee_id: string
          lapses?: number
          last_reviewed_at?: string
          next_due_at?: string
          question_id: string
          reps?: number
        }
        Update: {
          box?: number
          employee_id?: string
          lapses?: number
          last_reviewed_at?: string
          next_due_at?: string
          question_id?: string
          reps?: number
        }
        Relationships: [
          {
            foreignKeyName: "learner_cards_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learner_cards_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      player_badges: {
        Row: {
          badge_code: string
          earned_at: string
          employee_id: string
          id: string
        }
        Insert: {
          badge_code: string
          earned_at?: string
          employee_id: string
          id?: string
        }
        Update: {
          badge_code?: string
          earned_at?: string
          employee_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_badges_badge_code_fkey"
            columns: ["badge_code"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "player_badges_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
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
      players: {
        Row: {
          abandons: number
          avatar: string
          best_streak: number
          blocked: boolean
          bot_wins: number
          coins: number
          created_at: string
          display_name: string
          draws: number
          elo: number
          employee_id: string
          games: number
          last_seen_at: string
          losses: number
          preferred_class: string
          quests: Json
          ranked_locked_until: string | null
          streak: number
          unit: string
          updated_at: string
          wins: number
        }
        Insert: {
          abandons?: number
          avatar?: string
          best_streak?: number
          blocked?: boolean
          bot_wins?: number
          coins?: number
          created_at?: string
          display_name?: string
          draws?: number
          elo?: number
          employee_id: string
          games?: number
          last_seen_at?: string
          losses?: number
          preferred_class?: string
          quests?: Json
          ranked_locked_until?: string | null
          streak?: number
          unit?: string
          updated_at?: string
          wins?: number
        }
        Update: {
          abandons?: number
          avatar?: string
          best_streak?: number
          blocked?: boolean
          bot_wins?: number
          coins?: number
          created_at?: string
          display_name?: string
          draws?: number
          elo?: number
          employee_id?: string
          games?: number
          last_seen_at?: string
          losses?: number
          preferred_class?: string
          quests?: Json
          ranked_locked_until?: string | null
          streak?: number
          unit?: string
          updated_at?: string
          wins?: number
        }
        Relationships: [
          {
            foreignKeyName: "players_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      question_stats: {
        Row: {
          attempts: number
          blank: number
          correct: number
          partial: number
          question_id: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          blank?: number
          correct?: number
          partial?: number
          question_id: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          blank?: number
          correct?: number
          partial?: number
          question_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_stats_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: true
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      question_versions: {
        Row: {
          created_at: string
          id: string
          question_id: string
          quiz_id: string | null
          snapshot: Json
          version: number
        }
        Insert: {
          created_at?: string
          id?: string
          question_id: string
          quiz_id?: string | null
          snapshot?: Json
          version?: number
        }
        Update: {
          created_at?: string
          id?: string
          question_id?: string
          quiz_id?: string | null
          snapshot?: Json
          version?: number
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
          image_alt: string
          image_url: string | null
          is_archived: boolean
          kind: Database["public"]["Enums"]["question_kind"]
          norm_key: string | null
          option_explanations: string[]
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
          image_alt?: string
          image_url?: string | null
          is_archived?: boolean
          kind?: Database["public"]["Enums"]["question_kind"]
          norm_key?: string | null
          option_explanations?: string[]
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
          image_alt?: string
          image_url?: string | null
          is_archived?: boolean
          kind?: Database["public"]["Enums"]["question_kind"]
          norm_key?: string | null
          option_explanations?: string[]
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
          combo_fx: boolean
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
          combo_fx?: boolean
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
          combo_fx?: boolean
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
      result_events: {
        Row: {
          created_at: string
          id: number
          quiz_id: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          quiz_id?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          quiz_id?: string | null
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
      review_log: {
        Row: {
          correct: boolean
          created_at: string
          employee_id: string | null
          fraction: number
          id: string
          mode: string
          ms_taken: number
          question_id: string | null
          tags: string[]
        }
        Insert: {
          correct?: boolean
          created_at?: string
          employee_id?: string | null
          fraction?: number
          id?: string
          mode?: string
          ms_taken?: number
          question_id?: string | null
          tags?: string[]
        }
        Update: {
          correct?: boolean
          created_at?: string
          employee_id?: string | null
          fraction?: number
          id?: string
          mode?: string
          ms_taken?: number
          question_id?: string | null
          tags?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "review_log_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      seasons: {
        Row: {
          closed_at: string | null
          created_at: string
          ends_at: string
          id: string
          name: string
          standings: Json
          started_at: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          ends_at: string
          id?: string
          name: string
          standings?: Json
          started_at?: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          ends_at?: string
          id?: string
          name?: string
          standings?: Json
          started_at?: string
        }
        Relationships: []
      }
      topic_ratings: {
        Row: {
          correct: number
          employee_id: string
          games: number
          rating: number
          tag: string
          updated_at: string
        }
        Insert: {
          correct?: number
          employee_id: string
          games?: number
          rating?: number
          tag: string
          updated_at?: string
        }
        Update: {
          correct?: number
          employee_id?: string
          games?: number
          rating?: number
          tag?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "topic_ratings_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      tower_progress: {
        Row: {
          best_stage: number
          coins: number
          created_at: string
          employee_id: string
          runs: number
          state: Json
          updated_at: string
        }
        Insert: {
          best_stage?: number
          coins?: number
          created_at?: string
          employee_id: string
          runs?: number
          state?: Json
          updated_at?: string
        }
        Update: {
          best_stage?: number
          coins?: number
          created_at?: string
          employee_id?: string
          runs?: number
          state?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tower_progress_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      tower_run_events: {
        Row: {
          created_at: string
          id: string
          kind: string
          payload: Json
          run_id: string
          seq: number
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          payload?: Json
          run_id: string
          seq?: number
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          payload?: Json
          run_id?: string
          seq?: number
        }
        Relationships: [
          {
            foreignKeyName: "tower_run_events_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "tower_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      tower_runs: {
        Row: {
          answered: number
          correct: number
          employee_id: string
          finished_at: string | null
          hp: number
          id: string
          quiz_id: string | null
          seed: string
          stage_index: number
          started_at: string
          state: Json
          status: string
          version: number
        }
        Insert: {
          answered?: number
          correct?: number
          employee_id: string
          finished_at?: string | null
          hp?: number
          id?: string
          quiz_id?: string | null
          seed?: string
          stage_index?: number
          started_at?: string
          state?: Json
          status?: string
          version?: number
        }
        Update: {
          answered?: number
          correct?: number
          employee_id?: string
          finished_at?: string | null
          hp?: number
          id?: string
          quiz_id?: string | null
          seed?: string
          stage_index?: number
          started_at?: string
          state?: Json
          status?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "tower_runs_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tower_runs_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      tower_scores: {
        Row: {
          ascension: number
          board: string
          created_at: string
          curses: string[]
          day_key: string
          display_name: string
          employee_id: string
          floors: number
          hp: number
          id: string
          relics: string[]
          score: number
          seed: string
          unit: string
          win: boolean
        }
        Insert: {
          ascension?: number
          board?: string
          created_at?: string
          curses?: string[]
          day_key?: string
          display_name?: string
          employee_id: string
          floors?: number
          hp?: number
          id?: string
          relics?: string[]
          score?: number
          seed?: string
          unit?: string
          win?: boolean
        }
        Update: {
          ascension?: number
          board?: string
          created_at?: string
          curses?: string[]
          day_key?: string
          display_name?: string
          employee_id?: string
          floors?: number
          hp?: number
          id?: string
          relics?: string[]
          score?: number
          seed?: string
          unit?: string
          win?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "tower_scores_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
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
      arena_leaderboard: {
        Row: {
          best_streak: number | null
          draws: number | null
          elo: number | null
          games: number | null
          losses: number | null
          rank: number | null
          short_name: string | null
          unit: string | null
          wins: number | null
        }
        Relationships: []
      }
      org_topic_stats: {
        Row: {
          avg_rating: number | null
          correct: number | null
          games: number | null
          learners: number | null
          tag: string | null
        }
        Relationships: []
      }
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
      bump_integrity: {
        Args: { p_session: string; p_weight: number }
        Returns: number
      }
      bump_question_stats: { Args: { p_items: Json }; Returns: undefined }
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
      exam_apply_answers: {
        Args: {
          p_answers: Json
          p_helpers: Json
          p_seq: number
          p_session: string
        }
        Returns: undefined
      }
      exam_claim_save: {
        Args: {
          p_fingerprint: string
          p_max_beacons: number
          p_max_saves: number
          p_min_gap: number
          p_now_ms: number
          p_seen_limit: number
          p_session: string
          p_source: string
        }
        Returns: {
          ok: boolean
          reason: string
        }[]
      }
      exam_mark_checked: {
        Args: { p_index: number; p_session: string }
        Returns: undefined
      }
      exam_merge_helpers: {
        Args: { p_patch: Json; p_session: string }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      prune_carousel_events: { Args: { p_days?: number }; Returns: number }
      question_norm_key: { Args: { p_text: string }; Returns: string }
      refresh_org_topic_stats: { Args: never; Returns: undefined }
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
          p_device_info?: Json
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
      tower_apply_reviews: {
        Args: { p_employee_id: string; p_items: Json }
        Returns: undefined
      }
      verify_cron_secret: { Args: { p_secret: string }; Returns: boolean }
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
