import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, FileText, UserRoundCheck, Users } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthSession } from "../../app/providers/authSessionContext";
import { supabase } from "../../lib/supabase";
import type { MentorHalaqah } from "./mentorTypes";

export function MentorDashboardPage() {
  const { user, profile } = useAuthSession();
  const [halaqahs, setHalaqahs] = useState<MentorHalaqah[]>([]);
  const [participantCount, setParticipantCount] = useState(0);
  const [todaySubmissionCount, setTodaySubmissionCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadDashboard() {
      if (!user) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setErrorMessage(null);
      const { data, error } = await supabase
        .from("halaqahs")
        .select("id, code, name, capacity, status, classes(id, code, name, program_id, programs(id, code, name, syllabus))")
        .eq("mentor_user_id", user.id)
        .order("name");
      if (error) {
        setErrorMessage(error.message);
        setIsLoading(false);
        return;
      }
      const nextHalaqahs = (data ?? []) as unknown as MentorHalaqah[];
      setHalaqahs(nextHalaqahs);
      const ids = nextHalaqahs.map((item) => item.id);
      if (ids.length) {
        const [enrollments, submissions] = await Promise.all([
          supabase.from("enrollments").select("id", { count: "exact", head: true }).in("halaqah_id", ids).eq("enrollment_status", "active"),
          supabase.from("quran_submissions").select("id", { count: "exact", head: true }).in("halaqah_id", ids).eq("assessment_date", new Date().toISOString().slice(0, 10)),
        ]);
        setParticipantCount(enrollments.count ?? 0);
        if (!submissions.error) setTodaySubmissionCount(submissions.count ?? 0);
      }
      setIsLoading(false);
    }
    void loadDashboard();
  }, [user]);

  const firstName = profile?.full_name?.split(" ")[0] || "Musyrif";
  const syllabusReady = halaqahs.filter((item) => item.classes?.programs?.syllabus?.trim()).length;

  return (
    <div className="page-stack pb-12">
      <section className="rounded-lg border bg-background p-5 sm:p-6">
        <Badge variant="outline">PORTAL MUSYRIF</Badge>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div><h1 className="text-2xl font-bold sm:text-3xl">Assalamu'alaikum, {firstName}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Pantau amanah halaqah, peserta binaan, target pembelajaran, dan setoran Qur'an dari satu ruang kerja.</p></div>
          <Button asChild><Link to="/teacher/halaqah">Buka Halaqah <ArrowRight className="h-4 w-4" /></Link></Button>
        </div>
      </section>

      {errorMessage ? <Alert className="border-red-200 bg-red-50 text-red-900"><AlertTitle>Dashboard tidak dapat dimuat</AlertTitle><AlertDescription>{errorMessage}</AlertDescription></Alert> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[{ label: "Halaqah Aktif", value: halaqahs.filter((item) => item.status === "active").length, icon: Users }, { label: "Peserta Binaan", value: participantCount, icon: UserRoundCheck }, { label: "Setoran Hari Ini", value: todaySubmissionCount, icon: BookOpen }, { label: "Silabus Tersedia", value: syllabusReady, icon: FileText }].map((metric) => { const Icon = metric.icon; return <div key={metric.label} className="rounded-md border bg-background p-4"><div className="flex items-center justify-between"><p className="text-xs font-semibold text-muted-foreground">{metric.label}</p><Icon className="h-4 w-4 text-primary" /></div>{isLoading ? <Skeleton className="mt-2 h-8 w-16" /> : <p className="mt-1 text-2xl font-bold">{metric.value}</p>}</div>; })}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.7fr)]">
        <Card>
          <CardHeader><CardTitle>Halaqah yang Diampu</CardTitle><CardDescription>Akses cepat ke kelompok dan program pendampingan.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? <><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></> : !halaqahs.length ? <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">Belum ada penugasan halaqah aktif.</p> : halaqahs.slice(0, 5).map((item) => <div key={item.id} className="flex flex-col gap-3 rounded-md border p-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{item.code}</Badge><span className="text-xs text-muted-foreground">{item.classes?.programs?.name}</span></div><p className="mt-2 font-semibold">{item.name}</p><p className="mt-1 text-xs text-muted-foreground">{item.classes?.name} · Kapasitas {item.capacity ?? "tidak dibatasi"}</p></div><Button variant="outline" size="sm" asChild><Link to="/teacher/halaqah">Kelola <ArrowRight className="h-4 w-4" /></Link></Button></div>)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Fokus Hari Ini</CardTitle><CardDescription>Pintasan workflow pendampingan.</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start" asChild><Link to="/teacher/halaqah"><Users className="h-4 w-4" /> Pantau Peserta Binaan</Link></Button>
            <Button variant="outline" className="w-full justify-start" asChild><Link to="/teacher/silabus"><FileText className="h-4 w-4" /> Silabus Pendampingan</Link></Button>
            <Button variant="outline" className="w-full justify-start" asChild><Link to="/teacher/quran"><BookOpen className="h-4 w-4" /> Catat Setoran Qur'an</Link></Button>
            <Button variant="outline" className="w-full justify-start" asChild><Link to="/teacher/review"><UserRoundCheck className="h-4 w-4" /> Review Pembelajaran</Link></Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
