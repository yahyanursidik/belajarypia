import { useState, useEffect, useRef } from "react";
import { useSystemSettings } from "../../lib/useSystemSettings";
import { useAuthSession } from "../../app/providers/authSessionContext";
import { supabase } from "../../lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  BookOpen, ChevronDown, ChevronUp, LifeBuoy, Mail, MessageCircle, Phone, 
  Ticket as TicketIcon, Plus, Send, X, ArrowLeft, Clock, CheckCircle2, AlertCircle, RefreshCw 
} from "lucide-react";

type Ticket = {
  id: string;
  ticket_number: string;
  category: string;
  subject: string;
  priority: string;
  status: string;
  created_at: string;
  updated_at: string;
};

type Message = {
  id: string;
  ticket_id: string;
  sender_id: string;
  message_body: string;
  created_at: string;
  profiles?: {
    full_name: string;
  };
};

const faqs = [
  {
    question: "Bagaimana cara mengakses materi ujian atau kuis?",
    answer: "Anda dapat mengakses materi dan ujian melalui menu 'Program Saya'. Pilih program yang sedang Anda ikuti, lalu klik pada modul yang tersedia. Jika modul berisi ujian, akan ada tombol 'Mulai Kerjakan Ujian'."
  },
  {
    question: "Mengapa saya tidak bisa menekan tombol Mulai Ujian?",
    answer: "Beberapa ujian memiliki batas waktu atau prasyarat (prerequisite) yang harus diselesaikan terlebih dahulu. Selain itu, pastikan batas percobaan (max attempts) Anda belum habis."
  },
  {
    question: "Di mana saya bisa melihat nilai ujian saya?",
    answer: "Nilai ujian otomatis muncul di halaman detail ujian pada bagian 'Riwayat Percobaan' setelah Anda selesai mengerjakan. Anda juga bisa melihat rangkuman nilai di fitur Transkrip Nilai pada detail Program."
  },
  {
    question: "Kapan sertifikat (Syahadah) saya diterbitkan?",
    answer: "Sertifikat akan diterbitkan setelah Anda menyelesaikan seluruh materi dan ujian dengan status 'Lulus', serta melunasi administrasi jika ada. Tombol unduh sertifikat akan otomatis muncul di bagian bawah halaman Program."
  }
];

