import { useParams, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { TranscriptView } from "../../components/TranscriptView";

export function AdminTranscriptPage() {
  const { enrollmentId, participantId } = useParams();
  const navigate = useNavigate(); const location=useLocation(); const [params]=useSearchParams();
  const basePath=location.pathname.startsWith("/system")?"/system":"/admin";
  const requested=params.get("directory")??"";
  const directory=requested===`${basePath}/peserta`||requested.startsWith(`${basePath}/peserta?`)?requested:`${basePath}/peserta`;

  if (!enrollmentId) {
    return <div className="p-12 text-center text-red-500">ID Enrollment tidak ditemukan</div>;
  }

  return (
    <div className="animate-in fade-in duration-300">
      <TranscriptView enrollmentId={enrollmentId} onBack={()=>navigate(participantId?`${basePath}/peserta/${participantId}?tab=academic&returnTo=${encodeURIComponent(directory)}`:directory)} />
    </div>
  );
}
