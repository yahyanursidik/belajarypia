import { useEffect, useState } from "react";
import { 
  MessageCircleQuestion, 
  Search, 
  MoreVertical, 
  Send, 
  Paperclip, 
  AlertCircle,
  Clock,
  CheckCircle2,
  X,
  RefreshCw,
  Mail,
  User,
  ListFilter,
  Calendar,
  Tag,
  ChevronDown,
  Image as ImageIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { useAuthSession } from "@/app/providers/authSessionContext";

type Ticket = {
  id: string;
  ticket_number: string;
  reporter_id: string;
  category: string;
  subject: string;
  priority: string;
  status: string;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  profiles?: {
    full_name: string;
    email: string;
  };
};

type Message = {
  id: string;
  ticket_id: string;
  sender_id: string;
  message_body: string;
  is_internal_note: boolean;
  created_at: string;
  profiles?: {
    full_name: string;
    email: string;
  };
};

// Helper untuk avatar initials
const getInitials = (name: string) => {
  if (!name) return "?";
  return name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
};

export function SystemHelpdeskPage() {
  const { user } = useAuthSession();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  
  // Form State
  const [replyMessage, setReplyMessage] = useState("");
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Filters & Pagination
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all"); // 'all', 'today', 'week', 'month'
  
  const [showFilters, setShowFilters] = useState(false);
  
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const LIMIT = 20;

  const loadTickets = async (isLoadMore = false) => {
    if (!isLoadMore) {
      setIsLoading(true);
      setPage(0);
    }
    
    const currentPage = isLoadMore ? page + 1 : 0;
    
    let query = supabase
      .from("helpdesk_tickets")
      .select("*, profiles:reporter_id(full_name, email)", { count: "exact" })
      .order("updated_at", { ascending: false })
      .range(currentPage * LIMIT, (currentPage + 1) * LIMIT - 1);
      
    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }
    
    if (categoryFilter !== "all") {
      query = query.eq("category", categoryFilter);
    }
    
    if (dateFilter !== "all") {
      const now = new Date();
      let fromDate = new Date();
      if (dateFilter === "today") {
        fromDate.setHours(0, 0, 0, 0);
      } else if (dateFilter === "week") {
        fromDate.setDate(now.getDate() - 7);
      } else if (dateFilter === "month") {
        fromDate.setMonth(now.getMonth() - 1);
      }
      query = query.gte("created_at", fromDate.toISOString());
    }
    
    if (searchQuery.trim()) {
      query = query.or(`ticket_number.ilike.%${searchQuery.trim()}%,subject.ilike.%${searchQuery.trim()}%`);
    }
    
    const { data, count, error } = await query;
    if (data && !error) {
      if (isLoadMore) {
        setTickets(prev => {
          const newIds = data.map(d => d.id);
          const filteredPrev = prev.filter(p => !newIds.includes(p.id));
          return [...filteredPrev, ...(data as any)];
        });
      } else {
        setTickets(data as any);
      }
      setPage(currentPage);
      setHasMore(count !== null && (currentPage + 1) * LIMIT < count);
    }
    
    if (!isLoadMore) setIsLoading(false);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadTickets(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery, statusFilter, categoryFilter, dateFilter]);

  const loadMessages = async (ticketId: string) => {
    const { data } = await supabase
      .from("helpdesk_messages")
      .select("*, profiles:sender_id(full_name, email)")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });
      
    if (data) {
      setMessages(data as any);
    }
  };

  const handleSelectTicket = async (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setMessages([]);
    await loadMessages(ticket.id);
  };

  const handleSendReply = async () => {
    if (!replyMessage.trim() || !selectedTicket || !user) return;
    setIsSending(true);
    
    const { error } = await supabase.from("helpdesk_messages").insert({
      ticket_id: selectedTicket.id,
      sender_id: user.id,
      message_body: replyMessage.trim(),
      is_internal_note: isInternalNote
    });

    if (!error) {
      setReplyMessage("");
      await loadMessages(selectedTicket.id);
      
      if (selectedTicket.status === "open" && !isInternalNote) {
        await supabase
          .from("helpdesk_tickets")
          .update({ status: "in_progress" })
          .eq("id", selectedTicket.id);
        
        void loadTickets();
        setSelectedTicket({ ...selectedTicket, status: "in_progress" });
      }
    }
    setIsSending(false);
  };

  const handleChangeStatus = async (newStatus: string) => {
    if (!selectedTicket) return;
    const { error } = await supabase
      .from("helpdesk_tickets")
      .update({ status: newStatus })
      .eq("id", selectedTicket.id);
      
    if (!error) {
      setSelectedTicket({ ...selectedTicket, status: newStatus });
      void loadTickets();
    }
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case "open": return <Badge className="bg-blue-500/10 text-blue-600 border-blue-200/50 hover:bg-blue-500/20 transition-colors">Menunggu</Badge>;
      case "in_progress": return <Badge className="bg-amber-500/10 text-amber-600 border-amber-200/50 hover:bg-amber-500/20 transition-colors">Diproses</Badge>;
      case "resolved": return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200/50 hover:bg-emerald-500/20 transition-colors">Selesai</Badge>;
      case "closed": return <Badge className="bg-slate-500/10 text-slate-600 border-slate-200/50 hover:bg-slate-500/20 transition-colors">Ditutup</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };
  
  const getPriorityBadge = (priority: string) => {
    switch(priority) {
      case "urgent": return <span className="flex items-center text-xs text-rose-500 font-semibold bg-rose-50 px-2 py-0.5 rounded-full"><AlertCircle className="w-3 h-3 mr-1" /> Mendesak</span>;
      case "high": return <span className="flex items-center text-xs text-orange-500 font-semibold bg-orange-50 px-2 py-0.5 rounded-full"><AlertCircle className="w-3 h-3 mr-1" /> Tinggi</span>;
      case "medium": return <span className="flex items-center text-xs text-amber-600 font-semibold bg-amber-50 px-2 py-0.5 rounded-full"><AlertCircle className="w-3 h-3 mr-1" /> Sedang</span>;
      default: return <span className="flex items-center text-xs text-slate-500 font-semibold bg-slate-50 px-2 py-0.5 rounded-full"><AlertCircle className="w-3 h-3 mr-1" /> Rendah</span>;
    }
  };

  return (
    <div className="page-stack h-[calc(100vh-6rem)] flex flex-col p-4 md:p-6 overflow-hidden bg-gradient-to-br from-background via-background to-muted/30">
      
      {/* Header Premium */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 shrink-0 gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shadow-sm border border-primary/10">
            <MessageCircleQuestion className="text-primary w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground bg-clip-text">
              Pusat Bantuan
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5 flex items-center gap-2">
              Kelola dan respons keluhan atau pertanyaan pengguna.
            </p>
          </div>
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex flex-1 gap-6 min-h-0 relative z-10">
        
        {/* Left Column: Ticket List */}
        <div className={`flex-col bg-card/80 backdrop-blur-xl border border-border/50 rounded-2xl shadow-sm overflow-hidden flex ${selectedTicket ? 'hidden md:flex w-1/3 max-w-sm' : 'w-full'} transition-all duration-300`}>
          
          {/* Search & Filters */}
          <div className="p-4 border-b border-border/50 space-y-4 shrink-0 bg-background/50">
            <div className="flex items-center gap-2">
              <div className="relative flex-1 group">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input 
                  placeholder="Cari tiket atau pengguna..." 
                  className="pl-9 h-10 text-sm bg-background border-border/50 focus-visible:ring-primary/20 transition-all rounded-xl"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
              <Button 
                variant={showFilters ? "secondary" : "outline"} 
                size="icon" 
                className="h-10 w-10 shrink-0 rounded-xl transition-all"
                onClick={() => setShowFilters(!showFilters)}
              >
                <ListFilter className="w-4 h-4" />
              </Button>
            </div>
            
            {/* Extended Filters */}
            {showFilters && (
              <div className="grid grid-cols-2 gap-2 pt-2 animate-in slide-in-from-top-2 fade-in duration-200">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5"><Tag className="w-3 h-3"/> Kategori</label>
                  <select 
                    className="w-full text-sm rounded-lg border border-border/50 bg-background p-2 focus:ring-1 focus:ring-primary outline-none transition-all"
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                  >
                    <option value="all">Semua Kategori</option>
                    <option value="technical_issue">Kendala Teknis</option>
                    <option value="billing">Pembayaran</option>
                    <option value="account">Akun</option>
                    <option value="other">Lainnya</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5"><Calendar className="w-3 h-3"/> Waktu</label>
                  <select 
                    className="w-full text-sm rounded-lg border border-border/50 bg-background p-2 focus:ring-1 focus:ring-primary outline-none transition-all"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                  >
                    <option value="all">Kapan saja</option>
                    <option value="today">Hari ini</option>
                    <option value="week">7 Hari Terakhir</option>
                    <option value="month">30 Hari Terakhir</option>
                  </select>
                </div>
              </div>
            )}

            {/* Status Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar pt-1">
              {(['all', 'open', 'in_progress', 'resolved'] as const).map(status => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3.5 py-1.5 text-xs font-medium rounded-full transition-all whitespace-nowrap ${
                    statusFilter === status 
                      ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20' 
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  {status === 'all' ? 'Semua' : status === 'open' ? 'Menunggu' : status === 'in_progress' ? 'Diproses' : 'Selesai'}
                </button>
              ))}
              <div className="flex-1" />
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full text-muted-foreground hover:text-primary" onClick={() => loadTickets(false)} disabled={isLoading}>
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto bg-muted/5 p-2 space-y-1.5">
            {isLoading ? (
              <div className="flex items-center justify-center h-40">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-r-transparent" />
              </div>
            ) : tickets.length === 0 ? (
              <div className="text-center p-8 text-muted-foreground flex flex-col items-center mt-10 animate-in fade-in zoom-in-95">
                <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4 border border-border/50">
                  <MessageCircleQuestion className="w-8 h-8 text-muted-foreground/40" />
                </div>
                <p className="text-sm font-semibold text-foreground">{searchQuery || dateFilter !== 'all' || categoryFilter !== 'all' ? 'Tidak ada hasil' : 'Kotak Masuk Kosong'}</p>
                <p className="text-xs mt-1.5 opacity-80">{searchQuery || dateFilter !== 'all' || categoryFilter !== 'all' ? 'Ubah filter atau kata kunci pencarian.' : 'Hore! Semua permasalahan sudah ditangani.'}</p>
              </div>
            ) : (
              <div className="space-y-1.5 pb-2">
                {tickets.map(ticket => (
                  <div 
                    key={ticket.id} 
                    className={`p-3.5 cursor-pointer rounded-xl transition-all duration-200 border ${
                      selectedTicket?.id === ticket.id 
                        ? 'bg-primary/5 border-primary/20 shadow-sm' 
                        : 'bg-background border-transparent hover:border-border/50 hover:bg-muted/30 hover:shadow-sm'
                    }`}
                    onClick={() => handleSelectTicket(ticket)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary/50"></span>
                        {ticket.ticket_number}
                      </span>
                      {getStatusBadge(ticket.status)}
                    </div>
                    <h3 className={`font-semibold text-sm mb-2 line-clamp-1 transition-colors ${selectedTicket?.id === ticket.id ? 'text-primary' : 'text-foreground'}`}>
                      {ticket.subject}
                    </h3>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[9px] font-bold text-foreground">
                          {getInitials(ticket.profiles?.full_name || 'User')}
                        </div>
                        <span className="truncate max-w-[100px] font-medium">{ticket.profiles?.full_name || 'User'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {getPriorityBadge(ticket.priority)}
                        <span className="text-[10px] text-muted-foreground/70 ml-1">
                          {new Date(ticket.updated_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
                
                {hasMore && (
                  <div className="pt-2 text-center">
                    <Button variant="ghost" size="sm" onClick={() => loadTickets(true)} className="w-full text-xs rounded-xl hover:bg-primary/5 hover:text-primary">
                      Muat Lebih Banyak
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Ticket Chat / Details */}
        {selectedTicket ? (
          <div className="flex-1 bg-card/90 backdrop-blur-xl border border-border/50 rounded-2xl shadow-sm flex flex-col min-w-0 animate-in slide-in-from-right-2 fade-in duration-300">
            
            {/* Chat Header */}
            <div className="p-4 sm:p-5 border-b border-border/50 flex items-start justify-between bg-background/50 rounded-t-2xl shrink-0">
              <div className="min-w-0 pr-4">
                <div className="flex items-center gap-3 mb-2">
                  <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20 border-transparent shadow-none">{selectedTicket.ticket_number}</Badge>
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider bg-muted/50 px-2 py-0.5 rounded-md flex items-center gap-1.5">
                    <Tag className="w-3 h-3" />
                    {selectedTicket.category.replace('_', ' ')}
                  </span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 opacity-70" /> 
                    {new Date(selectedTicket.created_at).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </span>
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-foreground mb-3">{selectedTicket.subject}</h2>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary/80 to-primary flex items-center justify-center text-primary-foreground text-xs font-bold shadow-sm">
                    {getInitials(selectedTicket.profiles?.full_name || 'User')}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-foreground">
                      {selectedTicket.profiles?.full_name || 'Pengguna Anonim'}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Mail className="w-3 h-3" /> {selectedTicket.profiles?.email || 'Tidak ada email'}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 shrink-0">
                {selectedTicket.status !== 'resolved' && selectedTicket.status !== 'closed' && (
                  <Button variant="outline" size="sm" className="h-9 border-emerald-200 text-emerald-700 hover:bg-emerald-50 bg-emerald-50/30 rounded-xl transition-all shadow-sm" onClick={() => handleChangeStatus('resolved')}>
                    <CheckCircle2 className="w-4 h-4 mr-1.5" /> <span className="hidden sm:inline">Tandai</span> Selesai
                  </Button>
                )}
                {selectedTicket.status === 'resolved' && (
                  <Button variant="outline" size="sm" className="h-9 border-amber-200 text-amber-700 hover:bg-amber-50 rounded-xl shadow-sm" onClick={() => handleChangeStatus('open')}>
                    <RefreshCw className="w-4 h-4 mr-1.5" /> Buka Kembali
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full md:hidden bg-muted/50 hover:bg-muted" onClick={() => setSelectedTicket(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-fixed relative">
              <div className="absolute inset-0 bg-slate-50/90 z-0" />
              
              <div className="relative z-10 space-y-6">
                {messages.map((msg, i) => {
                  const isStaffMessage = msg.sender_id !== selectedTicket.reporter_id;
                  
                  return (
                    <div key={msg.id} className={`flex gap-3 group ${msg.is_internal_note ? 'justify-center my-8' : isStaffMessage ? 'flex-row-reverse' : 'flex-row'}`}>
                      
                      {!msg.is_internal_note && (
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold shadow-sm mt-auto mb-1 ${
                          isStaffMessage 
                            ? 'bg-gradient-to-tr from-primary to-primary/80 text-primary-foreground' 
                            : 'bg-white text-primary border border-primary/20'
                        }`}>
                          {getInitials(msg.profiles?.full_name || (isStaffMessage ? 'Admin' : 'User'))}
                        </div>
                      )}

                      {msg.is_internal_note ? (
                        <div className="bg-amber-50 border border-amber-200/80 text-amber-900 rounded-2xl px-5 py-3 text-sm shadow-sm max-w-[85%] relative overflow-hidden transition-all hover:shadow-md">
                          <div className="absolute top-0 left-0 w-1 h-full bg-amber-400" />
                          <div className="flex items-center gap-1.5 text-xs font-bold mb-2 text-amber-700">
                            <AlertCircle className="w-4 h-4" /> CATATAN INTERNAL (Hanya Staf)
                          </div>
                          <p className="whitespace-pre-wrap leading-relaxed">{msg.message_body}</p>
                          <div className="text-[10px] text-right mt-2 opacity-60 font-medium flex items-center justify-end gap-1">
                            <User className="w-3 h-3" />
                            {msg.profiles?.full_name || 'Admin'} • {new Date(msg.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      ) : (
                        <div className={`max-w-[75%] px-4 py-3 shadow-sm transition-all group-hover:shadow-md relative ${
                          isStaffMessage 
                            ? 'bg-gradient-to-br from-primary to-primary/90 text-primary-foreground rounded-2xl rounded-tr-sm' 
                            : 'bg-white border border-border/40 rounded-2xl rounded-tl-sm text-foreground'
                        }`}>
                          <div className={`text-xs font-bold mb-1.5 opacity-90 ${isStaffMessage ? 'text-primary-foreground/90' : 'text-primary'}`}>
                            {msg.profiles?.full_name || (isStaffMessage ? 'Admin' : 'User')}
                          </div>
                          <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{msg.message_body}</p>
                          <div className={`text-[10px] text-right mt-2 font-medium flex items-center justify-end gap-1 ${isStaffMessage ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                            <Clock className="w-3 h-3" />
                            {new Date(msg.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {messages.length === 0 && (
                  <div className="text-center p-8 text-muted-foreground flex flex-col items-center">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-r-transparent mb-3" />
                    <p className="text-sm font-medium">Memuat percakapan...</p>
                  </div>
                )}
              </div>
            </div>

            {/* Chat Input */}
            {selectedTicket.status !== 'closed' ? (
              <div className="p-4 bg-background/80 backdrop-blur-md border-t border-border/50 rounded-b-2xl shrink-0">
                <div className="flex items-center gap-3 mb-3 pl-1">
                  <label className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors group">
                    <div className={`w-5 h-5 rounded flex items-center justify-center border transition-all ${isInternalNote ? 'bg-amber-500 border-amber-500 text-white' : 'bg-background border-input group-hover:border-amber-400'}`}>
                      {isInternalNote && <CheckCircle2 className="w-3.5 h-3.5" />}
                    </div>
                    <input type="checkbox" checked={isInternalNote} onChange={e => setIsInternalNote(e.target.checked)} className="hidden" />
                    <span className={`font-medium transition-colors ${isInternalNote ? 'text-amber-600 dark:text-amber-500' : ''}`}>Balas sebagai Catatan Internal (Tersembunyi)</span>
                  </label>
                </div>
                <div className="flex items-end gap-2 relative">
                  <div className={`flex-1 rounded-2xl border overflow-hidden transition-all duration-300 shadow-sm ${
                    isInternalNote 
                      ? 'border-amber-300/60 bg-amber-50/30 focus-within:ring-2 focus-within:ring-amber-500/20 focus-within:border-amber-400' 
                      : 'bg-background focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary border-border/60'
                  }`}>
                    <textarea 
                      placeholder={isInternalNote ? "Ketik catatan internal untuk staf lain (pengguna tidak akan melihat ini)..." : "Ketik balasan untuk pengguna..."}
                      className={`w-full bg-transparent p-4 text-[15px] focus:outline-none min-h-[90px] max-h-[200px] resize-y placeholder:text-muted-foreground/60 ${isInternalNote ? 'text-amber-900 dark:text-amber-100' : ''}`}
                      value={replyMessage}
                      onChange={e => setReplyMessage(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          void handleSendReply();
                        }
                      }}
                    />
                    <div className="flex items-center justify-between px-3 pb-2 pt-1 border-t border-border/30 bg-muted/5">
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted">
                          <Paperclip className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted">
                          <ImageIcon className="w-4 h-4" />
                        </Button>
                      </div>
                      <span className="text-[10px] text-muted-foreground font-medium hidden sm:inline-block">
                        <kbd className="bg-muted px-1.5 py-0.5 rounded border border-border/50 mr-1">Enter</kbd> kirim
                        <span className="mx-2">•</span>
                        <kbd className="bg-muted px-1.5 py-0.5 rounded border border-border/50 mr-1">Shift+Enter</kbd> baris baru
                      </span>
                    </div>
                  </div>
                  <Button 
                    size="icon" 
                    className={`h-14 w-14 rounded-2xl shrink-0 shadow-md transition-all duration-300 hover:scale-105 active:scale-95 ${
                      isInternalNote 
                        ? 'bg-gradient-to-br from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 shadow-amber-500/20' 
                        : 'bg-gradient-to-br from-primary to-primary/90 shadow-primary/20'
                    }`}
                    onClick={handleSendReply}
                    disabled={isSending || !replyMessage.trim()}
                  >
                    {isSending ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/80 border-r-transparent" /> : <Send className={`w-5 h-5 ${replyMessage.trim() ? 'translate-x-0.5 -translate-y-0.5' : ''} transition-transform`} />}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-5 bg-muted/20 border-t border-border/50 text-center rounded-b-2xl shrink-0">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 mb-2">
                  <CheckCircle2 className="w-5 h-5 text-slate-500" />
                </div>
                <p className="text-sm text-muted-foreground font-medium">Tiket ini telah ditutup dan tidak dapat dibalas lagi.</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Buka kembali tiket jika masih memerlukan penanganan.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="hidden md:flex flex-1 items-center justify-center border border-border/50 rounded-2xl bg-card/50 backdrop-blur-sm animate-in fade-in duration-500">
            <div className="text-center p-8 max-w-sm">
              <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-primary/10 to-primary/5 flex items-center justify-center mx-auto mb-6 shadow-sm border border-primary/10">
                <MessageCircleQuestion className="w-10 h-10 text-primary/60" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">Pilih Tiket Laporan</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Pilih salah satu tiket dari daftar di sebelah kiri untuk melihat detail percakapan, merespons pertanyaan pengguna, atau menambahkan catatan internal.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
