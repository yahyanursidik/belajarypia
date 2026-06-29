-- =====================================================================================
-- Yayasan Pendidikan Ihsanul Adab (YPIA) - LMS Database Schema Migration
-- Phase 22: Helpdesk System
-- Description: Creates helpdesk_tickets and helpdesk_messages for ticketing support.
-- =====================================================================================

-- 1. Create Helpdesk Tickets Table
CREATE TABLE public.helpdesk_tickets (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    ticket_number varchar(20) NOT NULL UNIQUE,
    reporter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    category varchar(50) NOT NULL DEFAULT 'other', -- technical, academic, finance, general
    subject varchar(255) NOT NULL,
    priority varchar(20) NOT NULL DEFAULT 'medium', -- low, medium, high, urgent
    status varchar(20) NOT NULL DEFAULT 'open', -- open, in_progress, resolved, closed
    assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create Helpdesk Messages Table
CREATE TABLE public.helpdesk_messages (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    ticket_id uuid NOT NULL REFERENCES public.helpdesk_tickets(id) ON DELETE CASCADE,
    sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    message_body text NOT NULL,
    is_internal_note boolean DEFAULT false NOT NULL,
    created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create Indexes for faster querying
CREATE INDEX idx_helpdesk_tickets_reporter ON public.helpdesk_tickets(reporter_id);
CREATE INDEX idx_helpdesk_tickets_status ON public.helpdesk_tickets(status);
CREATE INDEX idx_helpdesk_messages_ticket ON public.helpdesk_messages(ticket_id);
CREATE INDEX idx_helpdesk_messages_created_at ON public.helpdesk_messages(created_at);

-- 4. Set up Row Level Security (RLS)
ALTER TABLE public.helpdesk_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.helpdesk_messages ENABLE ROW LEVEL SECURITY;

-- 4a. RLS for helpdesk_tickets
-- Participants/Reporters can view their own tickets
CREATE POLICY "Users can view their own tickets"
    ON public.helpdesk_tickets FOR SELECT
    USING (auth.uid() = reporter_id);

-- Staff (admin, super_admin, helpdesk) can view all tickets
CREATE POLICY "Staff can view all tickets"
    ON public.helpdesk_tickets FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.roles r ON r.id = ur.role_id
            WHERE ur.user_id = auth.uid() AND r.code IN ('super_admin', 'admin', 'helpdesk')
        )
    );

-- Participants/Reporters can insert their own tickets
CREATE POLICY "Users can create tickets"
    ON public.helpdesk_tickets FOR INSERT
    WITH CHECK (auth.uid() = reporter_id);

-- Staff can insert tickets on behalf of users
CREATE POLICY "Staff can insert tickets"
    ON public.helpdesk_tickets FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.roles r ON r.id = ur.role_id
            WHERE ur.user_id = auth.uid() AND r.code IN ('super_admin', 'admin', 'helpdesk')
        )
    );

-- Staff can update tickets
CREATE POLICY "Staff can update tickets"
    ON public.helpdesk_tickets FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.roles r ON r.id = ur.role_id
            WHERE ur.user_id = auth.uid() AND r.code IN ('super_admin', 'admin', 'helpdesk')
        )
    );

-- 4b. RLS for helpdesk_messages
-- Participants can view messages on their own tickets (except internal notes)
CREATE POLICY "Users can view messages on their tickets"
    ON public.helpdesk_messages FOR SELECT
    USING (
        is_internal_note = false AND
        EXISTS (
            SELECT 1 FROM public.helpdesk_tickets t
            WHERE t.id = ticket_id AND t.reporter_id = auth.uid()
        )
    );

-- Staff can view all messages
CREATE POLICY "Staff can view all messages"
    ON public.helpdesk_messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.roles r ON r.id = ur.role_id
            WHERE ur.user_id = auth.uid() AND r.code IN ('super_admin', 'admin', 'helpdesk')
        )
    );

-- Participants can insert messages on their tickets
CREATE POLICY "Users can insert messages on their tickets"
    ON public.helpdesk_messages FOR INSERT
    WITH CHECK (
        auth.uid() = sender_id AND
        is_internal_note = false AND
        EXISTS (
            SELECT 1 FROM public.helpdesk_tickets t
            WHERE t.id = ticket_id AND t.reporter_id = auth.uid()
        )
    );

-- Staff can insert messages on any ticket
CREATE POLICY "Staff can insert messages"
    ON public.helpdesk_messages FOR INSERT
    WITH CHECK (
        auth.uid() = sender_id AND
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.roles r ON r.id = ur.role_id
            WHERE ur.user_id = auth.uid() AND r.code IN ('super_admin', 'admin', 'helpdesk')
        )
    );

-- Trigger for updated_at on helpdesk_tickets
CREATE OR REPLACE FUNCTION update_helpdesk_tickets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_helpdesk_tickets_timestamp ON public.helpdesk_tickets;
CREATE TRIGGER update_helpdesk_tickets_timestamp
    BEFORE UPDATE ON public.helpdesk_tickets
    FOR EACH ROW
    EXECUTE FUNCTION update_helpdesk_tickets_updated_at();

-- Trigger for auto-generating ticket_number
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS TRIGGER AS $$
DECLARE
    ticket_count INT;
    prefix VARCHAR := 'TKT-';
    padded_count VARCHAR;
BEGIN
    -- Get current count of tickets
    SELECT COUNT(*) INTO ticket_count FROM public.helpdesk_tickets;
    
    -- Format number to 6 digits, e.g., 000001
    padded_count := LPAD((ticket_count + 1)::text, 6, '0');
    
    -- Combine prefix and padded count
    NEW.ticket_number := prefix || padded_count;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS generate_ticket_number_trigger ON public.helpdesk_tickets;
CREATE TRIGGER generate_ticket_number_trigger
    BEFORE INSERT ON public.helpdesk_tickets
    FOR EACH ROW
    WHEN (NEW.ticket_number IS NULL)
    EXECUTE FUNCTION generate_ticket_number();
