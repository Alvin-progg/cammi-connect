import type { AppointmentAuditAction } from "@/lib/appointments/audit";
import type {
  AppointmentStatus,
  BookingSource,
} from "@/lib/appointments/status";
import type { UserRole } from "@/lib/auth/roles";
import type { ChatRole } from "@/lib/chat/schemas";
import type { NotificationType } from "@/lib/notifications/types";
import type { ScheduleExceptionType } from "@/lib/schedules/types";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

/**
 * Manual database contract for the application tables. Keep this in sync
 * with db/migrations/0001_profiles_appointments.sql,
 * db/migrations/0002_doctor_dashboard_suite.sql,
 * db/migrations/0003_doctor_specialty_schedules.sql,
 * db/migrations/0004_chat.sql, and
 * db/migrations/0006–0007 (appointment lifecycle and audit log).
 */
export type Database = {
  public: {
    Tables: {
      departments: {
        Row: {
          id: string;
          name: string;
          code: string;
          description: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          code: string;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          name?: string;
          code?: string;
          description?: string | null;
          is_active?: boolean;
        };
        Relationships: [];
      };
      specialties: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          name?: string;
          description?: string | null;
          is_active?: boolean;
        };
        Relationships: [];
      };
      doctors: {
        Row: {
          id: string;
          department_id: string | null;
          full_name: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          department_id?: string | null;
          full_name: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          department_id?: string | null;
          full_name?: string;
          is_active?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      doctor_specialties: {
        Row: {
          doctor_id: string;
          specialty_id: string;
        };
        Insert: {
          doctor_id: string;
          specialty_id: string;
        };
        Update: {
          doctor_id?: string;
          specialty_id?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          auth_user_id: string | null;
          role: UserRole;
          full_name: string;
          department_id: string | null;
          specialty: string | null;
          phone: string | null;
          clinic_note: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          auth_user_id?: string | null;
          role?: UserRole;
          full_name: string;
          department_id?: string | null;
          specialty?: string | null;
          phone?: string | null;
          clinic_note?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          auth_user_id?: string | null;
          role?: UserRole;
          full_name?: string;
          department_id?: string | null;
          specialty?: string | null;
          phone?: string | null;
          clinic_note?: string | null;
          is_active?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      appointments: {
        Row: {
          id: string;
          doctor_id: string;
          patient_id: string;
          scheduled_at: string;
          /** Trigger-maintained end of the appointment interval. */
          scheduled_end_at: string;
          duration_minutes: number;
          status: AppointmentStatus;
          reason: string | null;
          cancellation_reason: string | null;
          cancelled_by_role: UserRole | null;
          rescheduled_from_at: string | null;
          booking_source: BookingSource;
          created_by_profile_id: string | null;
          confirmed_by_profile_id: string | null;
          confirmed_at: string | null;
          rejection_reason: string | null;
          specialty_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          doctor_id: string;
          patient_id: string;
          scheduled_at: string;
          scheduled_end_at?: string;
          duration_minutes?: number;
          status?: AppointmentStatus;
          reason?: string | null;
          cancellation_reason?: string | null;
          cancelled_by_role?: UserRole | null;
          rescheduled_from_at?: string | null;
          booking_source?: BookingSource;
          created_by_profile_id?: string | null;
          confirmed_by_profile_id?: string | null;
          confirmed_at?: string | null;
          rejection_reason?: string | null;
          specialty_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          scheduled_at?: string;
          duration_minutes?: number;
          status?: AppointmentStatus;
          reason?: string | null;
          cancellation_reason?: string | null;
          cancelled_by_role?: UserRole | null;
          rescheduled_from_at?: string | null;
          confirmed_by_profile_id?: string | null;
          confirmed_at?: string | null;
          rejection_reason?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      /**
       * Append-only (FD-001): a trigger rejects UPDATE and DELETE, and
       * service_role is granted SELECT and INSERT only.
       */
      appointment_audit_logs: {
        Row: {
          id: string;
          appointment_id: string;
          actor_profile_id: string | null;
          action: AppointmentAuditAction;
          previous_status: AppointmentStatus | null;
          new_status: AppointmentStatus;
          previous_values: Json | null;
          new_values: Json | null;
          reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          appointment_id: string;
          actor_profile_id?: string | null;
          action: AppointmentAuditAction;
          previous_status?: AppointmentStatus | null;
          new_status: AppointmentStatus;
          previous_values?: Json | null;
          new_values?: Json | null;
          reason?: string | null;
          created_at?: string;
        };
        Update: { [_ in never]: never };
        Relationships: [];
      };
      /** Append-only log of admin changes (0013). Rows cannot be updated or deleted. */
      audit_logs: {
        Row: {
          id: string;
          actor_profile_id: string;
          action: string;
          target_type: string;
          target_id: string;
          previous_values: Json | null;
          new_values: Json | null;
          reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_profile_id: string;
          action: string;
          target_type: string;
          target_id: string;
          previous_values?: Json | null;
          new_values?: Json | null;
          reason?: string | null;
          created_at?: string;
        };
        Update: { [_ in never]: never };
        Relationships: [];
      };
      /** Deprecated by appointment_audit_logs (0007); kept read-only until it is dropped. */
      appointment_status_history: {
        Row: {
          id: string;
          appointment_id: string;
          from_status: AppointmentStatus | null;
          to_status: AppointmentStatus;
          changed_by_profile_id: string | null;
          reason: string | null;
          scheduled_at_snapshot: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          appointment_id: string;
          from_status?: AppointmentStatus | null;
          to_status: AppointmentStatus;
          changed_by_profile_id?: string | null;
          reason?: string | null;
          scheduled_at_snapshot?: string | null;
          created_at?: string;
        };
        Update: {
          reason?: string | null;
        };
        Relationships: [];
      };
      doctor_schedules: {
        Row: {
          id: string;
          doctor_id: string;
          day_of_week: number;
          start_time: string;
          end_time: string;
          slot_duration_minutes: number;
          /** Manila date, inclusive. */
          effective_from: string;
          /** Manila date, inclusive; null means open-ended. */
          effective_until: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          doctor_id: string;
          day_of_week: number;
          start_time: string;
          end_time: string;
          slot_duration_minutes?: number;
          effective_from?: string;
          effective_until?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          day_of_week?: number;
          start_time?: string;
          end_time?: string;
          slot_duration_minutes?: number;
          effective_from?: string;
          effective_until?: string | null;
          is_active?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      schedule_exceptions: {
        Row: {
          id: string;
          doctor_id: string;
          start_datetime: string;
          end_datetime: string;
          exception_type: ScheduleExceptionType;
          reason: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          doctor_id: string;
          start_datetime: string;
          end_datetime: string;
          exception_type?: ScheduleExceptionType;
          reason: string;
          created_at?: string;
        };
        Update: {
          start_datetime?: string;
          end_datetime?: string;
          exception_type?: ScheduleExceptionType;
          reason?: string;
        };
        Relationships: [];
      };
      doctor_notifications: {
        Row: {
          id: string;
          doctor_id: string;
          appointment_id: string | null;
          type: NotificationType;
          title: string;
          body: string;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          doctor_id: string;
          appointment_id?: string | null;
          type: NotificationType;
          title: string;
          body?: string;
          read_at?: string | null;
          created_at?: string;
        };
        Update: {
          read_at?: string | null;
        };
        Relationships: [];
      };
      chat_conversations: {
        Row: {
          id: string;
          patient_id: string;
          title: string;
          booking_state: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          patient_id: string;
          title: string;
          booking_state?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          booking_state?: Json | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      chat_messages: {
        Row: {
          id: string;
          conversation_id: string;
          role: ChatRole;
          content: string;
          payload: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          role: ChatRole;
          content: string;
          payload?: Json | null;
          created_at?: string;
        };
        Update: {
          payload?: Json | null;
        };
        Relationships: [];
      };
      knowledge_documents: {
        Row: {
          id: string;
          slug: string;
          title: string;
          content_hash: string;
          version: number;
          is_published: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          title: string;
          content_hash: string;
          version?: number;
          is_published?: boolean;
        };
        Update: {
          title?: string;
          content_hash?: string;
          version?: number;
          is_published?: boolean;
        };
        Relationships: [];
      };
      knowledge_chunks: {
        Row: {
          id: string;
          document_id: string;
          document_version: number;
          chunk_index: number;
          section_title: string | null;
          content: string;
          content_hash: string;
          /** pgvector text form, e.g. "[0.1,0.2,...]". */
          embedding: string;
          is_published: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          document_id: string;
          document_version: number;
          chunk_index: number;
          section_title?: string | null;
          content: string;
          content_hash: string;
          embedding: string;
          is_published?: boolean;
        };
        Update: {
          is_published?: boolean;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      cammi_connect_save_doctor: {
        Args: {
          p_doctor_id: string | null;
          p_full_name: string;
          p_department_id: string | null;
          p_is_active: boolean;
          p_specialty_ids: string[];
        };
        Returns: string;
      };
      cammi_connect_book_appointment: {
        Args: {
          p_doctor_id: string;
          p_patient_id: string;
          p_scheduled_at: string;
          p_reason: string | null;
          p_booking_source: BookingSource;
          p_created_by: string;
        };
        Returns: string;
      };
      /** Migration 0009. Raises P0001 not_found, not_pending, inactive_doctor, past, outside_hours, or blocked. */
      cammi_connect_confirm_appointment: {
        Args: {
          p_appointment_id: string;
          p_staff_id: string;
        };
        Returns: undefined;
      };
      /** Migration 0009. Raises P0001 not_found, not_pending, or reason_required. */
      cammi_connect_reject_appointment: {
        Args: {
          p_appointment_id: string;
          p_staff_id: string;
          p_reason: string;
        };
        Returns: undefined;
      };
      /**
       * Migration 0010. p_status is checked_in, completed, or no_show. Raises
       * P0001 not_found, invalid_status, invalid_transition, or not_yet.
       */
      cammi_connect_record_attendance: {
        Args: {
          p_appointment_id: string;
          p_staff_id: string;
          p_status: Database["public"]["Enums"]["appointment_status"];
        };
        Returns: undefined;
      };
      cammi_connect_reschedule_appointment: {
        Args: {
          p_appointment_id: string;
          p_staff_id: string;
          p_scheduled_at: string;
          p_reason: string;
        };
        Returns: undefined;
      };
      cammi_connect_cancel_appointment: {
        Args: { p_appointment_id: string; p_staff_id: string; p_reason: string };
        Returns: undefined;
      };
      cammi_connect_front_desk_book_appointment: {
        Args: {
          p_patient_id: string;
          p_doctor_id: string;
          p_specialty_id: string | null;
          p_scheduled_at: string;
          p_reason: string | null;
          p_staff_id: string;
        };
        Returns: string;
      };
      cammi_connect_match_knowledge_chunks: {
        Args: {
          /** pgvector text form, e.g. "[0.1,0.2,...]". */
          query_embedding: string;
          match_count: number;
          min_similarity: number;
        };
        Returns: {
          chunk_id: string;
          slug: string;
          title: string;
          section_title: string | null;
          content: string;
          similarity: number;
        }[];
      };
      cammi_connect_replace_document_chunks: {
        Args: {
          p_document: Json;
          p_chunks: Json;
        };
        Returns: string;
      };
    };
    Enums: {
      user_role: UserRole;
      appointment_status: AppointmentStatus;
      booking_source: BookingSource;
      doctor_notification_type: NotificationType;
      schedule_exception_type: ScheduleExceptionType;
    };
    CompositeTypes: { [_ in never]: never };
  };
};
