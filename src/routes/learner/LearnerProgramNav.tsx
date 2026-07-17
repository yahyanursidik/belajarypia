import { Award, BookOpen, FileText } from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

type LearnerProgramNavProps = {
  programId: string;
  enrollmentId?: string | null;
};

const itemClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "inline-flex min-h-10 flex-1 items-center justify-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors sm:flex-none",
    isActive
      ? "border-primary text-primary"
      : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
  );

export function LearnerProgramNav({ programId, enrollmentId }: LearnerProgramNavProps) {
  return (
    <nav aria-label="Navigasi program" className="overflow-x-auto border-b bg-background">
      <div className="flex min-w-max items-center sm:min-w-0">
        <NavLink to={`/learner/program/${programId}`} end className={itemClass}>
          <BookOpen className="h-4 w-4" />
          Materi & Progres
        </NavLink>
        <NavLink to={`/learner/program/${programId}/silabus`} className={itemClass}>
          <FileText className="h-4 w-4" />
          Silabus
        </NavLink>
        {enrollmentId ? (
          <NavLink to={`/learner/transkrip/${enrollmentId}`} className={itemClass}>
            <Award className="h-4 w-4" />
            Nilai & Kelulusan
          </NavLink>
        ) : null}
      </div>
    </nav>
  );
}
