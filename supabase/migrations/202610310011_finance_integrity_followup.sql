-- Follow-up to 010: donor identity, legacy journal amounts and transaction/invoice locking.
-- Replaces existing implementations only. Existing function ACLs and RLS stay in force.
-- No receipt, invoice, enrollment, recipient account or evidence is changed by deployment.

create or replace function public.finance_create_transaction(p_payload jsonb,p_request_key uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare invoice public.finance_invoices%rowtype;channel public.donation_payment_channels%rowtype;program uuid=nullif(p_payload->>'program_id','')::uuid;participant uuid;invoice_id_value uuid=nullif(p_payload->>'invoice_id','')::uuid;commitment_id uuid=nullif(p_payload->>'donor_commitment_id','')::uuid;donor uuid=nullif(p_payload->>'donor_id','')::uuid;proof uuid=nullif(p_payload->>'proof_document_id','')::uuid;amount_value numeric=(p_payload->>'amount')::numeric;kind text=p_payload->>'transaction_type';reference text=nullif(btrim(p_payload->>'reference_number'),'');payer text=btrim(p_payload->>'payer_name');paid date=nullif(p_payload->>'paid_at','')::date;available numeric;tid uuid;result jsonb;is_staff boolean=public.finance_staff();
begin
 if auth.uid() is null then raise exception 'Silakan masuk untuk mengonfirmasi pembayaran.';end if;
 result=public.finance_operation(p_request_key,'transaction',p_payload);if result is not null then return result;end if;
 if amount_value is null or amount_value<=0 or amount_value>9999999999.99 or amount_value<>round(amount_value,2) or kind is null or kind not in ('spp','registration','education_infaq','donation','wakaf','other') or nullif(payer,'') is null or length(payer)>160 or paid is null or paid>(now() at time zone 'Asia/Jakarta')::date then raise exception 'Lengkapi nama pembayar, nominal positif dan tanggal pembayaran yang benar.';end if;
 if invoice_id_value is not null then
  select * into invoice from public.finance_invoices where id=invoice_id_value for update;
  if not found or invoice.status<>'open' then raise exception 'Tagihan tidak tersedia atau sudah lunas/dibatalkan.';end if;
  if not public.finance_can_manage(invoice.program_id) and not exists(select 1 from public.participants where id=invoice.participant_id and user_id=auth.uid()) then raise exception 'Tagihan bukan milik Anda.';end if;
  program=invoice.program_id;participant=invoice.participant_id;kind=invoice.invoice_type;
  select invoice.amount-coalesce(sum(amount),0) into available from public.transactions where invoice_id=invoice.id and status in ('pending','verified');
  if amount_value>available then raise exception 'Nominal melebihi sisa tagihan yang belum dilaporkan.';end if;
 else
  if kind in ('spp','registration','education_infaq') then raise exception 'Pilih tagihan kelas yang sesuai sebelum mencatat pembayaran.';end if;
  if is_staff then if not public.finance_can_manage(program) then raise exception 'Program donasi di luar cakupan Anda.';end if;
  else
   if kind='other' then raise exception 'Jenis transaksi ini hanya untuk petugas keuangan.';end if;
   select id into participant from public.participants where user_id=auth.uid() order by id limit 1;
   donor=null;commitment_id=null;
  end if;
 end if;
 select * into channel from public.donation_payment_channels where id=(p_payload->>'payment_channel_id')::uuid for share;
 if not found or not coalesce(public.finance_channel_ready(channel.id),false) or (channel.program_id is not null and channel.program_id is distinct from program) or (channel.purpose<>'both' and channel.purpose<>(case when invoice_id_value is null then 'donation' else 'class' end)) then raise exception 'Pilih rekening/QR aktif yang sesuai tujuan pembayaran.';end if;
 if (p_payload->>'channel_updated_at')::timestamptz is distinct from channel.updated_at then raise exception 'Kanal pembayaran telah berubah. Muat ulang dan periksa tujuan pembayaran.';end if;
 if channel.channel_type='cash' and not is_staff then raise exception 'Pencatatan tunai dilakukan petugas keuangan.';end if;
 if proof is null and channel.channel_type<>'cash' then raise exception 'Unggah bukti pembayaran terlebih dahulu.';end if;
 if proof is not null and not exists(select 1 from public.finance_documents d where d.id=proof and d.owner_id=auth.uid() and d.purpose='proof' and d.status='ready' and not exists(select 1 from public.transactions t where t.proof_document_id=d.id)) then raise exception 'Bukti belum siap, sudah digunakan, atau bukan milik Anda.';end if;
 if reference is not null then
  if length(reference)>120 then raise exception 'Nomor referensi maksimal 120 karakter.';end if;
  perform pg_advisory_xact_lock(hashtextextended(channel.id::text||upper(reference),73));
  if exists(select 1 from public.transactions where payment_channel_id=channel.id and upper(btrim(reference_number))=upper(reference) and status in ('pending','verified')) then raise exception 'Nomor referensi ini sudah tercatat pada kanal yang sama.';end if;
 end if;
 if is_staff and donor is not null and not exists(select 1 from public.donor_profiles d where d.id=donor and (public.finance_can_manage(null) or d.created_by=auth.uid() or exists(select 1 from public.donor_commitments c where c.donor_id=d.id and public.finance_can_manage(c.program_id)))) then raise exception 'Donatur tidak dapat diakses.';end if;
 if is_staff and invoice_id_value is null then
  if donor is not null then select d.participant_id into participant from public.donor_profiles d where d.id=donor;end if;
  if nullif(p_payload->>'participant_id','') is not null and (p_payload->>'participant_id')::uuid is distinct from participant then raise exception 'Identitas peserta harus sesuai donatur yang dipilih.';end if;
 end if;
 if commitment_id is not null then
  if not exists(select 1 from public.donor_commitments where id=commitment_id and donor_id=donor and program_id is not distinct from program) then raise exception 'Komitmen donatur tidak sesuai transaksi.';end if;
 end if;
 tid=gen_random_uuid();insert into public.transactions(id,participant_id,program_id,enrollment_id,invoice_id,donor_id,donor_commitment_id,payment_channel_id,amount,transaction_type,status,billing_month,notes,payer_name,reference_number,paid_at,proof_document_id,channel_snapshot,created_by) values(tid,participant,program,invoice.enrollment_id,invoice_id_value,donor,commitment_id,channel.id,amount_value,kind,'pending',invoice.billing_month,nullif(btrim(p_payload->>'notes'),''),payer,reference,paid,proof,to_jsonb(channel),auth.uid());
 result=jsonb_build_object('transaction_id',tid,'status','pending');perform public.finance_operation_done(p_request_key,'transaction',p_payload,result);insert into public.audit_logs(user_id,action,entity_type,entity_id,details) values(auth.uid(),'finance_transaction.submitted','transaction',tid,jsonb_build_object('invoice_id',invoice_id_value,'program_id',program));return result;
end;$$;

create or replace function public.finance_reverse_journal(p_transaction_id uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare original public.finance_journal_entries%rowtype;eid uuid;original_amount numeric;
begin
 select * into original from public.finance_journal_entries where transaction_id=p_transaction_id and status='posted' for update;if not found then return null;end if;
 select id into eid from public.finance_journal_entries where reverses_entry_id=original.id;if found then return eid;end if;
 if (select count(*) from public.finance_journal_lines where journal_entry_id=original.id)<2 or (select coalesce(sum(debit-credit),1) from public.finance_journal_lines where journal_entry_id=original.id)<>0 then raise exception 'Jurnal lama belum seimbang. Periksa rincian sebelum pembatalan.';end if;
 select amount into original_amount from public.transactions where id=p_transaction_id;
 if original_amount is null or original_amount<=0 or (select sum(debit) from public.finance_journal_lines where journal_entry_id=original.id)<>original_amount or (select sum(credit) from public.finance_journal_lines where journal_entry_id=original.id)<>original_amount then raise exception 'Nominal jurnal lama tidak sesuai transaksi. Periksa sebelum pembatalan.';end if;
 eid=gen_random_uuid();insert into public.finance_journal_entries(id,entry_number,reverses_entry_id,entry_date,description,status,created_by) values(eid,'REV-'||upper(replace(original.id::text,'-','')),original.id,(now() at time zone 'Asia/Jakarta')::date,'Pembalik: '||original.description,'posted',auth.uid());
 insert into public.finance_journal_lines(journal_entry_id,account_id,debit,credit,memo) select eid,account_id,credit,debit,'Pembalik pencatatan' from public.finance_journal_lines where journal_entry_id=original.id;
 return eid;
end;$$;

create or replace function public.finance_review_transaction(p_id uuid,p_status text,p_notes text,p_expected_updated_at timestamptz,p_activate boolean default false) returns jsonb language plpgsql security definer set search_path=public as $$
declare tx public.transactions%rowtype;invoice public.finance_invoices%rowtype;invoice_value uuid;paid_total numeric;entry uuid;
begin
 if auth.uid() is null then raise exception 'Silakan masuk kembali.';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,76));
 select invoice_id into invoice_value from public.transactions where id=p_id;
 if invoice_value is not null then select * into invoice from public.finance_invoices where id=invoice_value for update;end if;
 select * into tx from public.transactions where id=p_id for update;
 if not found or not public.finance_can_manage(tx.program_id) then raise exception 'Anda tidak memiliki akses memverifikasi transaksi ini.';end if;
 if tx.invoice_id is distinct from invoice_value then raise exception 'Hubungan tagihan telah berubah. Muat ulang sebelum memeriksa pembayaran.';end if;
 if p_status is null or p_status not in ('verified','rejected','void') or length(coalesce(p_notes,''))>4000 then raise exception 'Status atau catatan belum valid.';end if;
 if tx.status=p_status then return jsonb_build_object('transaction_id',tx.id,'status',tx.status);end if;
 if p_expected_updated_at is null or tx.updated_at<>p_expected_updated_at then raise exception 'Transaksi telah berubah. Muat ulang sebelum melanjutkan.';end if;
 if not ((tx.status='pending' and p_status in ('verified','rejected','void')) or (tx.status='verified' and p_status='void') or (tx.status='rejected' and p_status='void')) then raise exception 'Perubahan status tidak diizinkan.';end if;
 if p_status in ('rejected','void') and nullif(btrim(p_notes),'') is null then raise exception 'Isi alasan penolakan atau pembatalan.';end if;
 if p_status='verified' then
  if tx.amount<=0 or (tx.proof_document_id is null and coalesce(tx.channel_snapshot->>'channel_type','')<>'cash' and nullif(btrim(p_notes),'') is null) then raise exception 'Periksa bukti atau isi alasan verifikasi catatan lama.';end if;
  if invoice.id is not null then
   if invoice.status='cancelled' then raise exception 'Tagihan telah dibatalkan.';end if;
   select coalesce(sum(amount),0) into paid_total from public.transactions where invoice_id=invoice.id and status='verified';
   if paid_total+tx.amount>invoice.amount then raise exception 'Pembayaran akan melebihi tagihan. Periksa transaksi lain.';end if;
  end if;
 end if;
 update public.transactions set status=p_status,review_notes=nullif(btrim(p_notes),''),verified_by=case when p_status='verified' then auth.uid() else verified_by end,verified_at=case when p_status='verified' then now() else verified_at end,updated_at=now() where id=tx.id;
 if p_status='verified' then entry=public.finance_post_transaction(tx.id);elsif p_status='void' and tx.status='verified' then entry=public.finance_reverse_journal(tx.id);end if;
 if invoice.id is not null then
  select coalesce(sum(amount),0) into paid_total from public.transactions where invoice_id=invoice.id and status='verified';
  update public.finance_invoices set status=case when paid_total>=amount then 'paid' else 'open' end,updated_at=now() where id=invoice.id and status<>'cancelled';
  perform public.finance_refresh_enrollment(invoice.enrollment_id,p_status='verified' and p_activate);
 end if;
 insert into public.audit_logs(user_id,action,entity_type,entity_id,details) values(auth.uid(),'finance_transaction.'||p_status,'transaction',tx.id,jsonb_build_object('previous_status',tx.status,'invoice_id',tx.invoice_id,'journal_id',entry,'activate_requested',p_activate));
 return jsonb_build_object('transaction_id',tx.id,'status',p_status);
