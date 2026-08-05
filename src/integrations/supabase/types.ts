export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      app_config: {
        Row: {
          apps_script_url: string | null;
          id: number;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          apps_script_url?: string | null;
          id?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          apps_script_url?: string | null;
          id?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      daily_reports: {
        Row: {
          created_at: string;
          created_by: string | null;
          dados_complementares: Json;
          efetivo: Json;
          id: string;
          incendios: Json;
          notes: string | null;
          outras: Json;
          recursos: Json;
          report_date: string;
          shift: Database["public"]["Enums"]["report_shift"];
          updated_at: string;
          updated_by: string | null;
          version: number;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          dados_complementares?: Json;
          efetivo?: Json;
          id?: string;
          incendios?: Json;
          notes?: string | null;
          outras?: Json;
          recursos?: Json;
          report_date: string;
          shift?: Database["public"]["Enums"]["report_shift"];
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          dados_complementares?: Json;
          efetivo?: Json;
          id?: string;
          incendios?: Json;
          notes?: string | null;
          outras?: Json;
          recursos?: Json;
          report_date?: string;
          shift?: Database["public"]["Enums"]["report_shift"];
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Relationships: [];
      };
      daily_reports_history: {
        Row: {
          changed_at: string;
          changed_by: string | null;
          data: Json;
          id: number;
          operation: string;
          report_date: string;
          report_id: string;
          shift: Database["public"]["Enums"]["report_shift"];
          version: number;
        };
        Insert: {
          changed_at?: string;
          changed_by?: string | null;
          data: Json;
          id?: number;
          operation?: string;
          report_date: string;
          report_id: string;
          shift?: Database["public"]["Enums"]["report_shift"];
          version: number;
        };
        Update: {
          changed_at?: string;
          changed_by?: string | null;
          data?: Json;
          id?: number;
          operation?: string;
          report_date?: string;
          report_id?: string;
          shift?: Database["public"]["Enums"]["report_shift"];
          version?: number;
        };
        Relationships: [];
      };
      escala_operators: {
        Row: {
          active: boolean;
          created_at: string;
          id: string;
          name: string;
          phone: string;
          profile_id: string | null;
          rank: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          id?: string;
          name: string;
          phone?: string;
          profile_id?: string | null;
          rank?: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          id?: string;
          name?: string;
          phone?: string;
          profile_id?: string | null;
          rank?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "escala_operators_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      escala_shifts: {
        Row: {
          created_at: string;
          created_by: string | null;
          end_time: string;
          id: string;
          notes: string | null;
          operator_id: string;
          shift_date: string;
          start_time: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          end_time?: string;
          id?: string;
          notes?: string | null;
          operator_id: string;
          shift_date: string;
          start_time?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          end_time?: string;
          id?: string;
          notes?: string | null;
          operator_id?: string;
          shift_date?: string;
          start_time?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "escala_shifts_operator_id_fkey";
            columns: ["operator_id"];
            isOneToOne: false;
            referencedRelation: "escala_operators";
            referencedColumns: ["id"];
          },
        ];
      };
      municipios: {
        Row: {
          active: boolean;
          created_at: string;
          created_by: string | null;
          id: string;
          name: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          display_name: string | null;
          email: string | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          display_name?: string | null;
          email?: string | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          display_name?: string | null;
          email?: string | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      report_data: {
        Row: {
          data: Json;
          id: number;
          updated_at: string;
          updated_by: string | null;
          version: number;
        };
        Insert: {
          data?: Json;
          id?: number;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Update: {
          data?: Json;
          id?: number;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Relationships: [];
      };
      report_data_history: {
        Row: {
          change_summary: string | null;
          created_at: string;
          data: Json;
          id: number;
          report_id: number;
          updated_at: string;
          updated_by: string | null;
          version: number;
        };
        Insert: {
          change_summary?: string | null;
          created_at?: string;
          data: Json;
          id?: number;
          report_id: number;
          updated_at?: string;
          updated_by?: string | null;
          version: number;
        };
        Update: {
          change_summary?: string | null;
          created_at?: string;
          data?: Json;
          id?: number;
          report_id?: number;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_user_scheduled_on: {
        Args: { _date: string; _user_id: string };
        Returns: boolean;
      };
    };
    Enums: {
      app_role: "admin" | "editor" | "viewer";
      report_shift: "noturno" | "parcial";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "editor", "viewer"],
      report_shift: ["noturno", "parcial"],
    },
  },
} as const;
