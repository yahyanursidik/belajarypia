import { useNavigate } from "react-router-dom";
import { useAuthSession } from "../../app/providers/authSessionContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function NoRolePage() {
  const navigate = useNavigate();
  const { profile, signOut } = useAuthSession();

  return (
    <div className="page-stack page-stack--narrow">
      <Card>
        <CardHeader>
          <CardTitle>Role belum ditetapkan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Akun {profile?.email ?? "ini"} sudah login, tetapi belum memiliki
            role di tabel <code>user_roles</code>. Hubungi admin untuk
            menetapkan role sebelum mengakses dashboard.
          </p>
          <Button
            variant="outline"
            onClick={async () => {
              await signOut();
              navigate("/auth/login", { replace: true });
            }}
          >
            Keluar
          </Button>
        </CardContent>
      </Card>

      <Alert>
        <AlertTitle>Catatan setup</AlertTitle>
        <AlertDescription>
          Untuk pengujian awal, buat user di Supabase Auth lalu masukkan role
          yang sesuai ke tabel user_roles.
        </AlertDescription>
      </Alert>
    </div>
  );
}
