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
      audit_logs: {
        Row: {
          action_type: string
          actor_role: Database["public"]["Enums"]["app_role"] | null
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          meta: Json | null
          new_value: Json | null
          old_value: Json | null
        }
        Insert: {
          action_type: string
          actor_role?: Database["public"]["Enums"]["app_role"] | null
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          meta?: Json | null
          new_value?: Json | null
          old_value?: Json | null
        }
        Update: {
          action_type?: string
          actor_role?: Database["public"]["Enums"]["app_role"] | null
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          meta?: Json | null
          new_value?: Json | null
          old_value?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      bre_lender_rules: {
        Row: {
          basic_info: Json
          change_summary: string | null
          collateral_ltv: Json
          commercials: Json
          coverage: Json
          created_at: string
          created_by: string | null
          hard_thresholds: Json
          id: string
          is_active: boolean
          lender_id: string
          loan_caps: Json
          policy: Json
          version_number: number
        }
        Insert: {
          basic_info?: Json
          change_summary?: string | null
          collateral_ltv?: Json
          commercials?: Json
          coverage?: Json
          created_at?: string
          created_by?: string | null
          hard_thresholds?: Json
          id?: string
          is_active?: boolean
          lender_id: string
          loan_caps?: Json
          policy?: Json
          version_number: number
        }
        Update: {
          basic_info?: Json
          change_summary?: string | null
          collateral_ltv?: Json
          commercials?: Json
          coverage?: Json
          created_at?: string
          created_by?: string | null
          hard_thresholds?: Json
          id?: string
          is_active?: boolean
          lender_id?: string
          loan_caps?: Json
          policy?: Json
          version_number?: number
        }
        Relationships: []
      }
      bre_scoring_configs: {
        Row: {
          bucket_threshold: number
          change_summary: string | null
          coapplicant_params: Json
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          overall_band_mapping: Json
          student_params: Json
          university_params: Json
          version_number: number
        }
        Insert: {
          bucket_threshold?: number
          change_summary?: string | null
          coapplicant_params?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          overall_band_mapping?: Json
          student_params?: Json
          university_params?: Json
          version_number: number
        }
        Update: {
          bucket_threshold?: number
          change_summary?: string | null
          coapplicant_params?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          overall_band_mapping?: Json
          student_params?: Json
          university_params?: Json
          version_number?: number
        }
        Relationships: []
      }
      bre_simulation_runs: {
        Row: {
          id: string
          lender_rule_versions_used: Json | null
          profile_input: Json
          result: Json
          run_at: string
          run_by: string | null
          saved_name: string | null
          scoring_config_id: string | null
          scoring_config_snapshot: Json | null
          scoring_config_version: number
        }
        Insert: {
          id?: string
          lender_rule_versions_used?: Json | null
          profile_input: Json
          result: Json
          run_at?: string
          run_by?: string | null
          saved_name?: string | null
          scoring_config_id?: string | null
          scoring_config_snapshot?: Json | null
          scoring_config_version: number
        }
        Update: {
          id?: string
          lender_rule_versions_used?: Json | null
          profile_input?: Json
          result?: Json
          run_at?: string
          run_by?: string | null
          saved_name?: string | null
          scoring_config_id?: string | null
          scoring_config_snapshot?: Json | null
          scoring_config_version?: number
        }
        Relationships: []
      }
      bulk_upload_batches: {
        Row: {
          batch_id: string | null
          batch_status: Database["public"]["Enums"]["bulk_upload_status_enum"]
          failed_rows: number
          file_name: string
          file_url: string | null
          id: string
          partner_id: string
          processed_at: string | null
          success_rows: number
          total_rows: number
          uploaded_at: string
          uploaded_by: string
        }
        Insert: {
          batch_id?: string | null
          batch_status?: Database["public"]["Enums"]["bulk_upload_status_enum"]
          failed_rows?: number
          file_name: string
          file_url?: string | null
          id?: string
          partner_id: string
          processed_at?: string | null
          success_rows?: number
          total_rows?: number
          uploaded_at?: string
          uploaded_by: string
        }
        Update: {
          batch_id?: string | null
          batch_status?: Database["public"]["Enums"]["bulk_upload_status_enum"]
          failed_rows?: number
          file_name?: string
          file_url?: string | null
          id?: string
          partner_id?: string
          processed_at?: string | null
          success_rows?: number
          total_rows?: number
          uploaded_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "bulk_upload_batches_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bulk_upload_batches_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      bulk_upload_row_results: {
        Row: {
          batch_id: string
          created_at: string
          created_lead_id: string | null
          failure_reason: string | null
          id: string
          raw_payload: Json | null
          row_number: number
          validation_status: string
        }
        Insert: {
          batch_id: string
          created_at?: string
          created_lead_id?: string | null
          failure_reason?: string | null
          id?: string
          raw_payload?: Json | null
          row_number: number
          validation_status?: string
        }
        Update: {
          batch_id?: string
          created_at?: string
          created_lead_id?: string | null
          failure_reason?: string | null
          id?: string
          raw_payload?: Json | null
          row_number?: number
          validation_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "bulk_upload_row_results_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "bulk_upload_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bulk_upload_row_results_created_lead_id_fkey"
            columns: ["created_lead_id"]
            isOneToOne: false
            referencedRelation: "student_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_logs: {
        Row: {
          channel: string
          created_at: string
          error_message: string | null
          id: string
          lead_id: string | null
          mode_used: string
          payload_snapshot: Json
          provider: string
          provider_message_id: string | null
          recipient: string
          send_status: string
          template_key: string
          triggered_by_user: string | null
        }
        Insert: {
          channel: string
          created_at?: string
          error_message?: string | null
          id?: string
          lead_id?: string | null
          mode_used: string
          payload_snapshot?: Json
          provider: string
          provider_message_id?: string | null
          recipient: string
          send_status: string
          template_key: string
          triggered_by_user?: string | null
        }
        Update: {
          channel?: string
          created_at?: string
          error_message?: string | null
          id?: string
          lead_id?: string | null
          mode_used?: string
          payload_snapshot?: Json
          provider?: string
          provider_message_id?: string | null
          recipient?: string
          send_status?: string
          template_key?: string
          triggered_by_user?: string | null
        }
        Relationships: []
      }
      communication_templates: {
        Row: {
          active_flag: boolean
          body: string
          channel: string
          created_at: string
          description: string | null
          id: string
          subject: string | null
          template_key: string
          updated_at: string
        }
        Insert: {
          active_flag?: boolean
          body: string
          channel: string
          created_at?: string
          description?: string | null
          id?: string
          subject?: string | null
          template_key: string
          updated_at?: string
        }
        Update: {
          active_flag?: boolean
          body?: string
          channel?: string
          created_at?: string
          description?: string | null
          id?: string
          subject?: string | null
          template_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      countries_master: {
        Row: {
          active_flag: boolean
          country_name: string
          created_at: string
          id: string
          iso_code: string | null
          updated_at: string
        }
        Insert: {
          active_flag?: boolean
          country_name: string
          created_at?: string
          id?: string
          iso_code?: string | null
          updated_at?: string
        }
        Update: {
          active_flag?: boolean
          country_name?: string
          created_at?: string
          id?: string
          iso_code?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      country_aliases: {
        Row: {
          alias_lower: string
          canonical_name: string
          created_at: string
        }
        Insert: {
          alias_lower: string
          canonical_name: string
          created_at?: string
        }
        Update: {
          alias_lower?: string
          canonical_name?: string
          created_at?: string
        }
        Relationships: []
      }
      courses_master: {
        Row: {
          active_flag: boolean
          course_category: string | null
          course_name: string
          created_at: string
          id: string
          management_flag: boolean
          mba_flag: boolean
          normalized_course_name: string | null
          stem_flag: boolean
          updated_at: string
        }
        Insert: {
          active_flag?: boolean
          course_category?: string | null
          course_name: string
          created_at?: string
          id?: string
          management_flag?: boolean
          mba_flag?: boolean
          normalized_course_name?: string | null
          stem_flag?: boolean
          updated_at?: string
        }
        Update: {
          active_flag?: boolean
          course_category?: string | null
          course_name?: string
          created_at?: string
          id?: string
          management_flag?: boolean
          mba_flag?: boolean
          normalized_course_name?: string | null
          stem_flag?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      document_master: {
        Row: {
          active_flag: boolean
          applicable_for: string
          created_at: string
          description: string | null
          document_category: string | null
          document_code: string
          document_name: string
          id: string
          mandatory_flag: boolean
          updated_at: string
        }
        Insert: {
          active_flag?: boolean
          applicable_for?: string
          created_at?: string
          description?: string | null
          document_category?: string | null
          document_code: string
          document_name: string
          id?: string
          mandatory_flag?: boolean
          updated_at?: string
        }
        Update: {
          active_flag?: boolean
          applicable_for?: string
          created_at?: string
          description?: string | null
          document_category?: string | null
          document_code?: string
          document_name?: string
          id?: string
          mandatory_flag?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      employment_type_master: {
        Row: {
          active_flag: boolean
          created_at: string
          employment_type_label: string
          id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active_flag?: boolean
          created_at?: string
          employment_type_label: string
          id?: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active_flag?: boolean
          created_at?: string
          employment_type_label?: string
          id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      highest_qualification_master: {
        Row: {
          active_flag: boolean
          created_at: string
          id: string
          qualification_label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active_flag?: boolean
          created_at?: string
          id?: string
          qualification_label: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active_flag?: boolean
          created_at?: string
          id?: string
          qualification_label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      intake_master: {
        Row: {
          active_flag: boolean
          created_at: string
          id: string
          intake_term: string
          intake_year: number
          sort_order: number
        }
        Insert: {
          active_flag?: boolean
          created_at?: string
          id?: string
          intake_term: string
          intake_year: number
          sort_order?: number
        }
        Update: {
          active_flag?: boolean
          created_at?: string
          id?: string
          intake_term?: string
          intake_year?: number
          sort_order?: number
        }
        Relationships: []
      }
      lead_document_requirements: {
        Row: {
          created_at: string
          document_type_id: string
          due_date: string | null
          id: string
          lead_id: string
          lender_id: string | null
          remarks: string | null
          required_flag: boolean
          status: Database["public"]["Enums"]["document_status_enum"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          document_type_id: string
          due_date?: string | null
          id?: string
          lead_id: string
          lender_id?: string | null
          remarks?: string | null
          required_flag?: boolean
          status?: Database["public"]["Enums"]["document_status_enum"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          document_type_id?: string
          due_date?: string | null
          id?: string
          lead_id?: string
          lender_id?: string | null
          remarks?: string | null
          required_flag?: boolean
          status?: Database["public"]["Enums"]["document_status_enum"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_document_requirements_document_type_id_fkey"
            columns: ["document_type_id"]
            isOneToOne: false
            referencedRelation: "document_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_document_requirements_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "student_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_document_requirements_lender_id_fkey"
            columns: ["lender_id"]
            isOneToOne: false
            referencedRelation: "lenders"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_documents: {
        Row: {
          document_type_id: string | null
          file_name: string
          file_url: string | null
          id: string
          is_latest: boolean
          lead_id: string
          mime_type: string | null
          storage_path: string | null
          uploaded_at: string
          uploaded_by_role: Database["public"]["Enums"]["app_role"] | null
          uploaded_by_user_id: string | null
          validation_result: Json | null
          verification_remark: string | null
          verification_status: Database["public"]["Enums"]["document_status_enum"]
          verified_at: string | null
          verified_by: string | null
          version_number: number
        }
        Insert: {
          document_type_id?: string | null
          file_name: string
          file_url?: string | null
          id?: string
          is_latest?: boolean
          lead_id: string
          mime_type?: string | null
          storage_path?: string | null
          uploaded_at?: string
          uploaded_by_role?: Database["public"]["Enums"]["app_role"] | null
          uploaded_by_user_id?: string | null
          validation_result?: Json | null
          verification_remark?: string | null
          verification_status?: Database["public"]["Enums"]["document_status_enum"]
          verified_at?: string | null
          verified_by?: string | null
          version_number?: number
        }
        Update: {
          document_type_id?: string | null
          file_name?: string
          file_url?: string | null
          id?: string
          is_latest?: boolean
          lead_id?: string
          mime_type?: string | null
          storage_path?: string | null
          uploaded_at?: string
          uploaded_by_role?: Database["public"]["Enums"]["app_role"] | null
          uploaded_by_user_id?: string | null
          validation_result?: Json | null
          verification_remark?: string | null
          verification_status?: Database["public"]["Enums"]["document_status_enum"]
          verified_at?: string | null
          verified_by?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "lead_documents_document_type_id_fkey"
            columns: ["document_type_id"]
            isOneToOne: false
            referencedRelation: "document_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_documents_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "student_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_documents_uploaded_by_user_id_fkey"
            columns: ["uploaded_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_documents_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_edit_requests: {
        Row: {
          admin_decision_note: string | null
          applied_at: string | null
          applied_changes: Json | null
          created_at: string
          decided_at: string | null
          decided_by_user_id: string | null
          id: string
          lead_id: string
          partner_id: string
          partner_reason: string | null
          requested_by_user_id: string
          requested_changes: Json
          status: string
          updated_at: string
        }
        Insert: {
          admin_decision_note?: string | null
          applied_at?: string | null
          applied_changes?: Json | null
          created_at?: string
          decided_at?: string | null
          decided_by_user_id?: string | null
          id?: string
          lead_id: string
          partner_id: string
          partner_reason?: string | null
          requested_by_user_id: string
          requested_changes?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          admin_decision_note?: string | null
          applied_at?: string | null
          applied_changes?: Json | null
          created_at?: string
          decided_at?: string | null
          decided_by_user_id?: string | null
          id?: string
          lead_id?: string
          partner_id?: string
          partner_reason?: string | null
          requested_by_user_id?: string
          requested_changes?: Json
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      lead_lender_matches: {
        Row: {
          bre_output_json: Json | null
          fit_category: Database["public"]["Enums"]["fit_category_enum"] | null
          generated_at: string
          id: string
          lead_id: string
          lender_id: string
          lock_status: boolean
          recommendation_rank: number | null
          recommendation_reason_summary: string | null
          score: number | null
        }
        Insert: {
          bre_output_json?: Json | null
          fit_category?: Database["public"]["Enums"]["fit_category_enum"] | null
          generated_at?: string
          id?: string
          lead_id: string
          lender_id: string
          lock_status?: boolean
          recommendation_rank?: number | null
          recommendation_reason_summary?: string | null
          score?: number | null
        }
        Update: {
          bre_output_json?: Json | null
          fit_category?: Database["public"]["Enums"]["fit_category_enum"] | null
          generated_at?: string
          id?: string
          lead_id?: string
          lender_id?: string
          lock_status?: boolean
          recommendation_rank?: number | null
          recommendation_reason_summary?: string | null
          score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_lender_matches_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "student_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_lender_matches_lender_id_fkey"
            columns: ["lender_id"]
            isOneToOne: false
            referencedRelation: "lenders"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_notes: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          lead_id: string
          note_text: string
          note_type: Database["public"]["Enums"]["note_type_enum"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id: string
          note_text: string
          note_type?: Database["public"]["Enums"]["note_type_enum"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id?: string
          note_text?: string
          note_type?: Database["public"]["Enums"]["note_type_enum"]
        }
        Relationships: [
          {
            foreignKeyName: "lead_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_notes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "student_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_stage_history: {
        Row: {
          change_reason: string | null
          changed_by_role: Database["public"]["Enums"]["app_role"] | null
          changed_by_user_id: string | null
          created_at: string
          id: string
          internal_note: string | null
          lead_id: string
          new_stage: Database["public"]["Enums"]["lead_stage_enum"]
          new_status: Database["public"]["Enums"]["lead_status_enum"]
          partner_visible_note: string | null
          previous_stage: Database["public"]["Enums"]["lead_stage_enum"] | null
          previous_status:
            | Database["public"]["Enums"]["lead_status_enum"]
            | null
        }
        Insert: {
          change_reason?: string | null
          changed_by_role?: Database["public"]["Enums"]["app_role"] | null
          changed_by_user_id?: string | null
          created_at?: string
          id?: string
          internal_note?: string | null
          lead_id: string
          new_stage: Database["public"]["Enums"]["lead_stage_enum"]
          new_status: Database["public"]["Enums"]["lead_status_enum"]
          partner_visible_note?: string | null
          previous_stage?: Database["public"]["Enums"]["lead_stage_enum"] | null
          previous_status?:
            | Database["public"]["Enums"]["lead_status_enum"]
            | null
        }
        Update: {
          change_reason?: string | null
          changed_by_role?: Database["public"]["Enums"]["app_role"] | null
          changed_by_user_id?: string | null
          created_at?: string
          id?: string
          internal_note?: string | null
          lead_id?: string
          new_stage?: Database["public"]["Enums"]["lead_stage_enum"]
          new_status?: Database["public"]["Enums"]["lead_status_enum"]
          partner_visible_note?: string | null
          previous_stage?: Database["public"]["Enums"]["lead_stage_enum"] | null
          previous_status?:
            | Database["public"]["Enums"]["lead_status_enum"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_stage_history_changed_by_user_id_fkey"
            columns: ["changed_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_stage_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "student_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lender_premiere_audit: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          file_name: string | null
          id: string
          lender_id: string
          list_version: number | null
          meta: Json
          row_count: number | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          file_name?: string | null
          id?: string
          lender_id: string
          list_version?: number | null
          meta?: Json
          row_count?: number | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          file_name?: string | null
          id?: string
          lender_id?: string
          list_version?: number | null
          meta?: Json
          row_count?: number | null
        }
        Relationships: []
      }
      lender_premiere_colleges: {
        Row: {
          city: string | null
          college_name_normalized: string
          college_name_raw: string
          country_normalized: string
          country_raw: string
          effective_from: string | null
          effective_to: string | null
          id: string
          is_current: boolean
          lender_id: string
          list_version: number
          notes: string | null
          source_file_name: string | null
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          city?: string | null
          college_name_normalized: string
          college_name_raw: string
          country_normalized: string
          country_raw: string
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          is_current?: boolean
          lender_id: string
          list_version: number
          notes?: string | null
          source_file_name?: string | null
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          city?: string | null
          college_name_normalized?: string
          college_name_raw?: string
          country_normalized?: string
          country_raw?: string
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          is_current?: boolean
          lender_id?: string
          list_version?: number
          notes?: string | null
          source_file_name?: string | null
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      lender_university_mappings: {
        Row: {
          active_flag: boolean
          created_at: string
          id: string
          lender_id: string
          mapping_type: string
          notes: string | null
          priority_rank: number | null
          university_id: string
        }
        Insert: {
          active_flag?: boolean
          created_at?: string
          id?: string
          lender_id: string
          mapping_type?: string
          notes?: string | null
          priority_rank?: number | null
          university_id: string
        }
        Update: {
          active_flag?: boolean
          created_at?: string
          id?: string
          lender_id?: string
          mapping_type?: string
          notes?: string | null
          priority_rank?: number | null
          university_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lender_university_mappings_lender_id_fkey"
            columns: ["lender_id"]
            isOneToOne: false
            referencedRelation: "lenders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lender_university_mappings_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities_master"
            referencedColumns: ["id"]
          },
        ]
      }
      lenders: {
        Row: {
          active_flag: boolean
          bre_rule_id: string | null
          cc_emails: string[]
          contact_email: string | null
          created_at: string
          id: string
          income_expectations_min: number | null
          internal_notes: string | null
          lender_code: string
          lender_name: string
          lender_type: string | null
          loan_amount_max: number | null
          loan_amount_min: number | null
          processing_time_days: number | null
          supported_countries: string[] | null
          supports_collateral: boolean
          supports_unsecured: boolean
          updated_at: string
        }
        Insert: {
          active_flag?: boolean
          bre_rule_id?: string | null
          cc_emails?: string[]
          contact_email?: string | null
          created_at?: string
          id?: string
          income_expectations_min?: number | null
          internal_notes?: string | null
          lender_code: string
          lender_name: string
          lender_type?: string | null
          loan_amount_max?: number | null
          loan_amount_min?: number | null
          processing_time_days?: number | null
          supported_countries?: string[] | null
          supports_collateral?: boolean
          supports_unsecured?: boolean
          updated_at?: string
        }
        Update: {
          active_flag?: boolean
          bre_rule_id?: string | null
          cc_emails?: string[]
          contact_email?: string | null
          created_at?: string
          id?: string
          income_expectations_min?: number | null
          internal_notes?: string | null
          lender_code?: string
          lender_name?: string
          lender_type?: string | null
          loan_amount_max?: number | null
          loan_amount_min?: number | null
          processing_time_days?: number | null
          supported_countries?: string[] | null
          supports_collateral?: boolean
          supports_unsecured?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      lifecycle_stage_master: {
        Row: {
          active_flag: boolean
          created_at: string
          description: string | null
          id: string
          is_terminal: boolean
          sort_order: number
          stage_key: Database["public"]["Enums"]["lead_stage_enum"]
          stage_label: string
        }
        Insert: {
          active_flag?: boolean
          created_at?: string
          description?: string | null
          id?: string
          is_terminal?: boolean
          sort_order?: number
          stage_key: Database["public"]["Enums"]["lead_stage_enum"]
          stage_label: string
        }
        Update: {
          active_flag?: boolean
          created_at?: string
          description?: string | null
          id?: string
          is_terminal?: boolean
          sort_order?: number
          stage_key?: Database["public"]["Enums"]["lead_stage_enum"]
          stage_label?: string
        }
        Relationships: []
      }
      lifecycle_status_master: {
        Row: {
          active_flag: boolean
          created_at: string
          description: string | null
          id: string
          sort_order: number
          stage_key: Database["public"]["Enums"]["lead_stage_enum"]
          status_key: Database["public"]["Enums"]["lead_status_enum"]
          status_label: string
        }
        Insert: {
          active_flag?: boolean
          created_at?: string
          description?: string | null
          id?: string
          sort_order?: number
          stage_key: Database["public"]["Enums"]["lead_stage_enum"]
          status_key: Database["public"]["Enums"]["lead_status_enum"]
          status_label: string
        }
        Update: {
          active_flag?: boolean
          created_at?: string
          description?: string | null
          id?: string
          sort_order?: number
          stage_key?: Database["public"]["Enums"]["lead_stage_enum"]
          status_key?: Database["public"]["Enums"]["lead_status_enum"]
          status_label?: string
        }
        Relationships: []
      }
      notifications_queue: {
        Row: {
          created_at: string
          delivery_status: string
          entity_id: string | null
          entity_type: string | null
          id: string
          message_body: string | null
          notification_type: Database["public"]["Enums"]["notification_type_enum"]
          recipient_role: Database["public"]["Enums"]["app_role"] | null
          recipient_user_id: string | null
        }
        Insert: {
          created_at?: string
          delivery_status?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          message_body?: string | null
          notification_type: Database["public"]["Enums"]["notification_type_enum"]
          recipient_role?: Database["public"]["Enums"]["app_role"] | null
          recipient_user_id?: string | null
        }
        Update: {
          created_at?: string
          delivery_status?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          message_body?: string | null
          notification_type?: Database["public"]["Enums"]["notification_type_enum"]
          recipient_role?: Database["public"]["Enums"]["app_role"] | null
          recipient_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_queue_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_branches: {
        Row: {
          branch_code: string | null
          branch_name: string
          city: string | null
          contact_email: string | null
          contact_person: string | null
          contact_phone: string | null
          country: string | null
          created_at: string
          id: string
          is_active: boolean
          partner_id: string
          state: string | null
          updated_at: string
        }
        Insert: {
          branch_code?: string | null
          branch_name: string
          city?: string | null
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          partner_id: string
          state?: string | null
          updated_at?: string
        }
        Update: {
          branch_code?: string | null
          branch_name?: string
          city?: string | null
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          partner_id?: string
          state?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_branches_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_organizations: {
        Row: {
          contact_person_email: string | null
          contact_person_name: string | null
          contact_person_phone: string | null
          created_at: string
          display_name: string
          id: string
          is_archived: boolean
          legal_name: string
          onboarding_date: string | null
          partner_code: string
          partner_type: Database["public"]["Enums"]["partner_type_enum"]
          payout_entity_name: string | null
          payout_terms: string | null
          status: Database["public"]["Enums"]["partner_status_enum"]
          updated_at: string
        }
        Insert: {
          contact_person_email?: string | null
          contact_person_name?: string | null
          contact_person_phone?: string | null
          created_at?: string
          display_name: string
          id?: string
          is_archived?: boolean
          legal_name: string
          onboarding_date?: string | null
          partner_code: string
          partner_type?: Database["public"]["Enums"]["partner_type_enum"]
          payout_entity_name?: string | null
          payout_terms?: string | null
          status?: Database["public"]["Enums"]["partner_status_enum"]
          updated_at?: string
        }
        Update: {
          contact_person_email?: string | null
          contact_person_name?: string | null
          contact_person_phone?: string | null
          created_at?: string
          display_name?: string
          id?: string
          is_archived?: boolean
          legal_name?: string
          onboarding_date?: string | null
          partner_code?: string
          partner_type?: Database["public"]["Enums"]["partner_type_enum"]
          payout_entity_name?: string | null
          payout_terms?: string | null
          status?: Database["public"]["Enums"]["partner_status_enum"]
          updated_at?: string
        }
        Relationships: []
      }
      partner_payout_records: {
        Row: {
          created_at: string
          id: string
          lead_id: string
          partner_id: string
          payout_amount: number | null
          payout_approved_at: string | null
          payout_paid_at: string | null
          payout_rule_id: string | null
          payout_status: Database["public"]["Enums"]["payout_status_enum"]
          payout_triggered_at: string | null
          remarks: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          lead_id: string
          partner_id: string
          payout_amount?: number | null
          payout_approved_at?: string | null
          payout_paid_at?: string | null
          payout_rule_id?: string | null
          payout_status?: Database["public"]["Enums"]["payout_status_enum"]
          payout_triggered_at?: string | null
          remarks?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          lead_id?: string
          partner_id?: string
          payout_amount?: number | null
          payout_approved_at?: string | null
          payout_paid_at?: string | null
          payout_rule_id?: string | null
          payout_status?: Database["public"]["Enums"]["payout_status_enum"]
          payout_triggered_at?: string | null
          remarks?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_payout_records_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "student_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_payout_records_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_payout_records_payout_rule_id_fkey"
            columns: ["payout_rule_id"]
            isOneToOne: false
            referencedRelation: "partner_payout_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_payout_rules: {
        Row: {
          active_flag: boolean
          clawback_rule: string | null
          created_at: string
          effective_from: string
          effective_to: string | null
          id: string
          lender_id: string | null
          partner_id: string
          payout_amount: number | null
          payout_basis: Database["public"]["Enums"]["payout_basis_enum"]
          payout_percent: number | null
          payout_trigger_stage: Database["public"]["Enums"]["lead_stage_enum"]
          updated_at: string
        }
        Insert: {
          active_flag?: boolean
          clawback_rule?: string | null
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          lender_id?: string | null
          partner_id: string
          payout_amount?: number | null
          payout_basis?: Database["public"]["Enums"]["payout_basis_enum"]
          payout_percent?: number | null
          payout_trigger_stage?: Database["public"]["Enums"]["lead_stage_enum"]
          updated_at?: string
        }
        Update: {
          active_flag?: boolean
          clawback_rule?: string | null
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          lender_id?: string | null
          partner_id?: string
          payout_amount?: number | null
          payout_basis?: Database["public"]["Enums"]["payout_basis_enum"]
          payout_percent?: number | null
          payout_trigger_stage?: Database["public"]["Enums"]["lead_stage_enum"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_payout_rules_lender_id_fkey"
            columns: ["lender_id"]
            isOneToOne: false
            referencedRelation: "lenders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_payout_rules_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pincode_master: {
        Row: {
          district: string | null
          has_conflict: boolean
          pincode: string
          source_row_count: number
          state: string | null
          tier: string | null
          updated_at: string
        }
        Insert: {
          district?: string | null
          has_conflict?: boolean
          pincode: string
          source_row_count?: number
          state?: string | null
          tier?: string | null
          updated_at?: string
        }
        Update: {
          district?: string | null
          has_conflict?: boolean
          pincode?: string
          source_row_count?: number
          state?: string | null
          tier?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      qa_results_admin_ops: {
        Row: {
          actual: string | null
          evidence: string | null
          expected: string | null
          ran_at: string | null
          scenario: string | null
          scenario_no: number | null
          status: string | null
        }
        Insert: {
          actual?: string | null
          evidence?: string | null
          expected?: string | null
          ran_at?: string | null
          scenario?: string | null
          scenario_no?: number | null
          status?: string | null
        }
        Update: {
          actual?: string | null
          evidence?: string | null
          expected?: string | null
          ran_at?: string | null
          scenario?: string | null
          scenario_no?: number | null
          status?: string | null
        }
        Relationships: []
      }
      student_leads: {
        Row: {
          assigned_admin_id: string | null
          city: string | null
          coapplicant_email: string | null
          coapplicant_employer: string | null
          coapplicant_employment_type: string | null
          coapplicant_existing_emi: number | null
          coapplicant_income: number | null
          coapplicant_income_source: string | null
          coapplicant_mobile: string | null
          coapplicant_name: string | null
          coapplicant_relation: string | null
          collateral_available: boolean | null
          collateral_notes: string | null
          country_of_residence: string | null
          course_category: string | null
          course_name: string
          created_at: string
          current_stage: Database["public"]["Enums"]["lead_stage_enum"]
          current_status: Database["public"]["Enums"]["lead_status_enum"]
          district: string | null
          duplicate_flag: boolean
          fraud_flag: boolean
          highest_qualification: string | null
          id: string
          intake_term: string
          intake_year: number
          intended_study_country: string
          is_archived: boolean
          lead_authenticity: string
          lead_id: string | null
          loan_amount_required: number | null
          marks_gpa: string | null
          partner_id: string
          partner_user_id: string | null
          pincode: string | null
          source_sub_type: string | null
          source_type: string
          state: string | null
          status_reason: string | null
          student_dob: string | null
          student_email: string | null
          student_first_name: string
          student_full_name: string | null
          student_gender: string | null
          student_last_name: string | null
          student_phone: string
          student_portal_user_id: string | null
          student_whatsapp: string | null
          test_scores: Json | null
          tier: string | null
          university_id: string | null
          university_name_raw: string | null
          updated_at: string
          whatsapp_same_as_phone: boolean
        }
        Insert: {
          assigned_admin_id?: string | null
          city?: string | null
          coapplicant_email?: string | null
          coapplicant_employer?: string | null
          coapplicant_employment_type?: string | null
          coapplicant_existing_emi?: number | null
          coapplicant_income?: number | null
          coapplicant_income_source?: string | null
          coapplicant_mobile?: string | null
          coapplicant_name?: string | null
          coapplicant_relation?: string | null
          collateral_available?: boolean | null
          collateral_notes?: string | null
          country_of_residence?: string | null
          course_category?: string | null
          course_name: string
          created_at?: string
          current_stage?: Database["public"]["Enums"]["lead_stage_enum"]
          current_status?: Database["public"]["Enums"]["lead_status_enum"]
          district?: string | null
          duplicate_flag?: boolean
          fraud_flag?: boolean
          highest_qualification?: string | null
          id?: string
          intake_term: string
          intake_year: number
          intended_study_country: string
          is_archived?: boolean
          lead_authenticity?: string
          lead_id?: string | null
          loan_amount_required?: number | null
          marks_gpa?: string | null
          partner_id: string
          partner_user_id?: string | null
          pincode?: string | null
          source_sub_type?: string | null
          source_type?: string
          state?: string | null
          status_reason?: string | null
          student_dob?: string | null
          student_email?: string | null
          student_first_name: string
          student_full_name?: string | null
          student_gender?: string | null
          student_last_name?: string | null
          student_phone: string
          student_portal_user_id?: string | null
          student_whatsapp?: string | null
          test_scores?: Json | null
          tier?: string | null
          university_id?: string | null
          university_name_raw?: string | null
          updated_at?: string
          whatsapp_same_as_phone?: boolean
        }
        Update: {
          assigned_admin_id?: string | null
          city?: string | null
          coapplicant_email?: string | null
          coapplicant_employer?: string | null
          coapplicant_employment_type?: string | null
          coapplicant_existing_emi?: number | null
          coapplicant_income?: number | null
          coapplicant_income_source?: string | null
          coapplicant_mobile?: string | null
          coapplicant_name?: string | null
          coapplicant_relation?: string | null
          collateral_available?: boolean | null
          collateral_notes?: string | null
          country_of_residence?: string | null
          course_category?: string | null
          course_name?: string
          created_at?: string
          current_stage?: Database["public"]["Enums"]["lead_stage_enum"]
          current_status?: Database["public"]["Enums"]["lead_status_enum"]
          district?: string | null
          duplicate_flag?: boolean
          fraud_flag?: boolean
          highest_qualification?: string | null
          id?: string
          intake_term?: string
          intake_year?: number
          intended_study_country?: string
          is_archived?: boolean
          lead_authenticity?: string
          lead_id?: string | null
          loan_amount_required?: number | null
          marks_gpa?: string | null
          partner_id?: string
          partner_user_id?: string | null
          pincode?: string | null
          source_sub_type?: string | null
          source_type?: string
          state?: string | null
          status_reason?: string | null
          student_dob?: string | null
          student_email?: string | null
          student_first_name?: string
          student_full_name?: string | null
          student_gender?: string | null
          student_last_name?: string | null
          student_phone?: string
          student_portal_user_id?: string | null
          student_whatsapp?: string | null
          test_scores?: Json | null
          tier?: string | null
          university_id?: string | null
          university_name_raw?: string | null
          updated_at?: string
          whatsapp_same_as_phone?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "student_leads_assigned_admin_id_fkey"
            columns: ["assigned_admin_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_leads_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_leads_partner_user_id_fkey"
            columns: ["partner_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_leads_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities_master"
            referencedColumns: ["id"]
          },
        ]
      }
      universities_master: {
        Row: {
          active_flag: boolean
          aliases: string[] | null
          country: string
          country_normalized: string | null
          created_at: string
          grade: string | null
          grade_source: string
          id: string
          points: number | null
          qs_rank: number | null
          ranking_bucket: string | null
          university_name: string
          university_name_normalized: string | null
          updated_at: string
        }
        Insert: {
          active_flag?: boolean
          aliases?: string[] | null
          country: string
          country_normalized?: string | null
          created_at?: string
          grade?: string | null
          grade_source?: string
          id?: string
          points?: number | null
          qs_rank?: number | null
          ranking_bucket?: string | null
          university_name: string
          university_name_normalized?: string | null
          updated_at?: string
        }
        Update: {
          active_flag?: boolean
          aliases?: string[] | null
          country?: string
          country_normalized?: string | null
          created_at?: string
          grade?: string | null
          grade_source?: string
          id?: string
          points?: number | null
          qs_rank?: number | null
          ranking_bucket?: string | null
          university_name?: string
          university_name_normalized?: string | null
          updated_at?: string
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
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          auth_user_id: string | null
          bre_permission: string
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          last_login_at: string | null
          partner_id: string | null
          phone: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          bre_permission?: string
          created_at?: string
          email: string
          full_name: string
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          partner_id?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          bre_permission?: string
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          partner_id?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_users_partner"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_add_lead_note: {
        Args: {
          _lead_id: string
          _note_text: string
          _note_type?: Database["public"]["Enums"]["note_type_enum"]
        }
        Returns: Json
      }
      admin_change_lead_stage: {
        Args: {
          _change_reason?: string
          _internal_note?: string
          _lead_id: string
          _new_stage: Database["public"]["Enums"]["lead_stage_enum"]
          _new_status: Database["public"]["Enums"]["lead_status_enum"]
          _override?: boolean
          _partner_visible_note?: string
        }
        Returns: Json
      }
      admin_change_lead_status: {
        Args: {
          _change_reason?: string
          _lead_id: string
          _new_status: Database["public"]["Enums"]["lead_status_enum"]
        }
        Returns: Json
      }
      admin_review_document: {
        Args: { _action: string; _document_id: string; _remark?: string }
        Returns: Json
      }
      bre_activate_lender_rule: { Args: { _id: string }; Returns: Json }
      bre_activate_scoring_config: { Args: { _id: string }; Returns: Json }
      country_to_iso: { Args: { _name: string }; Returns: string }
      decide_edit_request: {
        Args: {
          _action: string
          _approved_fields?: string[]
          _decision_note?: string
          _request_id: string
        }
        Returns: Json
      }
      get_user_partner_id: { Args: { _auth_id: string }; Returns: string }
      get_user_role: {
        Args: { _auth_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_super: { Args: { _auth_id: string }; Returns: boolean }
      is_partner_org_active: { Args: { _partner_id: string }; Returns: boolean }
      match_college_names: {
        Args: { _a_norm: string; _b_norm: string }
        Returns: boolean
      }
      normalize_college_name: { Args: { _name: string }; Returns: string }
      normalize_phone: { Args: { _phone: string }; Returns: string }
      resolve_country_canonical: { Args: { _name: string }; Returns: string }
      seed_lead_document_requirements: {
        Args: { p_lead_id: string }
        Returns: number
      }
      seed_lead_lender_matches: { Args: { p_lead_id: string }; Returns: number }
      submit_edit_request: {
        Args: { _changes: Json; _lead_id: string; _reason: string }
        Returns: Json
      }
      tokens_distinctive: { Args: { _norm_name: string }; Returns: string[] }
    }
    Enums: {
      app_role: "super_admin" | "admin" | "partner_admin" | "partner_agent"
      bulk_upload_status_enum:
        | "uploaded"
        | "processing"
        | "completed"
        | "completed_with_errors"
        | "failed"
      document_status_enum:
        | "not_uploaded"
        | "uploaded"
        | "under_review"
        | "verified"
        | "rejected"
        | "reupload_needed"
        | "waived"
        | "not_applicable"
      fit_category_enum:
        | "best_fit"
        | "good_fit"
        | "premium_match"
        | "backup"
        | "not_eligible"
      lead_stage_enum:
        | "draft"
        | "submitted"
        | "under_initial_review"
        | "documents_pending"
        | "documents_under_review"
        | "bre_evaluated"
        | "sent_to_lender"
        | "login_submitted"
        | "credit_query"
        | "sanction_received"
        | "disbursed"
        | "rejected"
        | "dropped"
        | "on_hold"
      lead_status_enum:
        | "new"
        | "in_progress"
        | "pending_info"
        | "reupload_needed"
        | "awaiting_verification"
        | "verified"
        | "under_assessment"
        | "query_raised"
        | "query_resolved"
        | "approved"
        | "conditionally_approved"
        | "declined"
        | "withdrawn"
        | "on_hold"
        | "completed"
        | "not_applicable"
      note_type_enum: "internal" | "partner_visible" | "system"
      notification_type_enum:
        | "lead_created"
        | "lead_updated"
        | "stage_changed"
        | "document_uploaded"
        | "document_verified"
        | "document_rejected"
        | "payout_triggered"
        | "payout_approved"
        | "payout_paid"
        | "bulk_upload_completed"
        | "system_alert"
      partner_status_enum:
        | "active"
        | "inactive"
        | "onboarding"
        | "suspended"
        | "terminated"
      partner_type_enum:
        | "education_consultant"
        | "study_abroad_agency"
        | "university_partner"
        | "digital_aggregator"
        | "freelance_counsellor"
        | "other"
      payout_basis_enum:
        | "flat_fee"
        | "percentage_of_loan"
        | "percentage_of_disbursed"
        | "tiered"
        | "custom"
      payout_status_enum:
        | "pending"
        | "triggered"
        | "approved"
        | "paid"
        | "reversed"
        | "on_hold"
        | "cancelled"
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
      app_role: ["super_admin", "admin", "partner_admin", "partner_agent"],
      bulk_upload_status_enum: [
        "uploaded",
        "processing",
        "completed",
        "completed_with_errors",
        "failed",
      ],
      document_status_enum: [
        "not_uploaded",
        "uploaded",
        "under_review",
        "verified",
        "rejected",
        "reupload_needed",
        "waived",
        "not_applicable",
      ],
      fit_category_enum: [
        "best_fit",
        "good_fit",
        "premium_match",
        "backup",
        "not_eligible",
      ],
      lead_stage_enum: [
        "draft",
        "submitted",
        "under_initial_review",
        "documents_pending",
        "documents_under_review",
        "bre_evaluated",
        "sent_to_lender",
        "login_submitted",
        "credit_query",
        "sanction_received",
        "disbursed",
        "rejected",
        "dropped",
        "on_hold",
      ],
      lead_status_enum: [
        "new",
        "in_progress",
        "pending_info",
        "reupload_needed",
        "awaiting_verification",
        "verified",
        "under_assessment",
        "query_raised",
        "query_resolved",
        "approved",
        "conditionally_approved",
        "declined",
        "withdrawn",
        "on_hold",
        "completed",
        "not_applicable",
      ],
      note_type_enum: ["internal", "partner_visible", "system"],
      notification_type_enum: [
        "lead_created",
        "lead_updated",
        "stage_changed",
        "document_uploaded",
        "document_verified",
        "document_rejected",
        "payout_triggered",
        "payout_approved",
        "payout_paid",
        "bulk_upload_completed",
        "system_alert",
      ],
      partner_status_enum: [
        "active",
        "inactive",
        "onboarding",
        "suspended",
        "terminated",
      ],
      partner_type_enum: [
        "education_consultant",
        "study_abroad_agency",
        "university_partner",
        "digital_aggregator",
        "freelance_counsellor",
        "other",
      ],
      payout_basis_enum: [
        "flat_fee",
        "percentage_of_loan",
        "percentage_of_disbursed",
        "tiered",
        "custom",
      ],
      payout_status_enum: [
        "pending",
        "triggered",
        "approved",
        "paid",
        "reversed",
        "on_hold",
        "cancelled",
      ],
    },
  },
} as const
