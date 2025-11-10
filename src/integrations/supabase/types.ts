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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      assists: {
        Row: {
          goal_id: string
          id: string
          player_id: string | null
        }
        Insert: {
          goal_id: string
          id?: string
          player_id?: string | null
        }
        Update: {
          goal_id?: string
          id?: string
          player_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assists_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: true
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assists_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cards: {
        Row: {
          card_type: Database["public"]["Enums"]["card_type"]
          created_at: string
          id: string
          match_id: string
          minute: number
          player_id: string
        }
        Insert: {
          card_type: Database["public"]["Enums"]["card_type"]
          created_at?: string
          id?: string
          match_id: string
          minute: number
          player_id: string
        }
        Update: {
          card_type?: Database["public"]["Enums"]["card_type"]
          created_at?: string
          id?: string
          match_id?: string
          minute?: number
          player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cards_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cards_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          created_at: string
          id: string
          is_own_goal: boolean
          match_id: string
          minute: number
          player_id: string | null
          team_color: Database["public"]["Enums"]["team_color"]
        }
        Insert: {
          created_at?: string
          id?: string
          is_own_goal?: boolean
          match_id: string
          minute: number
          player_id?: string | null
          team_color: Database["public"]["Enums"]["team_color"]
        }
        Update: {
          created_at?: string
          id?: string
          is_own_goal?: boolean
          match_id?: string
          minute?: number
          player_id?: string | null
          team_color?: Database["public"]["Enums"]["team_color"]
        }
        Relationships: [
          {
            foreignKeyName: "goals_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          finished_at: string | null
          id: string
          match_number: number
          match_timer_paused_at: string | null
          match_timer_started_at: string | null
          match_timer_total_paused_seconds: number | null
          round_id: string
          scheduled_time: string
          score_away: number
          score_home: number
          started_at: string | null
          status: string | null
          team_away: Database["public"]["Enums"]["team_color"]
          team_home: Database["public"]["Enums"]["team_color"]
        }
        Insert: {
          finished_at?: string | null
          id?: string
          match_number: number
          match_timer_paused_at?: string | null
          match_timer_started_at?: string | null
          match_timer_total_paused_seconds?: number | null
          round_id: string
          scheduled_time: string
          score_away?: number
          score_home?: number
          started_at?: string | null
          status?: string | null
          team_away: Database["public"]["Enums"]["team_color"]
          team_home: Database["public"]["Enums"]["team_color"]
        }
        Update: {
          finished_at?: string | null
          id?: string
          match_number?: number
          match_timer_paused_at?: string | null
          match_timer_started_at?: string | null
          match_timer_total_paused_seconds?: number | null
          round_id?: string
          scheduled_time?: string
          score_away?: number
          score_home?: number
          started_at?: string | null
          status?: string | null
          team_away?: Database["public"]["Enums"]["team_color"]
          team_home?: Database["public"]["Enums"]["team_color"]
        }
        Relationships: [
          {
            foreignKeyName: "matches_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      player_attendance: {
        Row: {
          id: string
          player_id: string
          round_id: string
          status: Database["public"]["Enums"]["attendance_status"]
          team_color: Database["public"]["Enums"]["team_color"]
        }
        Insert: {
          id?: string
          player_id: string
          round_id: string
          status?: Database["public"]["Enums"]["attendance_status"]
          team_color: Database["public"]["Enums"]["team_color"]
        }
        Update: {
          id?: string
          player_id?: string
          round_id?: string
          status?: Database["public"]["Enums"]["attendance_status"]
          team_color?: Database["public"]["Enums"]["team_color"]
        }
        Relationships: [
          {
            foreignKeyName: "player_attendance_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_attendance_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      player_rankings: {
        Row: {
          assistencias: number
          atrasos: number
          cartoes_amarelos: number
          cartoes_azuis: number
          created_at: string
          derrotas: number
          email: string | null
          empates: number
          faltas: number
          gols: number
          id: string
          nickname: string
          player_id: string
          pontos_totais: number
          presencas: number
          punicoes: number
          updated_at: string
          vitorias: number
        }
        Insert: {
          assistencias?: number
          atrasos?: number
          cartoes_amarelos?: number
          cartoes_azuis?: number
          created_at?: string
          derrotas?: number
          email?: string | null
          empates?: number
          faltas?: number
          gols?: number
          id?: string
          nickname: string
          player_id: string
          pontos_totais?: number
          presencas?: number
          punicoes?: number
          updated_at?: string
          vitorias?: number
        }
        Update: {
          assistencias?: number
          atrasos?: number
          cartoes_amarelos?: number
          cartoes_azuis?: number
          created_at?: string
          derrotas?: number
          email?: string | null
          empates?: number
          faltas?: number
          gols?: number
          id?: string
          nickname?: string
          player_id?: string
          pontos_totais?: number
          presencas?: number
          punicoes?: number
          updated_at?: string
          vitorias?: number
        }
        Relationships: [
          {
            foreignKeyName: "player_rankings_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      player_round_stats: {
        Row: {
          absence_points: number | null
          absences: number | null
          blue_cards: number | null
          card_points: number | null
          created_at: string | null
          defeat_points: number | null
          defeats: number | null
          draw_points: number | null
          draws: number | null
          goal_points: number | null
          id: string
          late_points: number | null
          lates: number | null
          player_id: string
          presence_points: number | null
          punishment_points: number | null
          punishments: number | null
          round_id: string
          total_points: number | null
          victories: number | null
          victory_points: number | null
          yellow_cards: number | null
        }
        Insert: {
          absence_points?: number | null
          absences?: number | null
          blue_cards?: number | null
          card_points?: number | null
          created_at?: string | null
          defeat_points?: number | null
          defeats?: number | null
          draw_points?: number | null
          draws?: number | null
          goal_points?: number | null
          id?: string
          late_points?: number | null
          lates?: number | null
          player_id: string
          presence_points?: number | null
          punishment_points?: number | null
          punishments?: number | null
          round_id: string
          total_points?: number | null
          victories?: number | null
          victory_points?: number | null
          yellow_cards?: number | null
        }
        Update: {
          absence_points?: number | null
          absences?: number | null
          blue_cards?: number | null
          card_points?: number | null
          created_at?: string | null
          defeat_points?: number | null
          defeats?: number | null
          draw_points?: number | null
          draws?: number | null
          goal_points?: number | null
          id?: string
          late_points?: number | null
          lates?: number | null
          player_id?: string
          presence_points?: number | null
          punishment_points?: number | null
          punishments?: number | null
          round_id?: string
          total_points?: number | null
          victories?: number | null
          victory_points?: number | null
          yellow_cards?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "player_round_stats_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_round_stats_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          age_years: number | null
          birth_date: string | null
          created_at: string
          id: string
          level: Database["public"]["Enums"]["player_level"] | null
          name: string
          position: Database["public"]["Enums"]["player_position"] | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          age_years?: number | null
          birth_date?: string | null
          created_at?: string
          id?: string
          level?: Database["public"]["Enums"]["player_level"] | null
          name: string
          position?: Database["public"]["Enums"]["player_position"] | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          age_years?: number | null
          birth_date?: string | null
          created_at?: string
          id?: string
          level?: Database["public"]["Enums"]["player_level"] | null
          name?: string
          position?: Database["public"]["Enums"]["player_position"] | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "players_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          birth_date: string | null
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          is_approved: boolean | null
          is_player: boolean | null
          last_name: string | null
          level: Database["public"]["Enums"]["player_level"] | null
          name: string
          nickname: string | null
          player_id: string | null
          player_type: string | null
          player_type_detail:
            | Database["public"]["Enums"]["player_type_enum"]
            | null
          position: Database["public"]["Enums"]["player_position"] | null
          status: Database["public"]["Enums"]["player_status"] | null
          user_id: string | null
        }
        Insert: {
          birth_date?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          is_approved?: boolean | null
          is_player?: boolean | null
          last_name?: string | null
          level?: Database["public"]["Enums"]["player_level"] | null
          name: string
          nickname?: string | null
          player_id?: string | null
          player_type?: string | null
          player_type_detail?:
            | Database["public"]["Enums"]["player_type_enum"]
            | null
          position?: Database["public"]["Enums"]["player_position"] | null
          status?: Database["public"]["Enums"]["player_status"] | null
          user_id?: string | null
        }
        Update: {
          birth_date?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          is_approved?: boolean | null
          is_player?: boolean | null
          last_name?: string | null
          level?: Database["public"]["Enums"]["player_level"] | null
          name?: string
          nickname?: string | null
          player_id?: string | null
          player_type?: string | null
          player_type_detail?:
            | Database["public"]["Enums"]["player_type_enum"]
            | null
          position?: Database["public"]["Enums"]["player_position"] | null
          status?: Database["public"]["Enums"]["player_status"] | null
          user_id?: string | null
        }
        Relationships: []
      }
      punishments: {
        Row: {
          created_at: string
          id: string
          player_id: string
          points: number
          reason: string | null
          round_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          player_id: string
          points: number
          reason?: string | null
          round_id: string
        }
        Update: {
          created_at?: string
          id?: string
          player_id?: string
          points?: number
          reason?: string | null
          round_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "punishments_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "punishments_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      round_team_players: {
        Row: {
          created_at: string | null
          id: string
          player_id: string
          round_id: string
          team_color: Database["public"]["Enums"]["team_color"]
        }
        Insert: {
          created_at?: string | null
          id?: string
          player_id: string
          round_id: string
          team_color: Database["public"]["Enums"]["team_color"]
        }
        Update: {
          created_at?: string | null
          id?: string
          player_id?: string
          round_id?: string
          team_color?: Database["public"]["Enums"]["team_color"]
        }
        Relationships: [
          {
            foreignKeyName: "round_team_players_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "round_team_players_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      round_teams: {
        Row: {
          id: string
          round_id: string
          team_color: Database["public"]["Enums"]["team_color"]
        }
        Insert: {
          id?: string
          round_id: string
          team_color: Database["public"]["Enums"]["team_color"]
        }
        Update: {
          id?: string
          round_id?: string
          team_color?: Database["public"]["Enums"]["team_color"]
        }
        Relationships: [
          {
            foreignKeyName: "round_teams_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      rounds: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          round_number: number
          scheduled_date: string | null
          status: Database["public"]["Enums"]["round_status"]
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          round_number: number
          scheduled_date?: string | null
          status?: Database["public"]["Enums"]["round_status"]
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          round_number?: number
          scheduled_date?: string | null
          status?: Database["public"]["Enums"]["round_status"]
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_age_years: { Args: { birth_date: string }; Returns: number }
      close_all_matches_by_round: {
        Args: { p_round_id: string }
        Returns: Json
      }
      close_match: { Args: { p_match_id: string }; Returns: Json }
      delete_player_by_email: {
        Args: { player_email: string }
        Returns: undefined
      }
      delete_player_by_id: { Args: { profile_id: string }; Returns: undefined }
      delete_player_complete: { Args: { p_profile_id: string }; Returns: Json }
      generate_player_id: {
        Args: { p_birth_date: string; p_email: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { user_id: string }; Returns: boolean }
      recalc_all_player_rankings: { Args: never; Returns: Json }
      recalc_round_aggregates: { Args: { p_round_id: string }; Returns: Json }
      reset_all_data: { Args: never; Returns: undefined }
      reset_player_rankings: { Args: never; Returns: Json }
      set_player_birth_date: {
        Args: { p_birth_date: string; p_player_id: string }
        Returns: Json
      }
    }
    Enums: {
      attendance_status: "presente" | "atrasado" | "falta"
      card_type: "amarelo" | "azul"
      player_level: "A" | "B" | "C" | "D" | "E"
      player_position: "goleiro" | "defensor" | "meio-campista" | "atacante"
      player_status: "aprovado" | "aprovar" | "congelado"
      player_type_enum: "mensal" | "avulso" | "avulso_fixo"
      round_status: "a_iniciar" | "em_andamento" | "finalizada"
      team_color: "branco" | "vermelho" | "azul" | "laranja"
      user_role: "user" | "admin"
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
      attendance_status: ["presente", "atrasado", "falta"],
      card_type: ["amarelo", "azul"],
      player_level: ["A", "B", "C", "D", "E"],
      player_position: ["goleiro", "defensor", "meio-campista", "atacante"],
      player_status: ["aprovado", "aprovar", "congelado"],
      player_type_enum: ["mensal", "avulso", "avulso_fixo"],
      round_status: ["a_iniciar", "em_andamento", "finalizada"],
      team_color: ["branco", "vermelho", "azul", "laranja"],
      user_role: ["user", "admin"],
    },
  },
} as const
