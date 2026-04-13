export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          age: number | null;
          skills: string[];
          experience_years: number | null;
          desired_salary: string | null;
          desired_location: string | null;
          desired_role: string | null;
          values: string | null;
          raw_conversation: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          age?: number | null;
          skills?: string[];
          experience_years?: number | null;
          desired_salary?: string | null;
          desired_location?: string | null;
          desired_role?: string | null;
          values?: string | null;
          raw_conversation?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          age?: number | null;
          skills?: string[];
          experience_years?: number | null;
          desired_salary?: string | null;
          desired_location?: string | null;
          desired_role?: string | null;
          values?: string | null;
          raw_conversation?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      jobs: {
        Row: {
          id: string;
          title: string;
          company: string | null;
          description: string | null;
          location: string | null;
          salary: string | null;
          url: string | null;
          source: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          company?: string | null;
          description?: string | null;
          location?: string | null;
          salary?: string | null;
          url?: string | null;
          source?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          company?: string | null;
          description?: string | null;
          location?: string | null;
          salary?: string | null;
          url?: string | null;
          source?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      applications: {
        Row: {
          id: string;
          user_id: string;
          job_id: string;
          status: string;
          applied_at: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          job_id: string;
          status?: string;
          applied_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          job_id?: string;
          status?: string;
          applied_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "applications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "applications_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      documents: {
        Row: {
          id: string;
          user_id: string;
          job_id: string | null;
          doc_type: string;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          job_id?: string | null;
          doc_type: string;
          content: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          job_id?: string | null;
          doc_type?: string;
          content?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "documents_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "documents_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Job = Database["public"]["Tables"]["jobs"]["Row"];
export type Application = Database["public"]["Tables"]["applications"]["Row"];
export type Document = Database["public"]["Tables"]["documents"]["Row"];

export type ApplicationStatus =
  | "interested"
  | "applied"
  | "interviewing"
  | "offered"
  | "rejected"
  | "withdrawn";

export type DocType = "resume" | "cv" | "motivation_letter";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ProfileData {
  age?: number;
  skills?: string[];
  experience_years?: number;
  desired_salary?: string;
  desired_location?: string;
  desired_role?: string;
  values?: string;
}

export interface JobWithScore extends Job {
  score: number;
  reason: string;
}
