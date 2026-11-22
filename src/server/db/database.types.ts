import type { AppointmentAuditAction } from "@/lib/appointments/audit";
import type {
  AppointmentKind,
  AppointmentStatus,
  BookingSource,
} from "@/lib/appointments/status";
import type { UserRole } from "@/lib/auth/roles";
import type { ChatRole } from "@/lib/chat/schemas";
import type {
  KnowledgeCategory,
  KnowledgeProcessingStatus,
  KnowledgeStatus,
} from "@/lib/knowledge/types";
import type { NotificationType } from "@/lib/notifications/types";
import type { RequirementStatus } from "@/lib/requirements/types";
import type { ScheduleExceptionType } from "@/lib/schedules/types";
import type { ServiceBookingMode, ServiceCategory } from "@/lib/services/types";
import type { PaymentStatus } from "@/lib/billing/payments";

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
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          code: string;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          code?: string;
          description?: string | null;
          is_active?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      specialties: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          /** Migration 0032 (AI-APT-002): routing context for Cami, at most 1,000 characters. */
          routing_hints: string | null;
          /** Migration 0033 (PAY-01): integer centavos, null when not set. */
          default_consultation_fee_centavos: number | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          routing_hints?: string | null;
          default_consultation_fee_centavos?: number | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          description?: string | null;
          routing_hints?: string | null;
          default_consultation_fee_centavos?: number | null;
          is_active?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      /** Migration 0021 (admin services), priced in 0033 (PAY-01). */
      services: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          department_id: string | null;
          requires_appointment: boolean;
          booking_mode: ServiceBookingMode;
          is_active: boolean;
          /** Migration 0033 (PAY-01) pricing; money is integer centavos. */
          category: ServiceCategory;
          price_centavos: number | null;
          vatable: boolean;
          philhealth_benefit_centavos: number;
          hmo_coverable: boolean;
          requires_doctor_request: boolean;
          daily_capacity: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          department_id?: string | null;
          requires_appointment?: boolean;
          booking_mode?: ServiceBookingMode;
          is_active?: boolean;
          category?: ServiceCategory;
          price_centavos?: number | null;
          vatable?: boolean;
          philhealth_benefit_centavos?: number;
          hmo_coverable?: boolean;
          requires_doctor_request?: boolean;
          daily_capacity?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          description?: string | null;
          department_id?: string | null;
          requires_appointment?: boolean;
          booking_mode?: ServiceBookingMode;
          is_active?: boolean;
          category?: ServiceCategory;
          price_centavos?: number | null;
          vatable?: boolean;
          philhealth_benefit_centavos?: number;
          hmo_coverable?: boolean;
          requires_doctor_request?: boolean;
          daily_capacity?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      /** Migration 0033 (PAY-01). Admin-managed accredited HMOs. */
      hmo_providers: {
        Row: {
          id: string;
          name: string;
          copay_centavos: number;
          notes: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          copay_centavos?: number;
          notes?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          copay_centavos?: number;
          notes?: string | null;
          is_active?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      /** Migration 0034 (PAY-03). One charge per appointment, written only by cammi_connect_book_with_charge. */
      appointment_charges: {
        Row: {
          id: string;
          appointment_id: string;
          reference_code: string;
          privilege: "none" | "senior" | "pwd";
          payer: "self" | "hmo" | "philhealth";
          hmo_provider_id: string | null;
          hmo_member_number: string | null;
          base_centavos: number;
          vat_exemption_centavos: number;
          privilege_discount_centavos: number;
          philhealth_centavos: number;
          hmo_centavos: number;
          amount_due_centavos: number;
          created_at: string;
        };
        // Written only by cammi_connect_book_with_charge.
        Insert: { [_ in never]: never };
        Update: { [_ in never]: never };
        Relationships: [];
      };
      /** Migration 0034 (PAY-03). Snapshotted line items of a charge. */
      appointment_charge_items: {
        Row: {
          id: string;
          charge_id: string;
          line_number: number;
          kind: "consultation" | "service";
          description: string;
          doctor_id: string | null;
          specialty_id: string | null;
          /** Migration 0038 (PAY-07): set on service lines. */
          service_id: string | null;
          vatable: boolean;
          philhealth_benefit_centavos: number;
          hmo_coverable: boolean;
          base_centavos: number;
          vat_exemption_centavos: number;
          privilege_discount_centavos: number;
          philhealth_centavos: number;
          hmo_centavos: number;
          amount_due_centavos: number;
        };
        // Written only by cammi_connect_book_with_charge.
        Insert: { [_ in never]: never };
        Update: { [_ in never]: never };
        Relationships: [];
      };
      /** Migration 0034 (PAY-03). One payment per charge; transaction_reference is unique. */
      payments: {
        Row: {
          id: string;
          charge_id: string;
          appointment_id: string;
          status: Database["public"]["Enums"]["payment_status"];
          method: "qr_ph" | "counter" | null;
          amount_due_centavos: number;
          deadline_at: string | null;
          attempts: number;
          transaction_reference: string | null;
          amount_received_centavos: number | null;
          received_at: string | null;
          verified_by: string | null;
          verified_at: string | null;
          rejected_reason: string | null;
          rejected_by: string | null;
          rejected_at: string | null;
          /** Migration 0037 (PAY-06): the HMO decision. */
          hmo_loa_number: string | null;
          hmo_denied_reason: string | null;
          hmo_decided_by: string | null;
          hmo_decided_at: string | null;
          created_at: string;
          updated_at: string;
        };
        // Written only by cammi_connect_book_with_charge.
        Insert: { [_ in never]: never };
        Update: { [_ in never]: never };
        Relationships: [];
      };
      /** Migration 0035 (PAY-04). One row per accepted receipt upload. */
      payment_receipts: {
        Row: {
          id: string;
          payment_id: string;
          patient_id: string;
          storage_path: string;
          content_type: "image/jpeg" | "image/png" | "image/webp";
          size_bytes: number;
          uploaded_at: string;
          outcome: "pending" | "verified" | "rejected";
          /** Migration 0039 (PAY-08): when the image was deleted from storage (D5). */
          purged_at: string | null;
        };
        // Written only by cammi_connect_submit_payment_receipt.
        Insert: { [_ in never]: never };
        Update: { [_ in never]: never };
        Relationships: [];
      };
      /** Migration 0034 (PAY-03). Append-only payment history. */
      payment_events: {
        Row: {
          id: string;
          payment_id: string;
          actor_profile_id: string | null;
          action: string;
          previous_status: Database["public"]["Enums"]["payment_status"] | null;
          new_status: Database["public"]["Enums"]["payment_status"];
          new_values: Json | null;
          reason: string | null;
          created_at: string;
        };
        // Written only by the 0034–0037 payment functions.
        Insert: { [_ in never]: never };
        Update: { [_ in never]: never };
        Relationships: [];
      };
      /** Migration 0027 (admin system settings). A missing key uses its default. */
      system_settings: {
        Row: {
          key: string;
          value: Json;
          updated_by: string | null;
          updated_at: string;
        };
        Insert: {
          key: string;
          value: Json;
          updated_by?: string | null;
          updated_at?: string;
        };
        Update: {
          value?: Json;
          updated_by?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      /** Migration 0022 (admin requirements). Exactly one of service_id/specialty_id is set. */
      service_requirements: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          service_id: string | null;
          specialty_id: string | null;
          is_mandatory: boolean;
          effective_from: string;
          effective_to: string | null;
          status: RequirementStatus;
          superseded_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          service_id?: string | null;
          specialty_id?: string | null;
          is_mandatory?: boolean;
          effective_from?: string;
          effective_to?: string | null;
          status?: RequirementStatus;
          superseded_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          description?: string | null;
          service_id?: string | null;
          specialty_id?: string | null;
          is_mandatory?: boolean;
          effective_from?: string;
          effective_to?: string | null;
          status?: RequirementStatus;
          superseded_by?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      doctors: {
        Row: {
          id: string;
          department_id: string | null;
          full_name: string;
          contact_email: string | null;
          contact_phone: string | null;
          bio: string | null;
          /** Migration 0033 (PAY-01): integer centavos; null uses the specialty default. */
          consultation_fee_centavos: number | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          department_id?: string | null;
          full_name: string;
          contact_email?: string | null;
          contact_phone?: string | null;
          bio?: string | null;
          consultation_fee_centavos?: number | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          department_id?: string | null;
          full_name?: string;
          contact_email?: string | null;
          contact_phone?: string | null;
          bio?: string | null;
          consultation_fee_centavos?: number | null;
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
          /** Null only for a service visit (PAY-07, kind = 'service'). */
          doctor_id: string | null;
          /** PAY-07: 'service' for lab, imaging, and package visits. */
          kind: AppointmentKind;
          /** PAY-07: the visit's first service; every service is a charge line. */
          service_id: string | null;
          patient_id: string;
          scheduled_at: string;
          /** Trigger-maintained end of the appointment interval. */
          scheduled_end_at: string;
          duration_minutes: number;
          status: AppointmentStatus;
          reason: string | null;
          cancellation_reason: string | null;
          cancelled_by_role: UserRole | "system" | null;
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
          doctor_id?: string | null;
          kind?: AppointmentKind;
          service_id?: string | null;
          patient_id: string;
          scheduled_at: string;
          scheduled_end_at?: string;
          duration_minutes?: number;
          status?: AppointmentStatus;
          reason?: string | null;
          cancellation_reason?: string | null;
          cancelled_by_role?: UserRole | "system" | null;
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
          cancelled_by_role?: UserRole | "system" | null;
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
      /**
       * Migration 0038 (PAY-07). Weekly hours of a walk-in or scheduled
       * service, with the same Manila effective-date rules as doctor periods.
       * Written only by cammi_connect_admin_save_service_schedule.
       */
      service_schedules: {
        Row: {
          id: string;
          service_id: string;
          day_of_week: number;
          start_time: string;
          end_time: string;
          slot_minutes: number;
          capacity_per_slot: number;
          effective_from: string;
          effective_until: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: { [_ in never]: never };
        Update: { [_ in never]: never };
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
      /** doctor_id null with exception_type holiday applies to every doctor (0020). */
      schedule_exceptions: {
        Row: {
          id: string;
          doctor_id: string | null;
          start_datetime: string;
          end_datetime: string;
          exception_type: ScheduleExceptionType;
          reason: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          doctor_id: string | null;
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
          category: KnowledgeCategory;
          content: string;
          status: KnowledgeStatus;
          processing_status: KnowledgeProcessingStatus;
          processing_error: string | null;
          source_file_name: string | null;
          published_at: string | null;
          published_by: string | null;
          archived_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          title: string;
          content_hash: string;
          version?: number;
          category?: KnowledgeCategory;
          content?: string;
          status?: KnowledgeStatus;
          processing_status?: KnowledgeProcessingStatus;
          processing_error?: string | null;
          source_file_name?: string | null;
          published_at?: string | null;
          published_by?: string | null;
          archived_at?: string | null;
          created_by?: string | null;
        };
        Update: {
          title?: string;
          content_hash?: string;
          version?: number;
          category?: KnowledgeCategory;
          content?: string;
          status?: KnowledgeStatus;
          processing_status?: KnowledgeProcessingStatus;
          processing_error?: string | null;
          source_file_name?: string | null;
          published_at?: string | null;
          published_by?: string | null;
          archived_at?: string | null;
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
      /** Migration 0041 (BEN-01). One PWD declaration per patient; service_role only. */
      patient_pwd: {
        Row: {
          id: string;
          patient_id: string;
          pwd_id_number: string;
          pwd_id_image_path: string;
          verification_status: "pending" | "verified" | "rejected" | "expired";
          verified_by: string | null;
          verified_at: string | null;
          rejection_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          patient_id: string;
          pwd_id_number: string;
          pwd_id_image_path: string;
          verification_status?: "pending" | "verified" | "rejected" | "expired";
          verified_by?: string | null;
          verified_at?: string | null;
          rejection_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          pwd_id_number?: string;
          pwd_id_image_path?: string;
          verification_status?: "pending" | "verified" | "rejected" | "expired";
          verified_by?: string | null;
          verified_at?: string | null;
          rejection_reason?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      /** Migration 0041 (BEN-01). HMO memberships, one per patient and provider. */
      patient_hmo: {
        Row: {
          id: string;
          patient_id: string;
          hmo_provider_id: string;
          membership_number: string;
          hmo_card_image_path: string | null;
          verification_status: "pending" | "verified" | "rejected" | "expired";
          verified_by: string | null;
          verified_at: string | null;
          rejection_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          patient_id: string;
          hmo_provider_id: string;
          membership_number: string;
          hmo_card_image_path?: string | null;
          verification_status?: "pending" | "verified" | "rejected" | "expired";
          verified_by?: string | null;
          verified_at?: string | null;
          rejection_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          membership_number?: string;
          hmo_card_image_path?: string | null;
          verification_status?: "pending" | "verified" | "rejected" | "expired";
          verified_by?: string | null;
          verified_at?: string | null;
          rejection_reason?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      /** Migration 0041 (BEN-01). Which HMO providers a doctor accepts, with validity dates. */
      doctor_hmo_accreditations: {
        Row: {
          id: string;
          doctor_id: string;
          hmo_provider_id: string;
          status: "pending" | "active" | "inactive" | "expired" | "rejected";
          valid_from: string;
          valid_until: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          doctor_id: string;
          hmo_provider_id: string;
          status: "pending" | "active" | "inactive" | "expired" | "rejected";
          valid_from: string;
          valid_until?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: "pending" | "active" | "inactive" | "expired" | "rejected";
          valid_from?: string;
          valid_until?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      /** Migrations 0041 and 0042 (BEN-01, BEN-02). Appointment HMO authorization and coverage. */
      appointment_hmo: {
        Row: {
          id: string;
          appointment_id: string;
          patient_hmo_id: string;
          hmo_provider_id: string;
          provider_name_snapshot: string;
          membership_number_snapshot: string;
          accreditation_status_snapshot: "pending" | "active" | "inactive" | "expired" | "rejected" | null;
          accreditation_valid_from_snapshot: string | null;
          accreditation_valid_until_snapshot: string | null;
          authorization_status: "not_required" | "pending" | "approved" | "rejected" | "expired";
          coverage_status: "pending" | "covered" | "partially_covered" | "not_covered";
          loa_number: string | null;
          verified_by: string | null;
          verified_at: string | null;
          remarks: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          appointment_id: string;
          patient_hmo_id: string;
          hmo_provider_id: string;
          provider_name_snapshot: string;
          membership_number_snapshot: string;
          accreditation_status_snapshot?: "pending" | "active" | "inactive" | "expired" | "rejected" | null;
          accreditation_valid_from_snapshot?: string | null;
          accreditation_valid_until_snapshot?: string | null;
          authorization_status?: "not_required" | "pending" | "approved" | "rejected" | "expired";
          coverage_status?: "pending" | "covered" | "partially_covered" | "not_covered";
          loa_number?: string | null;
          verified_by?: string | null;
          verified_at?: string | null;
          remarks?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          authorization_status?: "not_required" | "pending" | "approved" | "rejected" | "expired";
          coverage_status?: "pending" | "covered" | "partially_covered" | "not_covered";
          loa_number?: string | null;
          verified_by?: string | null;
          verified_at?: string | null;
          remarks?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      /**
       * Migration 0035 (PAY-04). Raises P0001 payment_not_found,
       * payment_not_open, receipt_limit_reached, receipt_rate_limited, or
       * invalid_receipt.
       */
      /**
       * Migration 0036 (PAY-05). Front desk/admin only (P0001 not_allowed);
       * verify also raises payment_not_found, not_open, not_pending,
       * reference_required, duplicate_reference, amount_short, or
       * invalid_received_at; reject raises reason_required.
       */
      cammi_connect_verify_payment: {
        Args: {
          p_payment_id: string;
          p_staff_id: string;
          p_transaction_reference: string;
          p_amount_received_centavos: number;
          p_received_at: string;
        };
        Returns: { patient_id: string; amount_due_centavos: number }[];
      };
      cammi_connect_reject_payment_receipt: {
        Args: {
          p_payment_id: string;
          p_staff_id: string;
          p_reason_code: string;
          p_reason: string;
        };
        Returns: { patient_id: string; amount_due_centavos: number }[];
      };
      /** Migration 0039 (PAY-08). Run by pg_cron every 5 minutes; returns how many expired. */
      cammi_connect_expire_unpaid: {
        Args: Record<string, never>;
        Returns: number;
      };
      /** Migration 0039 (PAY-08). Used by scripts/purge-receipts.mts. */
      cammi_connect_mark_receipts_purged: {
        Args: { p_receipt_ids: string[] };
        Returns: number;
      };
      cammi_connect_decide_hmo: {
        Args: {
          p_payment_id: string;
          p_staff_id: string;
          p_decision: "approve" | "deny";
          p_loa_number: string | null;
          p_reason: string | null;
        };
        Returns: {
          patient_id: string;
          new_status: Database["public"]["Enums"]["payment_status"];
          method: "qr_ph" | "counter" | null;
          amount_due_centavos: number;
          deadline_at: string | null;
          reference_code: string;
          hmo_name: string;
        }[];
      };
      /** Migration 0036. Audits the view; returns the latest receipt's storage path. */
      cammi_connect_record_receipt_view: {
        Args: { p_payment_id: string; p_staff_id: string };
        Returns: string;
      };
      cammi_connect_submit_payment_receipt: {
        Args: {
          p_payment_id: string;
          p_patient_id: string;
          p_storage_path: string;
          p_content_type: string;
          p_size_bytes: number;
        };
        Returns: {
          receipt_id: string;
          payment_status: Database["public"]["Enums"]["payment_status"];
          attempts: number;
        }[];
      };
      /**
       * Migration 0014 (admin user management). The mutating functions raise
       * P0001 not_admin, reason_required, not_found, unchanged, self_change,
       * doctor_record, invalid_role, already_provisioned, or full_name_required.
       */
      cammi_connect_admin_list_users: {
        Args: {
          p_search: string | null;
          p_role: UserRole | null;
          p_is_active: boolean | null;
          p_limit: number;
          p_offset: number;
        };
        Returns: {
          id: string;
          full_name: string;
          email: string | null;
          role: UserRole;
          is_active: boolean;
          created_at: string;
          last_sign_in_at: string | null;
          total_count: number;
        }[];
      };
      cammi_connect_admin_get_user: {
        Args: { p_profile_id: string };
        Returns: {
          id: string;
          auth_user_id: string;
          full_name: string;
          email: string | null;
          phone: string | null;
          role: UserRole;
          is_active: boolean;
          created_at: string;
          last_sign_in_at: string | null;
          has_doctor_record: boolean;
        }[];
      };
      cammi_connect_admin_set_user_role: {
        Args: {
          p_actor_profile_id: string;
          p_target_profile_id: string;
          p_new_role: UserRole;
          p_reason: string;
        };
        Returns: undefined;
      };
      cammi_connect_admin_set_user_active: {
        Args: {
          p_actor_profile_id: string;
          p_target_profile_id: string;
          p_is_active: boolean;
          p_reason: string;
        };
        Returns: undefined;
      };
      cammi_connect_admin_update_user_profile: {
        Args: {
          p_actor_profile_id: string;
          p_target_profile_id: string;
          p_full_name: string;
          p_phone: string | null;
        };
        Returns: undefined;
      };
      cammi_connect_admin_provision_staff: {
        Args: {
          p_actor_profile_id: string;
          p_auth_user_id: string;
          p_role: UserRole;
          p_full_name: string;
          p_phone: string | null;
        };
        Returns: string;
      };
      /**
       * Migration 0015 (admin departments). The mutating functions raise P0001
       * not_admin, duplicate, not_found, unchanged, or has_future_appointments.
       */
      cammi_connect_admin_save_department: {
        Args: {
          p_actor_profile_id: string;
          p_department_id: string | null;
          p_name: string;
          p_code: string;
          p_description: string | null;
        };
        Returns: string;
      };
      cammi_connect_admin_set_department_active: {
        Args: {
          p_actor_profile_id: string;
          p_department_id: string;
          p_is_active: boolean;
        };
        Returns: undefined;
      };
      cammi_connect_department_appointment_stats: {
        Args: { p_from: string; p_to: string };
        Returns: {
          department_id: string;
          status: AppointmentStatus;
          appointment_count: number;
        }[];
      };
      cammi_connect_department_future_conflicts: {
        Args: { p_department_id: string };
        Returns: {
          appointment_id: string;
          scheduled_at: string;
          status: AppointmentStatus;
          doctor_name: string;
        }[];
      };
      /** Migration 0016 (admin specialties). Raise P0001 not_admin, duplicate, not_found, or unchanged. */
      cammi_connect_admin_save_specialty: {
        Args: {
          p_actor_profile_id: string;
          p_specialty_id: string | null;
          p_name: string;
          p_description: string | null;
          /** Migration 0032 (AI-APT-002). */
          p_routing_hints: string | null;
          /** Migration 0033 (PAY-01). */
          p_default_consultation_fee_centavos: number | null;
        };
        Returns: string;
      };
      cammi_connect_admin_set_specialty_active: {
        Args: {
          p_actor_profile_id: string;
          p_specialty_id: string;
          p_is_active: boolean;
        };
        Returns: undefined;
      };
      /** Migration 0021 (admin services). Raise P0001 not_admin, duplicate, not_found, unchanged, or inactive_department. */
      cammi_connect_admin_save_settings: {
        Args: {
          p_actor_profile_id: string;
          /** The changed keys only: {"<key>": <value>}. */
          p_values: Json;
        };
        Returns: undefined;
      };
      cammi_connect_admin_save_service: {
        Args: {
          p_actor_profile_id: string;
          p_service_id: string | null;
          p_name: string;
          p_description: string | null;
          p_department_id: string | null;
          p_requires_appointment: boolean;
          p_booking_mode: ServiceBookingMode;
          /** Migration 0033 (PAY-01). */
          p_category: ServiceCategory;
          p_price_centavos: number | null;
          p_vatable: boolean;
          p_philhealth_benefit_centavos: number;
          p_hmo_coverable: boolean;
          p_requires_doctor_request: boolean;
          p_daily_capacity: number | null;
        };
        Returns: string;
      };
      cammi_connect_admin_set_service_active: {
        Args: {
          p_actor_profile_id: string;
          p_service_id: string;
          p_is_active: boolean;
        };
        Returns: undefined;
      };
      /** Migration 0033 (PAY-01). Each raises P0001 with an HmoProviderRefusal code. */
      cammi_connect_admin_save_hmo_provider: {
        Args: {
          p_actor_profile_id: string;
          p_hmo_provider_id: string | null;
          p_name: string;
          p_copay_centavos: number;
          p_notes: string | null;
        };
        Returns: string;
      };
      cammi_connect_admin_set_hmo_provider_active: {
        Args: {
          p_actor_profile_id: string;
          p_hmo_provider_id: string;
          p_is_active: boolean;
        };
        Returns: undefined;
      };
      /** Migration 0022 (admin requirements). Each raises P0001 with a RequirementRefusal code. */
      cammi_connect_admin_save_requirement: {
        Args: {
          p_actor_profile_id: string;
          p_requirement_id: string | null;
          p_title: string;
          p_description: string | null;
          p_service_id: string | null;
          p_specialty_id: string | null;
          p_is_mandatory: boolean;
          p_effective_from: string;
          p_effective_to: string | null;
        };
        Returns: string;
      };
      cammi_connect_admin_publish_requirement: {
        Args: { p_actor_profile_id: string; p_requirement_id: string };
        Returns: undefined;
      };
      cammi_connect_admin_archive_requirement: {
        Args: { p_actor_profile_id: string; p_requirement_id: string };
        Returns: undefined;
      };
      cammi_connect_admin_supersede_requirement: {
        Args: { p_actor_profile_id: string; p_requirement_id: string; p_starts_on: string };
        Returns: string;
      };
      /** Migration 0017 (admin doctors). Each raises P0001 with a DoctorRefusal code. */
      cammi_connect_admin_save_doctor: {
        Args: {
          p_actor_profile_id: string;
          p_doctor_id: string | null;
          p_account_profile_id: string | null;
          p_full_name: string;
          p_department_id: string;
          p_contact_email: string | null;
          p_contact_phone: string | null;
          p_bio: string | null;
          p_specialty_ids: string[];
          /** Migration 0033 (PAY-01). */
          p_consultation_fee_centavos: number | null;
        };
        Returns: string;
      };
      cammi_connect_admin_set_doctor_specialties: {
        Args: {
          p_actor_profile_id: string;
          p_doctor_id: string;
          p_specialty_ids: string[];
        };
        Returns: undefined;
      };
      cammi_connect_admin_link_doctor_account: {
        Args: {
          p_actor_profile_id: string;
          p_doctor_id: string;
          p_account_profile_id: string;
        };
        Returns: undefined;
      };
      cammi_connect_admin_set_doctor_active: {
        Args: {
          p_actor_profile_id: string;
          p_doctor_id: string;
          p_is_active: boolean;
        };
        Returns: undefined;
      };
      cammi_connect_doctor_future_conflicts: {
        Args: { p_doctor_id: string };
        Returns: {
          appointment_id: string;
          scheduled_at: string;
          status: AppointmentStatus;
        }[];
      };
      cammi_connect_save_schedule_period: {
        Args: {
          p_actor_profile_id: string;
          p_doctor_id: string;
          p_period_id: string | null;
          p_day_of_week: number;
          p_start_time: string;
          p_end_time: string;
          p_slot_duration_minutes: number;
          p_effective_from: string;
          p_effective_until: string | null;
          p_is_active: boolean;
        };
        Returns: string;
      };
      /**
       * Migration 0020 (ADM-06). Raise P0001 invalid_type, not_authorized,
       * not_found, or has_appointments. p_doctor_id null is a hospital holiday.
       */
      cammi_connect_add_schedule_exception: {
        Args: {
          p_actor_profile_id: string;
          p_doctor_id: string | null;
          p_exception_type: ScheduleExceptionType;
          p_start: string;
          p_end: string;
          p_reason: string;
        };
        Returns: string;
      };
      cammi_connect_remove_schedule_exception: {
        Args: {
          p_actor_profile_id: string;
          p_doctor_id: string | null;
          p_exception_id: string;
        };
        Returns: undefined;
      };
      cammi_connect_exception_blocks: {
        Args: { p_doctor_id: string; p_start: string; p_end: string };
        Returns: boolean;
      };
      cammi_connect_doctor_appointments_outside_hours: {
        Args: { p_doctor_id: string };
        Returns: string[];
      };
      cammi_connect_admin_list_linkable_doctor_accounts: {
        Args: Record<PropertyKey, never>;
        Returns: {
          profile_id: string;
          full_name: string;
        }[];
      };
      /** Seed script only (scripts/seed.mjs). */
      cammi_connect_bootstrap_staff_role: {
        Args: {
          p_auth_user_id: string;
          p_role: UserRole;
          p_full_name: string;
        };
        Returns: string;
      };
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
      /**
       * Migration 0034 (PAY-03). Books through cammi_connect_book_appointment and
       * writes the charge, line, payment, and created event in one transaction.
       * Raises P0001 invalid_payment_choice, invalid_member_number,
       * hmo_unavailable, invalid_specialty, price_on_request, price_changed,
       * payment_too_soon, or any cammi_connect_book_appointment refusal.
       */
      cammi_connect_book_with_charge: {
        Args: {
          p_doctor_id: string;
          p_specialty_id: string;
          p_patient_id: string;
          p_scheduled_at: string;
          p_reason: string | null;
          p_privilege: string;
          p_payer: string;
          p_payment_method: string | null;
          p_hmo_provider_id: string | null;
          p_hmo_member_number: string | null;
          p_expected_amount_due_centavos: number;
        };
        Returns: {
          appointment_id: string;
          reference_code: string;
          payment_status: Database["public"]["Enums"]["payment_status"];
          amount_due_centavos: number;
          deadline_at: string | null;
        }[];
      };
      /**
       * Migration 0038 (PAY-07). Books a walk-in date or a scheduled slot for
       * one or more services with its charge, lines, payment, and created
       * event in one transaction. Raises P0001 invalid_payment_choice,
       * invalid_member_number, hmo_unavailable, invalid_services,
       * service_unavailable, price_on_request, invalid_service_combination,
       * too_many_upcoming, past, outside_hours, blocked, service_full,
       * slot_full, price_changed, or payment_too_soon.
       */
      cammi_connect_book_service: {
        Args: {
          p_patient_id: string;
          p_service_ids: string[];
          p_visit_date: string | null;
          p_scheduled_at: string | null;
          p_reason: string | null;
          p_privilege: string;
          p_payer: string;
          p_payment_method: string | null;
          p_hmo_provider_id: string | null;
          p_hmo_member_number: string | null;
          p_expected_amount_due_centavos: number;
        };
        Returns: {
          appointment_id: string;
          reference_code: string;
          payment_status: Database["public"]["Enums"]["payment_status"];
          amount_due_centavos: number;
          deadline_at: string | null;
        }[];
      };
      /** Migration 0038 (PAY-07). Holding service visits per service and start time in [p_from, p_to). */
      cammi_connect_service_load: {
        Args: { p_service_ids: string[]; p_from: string; p_to: string };
        Returns: { service_id: string; scheduled_at: string; bookings: number }[];
      };
      /**
       * Migration 0038 (PAY-07). Audited create or update of a service
       * period. Raises P0001 not_admin, not_found, not_bookable,
       * invalid_period, or overlap.
       */
      cammi_connect_admin_save_service_schedule: {
        Args: {
          p_actor_profile_id: string;
          p_schedule_id: string | null;
          p_service_id: string;
          p_day_of_week: number;
          p_start_time: string;
          p_end_time: string;
          p_slot_minutes: number;
          p_capacity_per_slot: number;
          p_effective_from: string;
          p_effective_until: string | null;
          p_is_active: boolean;
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
          /** Migration 0027: null searches every category. */
          categories?: string[] | null;
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
      cammi_connect_admin_save_knowledge_document: {
        Args: {
          p_actor_profile_id: string;
          p_document_id: string | null;
          p_title: string;
          p_category: KnowledgeCategory;
          p_content: string;
          p_content_hash: string;
          p_source_file_name: string | null;
        };
        Returns: string;
      };
      cammi_connect_admin_set_knowledge_document_status: {
        Args: { p_actor_profile_id: string; p_document_id: string; p_status: KnowledgeStatus };
        Returns: undefined;
      };
      cammi_connect_admin_reprocess_knowledge_document: {
        Args: { p_actor_profile_id: string; p_document_id: string };
        Returns: undefined;
      };
      cammi_connect_store_knowledge_chunks: {
        Args: { p_document_id: string; p_version: number; p_chunks: Json };
        Returns: undefined;
      };
      cammi_connect_replace_document_chunks: {
        Args: {
          p_document: Json;
          p_chunks: Json;
        };
        Returns: string;
      };
      cammi_connect_submit_pwd: {
        Args: { p_patient_id: string; p_pwd_id_number: string; p_pwd_id_image_path: string };
        Returns: undefined;
      };
      cammi_connect_submit_hmo: {
        Args: {
          p_patient_id: string;
          p_hmo_provider_id: string;
          p_membership_number: string;
          p_hmo_card_image_path: string | null;
        };
        Returns: string;
      };
      cammi_connect_decide_pwd: {
        Args: { p_patient_id: string; p_staff_id: string; p_decision: "verify" | "reject"; p_reason: string | null };
        Returns: "pending" | "verified" | "rejected" | "expired";
      };
      cammi_connect_decide_hmo_membership: {
        Args: { p_patient_hmo_id: string; p_staff_id: string; p_decision: "verify" | "reject"; p_reason: string | null };
        Returns: "pending" | "verified" | "rejected" | "expired";
      };
      cammi_connect_save_doctor_hmo_accreditation: {
        Args: {
          p_doctor_id: string;
          p_hmo_provider_id: string;
          p_status: "pending" | "active" | "inactive" | "expired" | "rejected";
          p_valid_from: string;
          p_valid_until: string | null;
          p_actor_id: string;
        };
        Returns: string;
      };
      cammi_connect_update_appointment_hmo: {
        Args: {
          p_appointment_id: string;
          p_staff_id: string;
          p_authorization_status: "not_required" | "pending" | "approved" | "rejected" | "expired";
          p_coverage_status: "pending" | "covered" | "partially_covered" | "not_covered";
          p_loa_number: string | null;
          p_remarks: string | null;
        };
        Returns: undefined;
      };
      cammi_connect_resolve_benefit_choice: {
        Args: {
          p_patient_id: string;
          p_doctor_id: string | null;
          p_privilege: string;
          p_payer: string;
          p_patient_hmo_id: string | null;
        };
        Returns: {
          hmo_provider_id: string | null;
          hmo_member_number: string | null;
          provider_name: string | null;
          accreditation_status: string | null;
          accreditation_valid_from: string | null;
          accreditation_valid_until: string | null;
        }[];
      };
      cammi_connect_book_with_saved_hmo: {
        Args: {
          p_doctor_id: string;
          p_specialty_id: string;
          p_patient_id: string;
          p_scheduled_at: string;
          p_reason: string | null;
          p_privilege: string;
          p_payer: string;
          p_payment_method: string | null;
          p_patient_hmo_id: string | null;
          p_expected_amount_due_centavos: number;
        };
        Returns: {
          appointment_id: string;
          reference_code: string;
          payment_status: Database["public"]["Enums"]["payment_status"];
          amount_due_centavos: number;
          deadline_at: string | null;
        }[];
      };
      cammi_connect_book_service_with_saved_hmo: {
        Args: {
          p_patient_id: string;
          p_service_ids: string[];
          p_visit_date: string | null;
          p_scheduled_at: string | null;
          p_reason: string | null;
          p_privilege: string;
          p_payer: string;
          p_payment_method: string | null;
          p_patient_hmo_id: string | null;
          p_expected_amount_due_centavos: number;
        };
        Returns: {
          appointment_id: string;
          reference_code: string;
          payment_status: Database["public"]["Enums"]["payment_status"];
          amount_due_centavos: number;
          deadline_at: string | null;
        }[];
      };
      cammi_connect_record_benefit_document_view: {
        Args: { p_kind: "pwd" | "hmo"; p_record_id: string; p_staff_id: string };
        Returns: string;
      };
    };
    Enums: {
      /** 0039 adds "system", used only by appointments.cancelled_by_role; no profile can have it. */
      user_role: UserRole | "system";
      appointment_status: AppointmentStatus;
      booking_source: BookingSource;
      doctor_notification_type: NotificationType;
      schedule_exception_type: ScheduleExceptionType;
      payment_status: PaymentStatus;
    };
    CompositeTypes: { [_ in never]: never };
  };
};
