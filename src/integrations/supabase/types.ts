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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      batch_ingredients: {
        Row: {
          batch_id: string
          created_at: string
          id: string
          ingredient_name: string
          quantity_used: number
          unit: string
        }
        Insert: {
          batch_id: string
          created_at?: string
          id?: string
          ingredient_name: string
          quantity_used: number
          unit?: string
        }
        Update: {
          batch_id?: string
          created_at?: string
          id?: string
          ingredient_name?: string
          quantity_used?: number
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "batch_ingredients_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
        ]
      }
      batches: {
        Row: {
          batch_size_mode: string
          batch_weight: number | null
          batch_weight_unit: string | null
          created_at: string
          id: string
          ingredient_cost_per_unit: number
          notes: string | null
          overhead_breakdown: Json | null
          overhead_cost_per_unit: number
          product_id: string
          quantity_produced: number
          status: string
          total_batch_cost: number
          total_cost_per_unit: number
          user_id: string
          variant_id: string | null
        }
        Insert: {
          batch_size_mode?: string
          batch_weight?: number | null
          batch_weight_unit?: string | null
          created_at?: string
          id?: string
          ingredient_cost_per_unit?: number
          notes?: string | null
          overhead_breakdown?: Json | null
          overhead_cost_per_unit?: number
          product_id: string
          quantity_produced: number
          status?: string
          total_batch_cost?: number
          total_cost_per_unit?: number
          user_id: string
          variant_id?: string | null
        }
        Update: {
          batch_size_mode?: string
          batch_weight?: number | null
          batch_weight_unit?: string | null
          created_at?: string
          id?: string
          ingredient_cost_per_unit?: number
          notes?: string | null
          overhead_breakdown?: Json | null
          overhead_cost_per_unit?: number
          product_id?: string
          quantity_produced?: number
          status?: string
          total_batch_cost?: number
          total_cost_per_unit?: number
          user_id?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      bill_items: {
        Row: {
          amount: number
          bill_id: string
          created_at: string
          id: string
          item_name: string
          price: number
          quantity: number
        }
        Insert: {
          amount: number
          bill_id: string
          created_at?: string
          id?: string
          item_name: string
          price: number
          quantity: number
        }
        Update: {
          amount?: number
          bill_id?: string
          created_at?: string
          id?: string
          item_name?: string
          price?: number
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "bill_items_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
        ]
      }
      bills: {
        Row: {
          bill_date: string | null
          created_at: string
          id: string
          image_path: string | null
          product_id: string | null
          supplier_name: string | null
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          bill_date?: string | null
          created_at?: string
          id?: string
          image_path?: string | null
          product_id?: string | null
          supplier_name?: string | null
          total: number
          updated_at?: string
          user_id: string
        }
        Update: {
          bill_date?: string | null
          created_at?: string
          id?: string
          image_path?: string | null
          product_id?: string | null
          supplier_name?: string | null
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bills_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredient_cost_history: {
        Row: {
          bill_id: string | null
          created_at: string
          id: string
          ingredient_name: string
          new_price: number
          old_price: number
          product_id: string
          user_id: string
        }
        Insert: {
          bill_id?: string | null
          created_at?: string
          id?: string
          ingredient_name: string
          new_price?: number
          old_price?: number
          product_id: string
          user_id: string
        }
        Update: {
          bill_id?: string | null
          created_at?: string
          id?: string
          ingredient_name?: string
          new_price?: number
          old_price?: number
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingredient_cost_history_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ingredient_cost_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_ingredients: {
        Row: {
          created_at: string
          id: string
          ingredient_name: string
          price: number
          quantity: number
          unit: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          ingredient_name: string
          price?: number
          quantity?: number
          unit?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          ingredient_name?: string
          price?: number
          quantity?: number
          unit?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      product_batch_sizes: {
        Row: {
          batch_size: number
          created_at: string
          id: string
          product_id: string
          unit: string
          updated_at: string
          user_id: string
        }
        Insert: {
          batch_size?: number
          created_at?: string
          id?: string
          product_id: string
          unit?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          batch_size?: number
          created_at?: string
          id?: string
          product_id?: string
          unit?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      product_cost_snapshots: {
        Row: {
          bill_id: string | null
          created_at: string
          id: string
          new_margin: number
          new_profit: number
          new_total_cost: number
          old_margin: number
          old_profit: number
          old_total_cost: number
          product_id: string
          recommended_price: number
          selling_price: number
          user_id: string
        }
        Insert: {
          bill_id?: string | null
          created_at?: string
          id?: string
          new_margin?: number
          new_profit?: number
          new_total_cost?: number
          old_margin?: number
          old_profit?: number
          old_total_cost?: number
          product_id: string
          recommended_price?: number
          selling_price?: number
          user_id: string
        }
        Update: {
          bill_id?: string | null
          created_at?: string
          id?: string
          new_margin?: number
          new_profit?: number
          new_total_cost?: number
          old_margin?: number
          old_profit?: number
          old_total_cost?: number
          product_id?: string
          recommended_price?: number
          selling_price?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_cost_snapshots_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_cost_snapshots_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_ingredients: {
        Row: {
          created_at: string
          id: string
          ingredient_name: string
          min_stock_threshold: number
          price: number
          product_id: string
          quantity: number
          total_cost: number
          total_purchased: number
          unit: string
          unit_price: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          ingredient_name: string
          min_stock_threshold?: number
          price?: number
          product_id: string
          quantity?: number
          total_cost?: number
          total_purchased?: number
          unit?: string
          unit_price?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          ingredient_name?: string
          min_stock_threshold?: number
          price?: number
          product_id?: string
          quantity?: number
          total_cost?: number
          total_purchased?: number
          unit?: string
          unit_price?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_ingredients_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_packaging_variants: {
        Row: {
          cover_cost: number
          created_at: string
          id: string
          is_default: boolean
          pack_size: number
          product_id: string
          selling_price: number
          size_label: string
          unit: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cover_cost?: number
          created_at?: string
          id?: string
          is_default?: boolean
          pack_size?: number
          product_id: string
          selling_price?: number
          size_label: string
          unit?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cover_cost?: number
          created_at?: string
          id?: string
          is_default?: boolean
          pack_size?: number
          product_id?: string
          selling_price?: number
          size_label?: string
          unit?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      product_production_costs: {
        Row: {
          created_at: string
          default_batch_size: number
          eb_cost: number
          eb_cost_mode: string
          id: string
          label_cost: number
          label_cost_mode: string
          labor_cost: number
          labor_cost_mode: string
          machine_cost: number
          machine_cost_mode: string
          packing_cover: number
          packing_cover_mode: string
          product_id: string
          shipping_cost: number
          shipping_cost_mode: string
          tax_basis: string
          tax_mode: string
          tax_value: number
          updated_at: string
          user_id: string
          utilities_cost: number
          utilities_cost_mode: string
        }
        Insert: {
          created_at?: string
          default_batch_size?: number
          eb_cost?: number
          eb_cost_mode?: string
          id?: string
          label_cost?: number
          label_cost_mode?: string
          labor_cost?: number
          labor_cost_mode?: string
          machine_cost?: number
          machine_cost_mode?: string
          packing_cover?: number
          packing_cover_mode?: string
          product_id: string
          shipping_cost?: number
          shipping_cost_mode?: string
          tax_basis?: string
          tax_mode?: string
          tax_value?: number
          updated_at?: string
          user_id: string
          utilities_cost?: number
          utilities_cost_mode?: string
        }
        Update: {
          created_at?: string
          default_batch_size?: number
          eb_cost?: number
          eb_cost_mode?: string
          id?: string
          label_cost?: number
          label_cost_mode?: string
          labor_cost?: number
          labor_cost_mode?: string
          machine_cost?: number
          machine_cost_mode?: string
          packing_cover?: number
          packing_cover_mode?: string
          product_id?: string
          shipping_cost?: number
          shipping_cost_mode?: string
          tax_basis?: string
          tax_mode?: string
          tax_value?: number
          updated_at?: string
          user_id?: string
          utilities_cost?: number
          utilities_cost_mode?: string
        }
        Relationships: []
      }
      product_recipes: {
        Row: {
          batch_unit: string
          created_at: string
          id: string
          ingredient_name: string
          planned_quantity: number | null
          planned_unit: string | null
          product_id: string
          quantity_required: number
          total_batch_quantity: number
          unit: string
          updated_at: string
          user_id: string
          variant_id: string | null
        }
        Insert: {
          batch_unit?: string
          created_at?: string
          id?: string
          ingredient_name: string
          planned_quantity?: number | null
          planned_unit?: string | null
          product_id: string
          quantity_required?: number
          total_batch_quantity?: number
          unit?: string
          updated_at?: string
          user_id: string
          variant_id?: string | null
        }
        Update: {
          batch_unit?: string
          created_at?: string
          id?: string
          ingredient_name?: string
          planned_quantity?: number | null
          planned_unit?: string | null
          product_id?: string
          quantity_required?: number
          total_batch_quantity?: number
          unit?: string
          updated_at?: string
          user_id?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_recipes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          selling_price: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          selling_price?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          selling_price?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          company_name: string | null
          created_at: string
          email: string | null
          employee_count: string | null
          full_name: string | null
          id: string
          industry: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          company_name?: string | null
          created_at?: string
          email?: string | null
          employee_count?: string | null
          full_name?: string | null
          id: string
          industry?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          company_name?: string | null
          created_at?: string
          email?: string | null
          employee_count?: string | null
          full_name?: string | null
          id?: string
          industry?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sale_items: {
        Row: {
          amount: number
          created_at: string
          id: string
          product_id: string
          quantity: number
          sale_id: string
          unit_price: number
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          product_id: string
          quantity?: number
          sale_id: string
          unit_price?: number
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          sale_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          created_at: string
          customer_name: string | null
          id: string
          notes: string | null
          sale_date: string
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          customer_name?: string | null
          id?: string
          notes?: string | null
          sale_date?: string
          total?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          customer_name?: string | null
          id?: string
          notes?: string | null
          sale_date?: string
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          plan: Database["public"]["Enums"]["subscription_plan"]
          razorpay_ref: string | null
          started_at: string
          status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          plan?: Database["public"]["Enums"]["subscription_plan"]
          razorpay_ref?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          plan?: Database["public"]["Enums"]["subscription_plan"]
          razorpay_ref?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          user_id?: string
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
      user_settings: {
        Row: {
          created_at: string
          currency: string
          default_product_id: string | null
          id: string
          low_stock_threshold: number
          notifications_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          default_product_id?: string | null
          id?: string
          low_stock_threshold?: number
          notifications_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          default_product_id?: string | null
          id?: string
          low_stock_threshold?: number
          notifications_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_settings_default_product_id_fkey"
            columns: ["default_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
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
      app_role: "admin" | "user"
      subscription_plan: "free" | "pro"
      subscription_status: "active" | "canceled" | "past_due"
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
      app_role: ["admin", "user"],
      subscription_plan: ["free", "pro"],
      subscription_status: ["active", "canceled", "past_due"],
    },
  },
} as const