end;$$;

create or replace function public.finance_allocate_transaction(p_id uuid,p_invoice_id uuid,p_expected_updated_at timestamptz) returns jsonb language plpgsql security definer set search_path=public as $$declare invoice public.finance_invoices%rowtype;tx public.transactions%rowtype;amount_paid numeric;begin
 if auth.uid() is null then raise exception 'Silakan masuk kembali.';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,76));
 select * into invoice from public.finance_invoices where id=p_invoice_id for update;
 if not found or not public.finance_can_manage(invoice.program_id) or invoice.status='cancelled' then raise exception 'Tagihan tidak dapat diakses.';end if;
 select * into tx from public.transactions where id=p_id for update;
 if not found or not public.finance_can_manage(tx.program_id) or tx.participant_id is distinct from invoice.participant_id or tx.program_id is distinct from invoice.program_id or tx.status not in ('pending','verified') or tx.transaction_type not in ('spp','registration','education_infaq') then raise exception 'Transaksi dan tagihan peserta tidak sesuai.';end if;
 if tx.amount<=0 then raise exception 'Nominal pembayaran lama harus positif sebelum dihubungkan ke tagihan.';end if;
 if tx.invoice_id=p_invoice_id then return jsonb_build_object('transaction_id',tx.id,'invoice_id',invoice.id);end if;
 if tx.invoice_id is not null or tx.updated_at is distinct from p_expected_updated_at then raise exception 'Transaksi sudah terhubung atau berubah. Muat ulang terlebih dahulu.';end if;
 select coalesce(sum(amount),0) into amount_paid from public.transactions where invoice_id=invoice.id and status in ('pending','verified');
 if amount_paid+tx.amount>invoice.amount then raise exception 'Nominal transaksi melebihi tagihan yang tersedia.';end if;
 update public.transactions set invoice_id=invoice.id,enrollment_id=invoice.enrollment_id,updated_at=now() where id=tx.id;
 select coalesce(sum(amount),0) into amount_paid from public.transactions where invoice_id=invoice.id and status='verified';
 update public.finance_invoices set status=case when amount_paid>=amount then 'paid' else 'open' end,updated_at=now() where id=invoice.id;
 perform public.finance_refresh_enrollment(invoice.enrollment_id);
 insert into public.audit_logs(user_id,action,entity_type,entity_id,details) values(auth.uid(),'finance_transaction.allocated','transaction',tx.id,jsonb_build_object('invoice_id',invoice.id));return jsonb_build_object('transaction_id',tx.id,'invoice_id',invoice.id);end;$$;
