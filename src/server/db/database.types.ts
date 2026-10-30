import type { AppointmentStatus } from "@/lib/appointments/status";
import type { UserRole } from "@/lib/auth/roles";
import type { NotificationType } from "@/lib/notifications/types";
import type { ScheduleExceptionType } from "@/lib/schedules/types";

/**
 * Manual database contract for the application tables. Keep this in sync
 * with db/migrations/0001_profiles_appointments.sql,
 * db/migrations/0002_doctor_dashboard_suite.sql, and
 * db/migrations/0003_doctor_specialty_schedules.sql.
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
        };
        Returns: string;
      };
    };
    Enums: {
      user_role: UserRole;
      appointment_status: AppointmentStatus;
      doctor_notification_type: NotificationType;
      schedule_exception_type: ScheduleExceptionType;
    };
    CompositeTypes: { [_ in never]: never };
  };
};
