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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      bilhetes: {
        Row: {
          cashback_multiplicador_snapshot: number
          cashback_pago: boolean
          cashback_pago_em: string | null
          cashback_pago_por: string | null
          created_at: string
          expira_em: string | null
          id: string
          mp_payment_id: string | null
          numero_bilhete: number
          pago_em: string | null
          selecao_cashback_id: number | null
          status_pagamento: Database["public"]["Enums"]["status_pagamento"]
          updated_at: string
          user_id: string
          valor_pago: number
        }
        Insert: {
          cashback_multiplicador_snapshot?: number
          cashback_pago?: boolean
          cashback_pago_em?: string | null
          cashback_pago_por?: string | null
          created_at?: string
          expira_em?: string | null
          id?: string
          mp_payment_id?: string | null
          numero_bilhete?: number
          pago_em?: string | null
          selecao_cashback_id?: number | null
          status_pagamento?: Database["public"]["Enums"]["status_pagamento"]
          updated_at?: string
          user_id: string
          valor_pago: number
        }
        Update: {
          cashback_multiplicador_snapshot?: number
          cashback_pago?: boolean
          cashback_pago_em?: string | null
          cashback_pago_por?: string | null
          created_at?: string
          expira_em?: string | null
          id?: string
          mp_payment_id?: string | null
          numero_bilhete?: number
          pago_em?: string | null
          selecao_cashback_id?: number | null
          status_pagamento?: Database["public"]["Enums"]["status_pagamento"]
          updated_at?: string
          user_id?: string
          valor_pago?: number
        }
        Relationships: [
          {
            foreignKeyName: "bilhetes_cashback_pago_por_fkey"
            columns: ["cashback_pago_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bilhetes_selecao_cashback_id_fkey"
            columns: ["selecao_cashback_id"]
            isOneToOne: false
            referencedRelation: "selecoes"
            referencedColumns: ["id"]
          },
        ]
      }
      copa_resultados: {
        Row: {
          artilheiro_nome: string | null
          campeao_id: number | null
          created_at: string
          finalizada: boolean
          id: number
          quarto_id: number | null
          revelacao_id: number | null
          terceiro_id: number | null
          updated_at: string
          vice_id: number | null
        }
        Insert: {
          artilheiro_nome?: string | null
          campeao_id?: number | null
          created_at?: string
          finalizada?: boolean
          id?: number
          quarto_id?: number | null
          revelacao_id?: number | null
          terceiro_id?: number | null
          updated_at?: string
          vice_id?: number | null
        }
        Update: {
          artilheiro_nome?: string | null
          campeao_id?: number | null
          created_at?: string
          finalizada?: boolean
          id?: number
          quarto_id?: number | null
          revelacao_id?: number | null
          terceiro_id?: number | null
          updated_at?: string
          vice_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "copa_resultados_campeao_id_fkey"
            columns: ["campeao_id"]
            isOneToOne: false
            referencedRelation: "selecoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "copa_resultados_quarto_id_fkey"
            columns: ["quarto_id"]
            isOneToOne: false
            referencedRelation: "selecoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "copa_resultados_revelacao_id_fkey"
            columns: ["revelacao_id"]
            isOneToOne: false
            referencedRelation: "selecoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "copa_resultados_terceiro_id_fkey"
            columns: ["terceiro_id"]
            isOneToOne: false
            referencedRelation: "selecoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "copa_resultados_vice_id_fkey"
            columns: ["vice_id"]
            isOneToOne: false
            referencedRelation: "selecoes"
            referencedColumns: ["id"]
          },
        ]
      }
      jogos: {
        Row: {
          created_at: string
          data_hora: string
          external_id: string | null
          fase: Database["public"]["Enums"]["fase_jogo"]
          finalizado: boolean
          gols_casa: number | null
          gols_fora: number | null
          id: number
          numero_jogo: number
          placeholder_casa: string | null
          placeholder_fora: string | null
          selecao_casa_id: number | null
          selecao_fora_id: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_hora: string
          external_id?: string | null
          fase: Database["public"]["Enums"]["fase_jogo"]
          finalizado?: boolean
          gols_casa?: number | null
          gols_fora?: number | null
          id?: number
          numero_jogo: number
          placeholder_casa?: string | null
          placeholder_fora?: string | null
          selecao_casa_id?: number | null
          selecao_fora_id?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_hora?: string
          external_id?: string | null
          fase?: Database["public"]["Enums"]["fase_jogo"]
          finalizado?: boolean
          gols_casa?: number | null
          gols_fora?: number | null
          id?: number
          numero_jogo?: number
          placeholder_casa?: string | null
          placeholder_fora?: string | null
          selecao_casa_id?: number | null
          selecao_fora_id?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jogos_selecao_casa_id_fkey"
            columns: ["selecao_casa_id"]
            isOneToOne: false
            referencedRelation: "selecoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jogos_selecao_fora_id_fkey"
            columns: ["selecao_fora_id"]
            isOneToOne: false
            referencedRelation: "selecoes"
            referencedColumns: ["id"]
          },
        ]
      }
      palpites: {
        Row: {
          bilhete_id: string
          created_at: string
          gols_casa: number
          gols_fora: number
          id: string
          jogo_id: number
          pontos_calculados: number | null
          updated_at: string
        }
        Insert: {
          bilhete_id: string
          created_at?: string
          gols_casa: number
          gols_fora: number
          id?: string
          jogo_id: number
          pontos_calculados?: number | null
          updated_at?: string
        }
        Update: {
          bilhete_id?: string
          created_at?: string
          gols_casa?: number
          gols_fora?: number
          id?: string
          jogo_id?: number
          pontos_calculados?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "palpites_bilhete_id_fkey"
            columns: ["bilhete_id"]
            isOneToOne: false
            referencedRelation: "bilhetes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "palpites_bilhete_id_fkey"
            columns: ["bilhete_id"]
            isOneToOne: false
            referencedRelation: "bilhetes_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "palpites_bilhete_id_fkey"
            columns: ["bilhete_id"]
            isOneToOne: false
            referencedRelation: "ranking"
            referencedColumns: ["bilhete_id"]
          },
          {
            foreignKeyName: "palpites_bilhete_id_fkey"
            columns: ["bilhete_id"]
            isOneToOne: false
            referencedRelation: "ranking_usuarios"
            referencedColumns: ["melhor_bilhete_id"]
          },
          {
            foreignKeyName: "palpites_jogo_id_fkey"
            columns: ["jogo_id"]
            isOneToOne: false
            referencedRelation: "jogos"
            referencedColumns: ["id"]
          },
        ]
      }
      palpites_bonus: {
        Row: {
          bilhete_id: string
          created_at: string
          id: string
          jogador_nome: string | null
          pontos_calculados: number | null
          selecao_id: number | null
          tipo: Database["public"]["Enums"]["tipo_bonus"]
          updated_at: string
        }
        Insert: {
          bilhete_id: string
          created_at?: string
          id?: string
          jogador_nome?: string | null
          pontos_calculados?: number | null
          selecao_id?: number | null
          tipo: Database["public"]["Enums"]["tipo_bonus"]
          updated_at?: string
        }
        Update: {
          bilhete_id?: string
          created_at?: string
          id?: string
          jogador_nome?: string | null
          pontos_calculados?: number | null
          selecao_id?: number | null
          tipo?: Database["public"]["Enums"]["tipo_bonus"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "palpites_bonus_bilhete_id_fkey"
            columns: ["bilhete_id"]
            isOneToOne: false
            referencedRelation: "bilhetes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "palpites_bonus_bilhete_id_fkey"
            columns: ["bilhete_id"]
            isOneToOne: false
            referencedRelation: "bilhetes_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "palpites_bonus_bilhete_id_fkey"
            columns: ["bilhete_id"]
            isOneToOne: false
            referencedRelation: "ranking"
            referencedColumns: ["bilhete_id"]
          },
          {
            foreignKeyName: "palpites_bonus_bilhete_id_fkey"
            columns: ["bilhete_id"]
            isOneToOne: false
            referencedRelation: "ranking_usuarios"
            referencedColumns: ["melhor_bilhete_id"]
          },
          {
            foreignKeyName: "palpites_bonus_selecao_id_fkey"
            columns: ["selecao_id"]
            isOneToOne: false
            referencedRelation: "selecoes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          clube: string | null
          cpf: string | null
          created_at: string
          email: string
          id: string
          is_admin: boolean
          nome: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          clube?: string | null
          cpf?: string | null
          created_at?: string
          email: string
          id: string
          is_admin?: boolean
          nome?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          clube?: string | null
          cpf?: string | null
          created_at?: string
          email?: string
          id?: string
          is_admin?: boolean
          nome?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ranking_signals: {
        Row: {
          id: number
          updated_at: string
        }
        Insert: {
          id?: number
          updated_at?: string
        }
        Update: {
          id?: number
          updated_at?: string
        }
        Relationships: []
      }
      ranking_snapshots: {
        Row: {
          id: string
          periodo: string
          pontos_totais: number
          posicao: number
          snapshot_at: string
          user_id: string
        }
        Insert: {
          id?: string
          periodo: string
          pontos_totais: number
          posicao: number
          snapshot_at?: string
          user_id: string
        }
        Update: {
          id?: string
          periodo?: string
          pontos_totais?: number
          posicao?: number
          snapshot_at?: string
          user_id?: string
        }
        Relationships: []
      }
      recalculo_jobs: {
        Row: {
          bonus_tipos: string[] | null
          erro_msg: string | null
          escopo: string
          finished_at: string | null
          id: string
          jogo_id: number | null
          started_at: string
          status: string
          total_processados: number | null
        }
        Insert: {
          bonus_tipos?: string[] | null
          erro_msg?: string | null
          escopo: string
          finished_at?: string | null
          id?: string
          jogo_id?: number | null
          started_at?: string
          status?: string
          total_processados?: number | null
        }
        Update: {
          bonus_tipos?: string[] | null
          erro_msg?: string | null
          escopo?: string
          finished_at?: string | null
          id?: string
          jogo_id?: number | null
          started_at?: string
          status?: string
          total_processados?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "recalculo_jobs_jogo_id_fkey"
            columns: ["jogo_id"]
            isOneToOne: false
            referencedRelation: "jogos"
            referencedColumns: ["id"]
          },
        ]
      }
      selecoes: {
        Row: {
          bandeira_emoji: string
          cashback_multiplicador: number
          codigo_iso: string
          created_at: string
          grupo: string
          id: number
          nome: string
        }
        Insert: {
          bandeira_emoji: string
          cashback_multiplicador?: number
          codigo_iso: string
          created_at?: string
          grupo: string
          id?: number
          nome: string
        }
        Update: {
          bandeira_emoji?: string
          cashback_multiplicador?: number
          codigo_iso?: string
          created_at?: string
          grupo?: string
          id?: number
          nome?: string
        }
        Relationships: []
      }
      sync_jogos_log: {
        Row: {
          erros: Json
          finalizado_em: string | null
          fonte: string
          id: string
          iniciado_em: string
          jogos_atualizados: number
          jogos_verificados: number
          placeholders_resolvidos: number
          status: string
        }
        Insert: {
          erros?: Json
          finalizado_em?: string | null
          fonte: string
          id?: string
          iniciado_em?: string
          jogos_atualizados?: number
          jogos_verificados?: number
          placeholders_resolvidos?: number
          status?: string
        }
        Update: {
          erros?: Json
          finalizado_em?: string | null
          fonte?: string
          id?: string
          iniciado_em?: string
          jogos_atualizados?: number
          jogos_verificados?: number
          placeholders_resolvidos?: number
          status?: string
        }
        Relationships: []
      }
    }
    Views: {
      bilhetes_view: {
        Row: {
          cashback_multiplicador_snapshot: number | null
          cashback_pago: boolean | null
          created_at: string | null
          effective_status:
            | Database["public"]["Enums"]["status_pagamento"]
            | null
          expira_em: string | null
          id: string | null
          mp_payment_id: string | null
          numero_bilhete: number | null
          pago_em: string | null
          selecao_cashback_id: number | null
          status_pagamento:
            | Database["public"]["Enums"]["status_pagamento"]
            | null
          updated_at: string | null
          user_id: string | null
          valor_pago: number | null
        }
        Insert: {
          cashback_multiplicador_snapshot?: number | null
          cashback_pago?: boolean | null
          created_at?: string | null
          effective_status?: never
          expira_em?: string | null
          id?: string | null
          mp_payment_id?: string | null
          numero_bilhete?: number | null
          pago_em?: string | null
          selecao_cashback_id?: number | null
          status_pagamento?:
            | Database["public"]["Enums"]["status_pagamento"]
            | null
          updated_at?: string | null
          user_id?: string | null
          valor_pago?: number | null
        }
        Update: {
          cashback_multiplicador_snapshot?: number | null
          cashback_pago?: boolean | null
          created_at?: string | null
          effective_status?: never
          expira_em?: string | null
          id?: string | null
          mp_payment_id?: string | null
          numero_bilhete?: number | null
          pago_em?: string | null
          selecao_cashback_id?: number | null
          status_pagamento?:
            | Database["public"]["Enums"]["status_pagamento"]
            | null
          updated_at?: string | null
          user_id?: string | null
          valor_pago?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bilhetes_selecao_cashback_id_fkey"
            columns: ["selecao_cashback_id"]
            isOneToOne: false
            referencedRelation: "selecoes"
            referencedColumns: ["id"]
          },
        ]
      }
      ranking: {
        Row: {
          acertos_exatos: number | null
          acertos_parciais: number | null
          acertou_campeao: boolean | null
          bilhete_id: string | null
          nome: string | null
          numero_bilhete: number | null
          pontos_mata_mata: number | null
          pontos_totais: number | null
          posicao: number | null
          user_id: string | null
        }
        Relationships: []
      }
      ranking_usuarios: {
        Row: {
          acertos_exatos: number | null
          acertos_parciais: number | null
          acertou_campeao: boolean | null
          melhor_bilhete_id: string | null
          melhor_numero_bilhete: number | null
          nome: string | null
          pontos_mata_mata: number | null
          pontos_totais: number | null
          posicao: number | null
          total_bilhetes: number | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_cashbacks_kpis: {
        Args: never
        Returns: {
          a_pagar_agora: number
          bilhetes_elegiveis: number
          exposicao_total: number
          pior_cenario_selecao: string
          pior_cenario_valor: number
        }[]
      }
      admin_overview_kpis: {
        Args: never
        Returns: {
          apostadores: number
          arrecadado: number
          pendentes: number
          tabelas_vendidas: number
        }[]
      }
      admin_ultimos_pagamentos: {
        Args: { lim?: number }
        Returns: {
          bandeira_emoji: string
          created_at: string
          id: string
          nome: string
          numero_bilhete: number
          pago_em: string
          selecao_nome: string
          status_pagamento: string
          total_bilhetes_usuario: number
          valor_pago: number
        }[]
      }
      admin_vendas_diarias: {
        Args: never
        Returns: {
          date: string
          receita: number
          tabelas: number
        }[]
      }
      count_palpites_confirmados: { Args: { uid: string }; Returns: number }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      fase_jogo:
        | "grupos"
        | "16avos"
        | "oitavas"
        | "quartas"
        | "semis"
        | "disputa_terceiro"
        | "final"
      status_pagamento: "pendente" | "confirmado" | "expirado" | "cancelado"
      tipo_bonus:
        | "campeao"
        | "vice"
        | "terceiro"
        | "quarto"
        | "artilheiro"
        | "revelacao"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      fase_jogo: [
        "grupos",
        "16avos",
        "oitavas",
        "quartas",
        "semis",
        "disputa_terceiro",
        "final",
      ],
      status_pagamento: ["pendente", "confirmado", "expirado", "cancelado"],
      tipo_bonus: [
        "campeao",
        "vice",
        "terceiro",
        "quarto",
        "artilheiro",
        "revelacao",
      ],
    },
  },
} as const
