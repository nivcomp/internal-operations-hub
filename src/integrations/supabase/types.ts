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
          conversation_id: string | null
          created_at: string
          draft_type: string
          id: string
          message_id: string | null
          payload: Json
          project_id: string
          status: string
          updated_at: string
          visibility: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          draft_type: string
          id?: string
          message_id?: string | null
          payload?: Json
          project_id: string
          status?: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          draft_type?: string
          id?: string
          message_id?: string | null
          payload?: Json
          project_id?: string
          status?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_generated_drafts_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "project_conversations"
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
      change_requests: {
        Row: {
          agency_price: number | null
          approved_date: string | null
          created_at: string
          description: string
          id: string
          project_id: string
          requested_by_client_id: string
          status: string
          supplier_cost: number | null
          title: string
          updated_at: string
        }
        Insert: {
          agency_price?: number | null
          approved_date?: string | null
          created_at?: string
          description?: string
          id?: string
          project_id: string
          requested_by_client_id: string
          status?: string
          supplier_cost?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          agency_price?: number | null
          approved_date?: string | null
          created_at?: string
          description?: string
          id?: string
          project_id?: string
          requested_by_client_id?: string
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
      clients: {
        Row: {
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
          budget_signal: string
          client_id: string
          created_at: string
          id: string
          name: string
          payment_gate_status: string
          status: string
          summary: string
          updated_at: string
        }
        Insert: {
          budget_signal?: string
          client_id: string
          created_at?: string
          id?: string
          name: string
          payment_gate_status?: string
          status?: string
          summary?: string
          updated_at?: string
        }
        Update: {
          budget_signal?: string
          client_id?: string
          created_at?: string
          id?: string
          name?: string
          payment_gate_status?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
