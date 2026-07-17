export type MentorHalaqah = {
  id: string;
  code: string;
  name: string;
  capacity: number | null;
  status: "active" | "archived";
  classes: {
    id: string;
    code: string;
    name: string;
    program_id: string;
    programs: {
      id: string;
      code: string;
      name: string;
      syllabus?: string | null;
    } | null;
  } | null;
};

export type MentorEnrollment = {
  id: string;
  halaqah_id: string;
  program_id: string;
  enrollment_number: string;
  enrollment_status: string;
  participants: {
    id: string;
    display_name: string;
    global_participant_number: string;
    city?: string | null;
  } | null;
};

export type MentorProgress = {
  enrollment_id: string;
  lesson_id: string;
  status: "started" | "completed";
};
