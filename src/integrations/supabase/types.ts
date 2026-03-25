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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          created_at: string
          detail: Json | null
          id: string
          ip_address: string | null
          module: string | null
          tenant_id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          detail?: Json | null
          id?: string
          ip_address?: string | null
          module?: string | null
          tenant_id: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          detail?: Json | null
          id?: string
          ip_address?: string | null
          module?: string | null
          tenant_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_conversations: {
        Row: {
          bot_id: string
          created_at: string
          id: string
          tenant_id: string
          title: string | null
          user_id: string | null
        }
        Insert: {
          bot_id: string
          created_at?: string
          id?: string
          tenant_id: string
          title?: string | null
          user_id?: string | null
        }
        Update: {
          bot_id?: string
          created_at?: string
          id?: string
          tenant_id?: string
          title?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bot_conversations_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_conversations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "bot_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      bots: {
        Row: {
          channel: string
          config: Json | null
          created_at: string
          id: string
          is_active: boolean | null
          model: string | null
          n8n_workflow_id: string | null
          name: string
          system_prompt: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          channel?: string
          config?: Json | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          model?: string | null
          n8n_workflow_id?: string | null
          name: string
          system_prompt?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          channel?: string
          config?: Json | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          model?: string | null
          n8n_workflow_id?: string | null
          name?: string
          system_prompt?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bots_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_role_permissions: {
        Row: {
          custom_role_id: string
          id: string
          permission_id: string
        }
        Insert: {
          custom_role_id: string
          id?: string
          permission_id: string
        }
        Update: {
          custom_role_id?: string
          id?: string
          permission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_role_permissions_custom_role_id_fkey"
            columns: ["custom_role_id"]
            isOneToOne: false
            referencedRelation: "custom_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          message_type: string
          role: string
          session_id: string
          structured: Json | null
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          message_type?: string
          role: string
          session_id: string
          structured?: Json | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          message_type?: string
          role?: string
          session_id?: string
          structured?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "dashboard_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_sessions: {
        Row: {
          created_at: string
          id: string
          prompt: string
          result: Json | null
          status: string | null
          tenant_id: string
          title: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          prompt: string
          result?: Json | null
          status?: string | null
          tenant_id: string
          title?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          prompt?: string
          result?: Json | null
          status?: string | null
          tenant_id?: string
          title?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      exports: {
        Row: {
          created_at: string
          export_type: string
          file_name: string | null
          file_url: string | null
          id: string
          metadata: Json | null
          source_module: string | null
          tenant_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          export_type: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          metadata?: Json | null
          source_module?: string | null
          tenant_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          export_type?: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          metadata?: Json | null
          source_module?: string | null
          tenant_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exports_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          agente_negocio: string | null
          agente_prim_gestion: string | null
          agente_ultim_gestion: string | null
          bpo: string | null
          campana_inconcert: string | null
          campana_mkt: string | null
          categoria_mkt: string | null
          ciudad: string | null
          cliente: string | null
          created_at: string
          email: string | null
          es_venta: boolean | null
          fch_creacion: string | null
          fch_negocio: string | null
          fch_prim_gestion: string | null
          fch_prim_resultado_marcadora: string | null
          fch_ultim_gestion: string | null
          id: string
          id_lead: string | null
          id_llave: string | null
          keyword: string | null
          prim_resultado_marcadora: string | null
          result_negocio: string | null
          result_prim_gestion: string | null
          result_ultim_gestion: string | null
          tenant_id: string
          tipo_llamada: string | null
          updated_at: string
        }
        Insert: {
          agente_negocio?: string | null
          agente_prim_gestion?: string | null
          agente_ultim_gestion?: string | null
          bpo?: string | null
          campana_inconcert?: string | null
          campana_mkt?: string | null
          categoria_mkt?: string | null
          ciudad?: string | null
          cliente?: string | null
          created_at?: string
          email?: string | null
          es_venta?: boolean | null
          fch_creacion?: string | null
          fch_negocio?: string | null
          fch_prim_gestion?: string | null
          fch_prim_resultado_marcadora?: string | null
          fch_ultim_gestion?: string | null
          id?: string
          id_lead?: string | null
          id_llave?: string | null
          keyword?: string | null
          prim_resultado_marcadora?: string | null
          result_negocio?: string | null
          result_prim_gestion?: string | null
          result_ultim_gestion?: string | null
          tenant_id: string
          tipo_llamada?: string | null
          updated_at?: string
        }
        Update: {
          agente_negocio?: string | null
          agente_prim_gestion?: string | null
          agente_ultim_gestion?: string | null
          bpo?: string | null
          campana_inconcert?: string | null
          campana_mkt?: string | null
          categoria_mkt?: string | null
          ciudad?: string | null
          cliente?: string | null
          created_at?: string
          email?: string | null
          es_venta?: boolean | null
          fch_creacion?: string | null
          fch_negocio?: string | null
          fch_prim_gestion?: string | null
          fch_prim_resultado_marcadora?: string | null
          fch_ultim_gestion?: string | null
          id?: string
          id_lead?: string | null
          id_llave?: string | null
          keyword?: string | null
          prim_resultado_marcadora?: string | null
          result_negocio?: string | null
          result_prim_gestion?: string | null
          result_ultim_gestion?: string | null
          tenant_id?: string
          tipo_llamada?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      memory_analitycs: {
        Row: {
          action: string | null
          chatInput: string | null
          created_at: string
          id: number
          sessionId: string | null
        }
        Insert: {
          action?: string | null
          chatInput?: string | null
          created_at?: string
          id?: number
          sessionId?: string | null
        }
        Update: {
          action?: string | null
          chatInput?: string | null
          created_at?: string
          id?: number
          sessionId?: string | null
        }
        Relationships: []
      }
      modules: {
        Row: {
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          slug: string
          sort_order: number | null
        }
        Insert: {
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          slug: string
          sort_order?: number | null
        }
        Update: {
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          slug?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      permissions: {
        Row: {
          action: string
          description: string | null
          id: string
          module_id: string
        }
        Insert: {
          action: string
          description?: string | null
          id?: string
          module_id: string
        }
        Update: {
          action?: string
          description?: string | null
          id?: string
          module_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "permissions_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          is_active: boolean | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name: string
          id: string
          is_active?: boolean | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          id: string
          permission_id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          id?: string
          permission_id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          id?: string
          permission_id?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          created_at: string
          description: string
          id: string
          priority: string
          status: string
          tenant_id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          description?: string
          id?: string
          priority?: string
          status?: string
          tenant_id: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          description?: string
          id?: string
          priority?: string
          status?: string
          tenant_id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          category: string | null
          id: string
          key: string
          tenant_id: string | null
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          category?: string | null
          id?: string
          key: string
          tenant_id?: string | null
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          category?: string | null
          id?: string
          key?: string
          tenant_id?: string | null
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "system_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_data_sources: {
        Row: {
          allow_chatbots: boolean | null
          allow_cross_analysis: boolean | null
          allow_dashboards: boolean | null
          allow_joins: boolean | null
          allow_reports: boolean | null
          category: string | null
          created_at: string
          description: string | null
          display_name: string
          id: string
          is_active: boolean | null
          priority: number | null
          restrictions: Json | null
          table_name: string
          updated_at: string
        }
        Insert: {
          allow_chatbots?: boolean | null
          allow_cross_analysis?: boolean | null
          allow_dashboards?: boolean | null
          allow_joins?: boolean | null
          allow_reports?: boolean | null
          category?: string | null
          created_at?: string
          description?: string | null
          display_name: string
          id?: string
          is_active?: boolean | null
          priority?: number | null
          restrictions?: Json | null
          table_name: string
          updated_at?: string
        }
        Update: {
          allow_chatbots?: boolean | null
          allow_cross_analysis?: boolean | null
          allow_dashboards?: boolean | null
          allow_joins?: boolean | null
          allow_reports?: boolean | null
          category?: string | null
          created_at?: string
          description?: string | null
          display_name?: string
          id?: string
          is_active?: boolean | null
          priority?: number | null
          restrictions?: Json | null
          table_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      tenants: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          language: string | null
          logo_url: string | null
          name: string
          plan: string
          primary_color: string | null
          slug: string
          timezone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          language?: string | null
          logo_url?: string | null
          name: string
          plan?: string
          primary_color?: string | null
          slug: string
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          language?: string | null
          logo_url?: string | null
          name?: string
          plan?: string
          primary_color?: string | null
          slug?: string
          timezone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ticket_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          is_internal: boolean | null
          ticket_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_internal?: boolean | null
          ticket_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_internal?: boolean | null
          ticket_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_comments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      user_custom_roles: {
        Row: {
          custom_role_id: string
          id: string
          user_id: string
        }
        Insert: {
          custom_role_id: string
          id?: string
          user_id: string
        }
        Update: {
          custom_role_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_custom_roles_custom_role_id_fkey"
            columns: ["custom_role_id"]
            isOneToOne: false
            referencedRelation: "custom_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          created_at: string
          granted: boolean
          id: string
          permission_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          granted?: boolean
          id?: string
          permission_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          granted?: boolean
          id?: string
          permission_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      _build_filters_where: { Args: { _f: Json }; Returns: string }
      _date_field_expr: { Args: { _d: string }; Returns: string }
      execute_leads_query: {
        Args: { _query: string; _tenant_id: string }
        Returns: Json
      }
      generar_analitica_dinamica: {
        Args: {
          _agente_negocio?: string
          _agrupador: string
          _campana_mkt?: string
          _fecha_desde?: string
          _fecha_hasta?: string
          _tenant_id: string
        }
        Returns: {
          dimension: string
          tasa_conversion: number
          tiempo_ciclo_min: number
          tiempo_resp_min: number
          total_leads: number
          total_ventas: number
        }[]
      }
      get_leads_dimensions: { Args: { _tenant_id: string }; Returns: Json }
      get_leads_kpis: {
        Args: {
          _date_field?: string
          _fecha_desde?: string
          _fecha_hasta?: string
          _filters?: Json
          _tenant_id: string
        }
        Returns: Json
      }
      get_user_tenant: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      leads_agg_1d: {
        Args: {
          _date_field?: string
          _dimension: string
          _fecha_desde?: string
          _fecha_hasta?: string
          _filters?: Json
          _limit?: number
          _tenant_id: string
        }
        Returns: Json
      }
      leads_agg_2d: {
        Args: {
          _date_field?: string
          _dim1: string
          _dim2: string
          _fecha_desde?: string
          _fecha_hasta?: string
          _filters?: Json
          _tenant_id: string
          _top_n?: number
        }
        Returns: Json
      }
      leads_funnel: {
        Args: {
          _date_field?: string
          _fecha_desde?: string
          _fecha_hasta?: string
          _filters?: Json
          _tenant_id: string
        }
        Returns: Json
      }
      leads_time_metrics: {
        Args: {
          _date_field?: string
          _fecha_desde?: string
          _fecha_hasta?: string
          _filters?: Json
          _group_by?: string
          _tenant_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "tenant_admin"
        | "manager"
        | "analyst"
        | "operator"
        | "viewer"
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
      app_role: [
        "super_admin",
        "tenant_admin",
        "manager",
        "analyst",
        "operator",
        "viewer",
      ],
    },
  },
} as const
