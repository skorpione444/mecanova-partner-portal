export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      client_distributors: {
        Row: {
          assignment_locked: boolean | null
          assignment_reason: string | null
          client_id: string
          contract_type: string | null
          created_at: string
          distributor_id: string
          is_default: boolean
        }
        Insert: {
          assignment_locked?: boolean | null
          assignment_reason?: string | null
          client_id: string
          contract_type?: string | null
          created_at?: string
          distributor_id: string
          is_default?: boolean
        }
        Update: {
          assignment_locked?: boolean | null
          assignment_reason?: string | null
          client_id?: string
          contract_type?: string | null
          created_at?: string
          distributor_id?: string
          is_default?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "client_distributors_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_distributors_distributor_id_fkey"
            columns: ["distributor_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          audience: Database["public"]["Enums"]["document_audience_enum"]
          created_at: string
          file_path: string
          id: string
          is_highlight: boolean
          is_shared: boolean
          partner_id: string | null
          product_id: string | null
          title: string
          type: Database["public"]["Enums"]["document_type_enum"]
          updated_at: string | null
        }
        Insert: {
          audience?: Database["public"]["Enums"]["document_audience_enum"]
          created_at?: string
          file_path: string
          id?: string
          is_highlight?: boolean
          is_shared?: boolean
          partner_id?: string | null
          product_id?: string | null
          title: string
          type: Database["public"]["Enums"]["document_type_enum"]
          updated_at?: string | null
        }
        Update: {
          audience?: Database["public"]["Enums"]["document_audience_enum"]
          created_at?: string
          file_path?: string
          id?: string
          is_highlight?: boolean
          is_shared?: boolean
          partner_id?: string | null
          product_id?: string | null
          title?: string
          type?: Database["public"]["Enums"]["document_type_enum"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          created_at: string
          distributor_id: string
          id: string
          movement_type: string
          order_request_id: string | null
          product_id: string
          qty_delta: number
        }
        Insert: {
          created_at?: string
          distributor_id: string
          id?: string
          movement_type: string
          order_request_id?: string | null
          product_id: string
          qty_delta: number
        }
        Update: {
          created_at?: string
          distributor_id?: string
          id?: string
          movement_type?: string
          order_request_id?: string | null
          product_id?: string
          qty_delta?: number
        }
        Relationships: []
      }
      inventory_status: {
        Row: {
          distributor_id: string
          note: string | null
          on_hand_qty: number
          product_id: string
          status: Database["public"]["Enums"]["inventory_status_enum"]
          updated_at: string
        }
        Insert: {
          distributor_id: string
          note?: string | null
          on_hand_qty?: number
          product_id: string
          status?: Database["public"]["Enums"]["inventory_status_enum"]
          updated_at?: string
        }
        Update: {
          distributor_id?: string
          note?: string | null
          on_hand_qty?: number
          product_id?: string
          status?: Database["public"]["Enums"]["inventory_status_enum"]
          updated_at?: string
        }
        Relationships: []
      }
      order_request_items: {
        Row: {
          cases_qty: number
          created_at: string
          id: string
          order_request_id: string
          product_id: string
        }
        Insert: {
          cases_qty: number
          created_at?: string
          id?: string
          order_request_id: string
          product_id: string
        }
        Update: {
          cases_qty?: number
          created_at?: string
          id?: string
          order_request_id?: string
          product_id?: string
        }
        Relationships: []
      }
      order_requests: {
        Row: {
          accepted_at: string | null
          cancelled_at: string | null
          client_id: string | null
          created_at: string
          created_by_user: string
          delivery_location: Json | null
          distributor_id: string | null
          fulfilled_at: string | null
          id: string
          notes: string | null
          partner_id: string
          rejected_at: string | null
          status: Database["public"]["Enums"]["order_status_enum"]
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          cancelled_at?: string | null
          client_id?: string | null
          created_at?: string
          created_by_user: string
          delivery_location?: Json | null
          distributor_id?: string | null
          fulfilled_at?: string | null
          id?: string
          notes?: string | null
          partner_id: string
          rejected_at?: string | null
          status?: Database["public"]["Enums"]["order_status_enum"]
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          cancelled_at?: string | null
          client_id?: string | null
          created_at?: string
          created_by_user?: string
          delivery_location?: Json | null
          distributor_id?: string | null
          fulfilled_at?: string | null
          id?: string
          notes?: string | null
          partner_id?: string
          rejected_at?: string | null
          status?: Database["public"]["Enums"]["order_status_enum"]
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      partners: {
        Row: {
          billing_address: Json | null
          capacity_status: string | null
          client_tier: string | null
          country: string | null
          created_at: string
          id: string
          is_mecanova: boolean
          name: string
          partner_type: Database["public"]["Enums"]["partner_type"]
          service_countries: string[] | null
          shipping_address: Json | null
          vat_id: string | null
        }
        Insert: {
          billing_address?: Json | null
          capacity_status?: string | null
          client_tier?: string | null
          country?: string | null
          created_at?: string
          id?: string
          is_mecanova?: boolean
          name: string
          partner_type?: Database["public"]["Enums"]["partner_type"]
          service_countries?: string[] | null
          shipping_address?: Json | null
          vat_id?: string | null
        }
        Update: {
          billing_address?: Json | null
          capacity_status?: string | null
          client_tier?: string | null
          country?: string | null
          created_at?: string
          id?: string
          is_mecanova?: boolean
          name?: string
          partner_type?: Database["public"]["Enums"]["partner_type"]
          service_countries?: string[] | null
          shipping_address?: Json | null
          vat_id?: string | null
        }
        Relationships: []
      }
      product_assets: {
        Row: {
          created_at: string
          file_path: string
          id: string
          product_id: string
          title: string | null
          type: Database["public"]["Enums"]["product_asset_type_enum"]
        }
        Insert: {
          created_at?: string
          file_path: string
          id?: string
          product_id: string
          title?: string | null
          type: Database["public"]["Enums"]["product_asset_type_enum"]
        }
        Update: {
          created_at?: string
          file_path?: string
          id?: string
          product_id?: string
          title?: string | null
          type?: Database["public"]["Enums"]["product_asset_type_enum"]
        }
        Relationships: []
      }
      products: {
        Row: {
          abv: number | null
          active: boolean
          brand: string | null
          case_size: number | null
          category: Database["public"]["Enums"]["product_category_enum"]
          created_at: string
          description: string | null
          id: string
          name: string
          size_ml: number | null
          sku: string | null
          supplier_id: string | null
        }
        Insert: {
          abv?: number | null
          active?: boolean
          brand?: string | null
          case_size?: number | null
          category?: Database["public"]["Enums"]["product_category_enum"]
          created_at?: string
          description?: string | null
          id?: string
          name: string
          size_ml?: number | null
          sku?: string | null
          supplier_id?: string | null
        }
        Update: {
          abv?: number | null
          active?: boolean
          brand?: string | null
          case_size?: number | null
          category?: Database["public"]["Enums"]["product_category_enum"]
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          size_ml?: number | null
          sku?: string | null
          supplier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          partner_id: string | null
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          partner_id?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          partner_id?: string | null
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
      accept_order: { Args: { p_order_id: string }; Returns: undefined }
      cancel_order: { Args: { p_order_id: string }; Returns: undefined }
      create_order: { Args: { p_distributor_id: string }; Returns: string }
      create_supply_order: { Args: Record<string, never>; Returns: string }
      current_partner_id: { Args: Record<string, never>; Returns: string }
      current_role: { Args: Record<string, never>; Returns: string }
      fulfill_order: { Args: { p_order_id: string }; Returns: undefined }
      is_admin: { Args: Record<string, never>; Returns: boolean }
      mecanova_current_partner_id: { Args: Record<string, never>; Returns: string }
      mecanova_current_role: { Args: Record<string, never>; Returns: string }
      mecanova_is_admin: { Args: Record<string, never>; Returns: boolean }
      reject_order: { Args: { p_order_id: string }; Returns: undefined }
      submit_order: { Args: { p_order_id: string }; Returns: undefined }
    }
    Enums: {
      document_audience_enum: "all" | "distributor" | "client" | "internal"
      document_type_enum:
        | "invoice"
        | "delivery_note"
        | "compliance"
        | "price_list"
        | "marketing"
        | "presentation"
        | "fact_sheet"
        | "brand_deck"
        | "spec_sheet"
      inventory_status_enum: "in_stock" | "limited" | "out"
      order_status_enum:
        | "created"
        | "submitted"
        | "accepted"
        | "rejected"
        | "fulfilled"
        | "cancelled"
        // Legacy (unused in app):
        | "confirmed"
        | "shipped"
        | "closed"
      partner_type: "client" | "distributor" | "supplier"
      product_asset_type_enum:
        | "bottle_shot"
        | "label_pdf"
        | "spec_sheet"
        | "brand_deck"
      product_category_enum: "tequila" | "mezcal" | "raicilla" | "other"
      user_role: "admin" | "partner" | "client" | "distributor"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// ── Convenience aliases ──────────────────────────────────────────────
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"]
export type Enums<T extends keyof Database["public"]["Enums"]> =
  Database["public"]["Enums"][T]

// ── Application-level type aliases ───────────────────────────────────
export type Partner = Tables<"partners">
export type Profile = Tables<"profiles">
export type Product = Tables<"products">
export type ProductAsset = Tables<"product_assets">
export type OrderRequest = Tables<"order_requests">
export type OrderRequestItem = Tables<"order_request_items">
export type InventoryStatus = Tables<"inventory_status">
export type InventoryMovement = Tables<"inventory_movements">
export type Document = Tables<"documents">
export type ClientDistributor = Tables<"client_distributors">

export type UserRole = Enums<"user_role">
export type OrderStatus = Enums<"order_status_enum">
export type PartnerType = Enums<"partner_type">
export type ProductCategory = Enums<"product_category_enum">
export type DocumentType = Enums<"document_type_enum">
export type DocumentAudience = Enums<"document_audience_enum">
export type InventoryStatusEnum = Enums<"inventory_status_enum">
export type ProductAssetType = Enums<"product_asset_type_enum">
