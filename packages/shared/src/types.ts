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
      bank_transactions: {
        Row: {
          amount: number
          assigned_to: string | null
          category: string | null
          cost_type: string
          created_at: string | null
          description: string | null
          direction: string
          holvi_transaction_id: string | null
          id: string
          matched_invoice_id: string | null
          notes: string | null
          synced_at: string | null
          transaction_date: string
          travel_reason: string | null
          travel_who_met: string | null
        }
        Insert: {
          amount: number
          assigned_to?: string | null
          category?: string | null
          cost_type?: string
          created_at?: string | null
          description?: string | null
          direction: string
          holvi_transaction_id?: string | null
          id?: string
          matched_invoice_id?: string | null
          notes?: string | null
          synced_at?: string | null
          transaction_date: string
          travel_reason?: string | null
          travel_who_met?: string | null
        }
        Update: {
          amount?: number
          assigned_to?: string | null
          category?: string | null
          cost_type?: string
          created_at?: string | null
          description?: string | null
          direction?: string
          holvi_transaction_id?: string | null
          id?: string
          matched_invoice_id?: string | null
          notes?: string | null
          synced_at?: string | null
          transaction_date?: string
          travel_reason?: string | null
          travel_who_met?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_transactions_matched_invoice_id_fkey"
            columns: ["matched_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
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
      crm_interactions: {
        Row: {
          body: string | null
          created_at: string
          created_by: string
          file_name: string | null
          file_path: string | null
          id: string
          interaction_type: Database["public"]["Enums"]["crm_interaction_type_enum"]
          occurred_at: string
          partner_id: string | null
          prospect_id: string | null
          summary: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          created_by: string
          file_name?: string | null
          file_path?: string | null
          id?: string
          interaction_type: Database["public"]["Enums"]["crm_interaction_type_enum"]
          occurred_at?: string
          partner_id?: string | null
          prospect_id?: string | null
          summary: string
        }
        Update: {
          body?: string | null
          created_at?: string
          created_by?: string
          file_name?: string | null
          file_path?: string | null
          id?: string
          interaction_type?: Database["public"]["Enums"]["crm_interaction_type_enum"]
          occurred_at?: string
          partner_id?: string | null
          prospect_id?: string | null
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_interactions_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_interactions_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
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
      holvi_sync_log: {
        Row: {
          error_message: string | null
          id: string
          status: string
          synced_at: string | null
          transactions_fetched: number | null
          transactions_new: number | null
        }
        Insert: {
          error_message?: string | null
          id?: string
          status: string
          synced_at?: string | null
          transactions_fetched?: number | null
          transactions_new?: number | null
        }
        Update: {
          error_message?: string | null
          id?: string
          status?: string
          synced_at?: string | null
          transactions_fetched?: number | null
          transactions_new?: number | null
        }
        Relationships: []
      }
      inventory_movements: {
        Row: {
          created_at: string
          distributor_id: string
          id: string
          movement_type: string
          note: string | null
          order_request_id: string | null
          product_id: string
          qty_delta: number
        }
        Insert: {
          created_at?: string
          distributor_id: string
          id?: string
          movement_type: string
          note?: string | null
          order_request_id?: string | null
          product_id: string
          qty_delta: number
        }
        Update: {
          created_at?: string
          distributor_id?: string
          id?: string
          movement_type?: string
          note?: string | null
          order_request_id?: string | null
          product_id?: string
          qty_delta?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_distributor_id_fkey"
            columns: ["distributor_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_order_request_id_fkey"
            columns: ["order_request_id"]
            isOneToOne: false
            referencedRelation: "order_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "inventory_status_distributor_id_fkey"
            columns: ["distributor_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_status_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          client_id: string
          created_at: string
          created_by_user: string
          currency: string
          distributor_id: string
          due_date: string
          file_path: string
          id: string
          invoice_number: string
          last_reminder_at: string | null
          notes: string | null
          paid_at: string | null
          status: Database["public"]["Enums"]["invoice_status_enum"]
          updated_at: string
        }
        Insert: {
          amount: number
          client_id: string
          created_at?: string
          created_by_user: string
          currency?: string
          distributor_id: string
          due_date: string
          file_path: string
          id?: string
          invoice_number: string
          last_reminder_at?: string | null
          notes?: string | null
          paid_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status_enum"]
          updated_at?: string
        }
        Update: {
          amount?: number
          client_id?: string
          created_at?: string
          created_by_user?: string
          currency?: string
          distributor_id?: string
          due_date?: string
          file_path?: string
          id?: string
          invoice_number?: string
          last_reminder_at?: string | null
          notes?: string | null
          paid_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status_enum"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_distributor_id_fkey"
            columns: ["distributor_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_manual_entries: {
        Row: {
          created_at: string
          id: string
          kpi_type: string
          notes: string | null
          product_id: string | null
          recorded_at: string
          recorded_by: string
          value_json: Json | null
          value_numeric: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          kpi_type: string
          notes?: string | null
          product_id?: string | null
          recorded_at?: string
          recorded_by: string
          value_json?: Json | null
          value_numeric?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          kpi_type?: string
          notes?: string | null
          product_id?: string | null
          recorded_at?: string
          recorded_by?: string
          value_json?: Json | null
          value_numeric?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "kpi_manual_entries_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      mindmap_state: {
        Row: {
          edges: Json
          nodes: Json
          updated_at: string
          viewport: Json
          workspace_id: string
        }
        Insert: {
          edges?: Json
          nodes?: Json
          updated_at?: string
          viewport?: Json
          workspace_id: string
        }
        Update: {
          edges?: Json
          nodes?: Json
          updated_at?: string
          viewport?: Json
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mindmap_state_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      order_request_items: {
        Row: {
          cases_qty: number
          created_at: string
          id: string
          order_request_id: string
          price_per_case: number | null
          product_id: string
        }
        Insert: {
          cases_qty: number
          created_at?: string
          id?: string
          order_request_id: string
          price_per_case?: number | null
          product_id: string
        }
        Update: {
          cases_qty?: number
          created_at?: string
          id?: string
          order_request_id?: string
          price_per_case?: number | null
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_request_items_order_request_id_fkey"
            columns: ["order_request_id"]
            isOneToOne: false
            referencedRelation: "order_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_request_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_requests: {
        Row: {
          accepted_at: string | null
          cancelled_at: string | null
          client_id: string | null
          created_at: string
          created_by_user: string
          delivered_at: string | null
          delivery_location: Json | null
          distributor_id: string | null
          estimated_delivery_date: string | null
          estimated_delivery_note: string | null
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
          delivered_at?: string | null
          delivery_location?: Json | null
          distributor_id?: string | null
          estimated_delivery_date?: string | null
          estimated_delivery_note?: string | null
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
          delivered_at?: string | null
          delivery_location?: Json | null
          distributor_id?: string | null
          estimated_delivery_date?: string | null
          estimated_delivery_note?: string | null
          fulfilled_at?: string | null
          id?: string
          notes?: string | null
          partner_id?: string
          rejected_at?: string | null
          status?: Database["public"]["Enums"]["order_status_enum"]
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_requests_distributor_id_fkey"
            columns: ["distributor_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_requests_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          address: string | null
          billing_address: Json | null
          capacity_status: string | null
          client_tier: string | null
          contact_email: string | null
          contact_person: string | null
          contact_phone: string | null
          contact_position: string | null
          country: string | null
          created_at: string
          crm_status: Database["public"]["Enums"]["crm_status_enum"] | null
          google_place_id: string | null
          id: string
          is_mecanova: boolean
          lat: number | null
          lng: number | null
          name: string
          notes: string | null
          partner_type: Database["public"]["Enums"]["partner_type"]
          service_countries: string[] | null
          shipping_address: Json | null
          vat_id: string | null
          venue_type: Database["public"]["Enums"]["venue_type_enum"] | null
          website: string | null
        }
        Insert: {
          address?: string | null
          billing_address?: Json | null
          capacity_status?: string | null
          client_tier?: string | null
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          contact_position?: string | null
          country?: string | null
          created_at?: string
          crm_status?: Database["public"]["Enums"]["crm_status_enum"] | null
          google_place_id?: string | null
          id?: string
          is_mecanova?: boolean
          lat?: number | null
          lng?: number | null
          name: string
          notes?: string | null
          partner_type?: Database["public"]["Enums"]["partner_type"]
          service_countries?: string[] | null
          shipping_address?: Json | null
          vat_id?: string | null
          venue_type?: Database["public"]["Enums"]["venue_type_enum"] | null
          website?: string | null
        }
        Update: {
          address?: string | null
          billing_address?: Json | null
          capacity_status?: string | null
          client_tier?: string | null
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          contact_position?: string | null
          country?: string | null
          created_at?: string
          crm_status?: Database["public"]["Enums"]["crm_status_enum"] | null
          google_place_id?: string | null
          id?: string
          is_mecanova?: boolean
          lat?: number | null
          lng?: number | null
          name?: string
          notes?: string | null
          partner_type?: Database["public"]["Enums"]["partner_type"]
          service_countries?: string[] | null
          shipping_address?: Json | null
          vat_id?: string | null
          venue_type?: Database["public"]["Enums"]["venue_type_enum"] | null
          website?: string | null
        }
        Relationships: []
      }
      pricing_system_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          updated_by: string | null
          value_numeric: number | null
          value_text: string | null
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          updated_by?: string | null
          value_numeric?: number | null
          value_text?: string | null
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          updated_by?: string | null
          value_numeric?: number | null
          value_text?: string | null
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
        Relationships: [
          {
            foreignKeyName: "product_assets_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_pricing_scenarios: {
        Row: {
          breakage_pct: number | null
          calculation_snapshot: Json | null
          client_tier: string | null
          collection_terms_days: number | null
          cost_of_capital_pct: number | null
          created_at: string
          created_by: string
          customs_cases_in_shipment: number | null
          customs_duty_pct: number | null
          customs_processing_eur: number | null
          distributor_fee_per_case: number | null
          dom_logistics_per_case: number | null
          excise_per_case_eur: number | null
          excise_rate_per_hl: number | null
          freight_mode: string | null
          freight_per_case: number | null
          fx_buffer_pct: number | null
          fx_rate_to_eur: number | null
          holding_months: number | null
          hs_code: string | null
          id: string
          import_vat_per_case_eur: number | null
          import_vat_rate: number | null
          insurance_pct: number | null
          labeling_per_case: number | null
          mode: string
          moq_cases: number | null
          name: string
          notes: string | null
          overhead_pct: number | null
          payment_terms_days: number | null
          product_id: string | null
          result_actual_margin_pct: number | null
          result_landed_cost_case: number | null
          result_max_supplier_case: number | null
          result_min_price_case: number | null
          sample_rate_pct: number | null
          supplier_currency: string
          supplier_price_per_case: number | null
          target_margin_pct: number | null
          target_price_per_case: number | null
          updated_at: string
          volume_tiers: Json | null
          warehousing_per_case_mo: number | null
        }
        Insert: {
          breakage_pct?: number | null
          calculation_snapshot?: Json | null
          client_tier?: string | null
          collection_terms_days?: number | null
          cost_of_capital_pct?: number | null
          created_at?: string
          created_by: string
          customs_cases_in_shipment?: number | null
          customs_duty_pct?: number | null
          customs_processing_eur?: number | null
          distributor_fee_per_case?: number | null
          dom_logistics_per_case?: number | null
          excise_per_case_eur?: number | null
          excise_rate_per_hl?: number | null
          freight_mode?: string | null
          freight_per_case?: number | null
          fx_buffer_pct?: number | null
          fx_rate_to_eur?: number | null
          holding_months?: number | null
          hs_code?: string | null
          id?: string
          import_vat_per_case_eur?: number | null
          import_vat_rate?: number | null
          insurance_pct?: number | null
          labeling_per_case?: number | null
          mode?: string
          moq_cases?: number | null
          name: string
          notes?: string | null
          overhead_pct?: number | null
          payment_terms_days?: number | null
          product_id?: string | null
          result_actual_margin_pct?: number | null
          result_landed_cost_case?: number | null
          result_max_supplier_case?: number | null
          result_min_price_case?: number | null
          sample_rate_pct?: number | null
          supplier_currency?: string
          supplier_price_per_case?: number | null
          target_margin_pct?: number | null
          target_price_per_case?: number | null
          updated_at?: string
          volume_tiers?: Json | null
          warehousing_per_case_mo?: number | null
        }
        Update: {
          breakage_pct?: number | null
          calculation_snapshot?: Json | null
          client_tier?: string | null
          collection_terms_days?: number | null
          cost_of_capital_pct?: number | null
          created_at?: string
          created_by?: string
          customs_cases_in_shipment?: number | null
          customs_duty_pct?: number | null
          customs_processing_eur?: number | null
          distributor_fee_per_case?: number | null
          dom_logistics_per_case?: number | null
          excise_per_case_eur?: number | null
          excise_rate_per_hl?: number | null
          freight_mode?: string | null
          freight_per_case?: number | null
          fx_buffer_pct?: number | null
          fx_rate_to_eur?: number | null
          holding_months?: number | null
          hs_code?: string | null
          id?: string
          import_vat_per_case_eur?: number | null
          import_vat_rate?: number | null
          insurance_pct?: number | null
          labeling_per_case?: number | null
          mode?: string
          moq_cases?: number | null
          name?: string
          notes?: string | null
          overhead_pct?: number | null
          payment_terms_days?: number | null
          product_id?: string | null
          result_actual_margin_pct?: number | null
          result_landed_cost_case?: number | null
          result_max_supplier_case?: number | null
          result_min_price_case?: number | null
          sample_rate_pct?: number | null
          supplier_currency?: string
          supplier_price_per_case?: number | null
          target_margin_pct?: number | null
          target_price_per_case?: number | null
          updated_at?: string
          volume_tiers?: Json | null
          warehousing_per_case_mo?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_pricing_scenarios_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          abv: number | null
          active: boolean
          bottles_per_case: number | null
          brand: string | null
          case_size: number | null
          category: Database["public"]["Enums"]["product_category_enum"]
          created_at: string
          description: string | null
          hs_code: string | null
          id: string
          name: string
          size_ml: number | null
          sku: string | null
          supplier_id: string | null
        }
        Insert: {
          abv?: number | null
          active?: boolean
          bottles_per_case?: number | null
          brand?: string | null
          case_size?: number | null
          category?: Database["public"]["Enums"]["product_category_enum"]
          created_at?: string
          description?: string | null
          hs_code?: string | null
          id?: string
          name: string
          size_ml?: number | null
          sku?: string | null
          supplier_id?: string | null
        }
        Update: {
          abv?: number | null
          active?: boolean
          bottles_per_case?: number | null
          brand?: string | null
          case_size?: number | null
          category?: Database["public"]["Enums"]["product_category_enum"]
          created_at?: string
          description?: string | null
          hs_code?: string | null
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
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          partner_id?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          partner_id?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      prospects: {
        Row: {
          address: string | null
          city: string | null
          contact_email: string | null
          contact_person: string | null
          contact_phone: string | null
          contact_position: string | null
          converted_to_partner_id: string | null
          created_at: string
          crm_status: Database["public"]["Enums"]["crm_status_enum"]
          google_place_id: string | null
          id: string
          lat: number | null
          lng: number | null
          name: string
          notes: string | null
          prospect_type: Database["public"]["Enums"]["partner_type"]
          updated_at: string
          venue_type: Database["public"]["Enums"]["venue_type_enum"] | null
          website: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          contact_position?: string | null
          converted_to_partner_id?: string | null
          created_at?: string
          crm_status?: Database["public"]["Enums"]["crm_status_enum"]
          google_place_id?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          notes?: string | null
          prospect_type?: Database["public"]["Enums"]["partner_type"]
          updated_at?: string
          venue_type?: Database["public"]["Enums"]["venue_type_enum"] | null
          website?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          contact_position?: string | null
          converted_to_partner_id?: string | null
          created_at?: string
          crm_status?: Database["public"]["Enums"]["crm_status_enum"]
          google_place_id?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          notes?: string | null
          prospect_type?: Database["public"]["Enums"]["partner_type"]
          updated_at?: string
          venue_type?: Database["public"]["Enums"]["venue_type_enum"] | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prospects_converted_to_partner_id_fkey"
            columns: ["converted_to_partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      research_sessions: {
        Row: {
          admin_user_id: string
          created_at: string
          id: string
          query: string
          result_count: number
          results: Json
          template_used: string | null
        }
        Insert: {
          admin_user_id: string
          created_at?: string
          id?: string
          query: string
          result_count?: number
          results?: Json
          template_used?: string | null
        }
        Update: {
          admin_user_id?: string
          created_at?: string
          id?: string
          query?: string
          result_count?: number
          results?: Json
          template_used?: string | null
        }
        Relationships: []
      }
      status_templates: {
        Row: {
          created_at: string
          id: string
          name: string
          statuses: Json
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          statuses?: Json
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          statuses?: Json
        }
        Relationships: []
      }
      statuses: {
        Row: {
          color: string
          id: string
          is_terminal: boolean
          name: string
          order_index: number
          slug: string
          workspace_id: string
        }
        Insert: {
          color?: string
          id?: string
          is_terminal?: boolean
          name: string
          order_index?: number
          slug: string
          workspace_id: string
        }
        Update: {
          color?: string
          id?: string
          is_terminal?: boolean
          name?: string
          order_index?: number
          slug?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "statuses_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transfers: {
        Row: {
          arrived_at: string | null
          cases_qty: number
          created_at: string
          expected_arrival_date: string | null
          from_dist_id: string
          id: string
          logistics_cost_eur: number | null
          notes: string | null
          product_id: string
          status: string
          to_dist_id: string
          transport_method: string
          transport_note: string | null
        }
        Insert: {
          arrived_at?: string | null
          cases_qty: number
          created_at?: string
          expected_arrival_date?: string | null
          from_dist_id: string
          id?: string
          logistics_cost_eur?: number | null
          notes?: string | null
          product_id: string
          status?: string
          to_dist_id: string
          transport_method?: string
          transport_note?: string | null
        }
        Update: {
          arrived_at?: string | null
          cases_qty?: number
          created_at?: string
          expected_arrival_date?: string | null
          from_dist_id?: string
          id?: string
          logistics_cost_eur?: number | null
          notes?: string | null
          product_id?: string
          status?: string
          to_dist_id?: string
          transport_method?: string
          transport_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_transfers_from_dist_id_fkey"
            columns: ["from_dist_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_to_dist_id_fkey"
            columns: ["to_dist_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      supply_orders: {
        Row: {
          arrived_at: string | null
          cases_ordered: number
          created_at: string
          distributor_id: string | null
          expected_arrival_date: string | null
          id: string
          notes: string | null
          product_id: string
          status: string
          supplier_id: string
          unit_cost_eur: number | null
        }
        Insert: {
          arrived_at?: string | null
          cases_ordered: number
          created_at?: string
          distributor_id?: string | null
          expected_arrival_date?: string | null
          id?: string
          notes?: string | null
          product_id: string
          status?: string
          supplier_id: string
          unit_cost_eur?: number | null
        }
        Update: {
          arrived_at?: string | null
          cases_ordered?: number
          created_at?: string
          distributor_id?: string | null
          expected_arrival_date?: string | null
          id?: string
          notes?: string | null
          product_id?: string
          status?: string
          supplier_id?: string
          unit_cost_eur?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "supply_orders_distributor_id_fkey"
            columns: ["distributor_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supply_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supply_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assignee: string
          context: string
          created_at: string
          description: string
          due_date: string | null
          id: string
          notes: string
          order_index: number
          parent_id: string | null
          priority: Database["public"]["Enums"]["todo_task_priority"]
          start_date: string | null
          status_id: string | null
          tags: string[]
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          assignee?: string
          context?: string
          created_at?: string
          description?: string
          due_date?: string | null
          id?: string
          notes?: string
          order_index?: number
          parent_id?: string | null
          priority?: Database["public"]["Enums"]["todo_task_priority"]
          start_date?: string | null
          status_id?: string | null
          tags?: string[]
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          assignee?: string
          context?: string
          created_at?: string
          description?: string
          due_date?: string | null
          id?: string
          notes?: string
          order_index?: number
          parent_id?: string | null
          priority?: Database["public"]["Enums"]["todo_task_priority"]
          start_date?: string | null
          status_id?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "statuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      todo_connections: {
        Row: {
          animated: boolean
          created_at: string
          id: string
          label: string | null
          source_node_id: string
          target_node_id: string
          view_id: string
        }
        Insert: {
          animated?: boolean
          created_at?: string
          id?: string
          label?: string | null
          source_node_id: string
          target_node_id: string
          view_id: string
        }
        Update: {
          animated?: boolean
          created_at?: string
          id?: string
          label?: string | null
          source_node_id?: string
          target_node_id?: string
          view_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "todo_connections_source_node_id_fkey"
            columns: ["source_node_id"]
            isOneToOne: false
            referencedRelation: "todo_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "todo_connections_target_node_id_fkey"
            columns: ["target_node_id"]
            isOneToOne: false
            referencedRelation: "todo_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "todo_connections_view_id_fkey"
            columns: ["view_id"]
            isOneToOne: false
            referencedRelation: "todo_views"
            referencedColumns: ["id"]
          },
        ]
      }
      todo_nodes: {
        Row: {
          color: string | null
          created_at: string
          data: Json
          id: string
          label: string
          linked_task_id: string | null
          node_type: Database["public"]["Enums"]["todo_node_type"]
          position_x: number
          position_y: number
          view_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          data?: Json
          id?: string
          label: string
          linked_task_id?: string | null
          node_type?: Database["public"]["Enums"]["todo_node_type"]
          position_x?: number
          position_y?: number
          view_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          data?: Json
          id?: string
          label?: string
          linked_task_id?: string | null
          node_type?: Database["public"]["Enums"]["todo_node_type"]
          position_x?: number
          position_y?: number
          view_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "todo_nodes_linked_task_id_fkey"
            columns: ["linked_task_id"]
            isOneToOne: false
            referencedRelation: "todo_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "todo_nodes_view_id_fkey"
            columns: ["view_id"]
            isOneToOne: false
            referencedRelation: "todo_views"
            referencedColumns: ["id"]
          },
        ]
      }
      todo_sections: {
        Row: {
          archived_at: string | null
          color: string
          created_at: string
          created_by: string | null
          icon: string | null
          id: string
          name: string
          position: number
        }
        Insert: {
          archived_at?: string | null
          color?: string
          created_at?: string
          created_by?: string | null
          icon?: string | null
          id?: string
          name: string
          position?: number
        }
        Update: {
          archived_at?: string | null
          color?: string
          created_at?: string
          created_by?: string | null
          icon?: string | null
          id?: string
          name?: string
          position?: number
        }
        Relationships: []
      }
      todo_subtasks: {
        Row: {
          completed: boolean
          description: string | null
          due_date: string | null
          id: string
          order_index: number
          parent_subtask_id: string | null
          priority: Database["public"]["Enums"]["todo_task_priority"] | null
          status: Database["public"]["Enums"]["todo_task_status"]
          tags: string[] | null
          task_id: string
          title: string
        }
        Insert: {
          completed?: boolean
          description?: string | null
          due_date?: string | null
          id?: string
          order_index?: number
          parent_subtask_id?: string | null
          priority?: Database["public"]["Enums"]["todo_task_priority"] | null
          status?: Database["public"]["Enums"]["todo_task_status"]
          tags?: string[] | null
          task_id: string
          title: string
        }
        Update: {
          completed?: boolean
          description?: string | null
          due_date?: string | null
          id?: string
          order_index?: number
          parent_subtask_id?: string | null
          priority?: Database["public"]["Enums"]["todo_task_priority"] | null
          status?: Database["public"]["Enums"]["todo_task_status"]
          tags?: string[] | null
          task_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "todo_subtasks_parent_subtask_id_fkey"
            columns: ["parent_subtask_id"]
            isOneToOne: false
            referencedRelation: "todo_subtasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "todo_subtasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "todo_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      todo_tasks: {
        Row: {
          blocked_by_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          linked_order_id: string | null
          linked_partner_id: string | null
          order_index: number
          owner_id: string | null
          priority: Database["public"]["Enums"]["todo_task_priority"]
          section_id: string | null
          status: Database["public"]["Enums"]["todo_task_status"]
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          blocked_by_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          linked_order_id?: string | null
          linked_partner_id?: string | null
          order_index?: number
          owner_id?: string | null
          priority?: Database["public"]["Enums"]["todo_task_priority"]
          section_id?: string | null
          status?: Database["public"]["Enums"]["todo_task_status"]
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          blocked_by_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          linked_order_id?: string | null
          linked_partner_id?: string | null
          order_index?: number
          owner_id?: string | null
          priority?: Database["public"]["Enums"]["todo_task_priority"]
          section_id?: string | null
          status?: Database["public"]["Enums"]["todo_task_status"]
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "todo_tasks_blocked_by_id_fkey"
            columns: ["blocked_by_id"]
            isOneToOne: false
            referencedRelation: "todo_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "todo_tasks_linked_order_id_fkey"
            columns: ["linked_order_id"]
            isOneToOne: false
            referencedRelation: "order_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "todo_tasks_linked_partner_id_fkey"
            columns: ["linked_partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "todo_tasks_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "todo_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      todo_view_modules: {
        Row: {
          config: Json
          created_at: string
          id: string
          module_type: Database["public"]["Enums"]["todo_module_type"]
          order_index: number
          title: string | null
          view_id: string
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          module_type: Database["public"]["Enums"]["todo_module_type"]
          order_index?: number
          title?: string | null
          view_id: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          module_type?: Database["public"]["Enums"]["todo_module_type"]
          order_index?: number
          title?: string | null
          view_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "todo_view_modules_view_id_fkey"
            columns: ["view_id"]
            isOneToOne: false
            referencedRelation: "todo_views"
            referencedColumns: ["id"]
          },
        ]
      }
      todo_views: {
        Row: {
          created_at: string
          created_by: string | null
          filter_config: Json
          id: string
          layout_config: Json
          name: string
          position: number
          section_id: string
          view_type: Database["public"]["Enums"]["todo_view_type"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          filter_config?: Json
          id?: string
          layout_config?: Json
          name: string
          position?: number
          section_id: string
          view_type?: Database["public"]["Enums"]["todo_view_type"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          filter_config?: Json
          id?: string
          layout_config?: Json
          name?: string
          position?: number
          section_id?: string
          view_type?: Database["public"]["Enums"]["todo_view_type"]
        }
        Relationships: [
          {
            foreignKeyName: "todo_views_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "todo_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          color: string
          created_at: string
          description: string
          icon: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string
          icon?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          description?: string
          icon?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_order: { Args: { p_order_id: string }; Returns: undefined }
      adjust_inventory: {
        Args: {
          p_movement_type: string
          p_note?: string
          p_product_id: string
          p_qty_delta: number
        }
        Returns: undefined
      }
      cancel_order: { Args: { p_order_id: string }; Returns: undefined }
      create_order: { Args: { p_distributor_id: string }; Returns: string }
      current_partner_id: { Args: never; Returns: string }
      current_role: { Args: never; Returns: string }
      deliver_order: { Args: { p_order_id: string }; Returns: undefined }
      fulfill_order: { Args: { p_order_id: string }; Returns: undefined }
      get_order_client_info: { Args: { p_order_id: string }; Returns: Json }
      is_admin: { Args: never; Returns: boolean }
      mecanova_current_partner_id: { Args: never; Returns: string }
      mecanova_current_role: { Args: never; Returns: string }
      mecanova_is_admin: { Args: never; Returns: boolean }
      reject_order: { Args: { p_order_id: string }; Returns: undefined }
      send_invoice_reminder: {
        Args: { p_invoice_id: string }
        Returns: undefined
      }
      submit_order: { Args: { p_order_id: string }; Returns: undefined }
    }
    Enums: {
      crm_interaction_type_enum: "email" | "call" | "meeting" | "note" | "file"
      crm_status_enum:
        | "uncontacted"
        | "contacted"
        | "negotiating"
        | "customer"
        | "inactive"
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
      inventory_status_enum: "in_stock" | "out"
      invoice_status_enum: "sent" | "paid" | "overdue"
      order_status_enum:
        | "submitted"
        | "confirmed"
        | "rejected"
        | "shipped"
        | "closed"
        | "created"
        | "accepted"
        | "fulfilled"
        | "cancelled"
        | "delivered"
      partner_type: "client" | "distributor" | "supplier"
      product_asset_type_enum:
        | "bottle_shot"
        | "label_pdf"
        | "spec_sheet"
        | "brand_deck"
      product_category_enum: "tequila" | "mezcal" | "raicilla" | "other"
      todo_module_type:
        | "task_list"
        | "kanban"
        | "notes"
        | "contacts"
        | "documents"
        | "mind_map"
      todo_node_type:
        | "idea"
        | "task_link"
        | "process_step"
        | "group"
        | "note"
        | "decision"
      todo_task_priority: "low" | "medium" | "high" | "urgent"
      todo_task_status:
        | "todo"
        | "in_progress"
        | "blocked"
        | "done"
        | "cancelled"
      todo_view_type: "list" | "board" | "mind_map" | "process_map" | "mixed"
      user_role: "admin" | "partner" | "client" | "distributor"
      venue_type_enum:
        | "bar"
        | "restaurant"
        | "hotel"
        | "wholesaler"
        | "private_customer"
        | "other"
        | "club"
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
      crm_interaction_type_enum: ["email", "call", "meeting", "note", "file"],
      crm_status_enum: [
        "uncontacted",
        "contacted",
        "negotiating",
        "customer",
        "inactive",
      ],
      document_audience_enum: ["all", "distributor", "client", "internal"],
      document_type_enum: [
        "invoice",
        "delivery_note",
        "compliance",
        "price_list",
        "marketing",
        "presentation",
        "fact_sheet",
        "brand_deck",
        "spec_sheet",
      ],
      inventory_status_enum: ["in_stock", "out"],
      invoice_status_enum: ["sent", "paid", "overdue"],
      order_status_enum: [
        "submitted",
        "confirmed",
        "rejected",
        "shipped",
        "closed",
        "created",
        "accepted",
        "fulfilled",
        "cancelled",
        "delivered",
      ],
      partner_type: ["client", "distributor", "supplier"],
      product_asset_type_enum: [
        "bottle_shot",
        "label_pdf",
        "spec_sheet",
        "brand_deck",
      ],
      product_category_enum: ["tequila", "mezcal", "raicilla", "other"],
      todo_module_type: [
        "task_list",
        "kanban",
        "notes",
        "contacts",
        "documents",
        "mind_map",
      ],
      todo_node_type: [
        "idea",
        "task_link",
        "process_step",
        "group",
        "note",
        "decision",
      ],
      todo_task_priority: ["low", "medium", "high", "urgent"],
      todo_task_status: ["todo", "in_progress", "blocked", "done", "cancelled"],
      todo_view_type: ["list", "board", "mind_map", "process_map", "mixed"],
      user_role: ["admin", "partner", "client", "distributor"],
      venue_type_enum: [
        "bar",
        "restaurant",
        "hotel",
        "wholesaler",
        "private_customer",
        "other",
        "club",
      ],
    },
  },
} as const

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

export type Prospect = Tables<"prospects">
export type CRMInteraction = Tables<"crm_interactions">

export type CRMStatus = Enums<"crm_status_enum">
export type VenueType = Enums<"venue_type_enum">
export type CRMInteractionType = Enums<"crm_interaction_type_enum">

export type UserRole = Enums<"user_role">
export type OrderStatus = Enums<"order_status_enum">
export type PartnerType = Enums<"partner_type">
export type ProductCategory = Enums<"product_category_enum">
export type DocumentType = Enums<"document_type_enum">
export type DocumentAudience = Enums<"document_audience_enum">
export type InventoryStatusEnum = Enums<"inventory_status_enum">
export type ProductAssetType = Enums<"product_asset_type_enum">
export type InvoiceStatus = Enums<"invoice_status_enum">
export type Invoice = Tables<"invoices">
export type KPIManualEntry = Tables<"kpi_manual_entries">

// ── Pricing calculator ───────────────────────────────────────────────

export type PricingMode = "cost_up" | "price_down"
export type SupplierCurrency = "EUR" | "USD" | "MXN"
export type FreightMode = "sea" | "air" | "land"

export interface VolumeTier {
  from_cases: number
  to_cases: number | null        // null = unlimited
  supplier_price: number         // per case in supplier currency
  result_min_price?: number
  result_margin_pct?: number
  result_max_supplier?: number
}

export interface PricingInputs {
  productId: string
  mode: PricingMode

  // Supplier
  supplierCurrency: SupplierCurrency
  fxUsdEur: number
  fxMxnEur: number
  fxBufferPct: number
  supplierPricePerCase: number
  orderCases: number
  moqCases: number | null

  // Freight
  localTransportEur: number
  localTransportCurrency: SupplierCurrency
  internationalFreightEur: number
  internationalFreightCurrency: SupplierCurrency
  freightMode: FreightMode
  insurancePct: number
  breakagePct: number

  // Import duties
  hsCode: string
  customsDutyPct: number

  // Excise (read-only in UI, derived from product + rate)
  exciseRatePerHl: number

  // VAT
  importVatRate: number

  // Domestic
  domLogisticsTotal: number
  warehousingPerCaseMo: number
  holdingMonths: number
  distributorFeeMode: "per_case" | "per_bottle" | "total"
  distributorFeeAmount: number

  // Compliance
  labelingPerBottle: number
  sampleRatePct: number
  overheadPct: number

  // Targets
  targetMarginPct: number
  targetPricePerCase: number
  clientTier: string

  // Volume tiers
  volumeTiers: VolumeTier[]
}

export interface PricingResult {
  // Per-case breakdown (EUR)
  supplierPriceEur: number
  fxBufferCost: number
  freightAndInsurance: number
  breakageCost: number
  customsDuty: number
  excisePerCase: number
  importVat: number
  domLogistics: number
  warehousing: number
  distributorFee: number
  labeling: number
  sampleAllocation: number
  overhead: number

  // Totals
  totalLandedCostPerCase: number
  totalLandedCostPerBottle: number

  // Cost-up result
  marginAmount: number
  minSellingPricePerCase: number
  minSellingPricePerBottle: number
  actualMarginPct: number

  // Price-down result
  maxSupplierPriceEur: number
  maxSupplierPriceOrigCurrency: number

  // Per-tier results
  tierResults: VolumeTier[]
}

export interface PricingSystemSetting {
  key: string
  value_numeric: number | null
  value_text: string | null
  description: string | null
  updated_at: string
  updated_by: string | null
}
