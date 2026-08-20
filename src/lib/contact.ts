export type ContactTemplateId = "general" | "learning_follow_up" | "new_material" | "new_exam";

export type ContactTemplate = {
  id: ContactTemplateId;
  label: string;
  subject: string;
  body: string;
};

export type ContactTemplateValues = {
  participantName: string;
  programName?: string | null;
};

export const participantContactTemplates: ContactTemplate[] = [
  {
    id: "general",
    label: "Sapaan umum",
    subject: "Informasi YPIA untuk {{nama}}",
    body: "Assalamu'alaikum {{nama}},\n\nKami menghubungi Anda dari YPIA. Silakan balas pesan ini bila ada hal yang perlu ditanyakan.\n\nJazakumullahu khairan.",
  },
  {
    id: "learning_follow_up",
    label: "Tindak lanjut belajar",
    subject: "Tindak lanjut pembelajaran {{program}}",
    body: "Assalamu'alaikum {{nama}},\n\nKami ingin menindaklanjuti aktivitas belajar Anda di program {{program}}. Mohon buka portal peserta dan hubungi kami bila ada kendala.\n\nJazakumullahu khairan.",
  },
  {
    id: "new_material",
    label: "Materi baru",
    subject: "Materi baru di {{program}}",
    body: "Assalamu'alaikum {{nama}},\n\nAda materi baru di program {{program}}. Silakan buka menu Program Saya di portal peserta untuk mempelajarinya.\n\nSemoga Allah mudahkan ikhtiar belajarnya.",
  },
  {
    id: "new_exam",
    label: "Kuis atau ujian baru",
    subject: "Kuis/ujian baru di {{program}}",
    body: "Assalamu'alaikum {{nama}},\n\nKuis atau ujian baru sudah tersedia di program {{program}}. Silakan buka Program Saya dan perhatikan batas waktunya.\n\nJazakumullahu khairan.",
  },
];

export function renderContactTemplate(template: ContactTemplate, values: ContactTemplateValues) {
  const replacements: Record<string, string> = {
    "{{nama}}": values.participantName || "Peserta",
    "{{program}}": values.programName || "program Anda",
  };

  const render = (value: string) => Object.entries(replacements).reduce(
    (result, [placeholder, replacement]) => result.replaceAll(placeholder, replacement),
    value,
  );

  return { subject: render(template.subject), body: render(template.body) };
}

export function normalizeWhatsAppNumber(phone?: string | null) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("62")) return digits;
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  if (digits.startsWith("8")) return `62${digits}`;
  return digits;
}

export function createWhatsAppLink(phone: string, body: string) {
  return `https://wa.me/${phone}?text=${encodeURIComponent(body)}`;
}

export function createEmailLink(email: string, subject: string, body: string) {
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
