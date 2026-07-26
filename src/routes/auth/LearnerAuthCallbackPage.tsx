import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { FullPageLoader } from "../../components/ui/full-page-loader";
import { useAuthSession } from "../../app/providers/authSessionContext";
import { supabase } from "../../lib/supabase";

export function LearnerAuthCallbackPage() {
  const navigate = useNavigate();
  const { isLoading, session, refresh } = useAuthSession();
  const hasStarted = useRef(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading || hasStarted.current) return;

    if (!session) {
      navigate("/learner/login", { replace: true });
      return;
    }

    hasStarted.current = true;

    async function prepareLearnerDashboard() {
      const { error } = await supabase.rpc("ensure_learner_identity");
      if (error) {
        setErrorMessage(error.message);
        return;
      }

      const nextState = await refresh();
      if (!nextState.roles.some((role) => role.code === "participant")) {
        setErrorMessage("Role peserta belum berhasil disiapkan. Silakan coba masuk kembali.");
        return;
      }

      navigate("/learner", { replace: true });
    }

    void prepareLearnerDashboard();
  }, [isLoading, navigate, refresh, session]);

  if (errorMessage) {
    return (
      <div className="portal-login portal-login--learner">
        <main className="portal-login__card">
          <Alert className="border-red-200 bg-red-50 text-red-700">
            <AlertTitle>Akun belum dapat disiapkan</AlertTitle>
            <AlertDescription className="text-red-700/80">{errorMessage}</AlertDescription>
          </Alert>
          <Button asChild variant="outline" className="mt-5 w-full">
            <Link to="/learner/login">Kembali ke login peserta</Link>
          </Button>
        </main>
      </div>
    );
  }

  return <FullPageLoader message="Menyiapkan dashboard peserta..." />;
}
