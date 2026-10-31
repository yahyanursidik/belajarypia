import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  UserRound,
  ShieldCheck,
  KeyRound,
  LogOut,
  CheckCheck,
  Mail,
  Hash,
  BookOpen,
} from "lucide-react";
import { useAuthSession } from "../../app/providers/authSessionContext";
import { supabase } from "../../lib/supabase";
import { Button } from "../../components/ui/button";
import { ProfilePasswordDialog } from "../../components/profile/ProfilePasswordDialog";
import { LearnerProfileWizard } from "../../components/learner/LearnerProfileWizard";
import {
  LearnerLoadState,
  LearnerRefresh,
  LearnerServices,
} from "../../components/learner/LearnerShared";
import { learnerError } from "../../lib/learnerWorkspace";
import {
  learnerProfileDraft,
  learnerProfileValue,
  type LearnerProfileData,
} from "../../lib/learnerProfile";
import { profileInitial } from "../../lib/profileWorkspace";
import { userTime } from "../../lib/usersWorkspace";
export function LearnerProfilePage() {
  const { user, refresh, signOut } = useAuthSession(),
    [params, setParams] = useSearchParams(),
    navigate = useNavigate(),
    [record, setRecord] = useState<LearnerProfileData | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [password, setPassword] = useState(false),
    request = useRef<AbortController | null>(null),
    id = user?.id;
  const data = record?.account.profile.id === id ? record : null;
  const load = useCallback(async () => {
    request.current?.abort();
    if (!id) {
      setLoading(false);
      return false;
    }
    const c = new AbortController();
    request.current = c;
    setLoading(true);
    setError("");
    try {
      const r = await supabase
        .rpc("learner_profile_workspace")
        .abortSignal(c.signal);
      if (r.error) throw r.error;
      if (
        r.data?.account?.profile?.id !== id ||
        !r.data.revision ||
        !Array.isArray(r.data.history)
      )
        throw new Error("Profil belajar belum lengkap.");
      if (!c.signal.aborted) {
        setRecord(r.data);
        return true;
      }
      return false;
    } catch (e) {
      if (!c.signal.aborted) setError(learnerError(e));
      return false;
    } finally {
      if (!c.signal.aborted) setLoading(false);
    }
  }, [id]);
  useEffect(() => {
    void load();
    return () => request.current?.abort();
  }, [load]);
  const close = () =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p);
        n.delete("edit");
        return n;
      },
      { replace: true },
    );
  async function saved(next: LearnerProfileData) {
    setRecord(next);
    close();
    setNotice("Profil belajar tersimpan.");
    try {
      await refresh();
    } catch {
      setNotice(
        "Profil tersimpan. Muat ulang sesi untuk memperbarui nama menu.",
      );
    }
  }
  if (!data)
    return (
      <LearnerLoadState
        error={error}
        loading={loading}
        onRetry={() => void load()}
      />
    );
  const draft = learnerProfileDraft(data),
    ready =
      !!draft.full_name.trim() &&
      (!data.participant || !!draft.display_name.trim()),
    canEdit =
      data.account.profile.status === "active" &&
      !data.account.login.login_blocked &&
      (!data.participant || data.participant.status === "active"),
    name =
      data.participant?.display_name ||
      data.account.profile.full_name ||
      "Akun saya";
  return (
    <div className="student-workspace">
      <header className="student-page-heading">
        <div>
          <span>RUANG PRIBADIMU</span>
          <h1>Profil belajar</h1>
        </div>
        <LearnerRefresh loading={loading} onClick={() => void load()} />
      </header>
      {error && (
        <LearnerLoadState
          error={error}
          loading={loading}
          onRetry={() => void load()}
        />
      )}
      <section className="student-profile-hero">
        <div className="student-profile-avatar">{profileInitial(name)}</div>
        <div>
          <h2>{name}</h2>
          <p>{data.account.login.email}</p>
          <span
            className={
              "student-status student-status-" +
              (data.participant?.status === "active" ? "active" : "hold")
            }
          >
            {data.participant
              ? data.participant.status === "active"
                ? "Peserta aktif"
                : data.participant.status === "inactive"
                  ? "Peserta nonaktif"
                  : "Peserta diarsipkan"
              : "Belum terhubung sebagai peserta"}
          </span>
        </div>
        <Button
          onClick={() => setParams({ edit: "1" })}
          disabled={!canEdit || loading}
        >
          <UserRound size={15} />
          {ready ? "Ubah profil" : "Lengkapi profil"}
        </Button>
      </section>
      {notice && (
        <p role="status" className="student-success">
          <CheckCheck size={16} />
          {notice}
        </p>
      )}
      {!data.participant && (
        <p className="student-preparation">
          Akun belum memiliki profil peserta.{" "}
          <Link to="/learner/cek-status">
            Cek pendaftaran
            <ArrowRight size={14} />
          </Link>
        </p>
      )}
      {!canEdit && (
        <p className="student-preparation">
          Perubahan profil belum tersedia.{" "}
          <Link to="/learner/bantuan?category=account">Hubungi bantuan</Link>
        </p>
      )}
      <div className="student-profile-grid">
        <section className="student-panel">
          <header className="student-section-heading">
            <h2>
              <UserRound size={18} />
              Identitas & kontak
            </h2>
            <span>{ready ? "Nama terisi" : "Nama belum lengkap"}</span>
          </header>
          <dl className="student-profile-facts">
            {[
              {
                key: "full_name",
                label: "Nama lengkap",
                value: draft.full_name,
              },
              {
                key: "display_name",
                label: "Nama tampilan",
                value: draft.display_name,
              },
              { key: "phone", label: "Nomor telepon", value: draft.phone },
              { key: "city", label: "Kota domisili", value: draft.city },
              { key: "gender", label: "Jenis kelamin", value: draft.gender },
              {
                key: "birth_date",
                label: "Tanggal lahir",
                value: draft.birth_date,
              },
              {
                key: "education_level",
                label: "Pendidikan",
                value: draft.education_level,
              },
            ]
              .filter(
                (f) =>
                  data.participant || ["full_name", "phone"].includes(f.key),
              )
              .map((f) => (
                <div key={f.key}>
                  <dt>{f.label}</dt>
                  <dd>{learnerProfileValue(f.key, f.value)}</dd>
                </div>
              ))}
          </dl>
        </section>
        <div className="student-profile-side">
          <section className="student-panel">
            <header className="student-section-heading">
              <h2>
                <BookOpen size={18} />
                Identitas peserta
              </h2>
            </header>
            <dl className="student-profile-facts">
              <div>
                <dt>
                  <Hash size={13} />
                  Nomor peserta
                </dt>
                <dd>
                  {data.participant?.global_participant_number ??
                    "Belum tersedia"}
                </dd>
              </div>
              <div>
                <dt>Kategori</dt>
                <dd>
                  {data.participant?.participant_type === "adult"
                    ? "Dewasa"
                    : data.participant?.participant_type === "child"
                      ? "Anak"
                      : (data.participant?.participant_type ??
                        "Belum tersedia")}
                </dd>
              </div>
            </dl>
            <Link className="student-panel-link" to="/learner/progres">
              Lihat progres belajar
              <ArrowRight size={14} />
            </Link>
          </section>
          <section className="student-panel">
            <header className="student-section-heading">
              <h2>
                <ShieldCheck size={18} />
                Akun masuk
              </h2>
            </header>
            <dl className="student-profile-facts">
              <div>
                <dt>
                  <Mail size={13} />
                  Email
                </dt>
                <dd>{data.account.login.email}</dd>
              </div>
              <div>
                <dt>Konfirmasi email</dt>
                <dd>
                  {data.account.login.email_confirmed
                    ? "Tercatat"
                    : "Belum tercatat"}
                </dd>
              </div>
              <div>
                <dt>Terakhir masuk</dt>
                <dd>
                  {data.account.login.last_sign_in_at
                    ? userTime(data.account.login.last_sign_in_at)
                    : "Belum tercatat"}
                </dd>
              </div>
            </dl>
            <Button
              variant="outline"
              className="student-account-password"
              disabled={
                data.account.profile.status !== "active" ||
                data.account.login.login_blocked
              }
              onClick={() => setPassword(true)}
            >
              <KeyRound size={15} />
              {data.account.login.password_enabled
                ? "Ubah kata sandi"
                : "Atur kata sandi"}
            </Button>
          </section>
        </div>
      </div>
      <LearnerServices />
      <Button
        variant="ghost"
        className="student-signout"
        onClick={async () => {
          await signOut();
          navigate("/learner/login", { replace: true });
        }}
      >
        <LogOut size={16} />
        Keluar akun
      </Button>
      {params.get("edit") === "1" && canEdit && (
        <LearnerProfileWizard
          key={data.revision}
          data={data}
          onClose={close}
          onSaved={(next) => void saved(next)}
          onReload={load}
        />
      )}{" "}
      {password && (
        <ProfilePasswordDialog
          email={data.account.login.email ?? "Akun saya"}
          onClose={() => setPassword(false)}
          onSaved={() => {
            setPassword(false);
            setNotice(
              "Kata sandi diperbarui. Gunakan sandi baru saat masuk berikutnya.",
            );
          }}
        />
      )}
    </div>
  );
}
