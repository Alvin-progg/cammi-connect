/**
 * Hospital directory shapes shared between the server layer and the admin and
 * patient-facing UI. None of these carry patient data.
 */
export type Department = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  isActive: boolean;
};

export type Specialty = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
};

export type DoctorSummary = {
  /** Same as the doctor's profile id. */
  id: string;
  fullName: string;
  departmentId: string | null;
  departmentName: string | null;
  isActive: boolean;
  specialties: { id: string; name: string }[];
};

/** A registered account an admin can link as a doctor login. */
export type LinkableAccount = { profileId: string; fullName: string };
