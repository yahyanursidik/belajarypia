import { AdmissionFormEditor } from "../../components/admission/AdmissionFormEditor";
export function ProgramAdmissionBuilder({
  programId,
  onFlagsChanged,
  onSaved,
}: {
  programId: string;
  onFlagsChanged?: (flags: any) => void;
  onSaved?: () => void;
}) {
  return (
    <AdmissionFormEditor
      key={programId}
      programId={programId}
      onFlagsChanged={onFlagsChanged}
      onSaved={onSaved}
    />
  );
}
