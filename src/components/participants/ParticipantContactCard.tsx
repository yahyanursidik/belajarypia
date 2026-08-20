import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Mail, MessageCircle } from "lucide-react";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import {
  createEmailLink,
  createWhatsAppLink,
  normalizeWhatsAppNumber,
  participantContactTemplates,
  renderContactTemplate,
  type ContactTemplateId,
} from "../../lib/contact";

type ParticipantContactCardProps = {
  participantName: string;
  phone?: string | null;
  email?: string | null;
  programName?: string | null;
};

export function ParticipantContactCard({ participantName, phone, email, programName }: ParticipantContactCardProps) {
  const [templateId, setTemplateId] = useState<ContactTemplateId>("general");
  const template = useMemo(
    () => participantContactTemplates.find((item) => item.id === templateId) ?? participantContactTemplates[0],
    [templateId],
  );
  const generatedMessage = useMemo(
    () => renderContactTemplate(template, { participantName, programName }),
    [participantName, programName, template],
  );
  const [subject, setSubject] = useState(generatedMessage.subject);
  const [body, setBody] = useState(generatedMessage.body);
  const waNumber = normalizeWhatsAppNumber(phone);

  useEffect(() => {
    setSubject(generatedMessage.subject);
    setBody(generatedMessage.body);
  }, [generatedMessage]);

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-primary" />
          Hubungi Peserta
        </CardTitle>
        <CardDescription>Pilih template, sesuaikan pesan, lalu buka WhatsApp atau aplikasi email.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-semibold">Template Pesan</label>
          <select className="field-control h-10 w-full" value={templateId} onChange={(event) => setTemplateId(event.target.value as ContactTemplateId)}>
            {participantContactTemplates.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold">Subjek Email</label>
          <input className="field-control h-10 w-full" value={subject} onChange={(event) => setSubject(event.target.value)} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold">Pesan</label>
          <textarea className="field-control min-h-[160px] w-full" value={body} onChange={(event) => setBody(event.target.value)} />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {waNumber ? (
            <Button asChild className="bg-emerald-600 !text-white hover:bg-emerald-700">
              <a href={createWhatsAppLink(waNumber, body)} target="_blank" rel="noreferrer">
                <MessageCircle className="h-4 w-4" /> WhatsApp
                <ExternalLink className="ml-auto h-3.5 w-3.5" />
              </a>
            </Button>
          ) : <Button disabled><MessageCircle className="h-4 w-4" /> WhatsApp</Button>}
          {email ? (
            <Button asChild variant="outline" className="!text-foreground">
              <a href={createEmailLink(email, subject, body)}>
                <Mail className="h-4 w-4" /> Email
                <ExternalLink className="ml-auto h-3.5 w-3.5" />
              </a>
            </Button>
          ) : <Button disabled variant="outline"><Mail className="h-4 w-4" /> Email</Button>}
        </div>
        {!waNumber || !email ? (
          <p className="text-xs leading-relaxed text-muted-foreground">
            {!waNumber ? "Nomor WhatsApp belum tersedia. " : ""}
            {!email ? "Email belum tersedia." : ""}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
