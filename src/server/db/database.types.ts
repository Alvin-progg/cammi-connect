import type { AppointmentStatus } from "@/lib/appointments/status";
import type { UserRole } from "@/lib/auth/roles";
import type { NotificationType } from "@/lib/notifications/types";

/**
 * Manual database contract for the tables used by the doctor dashboard.
 * Keep this in sync with db/migrations/0001_profiles_appointments.sql and
 * db/migrations/0002_doctor_dashboard_suite.sql.
 */
export type Database = {
  public: {
    Tables: {
      departments: {
        Row: {
          id: string;
          name: string;
          code: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          code: string;
          created_at?: string;
        };
        Update: {
          name?: string;
          code?: string;
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
          updated_at?: string;
        };
        Relationships: [];
      };
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
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          start_time?: string;
          end_time?: string;
          slot_duration_minutes?: number;
          is_active?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      doctor_blocked_slots: {
        Row: {
          id: string;
          doctor_id: string;
          starts_at: string;
          ends_at: string;
          reason: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          doctor_id: string;
          starts_at: string;
          ends_at: string;
          reason: string;
          created_at?: string;
        };
        Update: {
          starts_at?: string;
          ends_at?: string;
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
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: {
      user_role: UserRole;
      appointment_status: AppointmentStatus;
      doctor_notification_type: NotificationType;
    };
    CompositeTypes: { [_ in never]: never };
  };
};
