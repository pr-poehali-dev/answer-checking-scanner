export interface OUUser {
  id: number;
  login: string;
  full_name: string;
  role: string;
  institution_id: number;
  institution_position: string;
  institution_name: string;
  subject?: string;
  token: string;
  is_manager: boolean;
  password: string;
}

export type OUSection = "profile" | "management" | "collective";

export const POSITION_LABELS: Record<string, string> = {
  director: "Директор",
  vice_director: "Зам. директора",
  counselor: "Советник",
  teacher: "Педагог",
};

export const POSITIONS = [
  { value: "director", label: "Директор" },
  { value: "vice_director", label: "Зам. директора" },
  { value: "counselor", label: "Советник" },
  { value: "teacher", label: "Педагог" },
];

export function getPositionLabel(position: string, subject?: string | null): string {
  if (position === "teacher" && subject) return `Педагог (${subject})`;
  return POSITION_LABELS[position] || position;
}
