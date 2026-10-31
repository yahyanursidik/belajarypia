import { loadLearnerOutline } from "./learnerData";
import { summarizeLearning } from "./learningProgress";
export async function fetchLearningSummary(
  programId: string,
  enrollmentId: string,
  signal?: AbortSignal,
) {
  const o = await loadLearnerOutline(programId, signal);
  if (o.enrollment.id !== enrollmentId)
    throw new Error("Enrollment belajar berubah. Muat ulang program.");
  return summarizeLearning(o.modules, o.lessons, o.progress, o.requirements);
}