export function LearnerHelpPage() {
  const { user } = useAuthSession();
  const { settings } = useSystemSettings();
  
  const [activeTab, setActiveTab] = useState<'faq' | 'tickets'>('faq');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  // Tickets State
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoadingTickets, setIsLoadingTickets] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  
  // Messages State
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [isSending, setIsSending] = useState(false);

  // Create Form State
  const [isCreatingTicket, setIsCreatingTicket] = useState(false);
  const [newTicketSubject, setNewTicketSubject] = useState("");
  const [newTicketCategory, setNewTicketCategory] = useState("technical_issue");
  const [newTicketPriority] = useState("medium");
  const [newTicketMessage, setNewTicketMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<{title: string, desc: string, type: 'success' | 'error'} | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const showToast = (title: string, desc: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ title, desc, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const contactPhone = settings?.contact_phone || "6281234567890";
  const waLink = `https://wa.me/${contactPhone.replace(/[^0-9]/g, '')}?text=Assalamu'alaikum%20Admin,%20saya%20butuh%20bantuan%20terkait%20LMS.`;
  const emailLink = `mailto:${settings?.contact_email || "admin@ypia.id"}?subject=Bantuan%20LMS%20Peserta`;

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  const loadTickets = async () => {
    if (!user) return;
    setIsLoadingTickets(true);
    const { data, error } = await supabase
      .from("helpdesk_tickets")
      .select("*")
      .eq("reporter_id", user.id)
      .order("updated_at", { ascending: false });
    
    if (data && !error) {
      setTickets(data as Ticket[]);
    }
    setIsLoadingTickets(false);
  };

  useEffect(() => {
    if (activeTab === 'tickets') {
      void loadTickets();
    }
  }, [activeTab, user]);

  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const loadMessages = async (ticketId: string) => {
    setIsLoadingMessages(true);
    const { data } = await supabase
      .from("helpdesk_messages")
      .select("*, profiles:sender_id(full_name)")
      .eq("ticket_id", ticketId)
      .eq("is_internal_note", false)
      .order("created_at", { ascending: true });
      
    if (data) {
      setMessages(data as Message[]);
    }
    setIsLoadingMessages(false);
  };

  const handleOpenTicket = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    void loadMessages(ticket.id);
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newTicketSubject || !newTicketMessage) return;
    setIsSubmitting(true);

    try {
      // 1. Create Ticket
      const { data: ticketData, error: ticketError } = await supabase
        .from("helpdesk_tickets")
        .insert({
          reporter_id: user.id,
          subject: newTicketSubject,
          category: newTicketCategory,
          priority: newTicketPriority,
          status: "open"
        })
        .select()
        .single();
        
      if (ticketError) throw ticketError;

      // 2. Insert initial message
      if (ticketData) {
        await supabase.from("helpdesk_messages").insert({
          ticket_id: ticketData.id,
          sender_id: user.id,
          message_body: newTicketMessage
        });
        
        // Reset form & reload
        setNewTicketSubject("");
        setNewTicketMessage("");
        setNewTicketCategory("technical_issue");
        setIsCreatingTicket(false);
        showToast("Laporan Berhasil Dibuat", "Tim Helpdesk kami akan segera merespons tiket Anda.");
        void loadTickets();
        handleOpenTicket(ticketData as Ticket);
      }
    } catch (err) {
      console.error(err);
      showToast("Gagal Membuat Laporan", "Silakan coba beberapa saat lagi.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendReply = async () => {
    if (!user || !selectedTicket || !replyText.trim()) return;
    setIsSending(true);
    
    const { error } = await supabase.from("helpdesk_messages").insert({
      ticket_id: selectedTicket.id,
      sender_id: user.id,
      message_body: replyText.trim()
    });

    if (!error) {
      setReplyText("");
      await loadMessages(selectedTicket.id);
      
      // Update ticket updated_at & status if it was closed
      if (selectedTicket.status === 'closed' || selectedTicket.status === 'resolved') {
        const { data } = await supabase
          .from("helpdesk_tickets")
          .update({ status: 'open', updated_at: new Date().toISOString() })
          .eq("id", selectedTicket.id)
          .select()
          .single();
          
        if (data) {
          setSelectedTicket(data as Ticket);
          void loadTickets();
        }
      } else {
        // Just trigger trigger updated_at update
         await supabase
          .from("helpdesk_tickets")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", selectedTicket.id);
      }
    }
    setIsSending(false);
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case "open": return <Badge className="bg-blue-500 hover:bg-blue-600">Menunggu</Badge>;
      case "in_progress": return <Badge className="bg-amber-500 hover:bg-amber-600">Diproses</Badge>;
      case "resolved": return <Badge className="bg-emerald-500 hover:bg-emerald-600">Selesai</Badge>;
      case "closed": return <Badge className="bg-slate-500 hover:bg-slate-600">Ditutup</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  // RENDER: Full Screen Ticket Detail (Mobile Friendly)
  if (selectedTicket) {
    return (
      <div className="page-stack max-w-4xl mx-auto h-[calc(100vh-8rem)] flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative z-10">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center gap-3 bg-slate-50 shrink-0">
          <Button variant="ghost" size="icon" onClick={() => setSelectedTicket(null)} className="shrink-0 -ml-2 text-slate-500 hover:text-slate-800">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold text-primary">{selectedTicket.ticket_number}</span>
              {getStatusBadge(selectedTicket.status)}
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-800 truncate">{selectedTicket.subject}</h2>
          </div>
          <Button variant="outline" size="icon" onClick={() => loadMessages(selectedTicket.id)} disabled={isLoadingMessages}>
            <RefreshCw className={`w-4 h-4 ${isLoadingMessages ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Messages List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-fixed relative">
          <div className="absolute inset-0 bg-slate-50/90 z-0"></div>
          <div className="relative z-10 space-y-6 flex flex-col justify-end min-h-full">
          {isLoadingMessages ? (
            <div className="flex justify-center p-8 m-auto"><div className="w-8 h-8 animate-spin rounded-full border-2 border-primary border-r-transparent"></div></div>
          ) : messages.length === 0 ? (
            <div className="text-center p-8 m-auto text-slate-500 bg-white/60 backdrop-blur rounded-2xl border border-slate-200">
              <MessageCircle className="w-8 h-8 mx-auto mb-3 text-slate-300" />
              <p className="font-medium text-slate-700">Pesan Kosong</p>
              <p className="text-sm">Tulis pesan pertama Anda untuk admin Helpdesk.</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMine = msg.sender_id === user?.id;
              return (
                <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 py-3 shadow-sm ${
                    isMine ? 'bg-primary text-white rounded-tr-sm' : 'bg-white border border-slate-200 rounded-tl-sm text-slate-800'
                  }`}>
                    {!isMine && <div className="text-xs font-bold text-primary mb-1">{msg.profiles?.full_name || 'Admin / Helpdesk'}</div>}
                    <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{msg.message_body}</p>
                    <div className={`text-[10px] text-right mt-2 font-medium flex items-center justify-end gap-1 ${
                      isMine ? 'text-white/70' : 'text-slate-400'
                    }`}>
                      <Clock className="w-3 h-3" />
                      {new Date(msg.created_at).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="p-3 sm:p-4 border-t border-slate-200 bg-white shrink-0">
          {selectedTicket.status === 'closed' ? (
             <div className="p-3 bg-slate-100 text-center rounded-lg text-sm text-slate-600 font-medium border border-slate-200">
               Tiket ini telah ditutup oleh admin. Jika Anda membalas, tiket akan otomatis dibuka kembali.
             </div>
          ) : null}
          <div className="flex items-end gap-2 mt-2">
            <textarea
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void handleSendReply();
                }
              }}
              placeholder="Ketik balasan Anda di sini... (Enter untuk kirim)"
              className="flex-1 bg-slate-100 border-transparent focus:bg-white focus:border-primary focus:ring-1 focus:ring-primary rounded-xl p-3 text-sm min-h-[50px] max-h-[120px] resize-y transition-all"
            />
            <Button 
              size="icon" 
              className="h-[50px] w-[50px] rounded-xl shrink-0 bg-primary hover:bg-primary/90 shadow-sm"
              onClick={handleSendReply}
              disabled={isSending || !replyText.trim()}
            >
              {isSending ? <div className="w-5 h-5 animate-spin rounded-full border-2 border-white/80 border-r-transparent" /> : <Send className="w-5 h-5 translate-x-0.5 -translate-y-0.5" />}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // RENDER: Main Helpdesk View
  return (
    <div className="page-stack max-w-5xl mx-auto pb-24">
      
      {/* Hero Section */}
      <section className="page-hero bg-primary rounded-xl p-6 sm:p-8 mb-6 text-white shadow-lg overflow-hidden relative">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-white opacity-10 rounded-full blur-2xl"></div>
        <div className="relative z-10">
          <Badge className="bg-white/20 hover:bg-white/30 text-white border-none mb-3">Pusat Bantuan</Badge>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Ada yang bisa kami bantu?</h1>
          <p className="text-white/90 max-w-2xl text-sm sm:text-base">
            Temukan jawaban untuk pertanyaan umum seputar penggunaan portal pembelajaran, atau ajukan laporan langsung ke tim bantuan kami.
          </p>
        </div>
      </section>

      {/* Tabs */}
      <div className="flex bg-slate-100 p-1 rounded-xl mb-6 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('faq')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-medium text-sm transition-all whitespace-nowrap ${
            activeTab === 'faq' ? 'bg-white text-primary shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <BookOpen className="w-4 h-4" /> FAQ & Kontak
        </button>
        <button
          onClick={() => setActiveTab('tickets')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-medium text-sm transition-all whitespace-nowrap ${
            activeTab === 'tickets' ? 'bg-white text-primary shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <TicketIcon className="w-4 h-4" /> Tiket Laporan Saya
        </button>
      </div>

      {activeTab === 'faq' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 animate-in fade-in duration-300">
          
          {/* Left Column: Contact Methods */}
          <div className="md:col-span-1 space-y-6">
            <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
              <LifeBuoy className="w-5 h-5 text-primary" /> Kontak Cepat
            </h3>
            
            <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow group">
              <CardHeader className="pb-3">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                  <MessageCircle className="w-5 h-5 text-green-600" />
                </div>
                <CardTitle className="text-base">WhatsApp Admin</CardTitle>
                <CardDescription className="text-xs">Konsultasi cepat via chat.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  className="w-full bg-green-600 hover:bg-green-700 text-white" 
                  onClick={() => window.open(waLink, "_blank")}
                >
                  Buka WhatsApp
                </Button>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow group">
              <CardHeader className="pb-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                  <Mail className="w-5 h-5 text-blue-600" />
                </div>
                <CardTitle className="text-base">Email Support</CardTitle>
                <CardDescription className="text-xs">Pertanyaan administratif.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  variant="outline"
                  className="w-full border-blue-200 text-blue-700 hover:bg-blue-50" 
                  onClick={() => window.location.href = emailLink}
                >
                  Kirim Email
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: FAQs */}
          <div className="md:col-span-2">
            <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2 mb-4">
              <BookOpen className="w-5 h-5 text-primary" /> Pertanyaan Sering Diajukan
            </h3>
            
            <div className="space-y-3">
              {faqs.map((faq, index) => {
                const isOpen = openFaqIndex === index;
                return (
                  <div 
                    key={index} 
                    className={`border rounded-lg transition-colors overflow-hidden ${
                      isOpen ? 'border-primary/50 bg-primary/5 shadow-sm' : 'border-slate-200 bg-white hover:border-primary/30'
                    }`}
                  >
                    <button 
                      className="w-full flex items-center justify-between p-4 text-left font-medium text-slate-800 focus:outline-none"
                      onClick={() => toggleFaq(index)}
                    >
                      <span className="pr-4 text-sm sm:text-base">{faq.question}</span>
                      {isOpen ? (
                        <ChevronUp className="w-5 h-5 text-primary shrink-0" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-slate-400 shrink-0" />
                      )}
                    </button>
                    <div 
                      className={`px-4 pb-4 text-slate-600 text-sm leading-relaxed transition-all duration-300 ${
                        isOpen ? 'block' : 'hidden'
                      }`}
                    >
                      {faq.answer}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-8 p-4 bg-amber-50 rounded-lg border border-amber-200 text-amber-800 text-xs sm:text-sm flex gap-3 items-start">
              <Phone className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <p>
                Jam operasional layanan bantuan Helpdesk adalah pada hari kerja (Senin - Jumat) pukul 08:00 WIB hingga 16:00 WIB. Pertanyaan di luar jam operasional akan dibalas pada hari kerja berikutnya.
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'tickets' && (
        <div className="animate-in fade-in duration-300">
          
          {isCreatingTicket ? (
            <Card className="border-primary/20 shadow-sm border">
              <CardHeader className="bg-slate-50 border-b border-slate-100 flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Buat Laporan Baru</CardTitle>
                  <CardDescription>Ceritakan kendala yang Anda alami secara detail.</CardDescription>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setIsCreatingTicket(false)}>
                  <X className="w-5 h-5" />
                </Button>
              </CardHeader>
              <CardContent className="pt-6">
                <form onSubmit={handleCreateTicket} className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1.5 block">Kategori</label>
                    <select 
                      className="w-full p-2.5 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                      value={newTicketCategory}
                      onChange={e => setNewTicketCategory(e.target.value)}
                    >
                      <option value="technical_issue">Kendala Teknis (Error, Akses)</option>
                      <option value="academic">Akademik (Materi, Ujian, Nilai)</option>
                      <option value="billing">Pembayaran & Keuangan</option>
                      <option value="account">Profil & Akun</option>
                      <option value="other">Lainnya</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1.5 block">Subjek Laporan</label>
                    <Input 
                      required
                      placeholder="Contoh: Tidak bisa mengakses ujian Modul 1"
                      value={newTicketSubject}
                      onChange={e => setNewTicketSubject(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1.5 block">Pesan Detail</label>
                    <textarea 
                      required
                      placeholder="Jelaskan kendala Anda secara lengkap di sini..."
                      className="w-full p-3 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[120px] resize-y"
                      value={newTicketMessage}
                      onChange={e => setNewTicketMessage(e.target.value)}
                    />
                  </div>
                  <div className="pt-2 flex justify-end gap-3">
                    <Button type="button" variant="outline" onClick={() => setIsCreatingTicket(false)}>Batal</Button>
                    <Button type="submit" disabled={isSubmitting || !newTicketSubject || !newTicketMessage}>
                      {isSubmitting ? 'Mengirim...' : 'Kirim Laporan'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-4">
                <div>
                  <h3 className="font-bold text-lg text-slate-800">Daftar Tiket Anda</h3>
                  <p className="text-sm text-slate-500">Pantau status laporan dan balasan dari tim kami.</p>
                </div>
                <Button onClick={() => setIsCreatingTicket(true)} className="w-full sm:w-auto">
                  <Plus className="w-4 h-4 mr-2" /> Buat Tiket Baru
                </Button>
              </div>

              {isLoadingTickets ? (
                <div className="flex justify-center p-12"><div className="w-8 h-8 animate-spin rounded-full border-2 border-primary border-r-transparent"></div></div>
              ) : tickets.length === 0 ? (
                <div className="text-center p-12 bg-white rounded-xl border border-slate-200 border-dashed">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <TicketIcon className="w-8 h-8 text-slate-400" />
                  </div>
                  <h3 className="font-semibold text-slate-800 mb-1">Belum Ada Laporan</h3>
                  <p className="text-sm text-slate-500 mb-4">Anda belum pernah membuat tiket laporan ke Helpdesk.</p>
                  <Button variant="outline" onClick={() => setIsCreatingTicket(true)}>
                    Buat Laporan Sekarang
                  </Button>
                </div>
              ) : (
                <div className="grid gap-3">
                  {tickets.map(ticket => (
                    <div 
                      key={ticket.id}
                      onClick={() => handleOpenTicket(ticket)}
                      className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:border-primary/50 hover:shadow-md transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-xs font-bold text-primary">{ticket.ticket_number}</span>
                          {getStatusBadge(ticket.status)}
                          <span className="text-xs text-slate-400 flex items-center gap-1 hidden sm:flex">
                            <Clock className="w-3 h-3" /> {new Date(ticket.updated_at).toLocaleDateString('id-ID')}
                          </span>
                        </div>
                        <h4 className="font-semibold text-slate-800 truncate group-hover:text-primary transition-colors">{ticket.subject}</h4>
                        <div className="text-xs text-slate-500 capitalize mt-1 flex items-center gap-1">
                          <BookOpen className="w-3 h-3" /> {ticket.category.replace('_', ' ')}
                        </div>
                      </div>
                      
                      <div className="text-sm font-medium text-primary flex items-center gap-1 sm:hidden">
                        Lihat Percakapan <ChevronDown className="w-4 h-4 -rotate-90" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300 flex items-start gap-3 p-4 rounded-xl shadow-lg border ${
          toastMessage.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          {toastMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5" /> : <AlertCircle className="w-5 h-5 text-rose-600 mt-0.5" />}
          <div>
            <h4 className="font-bold text-sm">{toastMessage.title}</h4>
            <p className="text-xs opacity-80 mt-0.5">{toastMessage.desc}</p>
          </div>
          <button onClick={() => setToastMessage(null)} className="ml-4 opacity-50 hover:opacity-100"><X className="w-4 h-4"/></button>
        </div>
      )}
    </div>
  );
}
