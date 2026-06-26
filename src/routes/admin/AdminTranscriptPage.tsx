import { useParams } from "react-router-dom";
import { TranscriptView } from "../../components/TranscriptView";

export function AdminTranscriptPage() {
  const { enrollmentId } = useParams();

  if (!enrollmentId) {
    return <div className="p-12 text-center text-red-500">ID Enrollment tidak ditemukan</div>;
  }

  return (
    <div className="animate-in fade-in duration-300">
      <TranscriptView enrollmentId={enrollmentId} />
    </div>
  );
}
