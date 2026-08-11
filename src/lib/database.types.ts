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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      favorability_overrides: {
        Row: {
          created_at: string
          created_by: string | null
          game_id: string
          home_win_probability: number
          reason: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          game_id: string
          home_win_probability: number
          reason: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          game_id?: string
          home_win_probability?: number
          reason?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorability_overrides_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: true
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      model_prediction_snapshots: {
        Row: {
          away_team_rating: number
          away_win_probability: number
          capture_is_pregame: boolean
          capture_source: string
          captured_at: string
          division_cap: number
          game_id: string
          home_field_elo: number
          home_team_rating: number
          home_win_probability: number
          is_division_matchup: boolean
          kickoff_at: string
          manual_override: boolean
          manual_override_reason: string | null
          model_version: string
          rest_adjustment: number
          rest_advantage_days: number | null
          rest_advantage_team_id: string | null
          season: number
          week: number
          week_one_regression: boolean
        }
        Insert: {
          away_team_rating: number
          away_win_probability: number
          capture_is_pregame: boolean
          capture_source: string
          captured_at?: string
          division_cap: number
          game_id: string
          home_field_elo: number
          home_team_rating: number
          home_win_probability: number
          is_division_matchup: boolean
          kickoff_at: string
          manual_override?: boolean
          manual_override_reason?: string | null
          model_version: string
          rest_adjustment?: number
          rest_advantage_days?: number | null
          rest_advantage_team_id?: string | null
          season: number
          week: number
          week_one_regression: boolean
        }
        Update: {
          away_team_rating?: number
          away_win_probability?: number
          capture_is_pregame?: boolean
          capture_source?: string
          captured_at?: string
          division_cap?: number
          game_id?: string
          home_field_elo?: number
          home_team_rating?: number
          home_win_probability?: number
          is_division_matchup?: boolean
          kickoff_at?: string
          manual_override?: boolean
          manual_override_reason?: string | null
          model_version?: string
          rest_adjustment?: number
          rest_advantage_days?: number | null
          rest_advantage_team_id?: string | null
          season?: number
          week?: number
          week_one_regression?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "model_prediction_snapshots_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: true
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "model_prediction_snapshots_rest_advantage_team_id_fkey"
            columns: ["rest_advantage_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      foods: {
        Row: {
          created_at: string | null
          id: string
          name: string
          notes: string | null
          rating: number | null
          restaurant_id: string | null
          tags: string[] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          notes?: string | null
          rating?: number | null
          restaurant_id?: string | null
          tags?: string[] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          notes?: string | null
          rating?: number | null
          restaurant_id?: string | null
          tags?: string[] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "foods_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          away_score: number | null
          away_team_id: string
          created_at: string
          external_id: string
          home_score: number | null
          home_team_id: string
          id: string
          kickoff_at: string
          season: number
          season_type: string
          status: string
          updated_at: string
          venue: string | null
          week: number
          winner_team_id: string | null
        }
        Insert: {
          away_score?: number | null
          away_team_id: string
          created_at?: string
          external_id: string
          home_score?: number | null
          home_team_id: string
          id?: string
          kickoff_at: string
          season: number
          season_type?: string
          status?: string
          updated_at?: string
          venue?: string | null
          week: number
          winner_team_id?: string | null
        }
        Update: {
          away_score?: number | null
          away_team_id?: string
          created_at?: string
          external_id?: string
          home_score?: number | null
          home_team_id?: string
          id?: string
          kickoff_at?: string
          season?: number
          season_type?: string
          status?: string
          updated_at?: string
          venue?: string | null
          week?: number
          winner_team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "games_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      picks: {
        Row: {
          game_id: string
          id: string
          picked_at: string
          picked_team_id: string
          user_id: string
        }
        Insert: {
          game_id: string
          id?: string
          picked_at?: string
          picked_team_id: string
          user_id: string
        }
        Update: {
          game_id?: string
          id?: string
          picked_at?: string
          picked_team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "picks_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "picks_picked_team_id_fkey"
            columns: ["picked_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          is_admin: boolean
          onboarding_completed_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          is_admin?: boolean
          onboarding_completed_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          is_admin?: boolean
          onboarding_completed_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      restaurants: {
        Row: {
          created_at: string | null
          cuisine: string | null
          id: string
          location: string | null
          name: string
          notes: string | null
          updated_at: string | null
          user_id: string
          want_to_try: boolean | null
        }
        Insert: {
          created_at?: string | null
          cuisine?: string | null
          id?: string
          location?: string | null
          name: string
          notes?: string | null
          updated_at?: string | null
          user_id: string
          want_to_try?: boolean | null
        }
        Update: {
          created_at?: string | null
          cuisine?: string | null
          id?: string
          location?: string | null
          name?: string
          notes?: string | null
          updated_at?: string | null
          user_id?: string
          want_to_try?: boolean | null
        }
        Relationships: []
      }
      sync_runs: {
        Row: {
          error: string | null
          finished_at: string | null
          id: number
          matched: number
          provider_games: number
          requested_by: string | null
          season: number
          source: string
          started_at: string
          status: string
          unchanged: number
          unmatched: Json
          updated: number
          weeks: number[]
        }
        Insert: {
          error?: string | null
          finished_at?: string | null
          id?: number
          matched?: number
          provider_games?: number
          requested_by?: string | null
          season: number
          source: string
          started_at?: string
          status?: string
          unchanged?: number
          unmatched?: Json
          updated?: number
          weeks?: number[]
        }
        Update: {
          error?: string | null
          finished_at?: string | null
          id?: number
          matched?: number
          provider_games?: number
          requested_by?: string | null
          season?: number
          source?: string
          started_at?: string
          status?: string
          unchanged?: number
          unmatched?: Json
          updated?: number
          weeks?: number[]
        }
        Relationships: []
      }
      teams: {
        Row: {
          abbreviation: string
          conference: string
          created_at: string
          division: string
          id: string
          name: string
        }
        Insert: {
          abbreviation: string
          conference: string
          created_at?: string
          division: string
          id?: string
          name: string
        }
        Update: {
          abbreviation?: string
          conference?: string
          created_at?: string
          division?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      user_power_rankings: {
        Row: {
          team_order: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          team_order: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          team_order?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      shared_predictions: {
        Row: { id: string; user_id: string; kind: string; public_token: string; payload: Json; display_name: string; is_public: boolean; created_at: string; updated_at: string }
        Insert: { id?: string; user_id: string; kind: string; public_token?: string; payload?: Json; display_name: string; is_public?: boolean; created_at?: string; updated_at?: string }
        Update: { id?: string; user_id?: string; kind?: string; public_token?: string; payload?: Json; display_name?: string; is_public?: boolean; created_at?: string; updated_at?: string }
        Relationships: []
      }
    }
    Views: {
      leaderboard_points: {
        Row: {
          accuracy: number | null
          correct: number | null
          display_name: string | null
          final_picks: number | null
          picks_made: number | null
          points: number | null
          upsets: number | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      submit_pick: {
        Args: { p_game_id: string; p_team_id: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
