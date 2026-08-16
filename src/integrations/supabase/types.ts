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
      activity_logs: {
        Row: {
          created_at: string
          detail: string
          id: string
          label: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          detail?: string
          id?: string
          label: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          detail?: string
          id?: string
          label?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_generated_drafts: {
        Row: {
          action_kind: string
          agent_type: string
          applied_at: string | null
          applied_by_profile_id: string | null
          confirm_role: string
          conversation_id: string | null
          created_at: string
          created_by_profile_id: string | null
          draft_type: string
          estimate_id: string | null
          estimate_version: number | null
          id: string
          message_id: string | null
          payload: Json
          preview: Json
          project_id: string
          status: string
          updated_at: string
          visibility: string
        }
        Insert: {
          action_kind?: string
          agent_type?: string
          applied_at?: string | null
          applied_by_profile_id?: string | null
          confirm_role?: string
          conversation_id?: string | null
          created_at?: string
          created_by_profile_id?: string | null
          draft_type: string
          estimate_id?: string | null
          estimate_version?: number | null
          id?: string
          message_id?: string | null
          payload?: Json
          preview?: Json
          project_id: string
          status?: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          action_kind?: string
          agent_type?: string
          applied_at?: string | null
          applied_by_profile_id?: string | null
          confirm_role?: string
          conversation_id?: string | null
          created_at?: string
          created_by_profile_id?: string | null
          draft_type?: string
          estimate_id?: string | null
          estimate_version?: number | null
          id?: string
          message_id?: string | null
          payload?: Json
          preview?: Json
          project_id?: string
          status?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_generated_drafts_applied_by_profile_id_fkey"
            columns: ["applied_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_generated_drafts_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "project_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_generated_drafts_created_by_profile_id_fkey"
            columns: ["created_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_generated_drafts_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "project_estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_generated_drafts_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_generated_drafts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_project_summaries: {
        Row: {
          audience_role: string
          conversation_id: string | null
          covered_message_count: number
          created_at: string
          id: string
          last_message_at: string | null
          project_id: string
          summary: string
          updated_at: string
        }
        Insert: {
          audience_role?: string
          conversation_id?: string | null
          covered_message_count?: number
          created_at?: string
          id?: string
          last_message_at?: string | null
          project_id: string
          summary?: string
          updated_at?: string
        }
        Update: {
          audience_role?: string
          conversation_id?: string | null
          covered_message_count?: number
          created_at?: string
          id?: string
          last_message_at?: string | null
          project_id?: string
          summary?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_project_summaries_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "project_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_project_summaries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_request_classifications: {
        Row: {
          agent_type: string
          classification: string
          classifier_model: string
          classifier_tokens: number
          confidence: number
          conversation_id: string | null
          created_at: string
          id: string
          message_excerpt: string
          message_hash: string
          profile_id: string | null
          project_id: string | null
          reason: string
          updated_at: string
        }
        Insert: {
          agent_type?: string
          classification: string
          classifier_model?: string
          classifier_tokens?: number
          confidence?: number
          conversation_id?: string | null
          created_at?: string
          id?: string
          message_excerpt?: string
          message_hash?: string
          profile_id?: string | null
          project_id?: string | null
          reason?: string
          updated_at?: string
        }
        Update: {
          agent_type?: string
          classification?: string
          classifier_model?: string
          classifier_tokens?: number
          confidence?: number
          conversation_id?: string | null
          created_at?: string
          id?: string
          message_excerpt?: string
          message_hash?: string
          profile_id?: string | null
          project_id?: string | null
          reason?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_request_classifications_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "project_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_request_classifications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_request_classifications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_response_cache: {
        Row: {
          agent_type: string
          audience_role: string
          cache_key: string
          created_at: string
          expires_at: string
          hit_count: number
          id: string
          project_id: string
          response_body: string
          updated_at: string
        }
        Insert: {
          agent_type?: string
          audience_role?: string
          cache_key: string
          created_at?: string
          expires_at?: string
          hit_count?: number
          id?: string
          project_id: string
          response_body?: string
          updated_at?: string
        }
        Update: {
          agent_type?: string
          audience_role?: string
          cache_key?: string
          created_at?: string
          expires_at?: string
          hit_count?: number
          id?: string
          project_id?: string
          response_body?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_response_cache_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_runs: {
        Row: {
          agent_type: string
          conversation_id: string | null
          created_at: string
          error: string
          id: string
          latency_ms: number | null
          model: string
          project_id: string | null
          requested_by_profile_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          agent_type: string
          conversation_id?: string | null
          created_at?: string
          error?: string
          id?: string
          latency_ms?: number | null
          model?: string
          project_id?: string | null
          requested_by_profile_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          agent_type?: string
          conversation_id?: string | null
          created_at?: string
          error?: string
          id?: string
          latency_ms?: number | null
          model?: string
          project_id?: string | null
          requested_by_profile_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_runs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "project_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_runs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_runs_requested_by_profile_id_fkey"
            columns: ["requested_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_sessions: {
        Row: {
          created_at: string
          id: string
          kind: string
          metadata: Json
          output: string
          project_id: string | null
          prompt: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          metadata?: Json
          output?: string
          project_id?: string | null
          prompt?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          metadata?: Json
          output?: string
          project_id?: string | null
          prompt?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_sessions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_alerts: {
        Row: {
          acknowledged: boolean
          acknowledged_at: string | null
          acknowledged_by: string | null
          alert_type: string
          created_at: string
          detail: string
          id: string
          metadata: Json
          profile_id: string | null
          project_id: string | null
          severity: string
          title: string
          updated_at: string
        }
        Insert: {
          acknowledged?: boolean
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type: string
          created_at?: string
          detail?: string
          id?: string
          metadata?: Json
          profile_id?: string | null
          project_id?: string | null
          severity?: string
          title?: string
          updated_at?: string
        }
        Update: {
          acknowledged?: boolean
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type?: string
          created_at?: string
          detail?: string
          id?: string
          metadata?: Json
          profile_id?: string | null
          project_id?: string | null
          severity?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_alerts_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_alerts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_alerts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_events: {
        Row: {
          actor_role: string
          agent_type: string
          classification: string
          client_id: string | null
          conversation_id: string | null
          created_at: string
          duration_ms: number
          estimated_cost: number
          id: string
          input_tokens: number
          message_hash: string
          message_length: number
          model: string
          outcome: string
          output_tokens: number
          profile_id: string | null
          project_id: string | null
          rejection_reason: string
          supplier_id: string | null
          total_tokens: number
          updated_at: string
        }
        Insert: {
          actor_role?: string
          agent_type?: string
          classification?: string
          client_id?: string | null
          conversation_id?: string | null
          created_at?: string
          duration_ms?: number
          estimated_cost?: number
          id?: string
          input_tokens?: number
          message_hash?: string
          message_length?: number
          model?: string
          outcome?: string
          output_tokens?: number
          profile_id?: string | null
          project_id?: string | null
          rejection_reason?: string
          supplier_id?: string | null
          total_tokens?: number
          updated_at?: string
        }
        Update: {
          actor_role?: string
          agent_type?: string
          classification?: string
          client_id?: string | null
          conversation_id?: string | null
          created_at?: string
          duration_ms?: number
          estimated_cost?: number
          id?: string
          input_tokens?: number
          message_hash?: string
          message_length?: number
          model?: string
          outcome?: string
          output_tokens?: number
          profile_id?: string | null
          project_id?: string | null
          rejection_reason?: string
          supplier_id?: string | null
          total_tokens?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_events_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "project_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_events_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_events_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_limits: {
        Row: {
          cooldown_seconds: number
          created_at: string
          daily_message_limit: number
          daily_token_limit: number
          hard_stop_threshold_percent: number
          id: string
          is_paused: boolean
          maximum_context_size: number
          maximum_message_length: number
          maximum_output_tokens: number
          monthly_message_limit: number
          monthly_token_limit: number
          note: string
          paused_reason: string
          paused_until: string | null
          scope_id: string | null
          scope_type: string
          updated_at: string
          warning_threshold_percent: number
        }
        Insert: {
          cooldown_seconds?: number
          created_at?: string
          daily_message_limit?: number
          daily_token_limit?: number
          hard_stop_threshold_percent?: number
          id?: string
          is_paused?: boolean
          maximum_context_size?: number
          maximum_message_length?: number
          maximum_output_tokens?: number
          monthly_message_limit?: number
          monthly_token_limit?: number
          note?: string
          paused_reason?: string
          paused_until?: string | null
          scope_id?: string | null
          scope_type: string
          updated_at?: string
          warning_threshold_percent?: number
        }
        Update: {
          cooldown_seconds?: number
          created_at?: string
          daily_message_limit?: number
          daily_token_limit?: number
          hard_stop_threshold_percent?: number
          id?: string
          is_paused?: boolean
          maximum_context_size?: number
          maximum_message_length?: number
          maximum_output_tokens?: number
          monthly_message_limit?: number
          monthly_token_limit?: number
          note?: string
          paused_reason?: string
          paused_until?: string | null
          scope_id?: string | null
          scope_type?: string
          updated_at?: string
          warning_threshold_percent?: number
        }
        Relationships: []
      }
      approvals: {
        Row: {
          approved_date: string | null
          approver_role: string
          created_at: string
          id: string
          notes: string
          project_id: string
          scope_id: string
          status: string
          updated_at: string
        }
        Insert: {
          approved_date?: string | null
          approver_role: string
          created_at?: string
          id?: string
          notes?: string
          project_id: string
          scope_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          approved_date?: string | null
          approver_role?: string
          created_at?: string
          id?: string
          notes?: string
          project_id?: string
          scope_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "approvals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_scope_id_fkey"
            columns: ["scope_id"]
            isOneToOne: false
            referencedRelation: "scopes"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_flow_leads: {
        Row: {
          accounting_system: string
          accounting_system_other: string | null
          company_name: string
          created_at: string
          email: string
          first_name: string
          id: string
          last_name: string
          mobile_phone: string
          notes: string | null
          phone: string | null
          physical_address: string | null
          reason_for_cash_flow_software: string
          source: string
          status: string
        }
        Insert: {
          accounting_system: string
          accounting_system_other?: string | null
          company_name: string
          created_at?: string
          email: string
          first_name: string
          id?: string
          last_name: string
          mobile_phone: string
          notes?: string | null
          phone?: string | null
          physical_address?: string | null
          reason_for_cash_flow_software: string
          source?: string
          status?: string
        }
        Update: {
          accounting_system?: string
          accounting_system_other?: string | null
          company_name?: string
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          mobile_phone?: string
          notes?: string | null
          phone?: string | null
          physical_address?: string | null
          reason_for_cash_flow_software?: string
          source?: string
          status?: string
        }
        Relationships: []
      }
      change_requests: {
        Row: {
          agency_price: number | null
          approved_date: string | null
          created_at: string
          delivery_impact: string
          description: string
          id: string
          project_id: string
          requested_by_client_id: string
          requires_signature: boolean
          revised_proposal_version_id: string | null
          source_proposal_version_id: string | null
          status: string
          supplier_cost: number | null
          title: string
          updated_at: string
        }
        Insert: {
          agency_price?: number | null
          approved_date?: string | null
          created_at?: string
          delivery_impact?: string
          description?: string
          id?: string
          project_id: string
          requested_by_client_id: string
          requires_signature?: boolean
          revised_proposal_version_id?: string | null
          source_proposal_version_id?: string | null
          status?: string
          supplier_cost?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          agency_price?: number | null
          approved_date?: string | null
          created_at?: string
          delivery_impact?: string
          description?: string
          id?: string
          project_id?: string
          requested_by_client_id?: string
          requires_signature?: boolean
          revised_proposal_version_id?: string | null
          source_proposal_version_id?: string | null
          status?: string
          supplier_cost?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "change_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_requests_requested_by_client_id_fkey"
            columns: ["requested_by_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_requests_revised_proposal_version_id_fkey"
            columns: ["revised_proposal_version_id"]
            isOneToOne: false
            referencedRelation: "proposal_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_requests_source_proposal_version_id_fkey"
            columns: ["source_proposal_version_id"]
            isOneToOne: false
            referencedRelation: "proposal_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          agent_type: string | null
          body: string
          conversation_id: string
          created_at: string
          edited_at: string | null
          id: string
          project_id: string
          sender_profile_id: string | null
          sender_type: string
          status: string
          structured_payload: Json
          updated_at: string
          visibility: string
        }
        Insert: {
          agent_type?: string | null
          body?: string
          conversation_id: string
          created_at?: string
          edited_at?: string | null
          id?: string
          project_id: string
          sender_profile_id?: string | null
          sender_type: string
          status?: string
          structured_payload?: Json
          updated_at?: string
          visibility: string
        }
        Update: {
          agent_type?: string | null
          body?: string
          conversation_id?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          project_id?: string
          sender_profile_id?: string | null
          sender_type?: string
          status?: string
          structured_payload?: Json
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "project_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_sender_profile_id_fkey"
            columns: ["sender_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_meetings: {
        Row: {
          conversation_id: string | null
          created_at: string
          duration_minutes: number | null
          ended_at: string | null
          id: string
          language: string
          lead_id: string | null
          project_id: string
          started_at: string
          started_by: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          duration_minutes?: number | null
          ended_at?: string | null
          id?: string
          language?: string
          lead_id?: string | null
          project_id: string
          started_at?: string
          started_by?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          duration_minutes?: number | null
          ended_at?: string | null
          id?: string
          language?: string
          lead_id?: string | null
          project_id?: string
          started_at?: string
          started_by?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_meetings_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "project_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_meetings_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_meetings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_meetings_started_by_fkey"
            columns: ["started_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          archived_at: string | null
          company: string
          created_at: string
          email: string
          id: string
          name: string
          notes: string
          phone: string | null
          status: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          company: string
          created_at?: string
          email: string
          id?: string
          name: string
          notes?: string
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          company?: string
          created_at?: string
          email?: string
          id?: string
          name?: string
          notes?: string
          phone?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      contact_notes: {
        Row: {
          body: string
          client_id: string | null
          created_at: string
          created_by: string | null
          id: string
          import_batch_id: string | null
          lead_id: string | null
          note_type: string
          original_source: string | null
          project_id: string | null
        }
        Insert: {
          body: string
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          import_batch_id?: string | null
          lead_id?: string | null
          note_type?: string
          original_source?: string | null
          project_id?: string | null
        }
        Update: {
          body?: string
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          import_batch_id?: string | null
          lead_id?: string | null
          note_type?: string
          original_source?: string | null
          project_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_notes_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_notes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_notes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          participant_role: string
          profile_id: string | null
          updated_at: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          participant_role: string
          profile_id?: string | null
          updated_at?: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          participant_role?: string
          profile_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "project_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_participants_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      copilot_audit_log: {
        Row: {
          action_type: string
          actor_role: string
          command: string
          confirmed: boolean
          created_at: string
          execution_result: string
          failure_reason: string | null
          id: string
          interpreted_intent: string
          new_value: Json | null
          operator_action_id: string | null
          previous_value: Json | null
          profile_id: string | null
          source: string
          target_id: string | null
          target_label: string
          target_type: string
        }
        Insert: {
          action_type: string
          actor_role?: string
          command?: string
          confirmed?: boolean
          created_at?: string
          execution_result?: string
          failure_reason?: string | null
          id?: string
          interpreted_intent?: string
          new_value?: Json | null
          operator_action_id?: string | null
          previous_value?: Json | null
          profile_id?: string | null
          source?: string
          target_id?: string | null
          target_label?: string
          target_type?: string
        }
        Update: {
          action_type?: string
          actor_role?: string
          command?: string
          confirmed?: boolean
          created_at?: string
          execution_result?: string
          failure_reason?: string | null
          id?: string
          interpreted_intent?: string
          new_value?: Json | null
          operator_action_id?: string | null
          previous_value?: Json | null
          profile_id?: string | null
          source?: string
          target_id?: string | null
          target_label?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "copilot_audit_log_operator_action_id_fkey"
            columns: ["operator_action_id"]
            isOneToOne: false
            referencedRelation: "copilot_operator_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "copilot_audit_log_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      copilot_entity_facts: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          facts: Json
          id: string
          label: string
          refreshed_at: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          facts?: Json
          id?: string
          label?: string
          refreshed_at?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          facts?: Json
          id?: string
          label?: string
          refreshed_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      copilot_messages: {
        Row: {
          body: string
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          payload: Json
          profile_id: string
          project_id: string | null
          scope_key: string
          sender: string
        }
        Insert: {
          body?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          payload?: Json
          profile_id: string
          project_id?: string | null
          scope_key?: string
          sender: string
        }
        Update: {
          body?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          payload?: Json
          profile_id?: string
          project_id?: string | null
          scope_key?: string
          sender?: string
        }
        Relationships: [
          {
            foreignKeyName: "copilot_messages_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "copilot_messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      copilot_operator_actions: {
        Row: {
          action_label: string
          action_type: string
          confirmed_at: string | null
          created_at: string
          executed_at: string | null
          failure_reason: string | null
          id: string
          payload: Json
          plan_id: string | null
          plan_step: number
          plan_title: string | null
          preview: Json
          profile_id: string
          requires_confirmation: boolean
          result: Json | null
          risk_level: string
          source: string
          source_command: string
          status: string
          target_id: string | null
          target_label: string
          target_type: string
          updated_at: string
        }
        Insert: {
          action_label?: string
          action_type: string
          confirmed_at?: string | null
          created_at?: string
          executed_at?: string | null
          failure_reason?: string | null
          id?: string
          payload?: Json
          plan_id?: string | null
          plan_step?: number
          plan_title?: string | null
          preview?: Json
          profile_id: string
          requires_confirmation?: boolean
          result?: Json | null
          risk_level?: string
          source?: string
          source_command?: string
          status?: string
          target_id?: string | null
          target_label?: string
          target_type?: string
          updated_at?: string
        }
        Update: {
          action_label?: string
          action_type?: string
          confirmed_at?: string | null
          created_at?: string
          executed_at?: string | null
          failure_reason?: string | null
          id?: string
          payload?: Json
          plan_id?: string | null
          plan_step?: number
          plan_title?: string | null
          preview?: Json
          profile_id?: string
          requires_confirmation?: boolean
          result?: Json | null
          risk_level?: string
          source?: string
          source_command?: string
          status?: string
          target_id?: string | null
          target_label?: string
          target_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "copilot_operator_actions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      copilot_slot_memory: {
        Row: {
          action_type: string
          confidence: number
          confirmed_parameters: Json
          created_at: string
          expires_at: string
          id: string
          intent: string
          last_correction: string
          missing_parameters: Json
          operator_action_id: string | null
          profile_id: string
          scope_key: string
          source_language: string
          status: string
          target_id: string | null
          target_label: string
          target_type: string
          updated_at: string
        }
        Insert: {
          action_type: string
          confidence?: number
          confirmed_parameters?: Json
          created_at?: string
          expires_at?: string
          id?: string
          intent: string
          last_correction?: string
          missing_parameters?: Json
          operator_action_id?: string | null
          profile_id: string
          scope_key: string
          source_language?: string
          status?: string
          target_id?: string | null
          target_label?: string
          target_type?: string
          updated_at?: string
        }
        Update: {
          action_type?: string
          confidence?: number
          confirmed_parameters?: Json
          created_at?: string
          expires_at?: string
          id?: string
          intent?: string
          last_correction?: string
          missing_parameters?: Json
          operator_action_id?: string | null
          profile_id?: string
          scope_key?: string
          source_language?: string
          status?: string
          target_id?: string | null
          target_label?: string
          target_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "copilot_slot_memory_operator_action_id_fkey"
            columns: ["operator_action_id"]
            isOneToOne: false
            referencedRelation: "copilot_operator_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "copilot_slot_memory_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      copilot_state: {
        Row: {
          preferences: Json
          profile_id: string
          updated_at: string
        }
        Insert: {
          preferences?: Json
          profile_id: string
          updated_at?: string
        }
        Update: {
          preferences?: Json
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "copilot_state_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_ai_suggestions: {
        Row: {
          client_id: string | null
          created_at: string
          id: string
          kind: string
          lead_id: string | null
          payload: Json
          status: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          id?: string
          kind: string
          lead_id?: string | null
          payload?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          lead_id?: string | null
          payload?: Json
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_ai_suggestions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_ai_suggestions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_leads: {
        Row: {
          archived_at: string | null
          company: string
          converted_at: string | null
          converted_client_id: string | null
          created_at: string
          currency: string
          email: string | null
          email_normalized: string | null
          estimated_value: number | null
          extra: Json
          id: string
          import_batch_id: string | null
          last_contact_at: string | null
          name: string
          next_follow_up_at: string | null
          notes: string
          owner_profile_id: string | null
          phone: string | null
          phone_normalized: string | null
          service_interest: string | null
          source: string | null
          source_row_id: string | null
          stage: string
          status: string
          tags: string[]
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          company?: string
          converted_at?: string | null
          converted_client_id?: string | null
          created_at?: string
          currency?: string
          email?: string | null
          email_normalized?: string | null
          estimated_value?: number | null
          extra?: Json
          id?: string
          import_batch_id?: string | null
          last_contact_at?: string | null
          name?: string
          next_follow_up_at?: string | null
          notes?: string
          owner_profile_id?: string | null
          phone?: string | null
          phone_normalized?: string | null
          service_interest?: string | null
          source?: string | null
          source_row_id?: string | null
          stage?: string
          status?: string
          tags?: string[]
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          company?: string
          converted_at?: string | null
          converted_client_id?: string | null
          created_at?: string
          currency?: string
          email?: string | null
          email_normalized?: string | null
          estimated_value?: number | null
          extra?: Json
          id?: string
          import_batch_id?: string | null
          last_contact_at?: string | null
          name?: string
          next_follow_up_at?: string | null
          notes?: string
          owner_profile_id?: string | null
          phone?: string | null
          phone_normalized?: string | null
          service_interest?: string | null
          source?: string | null
          source_row_id?: string | null
          stage?: string
          status?: string
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_leads_converted_client_id_fkey"
            columns: ["converted_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_leads_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_leads_owner_profile_id_fkey"
            columns: ["owner_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      decision_logs: {
        Row: {
          created_at: string
          decision: string
          id: string
          impact: string
          made_by_role: string
          project_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          decision: string
          id?: string
          impact?: string
          made_by_role: string
          project_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          decision?: string
          id?: string
          impact?: string
          made_by_role?: string
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "decision_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      estimate_adjustments: {
        Row: {
          amount: number
          client_visible: boolean
          created_at: string
          estimate_id: string
          id: string
          kind: string
          label: string
          notes: string
          updated_at: string
        }
        Insert: {
          amount?: number
          client_visible?: boolean
          created_at?: string
          estimate_id: string
          id?: string
          kind?: string
          label: string
          notes?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          client_visible?: boolean
          created_at?: string
          estimate_id?: string
          id?: string
          kind?: string
          label?: string
          notes?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "estimate_adjustments_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "project_estimates"
            referencedColumns: ["id"]
          },
        ]
      }
      estimate_items: {
        Row: {
          acceptance_criteria: string
          ai_generated: boolean
          base_hours: number
          client_optional: boolean
          client_visible: boolean
          client_visible_description: string
          client_visible_label: string
          complexity_level: string
          complexity_multiplier: number
          created_at: string
          dependency_notes: string
          description: string
          estimate_id: string
          estimated_hours_max: number
          estimated_hours_min: number
          id: string
          integration_multiplier: number
          max_quantity: number
          option_group: string
          option_tier: string
          project_phase: string
          quantity: number
          responsible_role: string
          risk_notes: string
          selected_by_client: boolean
          sort_order: number
          source_message_id: string | null
          supplier_id: string | null
          title: string
          uncertainty_multiplier: number
          updated_at: string
        }
        Insert: {
          acceptance_criteria?: string
          ai_generated?: boolean
          base_hours?: number
          client_optional?: boolean
          client_visible?: boolean
          client_visible_description?: string
          client_visible_label?: string
          complexity_level?: string
          complexity_multiplier?: number
          created_at?: string
          dependency_notes?: string
          description?: string
          estimate_id: string
          estimated_hours_max?: number
          estimated_hours_min?: number
          id?: string
          integration_multiplier?: number
          max_quantity?: number
          option_group?: string
          option_tier?: string
          project_phase?: string
          quantity?: number
          responsible_role?: string
          risk_notes?: string
          selected_by_client?: boolean
          sort_order?: number
          source_message_id?: string | null
          supplier_id?: string | null
          title: string
          uncertainty_multiplier?: number
          updated_at?: string
        }
        Update: {
          acceptance_criteria?: string
          ai_generated?: boolean
          base_hours?: number
          client_optional?: boolean
          client_visible?: boolean
          client_visible_description?: string
          client_visible_label?: string
          complexity_level?: string
          complexity_multiplier?: number
          created_at?: string
          dependency_notes?: string
          description?: string
          estimate_id?: string
          estimated_hours_max?: number
          estimated_hours_min?: number
          id?: string
          integration_multiplier?: number
          max_quantity?: number
          option_group?: string
          option_tier?: string
          project_phase?: string
          quantity?: number
          responsible_role?: string
          risk_notes?: string
          selected_by_client?: boolean
          sort_order?: number
          source_message_id?: string | null
          supplier_id?: string | null
          title?: string
          uncertainty_multiplier?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "estimate_items_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "project_estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_items_source_message_id_fkey"
            columns: ["source_message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_items_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      estimate_role_allocations: {
        Row: {
          calculated_internal_cost_max: number
          calculated_internal_cost_min: number
          created_at: string
          estimate_id: string
          estimated_hours_max: number
          estimated_hours_min: number
          fixed_internal_cost: number | null
          id: string
          internal_hourly_cost: number
          notes: string
          role: string
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          calculated_internal_cost_max?: number
          calculated_internal_cost_min?: number
          created_at?: string
          estimate_id: string
          estimated_hours_max?: number
          estimated_hours_min?: number
          fixed_internal_cost?: number | null
          id?: string
          internal_hourly_cost?: number
          notes?: string
          role: string
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          calculated_internal_cost_max?: number
          calculated_internal_cost_min?: number
          created_at?: string
          estimate_id?: string
          estimated_hours_max?: number
          estimated_hours_min?: number
          fixed_internal_cost?: number | null
          id?: string
          internal_hourly_cost?: number
          notes?: string
          role?: string
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "estimate_role_allocations_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "project_estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_role_allocations_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      estimate_scenarios: {
        Row: {
          client_notes: string
          created_at: string
          created_by_agent: string
          estimate_id: string
          estimated_budget_max: number
          estimated_budget_min: number
          estimated_hours_max: number
          estimated_hours_min: number
          id: string
          is_promoted: boolean
          name: string
          project_id: string
          selections: Json
          source_message_id: string | null
          updated_at: string
        }
        Insert: {
          client_notes?: string
          created_at?: string
          created_by_agent?: string
          estimate_id: string
          estimated_budget_max?: number
          estimated_budget_min?: number
          estimated_hours_max?: number
          estimated_hours_min?: number
          id?: string
          is_promoted?: boolean
          name: string
          project_id: string
          selections?: Json
          source_message_id?: string | null
          updated_at?: string
        }
        Update: {
          client_notes?: string
          created_at?: string
          created_by_agent?: string
          estimate_id?: string
          estimated_budget_max?: number
          estimated_budget_min?: number
          estimated_hours_max?: number
          estimated_hours_min?: number
          id?: string
          is_promoted?: boolean
          name?: string
          project_id?: string
          selections?: Json
          source_message_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "estimate_scenarios_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "project_estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_scenarios_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_scenarios_source_message_id_fkey"
            columns: ["source_message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      estimate_supplier_reviews: {
        Row: {
          agency_notes: string
          assumptions: string
          created_at: string
          delivery_risk: string
          dependencies: string
          estimate_id: string
          fixed_quote: number | null
          id: string
          item_id: string
          missing_information: string
          proposed_duration_days: number | null
          source_message_id: string | null
          status: string
          suggested_hours_max: number | null
          suggested_hours_min: number | null
          supplier_decision: string
          supplier_id: string
          updated_at: string
          weekly_availability_hours: number | null
        }
        Insert: {
          agency_notes?: string
          assumptions?: string
          created_at?: string
          delivery_risk?: string
          dependencies?: string
          estimate_id: string
          fixed_quote?: number | null
          id?: string
          item_id: string
          missing_information?: string
          proposed_duration_days?: number | null
          source_message_id?: string | null
          status?: string
          suggested_hours_max?: number | null
          suggested_hours_min?: number | null
          supplier_decision?: string
          supplier_id: string
          updated_at?: string
          weekly_availability_hours?: number | null
        }
        Update: {
          agency_notes?: string
          assumptions?: string
          created_at?: string
          delivery_risk?: string
          dependencies?: string
          estimate_id?: string
          fixed_quote?: number | null
          id?: string
          item_id?: string
          missing_information?: string
          proposed_duration_days?: number | null
          source_message_id?: string | null
          status?: string
          suggested_hours_max?: number | null
          suggested_hours_min?: number | null
          supplier_decision?: string
          supplier_id?: string
          updated_at?: string
          weekly_availability_hours?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "estimate_supplier_reviews_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "project_estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_supplier_reviews_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "estimate_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_supplier_reviews_source_message_id_fkey"
            columns: ["source_message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_supplier_reviews_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      estimate_versions: {
        Row: {
          created_at: string
          estimate_id: string
          id: string
          note: string
          project_id: string
          snapshot: Json
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          estimate_id: string
          id?: string
          note?: string
          project_id: string
          snapshot?: Json
          updated_at?: string
          version: number
        }
        Update: {
          created_at?: string
          estimate_id?: string
          id?: string
          note?: string
          project_id?: string
          snapshot?: Json
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "estimate_versions_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "project_estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_versions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      execution_packages: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          package: Json
          project_id: string
          proposal_version_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          package: Json
          project_id: string
          proposal_version_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          version: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          package?: Json
          project_id?: string
          proposal_version_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "execution_packages_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "execution_packages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "execution_packages_proposal_version_id_fkey"
            columns: ["proposal_version_id"]
            isOneToOne: false
            referencedRelation: "proposal_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "execution_packages_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      files: {
        Row: {
          added_by: string
          created_at: string
          file_type: string
          id: string
          project_id: string
          title: string
          updated_at: string
          url: string
          visibility: string
        }
        Insert: {
          added_by?: string
          created_at?: string
          file_type?: string
          id?: string
          project_id: string
          title: string
          updated_at?: string
          url: string
          visibility?: string
        }
        Update: {
          added_by?: string
          created_at?: string
          file_type?: string
          id?: string
          project_id?: string
          title?: string
          updated_at?: string
          url?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      import_batches: {
        Row: {
          created_at: string
          failed_rows: number
          file_name: string
          file_type: string
          id: string
          imported_at: string
          imported_by: string | null
          mapping_json: Json
          skipped_rows: number
          status: string
          storage_path: string | null
          successful_rows: number
          total_rows: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          failed_rows?: number
          file_name: string
          file_type: string
          id?: string
          imported_at?: string
          imported_by?: string | null
          mapping_json?: Json
          skipped_rows?: number
          status?: string
          storage_path?: string | null
          successful_rows?: number
          total_rows?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          failed_rows?: number
          file_name?: string
          file_type?: string
          id?: string
          imported_at?: string
          imported_by?: string | null
          mapping_json?: Json
          skipped_rows?: number
          status?: string
          storage_path?: string | null
          successful_rows?: number
          total_rows?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_batches_imported_by_fkey"
            columns: ["imported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      import_rows: {
        Row: {
          batch_id: string
          created_at: string
          error: string | null
          id: string
          raw: Json
          resolution: string
          row_index: number
          sheet_name: string
          sheet_type: string
          status: string
          target_id: string | null
          target_table: string | null
          updated_at: string
        }
        Insert: {
          batch_id: string
          created_at?: string
          error?: string | null
          id?: string
          raw?: Json
          resolution?: string
          row_index: number
          sheet_name?: string
          sheet_type?: string
          status?: string
          target_id?: string | null
          target_table?: string | null
          updated_at?: string
        }
        Update: {
          batch_id?: string
          created_at?: string
          error?: string | null
          id?: string
          raw?: Json
          resolution?: string
          row_index?: number
          sheet_name?: string
          sheet_type?: string
          status?: string
          target_id?: string | null
          target_table?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_rows_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_conversation_messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          id: string
          sender_profile_id: string | null
          sender_type: string
          source_key: string | null
          updated_at: string
          visibility: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          sender_profile_id?: string | null
          sender_type: string
          source_key?: string | null
          updated_at?: string
          visibility?: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          sender_profile_id?: string | null
          sender_type?: string
          source_key?: string | null
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_conversation_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "lead_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_conversation_messages_sender_profile_id_fkey"
            columns: ["sender_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_conversations: {
        Row: {
          client_id: string
          created_at: string
          disqualification_reason: string
          first_opened_at: string | null
          id: string
          invitation_id: string | null
          last_agency_message_at: string | null
          last_agency_read_at: string | null
          last_client_message_at: string | null
          pause_message: string
          profile_id: string
          project_id: string | null
          promoted_at: string | null
          promoted_by: string | null
          status: string
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          disqualification_reason?: string
          first_opened_at?: string | null
          id?: string
          invitation_id?: string | null
          last_agency_message_at?: string | null
          last_agency_read_at?: string | null
          last_client_message_at?: string | null
          pause_message?: string
          profile_id: string
          project_id?: string | null
          promoted_at?: string | null
          promoted_by?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          disqualification_reason?: string
          first_opened_at?: string | null
          id?: string
          invitation_id?: string | null
          last_agency_message_at?: string | null
          last_agency_read_at?: string | null
          last_client_message_at?: string | null
          pause_message?: string
          profile_id?: string
          project_id?: string | null
          promoted_at?: string | null
          promoted_by?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_conversations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_conversations_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "onboarding_invitations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_conversations_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_conversations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_conversations_promoted_by_fkey"
            columns: ["promoted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_sources: {
        Row: {
          ai_derived: boolean
          captured_at: string
          created_at: string
          created_by: string | null
          external_url: string | null
          extracted_text: string
          id: string
          meeting_id: string
          mime_type: string | null
          project_id: string
          review_status: string
          source_type: string
          speaker: string
          storage_path: string | null
          title: string
          transcript: string
          updated_at: string
        }
        Insert: {
          ai_derived?: boolean
          captured_at?: string
          created_at?: string
          created_by?: string | null
          external_url?: string | null
          extracted_text?: string
          id?: string
          meeting_id: string
          mime_type?: string | null
          project_id: string
          review_status?: string
          source_type: string
          speaker?: string
          storage_path?: string | null
          title?: string
          transcript?: string
          updated_at?: string
        }
        Update: {
          ai_derived?: boolean
          captured_at?: string
          created_at?: string
          created_by?: string | null
          external_url?: string | null
          extracted_text?: string
          id?: string
          meeting_id?: string
          mime_type?: string | null
          project_id?: string
          review_status?: string
          source_type?: string
          speaker?: string
          storage_path?: string | null
          title?: string
          transcript?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_sources_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_sources_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "client_meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_sources_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_time_charges: {
        Row: {
          actual_minutes: number
          billable_hours: number
          created_at: string
          created_by: string | null
          deducted_at: string | null
          id: string
          meeting_id: string
          paid_hours_id: string | null
          project_id: string
        }
        Insert: {
          actual_minutes: number
          billable_hours: number
          created_at?: string
          created_by?: string | null
          deducted_at?: string | null
          id?: string
          meeting_id: string
          paid_hours_id?: string | null
          project_id: string
        }
        Update: {
          actual_minutes?: number
          billable_hours?: number
          created_at?: string
          created_by?: string | null
          deducted_at?: string | null
          id?: string
          meeting_id?: string
          paid_hours_id?: string | null
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_time_charges_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_time_charges_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: true
            referencedRelation: "client_meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_time_charges_paid_hours_id_fkey"
            columns: ["paid_hours_id"]
            isOneToOne: false
            referencedRelation: "paid_hours"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_time_charges_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_invitations: {
        Row: {
          accepted_at: string | null
          client_id: string | null
          company: string
          contact_name: string
          created_at: string
          created_by: string | null
          email: string
          emailed: boolean
          expires_at: string | null
          id: string
          invite_link: string
          invited_profile_id: string | null
          phone: string
          project_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          status: string
          supplier_id: string | null
          token: string
          updated_at: string
          used_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          client_id?: string | null
          company?: string
          contact_name?: string
          created_at?: string
          created_by?: string | null
          email: string
          emailed?: boolean
          expires_at?: string | null
          id?: string
          invite_link?: string
          invited_profile_id?: string | null
          phone?: string
          project_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          status?: string
          supplier_id?: string | null
          token?: string
          updated_at?: string
          used_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          client_id?: string | null
          company?: string
          contact_name?: string
          created_at?: string
          created_by?: string | null
          email?: string
          emailed?: boolean
          expires_at?: string | null
          id?: string
          invite_link?: string
          invited_profile_id?: string | null
          phone?: string
          project_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          supplier_id?: string | null
          token?: string
          updated_at?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_invitations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_invitations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_invitations_invited_profile_id_fkey"
            columns: ["invited_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_invitations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_invitations_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_state: {
        Row: {
          answers: Json
          completion_percentage: number
          created_at: string
          current_step: number
          onboarding_completed_at: string | null
          onboarding_started_at: string
          profile_id: string
          role: Database["public"]["Enums"]["app_role"]
          skipped_steps: string[]
          updated_at: string
        }
        Insert: {
          answers?: Json
          completion_percentage?: number
          created_at?: string
          current_step?: number
          onboarding_completed_at?: string | null
          onboarding_started_at?: string
          profile_id: string
          role: Database["public"]["Enums"]["app_role"]
          skipped_steps?: string[]
          updated_at?: string
        }
        Update: {
          answers?: Json
          completion_percentage?: number
          created_at?: string
          current_step?: number
          onboarding_completed_at?: string | null
          onboarding_started_at?: string
          profile_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          skipped_steps?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_state_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      paid_hours: {
        Row: {
          client_id: string
          created_at: string
          expiry_date: string | null
          hours_purchased: number
          hours_remaining: number
          hours_used: number
          id: string
          project_id: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          expiry_date?: string | null
          hours_purchased?: number
          hours_remaining?: number
          hours_used?: number
          id?: string
          project_id?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          expiry_date?: string | null
          hours_purchased?: number
          hours_remaining?: number
          hours_used?: number
          id?: string
          project_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "paid_hours_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paid_hours_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      past_projects: {
        Row: {
          archived_at: string | null
          client_id: string | null
          created_at: string
          currency: string
          description: string
          end_date: string | null
          id: string
          import_batch_id: string | null
          lead_id: string | null
          notes: string
          outcome: string
          project_name: string
          source_row_id: string | null
          start_date: string | null
          status: string
          technologies: string[]
          updated_at: string
          value: number | null
        }
        Insert: {
          archived_at?: string | null
          client_id?: string | null
          created_at?: string
          currency?: string
          description?: string
          end_date?: string | null
          id?: string
          import_batch_id?: string | null
          lead_id?: string | null
          notes?: string
          outcome?: string
          project_name: string
          source_row_id?: string | null
          start_date?: string | null
          status?: string
          technologies?: string[]
          updated_at?: string
          value?: number | null
        }
        Update: {
          archived_at?: string | null
          client_id?: string | null
          created_at?: string
          currency?: string
          description?: string
          end_date?: string | null
          id?: string
          import_batch_id?: string | null
          lead_id?: string | null
          notes?: string
          outcome?: string
          project_name?: string
          source_row_id?: string | null
          start_date?: string | null
          status?: string
          technologies?: string[]
          updated_at?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "past_projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "past_projects_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "past_projects_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          due_date: string | null
          id: string
          notes: string
          project_id: string
          received_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          currency?: string
          due_date?: string | null
          id?: string
          notes?: string
          project_id: string
          received_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          due_date?: string | null
          id?: string
          notes?: string
          project_id?: string
          received_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      phase_pricing: {
        Row: {
          client_price: number
          created_at: string
          id: string
          notes: string
          phase_name: string
          pricing_id: string
          supplier_cost: number
          updated_at: string
        }
        Insert: {
          client_price?: number
          created_at?: string
          id?: string
          notes?: string
          phase_name: string
          pricing_id: string
          supplier_cost?: number
          updated_at?: string
        }
        Update: {
          client_price?: number
          created_at?: string
          id?: string
          notes?: string
          phase_name?: string
          pricing_id?: string
          supplier_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "phase_pricing_pricing_id_fkey"
            columns: ["pricing_id"]
            isOneToOne: false
            referencedRelation: "project_pricing"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          client_id: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["app_role"]
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          email: string
          full_name?: string
          id: string
          is_active?: boolean
          role: Database["public"]["Enums"]["app_role"]
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      project_assumptions: {
        Row: {
          body: string
          client_visible: boolean
          created_at: string
          id: string
          kind: string
          project_id: string
          source_message_id: string | null
          status: string
          supplier_visible: boolean
          updated_at: string
        }
        Insert: {
          body: string
          client_visible?: boolean
          created_at?: string
          id?: string
          kind?: string
          project_id: string
          source_message_id?: string | null
          status?: string
          supplier_visible?: boolean
          updated_at?: string
        }
        Update: {
          body?: string
          client_visible?: boolean
          created_at?: string
          id?: string
          kind?: string
          project_id?: string
          source_message_id?: string | null
          status?: string
          supplier_visible?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_assumptions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_assumptions_source_message_id_fkey"
            columns: ["source_message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      project_briefs: {
        Row: {
          ai_draft_notes: string
          assumptions: string[]
          constraints: string[]
          created_at: string
          discovery_notes: string
          exclusions: string[]
          final_agency_notes: string
          goals: string[]
          id: string
          problem_statement: string
          project_id: string
          updated_at: string
        }
        Insert: {
          ai_draft_notes?: string
          assumptions?: string[]
          constraints?: string[]
          created_at?: string
          discovery_notes?: string
          exclusions?: string[]
          final_agency_notes?: string
          goals?: string[]
          id?: string
          problem_statement?: string
          project_id: string
          updated_at?: string
        }
        Update: {
          ai_draft_notes?: string
          assumptions?: string[]
          constraints?: string[]
          created_at?: string
          discovery_notes?: string
          exclusions?: string[]
          final_agency_notes?: string
          goals?: string[]
          id?: string
          problem_statement?: string
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_briefs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_conversations: {
        Row: {
          created_at: string
          id: string
          kind: string
          project_id: string
          status: string
          supplier_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          project_id: string
          status?: string
          supplier_id?: string | null
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          project_id?: string
          status?: string
          supplier_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_conversations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_conversations_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      project_documents: {
        Row: {
          audience: string
          content_hash: string
          created_at: string
          created_by: string | null
          document_type: string
          id: string
          language: string
          markdown: string
          project_id: string
          proposal_version_id: string | null
          status: string
          storage_path: string | null
          version: number
        }
        Insert: {
          audience: string
          content_hash?: string
          created_at?: string
          created_by?: string | null
          document_type: string
          id?: string
          language?: string
          markdown?: string
          project_id: string
          proposal_version_id?: string | null
          status?: string
          storage_path?: string | null
          version?: number
        }
        Update: {
          audience?: string
          content_hash?: string
          created_at?: string
          created_by?: string | null
          document_type?: string
          id?: string
          language?: string
          markdown?: string
          project_id?: string
          proposal_version_id?: string | null
          status?: string
          storage_path?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_documents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_documents_proposal_version_id_fkey"
            columns: ["proposal_version_id"]
            isOneToOne: false
            referencedRelation: "proposal_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      project_estimates: {
        Row: {
          approved_by_yaniv: boolean
          change_request_rule: string
          client_calculation_rate: number
          client_visible: boolean
          contingency_percent: number
          created_at: string
          currency: string
          delivery_end_date: string | null
          delivery_range_label: string
          delivery_start_date: string | null
          estimate_rounding_increment: number
          estimated_budget_max: number
          estimated_budget_min: number
          estimated_hours_max: number
          estimated_hours_min: number
          external_costs: number
          final_fixed_price: number | null
          fixed_price_exclusions: string
          fixed_price_scope: string
          id: string
          internal_cost: number
          management_buffer_percent: number
          minimum_billing_unit: number
          notes: string
          payment_milestones: string
          project_id: string
          recommended_fixed_price: number
          risk_buffer_percent: number
          show_hourly_rate_to_client: boolean
          source_conversation_id: string | null
          status: string
          target_margin_percent: number
          testing_buffer_percent: number
          updated_at: string
          validity_date: string | null
          version: number
          yaniv_internal_hourly_cost: number
        }
        Insert: {
          approved_by_yaniv?: boolean
          change_request_rule?: string
          client_calculation_rate?: number
          client_visible?: boolean
          contingency_percent?: number
          created_at?: string
          currency?: string
          delivery_end_date?: string | null
          delivery_range_label?: string
          delivery_start_date?: string | null
          estimate_rounding_increment?: number
          estimated_budget_max?: number
          estimated_budget_min?: number
          estimated_hours_max?: number
          estimated_hours_min?: number
          external_costs?: number
          final_fixed_price?: number | null
          fixed_price_exclusions?: string
          fixed_price_scope?: string
          id?: string
          internal_cost?: number
          management_buffer_percent?: number
          minimum_billing_unit?: number
          notes?: string
          payment_milestones?: string
          project_id: string
          recommended_fixed_price?: number
          risk_buffer_percent?: number
          show_hourly_rate_to_client?: boolean
          source_conversation_id?: string | null
          status?: string
          target_margin_percent?: number
          testing_buffer_percent?: number
          updated_at?: string
          validity_date?: string | null
          version?: number
          yaniv_internal_hourly_cost?: number
        }
        Update: {
          approved_by_yaniv?: boolean
          change_request_rule?: string
          client_calculation_rate?: number
          client_visible?: boolean
          contingency_percent?: number
          created_at?: string
          currency?: string
          delivery_end_date?: string | null
          delivery_range_label?: string
          delivery_start_date?: string | null
          estimate_rounding_increment?: number
          estimated_budget_max?: number
          estimated_budget_min?: number
          estimated_hours_max?: number
          estimated_hours_min?: number
          external_costs?: number
          final_fixed_price?: number | null
          fixed_price_exclusions?: string
          fixed_price_scope?: string
          id?: string
          internal_cost?: number
          management_buffer_percent?: number
          minimum_billing_unit?: number
          notes?: string
          payment_milestones?: string
          project_id?: string
          recommended_fixed_price?: number
          risk_buffer_percent?: number
          show_hourly_rate_to_client?: boolean
          source_conversation_id?: string | null
          status?: string
          target_margin_percent?: number
          testing_buffer_percent?: number
          updated_at?: string
          validity_date?: string | null
          version?: number
          yaniv_internal_hourly_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_estimates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_estimates_source_conversation_id_fkey"
            columns: ["source_conversation_id"]
            isOneToOne: false
            referencedRelation: "project_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      project_messages: {
        Row: {
          author_role: string
          body: string
          created_at: string
          id: string
          project_id: string
          updated_at: string
          visibility: string
        }
        Insert: {
          author_role: string
          body?: string
          created_at?: string
          id?: string
          project_id: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          author_role?: string
          body?: string
          created_at?: string
          id?: string
          project_id?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_pricing: {
        Row: {
          actual_margin_percent: number
          client_price: number
          created_at: string
          currency: string
          id: string
          pricing_notes: string
          project_id: string
          supplier_cost_estimate: number
          target_margin_percent: number
          updated_at: string
        }
        Insert: {
          actual_margin_percent?: number
          client_price?: number
          created_at?: string
          currency?: string
          id?: string
          pricing_notes?: string
          project_id: string
          supplier_cost_estimate?: number
          target_margin_percent?: number
          updated_at?: string
        }
        Update: {
          actual_margin_percent?: number
          client_price?: number
          created_at?: string
          currency?: string
          id?: string
          pricing_notes?: string
          project_id?: string
          supplier_cost_estimate?: number
          target_margin_percent?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_pricing_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_progress_updates: {
        Row: {
          body: string
          created_at: string
          id: string
          project_id: string
          source_message_id: string | null
          status: string
          supplier_id: string | null
          update_type: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          project_id: string
          source_message_id?: string | null
          status?: string
          supplier_id?: string | null
          update_type?: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          project_id?: string
          source_message_id?: string | null
          status?: string
          supplier_id?: string | null
          update_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_progress_updates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_progress_updates_source_message_id_fkey"
            columns: ["source_message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_progress_updates_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      project_prototypes: {
        Row: {
          created_at: string
          created_by: string
          id: string
          project_id: string
          prototype_kind: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          project_id: string
          prototype_kind: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          project_id?: string
          prototype_kind?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_prototypes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_prototypes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_questions: {
        Row: {
          answer: string
          asked_by_role: string
          created_at: string
          id: string
          project_id: string
          question: string
          source_message_id: string | null
          status: string
          target_role: string
          updated_at: string
        }
        Insert: {
          answer?: string
          asked_by_role: string
          created_at?: string
          id?: string
          project_id: string
          question: string
          source_message_id?: string | null
          status?: string
          target_role: string
          updated_at?: string
        }
        Update: {
          answer?: string
          asked_by_role?: string
          created_at?: string
          id?: string
          project_id?: string
          question?: string
          source_message_id?: string | null
          status?: string
          target_role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_questions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_questions_source_message_id_fkey"
            columns: ["source_message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      project_requirements: {
        Row: {
          category: string
          client_visible: boolean
          created_at: string
          detail: string
          id: string
          project_id: string
          source_message_id: string | null
          status: string
          supplier_visible: boolean
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          client_visible?: boolean
          created_at?: string
          detail?: string
          id?: string
          project_id: string
          source_message_id?: string | null
          status?: string
          supplier_visible?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          client_visible?: boolean
          created_at?: string
          detail?: string
          id?: string
          project_id?: string
          source_message_id?: string | null
          status?: string
          supplier_visible?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_requirements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_requirements_source_message_id_fkey"
            columns: ["source_message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      project_schedule: {
        Row: {
          approved_delivery_date: string | null
          client_response_delay_days: number
          created_at: string
          date_priority: string
          date_reason: string
          delivery_notes: string
          earliest_start_date: string | null
          external_approval_delay_days: number
          id: string
          partial_delivery_ok: boolean
          phase_one_date: string | null
          project_id: string
          recommended_delivery_end: string | null
          recommended_delivery_start: string | null
          requested_completion_date: string | null
          scope_changed_after_date_approval: boolean
          status_reason: string
          supplier_availability_confirmed: boolean
          target_date_status: string
          updated_at: string
          weekly_capacity_hours: number
        }
        Insert: {
          approved_delivery_date?: string | null
          client_response_delay_days?: number
          created_at?: string
          date_priority?: string
          date_reason?: string
          delivery_notes?: string
          earliest_start_date?: string | null
          external_approval_delay_days?: number
          id?: string
          partial_delivery_ok?: boolean
          phase_one_date?: string | null
          project_id: string
          recommended_delivery_end?: string | null
          recommended_delivery_start?: string | null
          requested_completion_date?: string | null
          scope_changed_after_date_approval?: boolean
          status_reason?: string
          supplier_availability_confirmed?: boolean
          target_date_status?: string
          updated_at?: string
          weekly_capacity_hours?: number
        }
        Update: {
          approved_delivery_date?: string | null
          client_response_delay_days?: number
          created_at?: string
          date_priority?: string
          date_reason?: string
          delivery_notes?: string
          earliest_start_date?: string | null
          external_approval_delay_days?: number
          id?: string
          partial_delivery_ok?: boolean
          phase_one_date?: string | null
          project_id?: string
          recommended_delivery_end?: string | null
          recommended_delivery_start?: string | null
          requested_completion_date?: string | null
          scope_changed_after_date_approval?: boolean
          status_reason?: string
          supplier_availability_confirmed?: boolean
          target_date_status?: string
          updated_at?: string
          weekly_capacity_hours?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_schedule_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_supplier_assignments: {
        Row: {
          created_at: string
          id: string
          project_id: string
          supplier_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          supplier_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          supplier_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_supplier_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_supplier_assignments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          archived_at: string | null
          budget_signal: string
          client_id: string
          created_at: string
          id: string
          name: string
          payment_gate_status: string
          planning_readiness: string
          status: string
          summary: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          budget_signal?: string
          client_id: string
          created_at?: string
          id?: string
          name: string
          payment_gate_status?: string
          planning_readiness?: string
          status?: string
          summary?: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          budget_signal?: string
          client_id?: string
          created_at?: string
          id?: string
          name?: string
          payment_gate_status?: string
          planning_readiness?: string
          status?: string
          summary?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_signatures: {
        Row: {
          acceptance_status: string
          created_at: string
          currency: string
          document_hash: string
          fixed_price: number
          id: string
          ip_address: unknown
          payment_terms: string
          project_id: string
          proposal_version_id: string
          signature_artifact: string
          signed_at: string
          signed_by: string | null
          signer_email: string
          signer_name: string
          signer_role: string
          specification_version_id: string
          user_agent: string
        }
        Insert: {
          acceptance_status?: string
          created_at?: string
          currency: string
          document_hash: string
          fixed_price: number
          id?: string
          ip_address?: unknown
          payment_terms: string
          project_id: string
          proposal_version_id: string
          signature_artifact: string
          signed_at?: string
          signed_by?: string | null
          signer_email: string
          signer_name: string
          signer_role: string
          specification_version_id: string
          user_agent?: string
        }
        Update: {
          acceptance_status?: string
          created_at?: string
          currency?: string
          document_hash?: string
          fixed_price?: number
          id?: string
          ip_address?: unknown
          payment_terms?: string
          project_id?: string
          proposal_version_id?: string
          signature_artifact?: string
          signed_at?: string
          signed_by?: string | null
          signer_email?: string
          signer_name?: string
          signer_role?: string
          specification_version_id?: string
          user_agent?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_signatures_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_signatures_proposal_version_id_fkey"
            columns: ["proposal_version_id"]
            isOneToOne: true
            referencedRelation: "proposal_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_signatures_signed_by_fkey"
            columns: ["signed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_signatures_specification_version_id_fkey"
            columns: ["specification_version_id"]
            isOneToOne: false
            referencedRelation: "specification_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_versions: {
        Row: {
          change_request_id: string | null
          content: Json
          created_at: string
          created_by: string | null
          currency: string
          document_hash: string
          estimate_id: string
          fixed_price: number
          id: string
          language: string
          payment_terms: string
          project_id: string
          proposal_kind: string
          published_at: string | null
          specification_version_id: string
          status: string
          version: number
          viewed_at: string | null
        }
        Insert: {
          change_request_id?: string | null
          content: Json
          created_at?: string
          created_by?: string | null
          currency: string
          document_hash: string
          estimate_id: string
          fixed_price: number
          id?: string
          language?: string
          payment_terms?: string
          project_id: string
          proposal_kind?: string
          published_at?: string | null
          specification_version_id: string
          status?: string
          version: number
          viewed_at?: string | null
        }
        Update: {
          change_request_id?: string | null
          content?: Json
          created_at?: string
          created_by?: string | null
          currency?: string
          document_hash?: string
          estimate_id?: string
          fixed_price?: number
          id?: string
          language?: string
          payment_terms?: string
          project_id?: string
          proposal_kind?: string
          published_at?: string | null
          specification_version_id?: string
          status?: string
          version?: number
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposal_versions_change_request_id_fkey"
            columns: ["change_request_id"]
            isOneToOne: false
            referencedRelation: "change_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_versions_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "project_estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_versions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_versions_specification_version_id_fkey"
            columns: ["specification_version_id"]
            isOneToOne: false
            referencedRelation: "specification_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      prototype_approvals: {
        Row: {
          approved_by: string
          comment: string
          created_at: string
          decision: string
          id: string
          project_id: string
          prototype_version_id: string
        }
        Insert: {
          approved_by: string
          comment?: string
          created_at?: string
          decision: string
          id?: string
          project_id: string
          prototype_version_id: string
        }
        Update: {
          approved_by?: string
          comment?: string
          created_at?: string
          decision?: string
          id?: string
          project_id?: string
          prototype_version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prototype_approvals_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prototype_approvals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prototype_approvals_prototype_version_id_fkey"
            columns: ["prototype_version_id"]
            isOneToOne: false
            referencedRelation: "prototype_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      prototype_versions: {
        Row: {
          audience: string
          content: Json
          created_at: string
          created_by: string
          id: string
          project_id: string
          prototype_id: string
          source_notes: string
          status: string
          summary: string
          title: string
          version: number
        }
        Insert: {
          audience?: string
          content: Json
          created_at?: string
          created_by: string
          id?: string
          project_id: string
          prototype_id: string
          source_notes?: string
          status?: string
          summary?: string
          title: string
          version: number
        }
        Update: {
          audience?: string
          content?: Json
          created_at?: string
          created_by?: string
          id?: string
          project_id?: string
          prototype_id?: string
          source_notes?: string
          status?: string
          summary?: string
          title?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "prototype_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prototype_versions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prototype_versions_prototype_id_fkey"
            columns: ["prototype_id"]
            isOneToOne: false
            referencedRelation: "project_prototypes"
            referencedColumns: ["id"]
          },
        ]
      }
      public_registrations: {
        Row: {
          client_id: string | null
          company: string
          confirmed_at: string | null
          consent_at: string | null
          contact_name: string
          converted_at: string | null
          created_at: string
          email: string
          id: string
          ip_hash: string
          message: string
          phone: string
          preferred_language: string
          profile_id: string | null
          review_notes: string
          reviewed_at: string | null
          reviewed_by: string | null
          role: string
          seen_by_admin: boolean
          source: string
          status: string
          supplier_id: string | null
          timezone: string
          updated_at: string
          user_agent: string
        }
        Insert: {
          client_id?: string | null
          company?: string
          confirmed_at?: string | null
          consent_at?: string | null
          contact_name: string
          converted_at?: string | null
          created_at?: string
          email: string
          id?: string
          ip_hash?: string
          message?: string
          phone?: string
          preferred_language?: string
          profile_id?: string | null
          review_notes?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          role: string
          seen_by_admin?: boolean
          source?: string
          status?: string
          supplier_id?: string | null
          timezone?: string
          updated_at?: string
          user_agent?: string
        }
        Update: {
          client_id?: string | null
          company?: string
          confirmed_at?: string | null
          consent_at?: string | null
          contact_name?: string
          converted_at?: string | null
          created_at?: string
          email?: string
          id?: string
          ip_hash?: string
          message?: string
          phone?: string
          preferred_language?: string
          profile_id?: string | null
          review_notes?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          role?: string
          seen_by_admin?: boolean
          source?: string
          status?: string
          supplier_id?: string | null
          timezone?: string
          updated_at?: string
          user_agent?: string
        }
        Relationships: [
          {
            foreignKeyName: "public_registrations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_registrations_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_registrations_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_registrations_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      registration_audit_log: {
        Row: {
          actor_profile_id: string | null
          created_at: string
          detail: Json
          email: string
          event: string
          id: string
          ip_hash: string
          registration_id: string | null
          role: string | null
        }
        Insert: {
          actor_profile_id?: string | null
          created_at?: string
          detail?: Json
          email?: string
          event: string
          id?: string
          ip_hash?: string
          registration_id?: string | null
          role?: string | null
        }
        Update: {
          actor_profile_id?: string | null
          created_at?: string
          detail?: Json
          email?: string
          event?: string
          id?: string
          ip_hash?: string
          registration_id?: string | null
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "registration_audit_log_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registration_audit_log_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "public_registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      registration_settings: {
        Row: {
          created_at: string
          daily_limit: number
          enabled: boolean
          intro_text: string
          path_code: string
          role: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          daily_limit?: number
          enabled?: boolean
          intro_text?: string
          path_code?: string
          role: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          daily_limit?: number
          enabled?: boolean
          intro_text?: string
          path_code?: string
          role?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "registration_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      scope_items: {
        Row: {
          acceptance_notes: string
          client_visible: boolean
          created_at: string
          description: string
          id: string
          phase: string
          scope_id: string
          supplier_visible: boolean
          title: string
          updated_at: string
        }
        Insert: {
          acceptance_notes?: string
          client_visible?: boolean
          created_at?: string
          description?: string
          id?: string
          phase?: string
          scope_id: string
          supplier_visible?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          acceptance_notes?: string
          client_visible?: boolean
          created_at?: string
          description?: string
          id?: string
          phase?: string
          scope_id?: string
          supplier_visible?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scope_items_scope_id_fkey"
            columns: ["scope_id"]
            isOneToOne: false
            referencedRelation: "scopes"
            referencedColumns: ["id"]
          },
        ]
      }
      scopes: {
        Row: {
          approved_date: string | null
          client_facing_summary: string
          created_at: string
          id: string
          internal_delivery_notes: string
          project_id: string
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          approved_date?: string | null
          client_facing_summary?: string
          created_at?: string
          id?: string
          internal_delivery_notes?: string
          project_id: string
          status?: string
          updated_at?: string
          version?: number
        }
        Update: {
          approved_date?: string | null
          client_facing_summary?: string
          created_at?: string
          id?: string
          internal_delivery_notes?: string
          project_id?: string
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "scopes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      specification_section_sources: {
        Row: {
          created_at: string
          id: string
          meeting_source_id: string | null
          message_id: string | null
          section_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          meeting_source_id?: string | null
          message_id?: string | null
          section_id: string
        }
        Update: {
          created_at?: string
          id?: string
          meeting_source_id?: string | null
          message_id?: string | null
          section_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "specification_section_sources_meeting_source_id_fkey"
            columns: ["meeting_source_id"]
            isOneToOne: false
            referencedRelation: "meeting_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "specification_section_sources_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "specification_section_sources_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "specification_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      specification_sections: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          client_visible: boolean
          content: string
          created_at: string
          id: string
          meeting_id: string | null
          project_id: string
          section_key: string
          sort_order: number
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          client_visible?: boolean
          content?: string
          created_at?: string
          id?: string
          meeting_id?: string | null
          project_id: string
          section_key: string
          sort_order?: number
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          client_visible?: boolean
          content?: string
          created_at?: string
          id?: string
          meeting_id?: string | null
          project_id?: string
          section_key?: string
          sort_order?: number
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "specification_sections_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "specification_sections_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "client_meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "specification_sections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      specification_versions: {
        Row: {
          content_hash: string
          created_at: string
          created_by: string | null
          id: string
          project_id: string
          snapshot: Json
          version: number
        }
        Insert: {
          content_hash: string
          created_at?: string
          created_by?: string | null
          id?: string
          project_id: string
          snapshot: Json
          version: number
        }
        Update: {
          content_hash?: string
          created_at?: string
          created_by?: string | null
          id?: string
          project_id?: string
          snapshot?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "specification_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "specification_versions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_payments: {
        Row: {
          amount_owed: number
          amount_paid: number
          created_at: string
          currency: string
          id: string
          project_id: string
          status: string
          supplier_id: string
          updated_at: string
        }
        Insert: {
          amount_owed?: number
          amount_paid?: number
          created_at?: string
          currency?: string
          id?: string
          project_id: string
          status?: string
          supplier_id: string
          updated_at?: string
        }
        Update: {
          amount_owed?: number
          amount_paid?: number
          created_at?: string
          currency?: string
          id?: string
          project_id?: string
          status?: string
          supplier_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_payments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_profiles: {
        Row: {
          created_at: string
          currency: string
          hourly_rate: number
          languages: string[]
          main_skills: string[]
          notes: string
          portfolio_links: string[]
          supplier_id: string
          tools: string[]
          updated_at: string
          weekly_availability_hours: number
          years_of_experience: number
        }
        Insert: {
          created_at?: string
          currency?: string
          hourly_rate?: number
          languages?: string[]
          main_skills?: string[]
          notes?: string
          portfolio_links?: string[]
          supplier_id: string
          tools?: string[]
          updated_at?: string
          weekly_availability_hours?: number
          years_of_experience?: number
        }
        Update: {
          created_at?: string
          currency?: string
          hourly_rate?: number
          languages?: string[]
          main_skills?: string[]
          notes?: string
          portfolio_links?: string[]
          supplier_id?: string
          tools?: string[]
          updated_at?: string
          weekly_availability_hours?: number
          years_of_experience?: number
        }
        Relationships: [
          {
            foreignKeyName: "supplier_profiles_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: true
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_skill_suggestions: {
        Row: {
          created_at: string
          id: string
          reviewed_by: string | null
          source_text: string
          status: string
          suggested_skill: string
          supplier_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          reviewed_by?: string | null
          source_text?: string
          status?: string
          suggested_skill: string
          supplier_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          reviewed_by?: string | null
          source_text?: string
          status?: string
          suggested_skill?: string
          supplier_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_skill_suggestions_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_time_entries: {
        Row: {
          approved_by: string | null
          created_at: string
          description: string
          entry_date: string
          hours: number
          id: string
          project_id: string
          status: string
          supplier_id: string
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          description?: string
          entry_date: string
          hours: number
          id?: string
          project_id: string
          status?: string
          supplier_id: string
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          description?: string
          entry_date?: string
          hours?: number
          id?: string
          project_id?: string
          status?: string
          supplier_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_time_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_time_entries_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          archived_at: string | null
          country: string
          created_at: string
          email: string
          id: string
          name: string
          phone: string | null
          status: string
          timezone: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          country?: string
          created_at?: string
          email: string
          id?: string
          name: string
          phone?: string | null
          status?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          country?: string
          created_at?: string
          email?: string
          id?: string
          name?: string
          phone?: string | null
          status?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      finish_client_meeting: {
        Args: {
          p_billable_hours?: number
          p_meeting_id: string
          p_paid_hours_id?: string
        }
        Returns: {
          conversation_id: string | null
          created_at: string
          duration_minutes: number | null
          ended_at: string | null
          id: string
          language: string
          lead_id: string | null
          project_id: string
          started_at: string
          started_by: string | null
          status: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "client_meetings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      promote_client_onboarding: {
        Args: { _profile_id: string; _project_name?: string }
        Returns: string
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      submit_client_onboarding: { Args: { _answers: Json }; Returns: string }
      submit_supplier_onboarding: { Args: { _answers: Json }; Returns: string }
    }
    Enums: {
      app_role: "agency_admin" | "client" | "supplier"
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
      app_role: ["agency_admin", "client", "supplier"],
    },
  },
} as const
