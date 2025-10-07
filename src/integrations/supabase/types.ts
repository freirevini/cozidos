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
            referencedRelation: "players"
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
            referencedRelation: "players"
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
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          finished_at: string | null
          id: string
          match_number: number
          round_id: string
          scheduled_time: string
          score_away: number
          score_home: number
          started_at: string | null
          team_away: Database["public"]["Enums"]["team_color"]
          team_home: Database["public"]["Enums"]["team_color"]
        }
        Insert: {
          finished_at?: string | null
          id?: string
          match_number: number
          round_id: string
          scheduled_time: string
          score_away?: number
          score_home?: number
          started_at?: string | null
          team_away: Database["public"]["Enums"]["team_color"]
          team_home: Database["public"]["Enums"]["team_color"]
        }
        Update: {
          finished_at?: string | null
          id?: string
          match_number?: number
          round_id?: string
          scheduled_time?: string
          score_away?: number
          score_home?: number
          started_at?: string | null
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
            referencedRelation: "players"
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
      players: {
        Row: {
          created_at: string
          id: string
          level: Database["public"]["Enums"]["player_level"]
          name: string
          position: Database["public"]["Enums"]["player_position"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          level: Database["public"]["Enums"]["player_level"]
          name: string
          position: Database["public"]["Enums"]["player_position"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          level?: Database["public"]["Enums"]["player_level"]
          name?: string
          position?: Database["public"]["Enums"]["player_position"]
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
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
            referencedRelation: "players"
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
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          round_number: number
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          round_number?: number
          status?: string
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
      is_admin: {
        Args: { user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      attendance_status: "presente" | "atrasado" | "falta"
      card_type: "amarelo" | "vermelho"
      player_level: "A" | "B" | "C" | "D" | "E"
      player_position: "goleiro" | "defensor" | "meio-campista" | "atacante"
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
      card_type: ["amarelo", "vermelho"],
      player_level: ["A", "B", "C", "D", "E"],
      player_position: ["goleiro", "defensor", "meio-campista", "atacante"],
      team_color: ["branco", "vermelho", "azul", "laranja"],
      user_role: ["user", "admin"],
    },
  },
} as const
