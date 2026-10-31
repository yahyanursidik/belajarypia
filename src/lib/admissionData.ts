import { supabase } from "./supabase";
import type {
  AdmissionForm,
  AdmissionProgram,
  ApplicationRow,
} from "./admissionWorkspace";
export async function loadAdmissionWorkspace(signal: AbortSignal) {
  const [programs, forms, applications] = await Promise.all([
    readPages<AdmissionProgram>((offset) =>
      supabase
        .from("programs")
        .select("id,code,name,status,curriculum_model,feature_flags")
        .order("name")
        .order("id")
        .range(offset, offset + 499)
        .abortSignal(signal),
    ),
    readPages<AdmissionForm>((offset) =>
      supabase
        .from("registration_forms")
        .select("*")
        .order("created_at", { ascending: false })
        .order("id")
        .range(offset, offset + 499)
        .abortSignal(signal),
    ),
    readPages<ApplicationRow>((offset) =>
      supabase
        .from("applicant_program_choices")
        .select(
          "*,applicants!inner(id,full_name,email,phone,city,gender,birth_date,source_channel,status,submitted_at,created_at),programs(id,code,name,status,curriculum_model,feature_flags)",
        )
        .order("created_at", { ascending: false })
        .order("id")
        .range(offset, offset + 499)
        .abortSignal(signal),
    ),
  ]);
  return { programs, forms, applications };
}
async function readPages<T>(
  query: (
    offset: number,
  ) => PromiseLike<{ data: unknown[] | null; error: unknown }>,
) {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await query(offset);
    if (error) throw error;
    rows.push(...((data ?? []) as T[]));
    if ((data?.length ?? 0) < 500) return rows;
  }
}
