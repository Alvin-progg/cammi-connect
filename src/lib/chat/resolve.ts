const DOCTOR_TITLE_PATTERN = /^(dr\.?|doctor|doc)\s+/;

function normaliseName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}.\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(DOCTOR_TITLE_PATTERN, "")
    .replace(/^dr\.?$/, "");
}

/**
 * Matches a name the patient typed against database doctors. Every word the
 * patient typed must appear in the doctor's name, so "Dr. Santos" returns all
 * Santoses and the caller can ask which one.
 */
export function matchDoctorsByName<T extends { fullName: string }>(name: string, doctors: T[]): T[] {
  const wanted = normaliseName(name).split(" ").filter(Boolean);
  if (wanted.length === 0) return [];

  return doctors.filter((doctor) => {
    const words = normaliseName(doctor.fullName).split(" ");
    return wanted.every((word) => words.includes(word));
  });
}
