-- Fix generate_ticket_number trigger function to use SECURITY DEFINER
-- This ensures the function runs with elevated privileges so it can count ALL tickets
-- in the system instead of only the tickets visible to the current user (via RLS).
-- If it counts only the user's tickets, the generated number will overlap with existing
-- numbers from other users, causing a unique constraint violation on ticket_number.

CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS TRIGGER
SECURITY DEFINER
AS $$
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
