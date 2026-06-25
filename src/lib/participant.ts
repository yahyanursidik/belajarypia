import { UserProfile as Profile } from "./auth";
import { Program } from "./organization";

export type ParticipantStatus = "active" | "inactive" | "archived";
export type EnrollmentStatus = "pending" | "active" | "hold" | "completed" | "cancelled";

export type Participant = {
  id: string;
  user_id: string | null;
  global_participant_number: string;
  display_name: string;
  gender: string | null;
  birth_date: string | null;
  city: string | null;
  education_level: string | null;
  participant_type: string;
  status: ParticipantStatus;
  joined_at: string;
  created_at: string;
  profiles?: Profile | null;
};

export type Guardian = {
  id: string;
  user_id: string | null;
  relation_type: string | null;
  notes: string | null;
  created_at: string;
  profiles?: Profile | null;
};

export type GuardianParticipant = {
  id: string;
  guardian_id: string;
  participant_id: string;
  is_primary: boolean;
  created_at: string;
  guardians?: Guardian;
  participants?: Participant;
};

export type Enrollment = {
  id: string;
  participant_id: string;
  program_id: string;
  batch_id: string | null;
  class_id: string | null;
  halaqah_id: string | null;
  enrollment_number: string;
  enrollment_status: EnrollmentStatus;
  payment_status: string;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  programs?: Program;
  participants?: Participant;
};
