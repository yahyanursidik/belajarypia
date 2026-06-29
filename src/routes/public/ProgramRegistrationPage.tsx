import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  defaultRegistrationFields,
  type RegistrationForm,
  type RegistrationFormField,
} from "../../lib/admission";
import type { Program } from "../../lib/organization";
import { supabase } from "../../lib/supabase";

type ApplicantCoreForm = {
  full_name: string;
  email: string;
  phone: string;
  city: string;
  gender: string;
  birth_date: string;
  source_channel: string;
};

const initialCoreForm: ApplicantCoreForm = {
  full_name: "",
  email: "",
  phone: "",
  city: "",
  gender: "",
  birth_date: "",
  source_channel: "",
};

export function ProgramRegistrationPage() {
  const { programId } = useParams();
  const [program, setProgram] = useState<Program | null>(null);
  const [registrationForm, setRegistrationForm] = useState<RegistrationForm | null>(null);
  const [fields, setFields] = useState<RegistrationFormField[]>([]);
  const [coreForm, setCoreForm] = useState<ApplicantCoreForm>(initialCoreForm);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submittedGender, setSubmittedGender] = useState<string | null>(null);

  useEffect(() => {
    async function loadForm() {
      if (!programId) {
        setIsLoading(false);
        return;
      }

      const { data: programRow } = await supabase
        .from("programs")
        .select("id, unit_id, code, name, description, program_type, curriculum_model, delivery_mode, status, feature_flags, units(code, name)")
        .eq("id", programId)
        .eq("status", "active")
        .maybeSingle();

      setProgram((programRow as unknown as Program | null) ?? null);

      const { data: formRows } = await supabase
        .from("registration_forms")
        .select("id, program_id, title, description, status, group_settings")
        .eq("status", "active")
        .or(`program_id.eq.${programId},program_id.is.null`)
        .order("program_id", { ascending: false })
        .limit(1);

      const form = (formRows?.[0] as RegistrationForm | undefined) ?? null;
      setRegistrationForm(form);

      if (form) {
        const { data: fieldRows } = await supabase
          .from("registration_form_fields")
          .select("id, form_id, field_key, label, field_type, is_required, options_json, order_no")
          .eq("form_id", form.id)
          .order("order_no");

        setFields((fieldRows ?? []) as RegistrationFormField[]);
      } else {
        setFields(
          defaultRegistrationFields.map((field, index) => ({
            ...field,
            id: field.field_key,
            form_id: "default",
            order_no: index,
          })),
        );
      }

      setIsLoading(false);
    }

    void loadForm();
  }, [programId]);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Memuat formulir...</p>;
  }

  if (!program || !programId) {
    return (
      <Alert>
        <AlertTitle>Program tidak tersedia</AlertTitle>
        <AlertDescription>
          Program tidak ditemukan atau belum aktif untuk pendaftaran publik.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="page-stack">
      <section className="page-hero">
        <Badge>Form Pendaftaran</Badge>
        <h2>{registrationForm?.title ?? `Daftar ${program.name}`}</h2>
        <p>
          {registrationForm?.description ??
            "Lengkapi data awal calon peserta. Admin akan mereview sebelum peserta diterima."}
        </p>
      </section>

      {successMessage ? (
        <div className="space-y-4">
          <Alert className="bg-emerald-50 text-emerald-900 border-emerald-200">
            <AlertTitle>Pendaftaran terkirim</AlertTitle>
            <AlertDescription>{successMessage}</AlertDescription>
          </Alert>

          {registrationForm?.group_settings && registrationForm.group_settings.platform !== "none" && (
            <Card className="border-primary/20 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
              <CardHeader className="bg-primary/5 border-b pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <span>Bergabung dengan Grup {registrationForm.group_settings.platform === 'whatsapp' ? 'WhatsApp' : 'Telegram'}</span>
                </CardTitle>
                <CardDescription>
                  Silakan bergabung ke grup komunitas untuk mendapatkan informasi selanjutnya.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="flex flex-col gap-3">
                  {(() => {
                    const settings = registrationForm.group_settings!;
                    let groups: { name: string; link: string }[] = [];
                    
                    if (settings.separated_gender) {
                      if (submittedGender === "male") {
                        groups = settings.ikhwan_groups || [];
                      } else if (submittedGender === "female") {
                        groups = settings.akhwat_groups || [];
                      }
                    } else {
                      groups = settings.general_groups || [];
                    }

                    if (groups.length === 0) {
                      return <p className="text-sm text-slate-500">Tautan grup belum tersedia.</p>;
                    }

                    return groups.map((g, idx) => (
                      <Button key={idx} asChild variant="outline" className="w-full justify-start text-left h-auto py-3 border-primary/30 hover:border-primary hover:bg-primary/5">
                        <a href={g.link} target="_blank" rel="noopener noreferrer">
                          <span className="font-semibold text-primary">{g.name || `Grup ${idx + 1}`}</span>
                        </a>
                      </Button>
                    ));
                  })()}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ) : null}
      {errorMessage ? (
        <Alert>
          <AlertTitle>Gagal submit</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Data Calon Peserta</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 md:grid-cols-2"
            onSubmit={async (event) => {
              event.preventDefault();
              setIsSubmitting(true);
              setErrorMessage(null);
              setSuccessMessage(null);

              const { data: applicant, error: applicantError } = await supabase
                .from("applicants")
                .insert({
                  full_name: coreForm.full_name.trim(),
                  email: coreForm.email.trim(),
                  phone: coreForm.phone.trim(),
                  city: coreForm.city.trim() || null,
                  gender: coreForm.gender || null,
                  birth_date: coreForm.birth_date || null,
                  source_channel: coreForm.source_channel.trim() || null,
                  status: "submitted",
                })
                .select("id")
                .single();

              if (applicantError || !applicant) {
                setErrorMessage(applicantError?.message ?? "Applicant gagal dibuat.");
                setIsSubmitting(false);
                return;
              }

              const applicantId = (applicant as { id: string }).id;
              const { error: choiceError } = await supabase
                .from("applicant_program_choices")
                .insert({
                  applicant_id: applicantId,
                  program_id: programId,
                  preferred_schedule: answers.schedule_preference || null,
                });

              if (choiceError) {
                setErrorMessage(choiceError.message);
                setIsSubmitting(false);
                return;
              }

              const answerRows = fields.map((field) => ({
                applicant_id: applicantId,
                form_field_key: field.field_key,
                value_text: answers[field.field_key] ?? "",
              }));

              if (answerRows.length > 0) {
                const { error: answerError } = await supabase
                  .from("applicant_answers")
                  .insert(answerRows);

                if (answerError) {
                  setErrorMessage(answerError.message);
                  setIsSubmitting(false);
                  return;
                }
              }

              setSubmittedGender(coreForm.gender);
              setCoreForm(initialCoreForm);
              setAnswers({});
              setSuccessMessage(
                "Data pendaftaran berhasil dikirim. Admin akan mereview pendaftaran Anda.",
              );
              setIsSubmitting(false);
            }}
          >
            <label className="grid gap-2 text-sm font-medium">
              Nama lengkap
              <Input
                onChange={(event) =>
                  setCoreForm((current) => ({ ...current, full_name: event.target.value }))
                }
                required
                value={coreForm.full_name}
              />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Email
              <Input
                onChange={(event) =>
                  setCoreForm((current) => ({ ...current, email: event.target.value }))
                }
                required
                type="email"
                value={coreForm.email}
              />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Nomor WhatsApp
              <Input
                onChange={(event) =>
                  setCoreForm((current) => ({ ...current, phone: event.target.value }))
                }
                required
                value={coreForm.phone}
              />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Kota
              <Input
                onChange={(event) =>
                  setCoreForm((current) => ({ ...current, city: event.target.value }))
                }
                value={coreForm.city}
              />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Jenis kelamin
              <select
                className="field-control"
                onChange={(event) =>
                  setCoreForm((current) => ({ ...current, gender: event.target.value }))
                }
                value={coreForm.gender}
              >
                <option value="">Pilih</option>
                <option value="male">Laki-laki</option>
                <option value="female">Perempuan</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Tanggal lahir
              <Input
                onChange={(event) =>
                  setCoreForm((current) => ({ ...current, birth_date: event.target.value }))
                }
                type="date"
                value={coreForm.birth_date}
              />
            </label>
            <label className="grid gap-2 text-sm font-medium md:col-span-2">
              Sumber informasi
              <Input
                onChange={(event) =>
                  setCoreForm((current) => ({
                    ...current,
                    source_channel: event.target.value,
                  }))
                }
                placeholder="Instagram, teman, WhatsApp, dan lainnya"
                value={coreForm.source_channel}
              />
            </label>

            {fields.map((field) => (
              <label className="grid gap-2 text-sm font-medium md:col-span-2" key={field.field_key}>
                {field.label}
                {field.field_type === "textarea" ? (
                  <textarea
                    className="field-control min-h-28 py-2"
                    onChange={(event) =>
                      setAnswers((current) => ({
                        ...current,
                        [field.field_key]: event.target.value,
                      }))
                    }
                    required={field.is_required}
                    value={answers[field.field_key] ?? ""}
                  />
                ) : field.field_type === "select" ? (
                  <select
                    className="field-control"
                    onChange={(event) =>
                      setAnswers((current) => ({
                        ...current,
                        [field.field_key]: event.target.value,
                      }))
                    }
                    required={field.is_required}
                    value={answers[field.field_key] ?? ""}
                  >
                    <option value="">Pilih</option>
                    {(field.options_json ?? []).map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    onChange={(event) =>
                      setAnswers((current) => ({
                        ...current,
                        [field.field_key]: event.target.value,
                      }))
                    }
                    required={field.is_required}
                    type={field.field_type === "email" ? "email" : "text"}
                    value={answers[field.field_key] ?? ""}
                  />
                )}
              </label>
            ))}

            <div className="flex flex-wrap gap-3 md:col-span-2">
              <Button disabled={isSubmitting} type="submit">
                {isSubmitting ? "Mengirim..." : "Kirim Pendaftaran"}
              </Button>
              <Button asChild variant="outline">
                <Link to={`/program/${program.id}`}>Kembali ke Detail</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
