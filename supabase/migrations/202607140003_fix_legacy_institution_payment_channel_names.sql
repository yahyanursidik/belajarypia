update public.donation_payment_channels
set
  account_holder = replace(account_holder, 'Yayasan Pendidikan Islam Al Atsari', 'Yayasan Pendidikan Ihsanul Adab'),
  instructions = replace(instructions, 'Yayasan Pendidikan Islam Al Atsari', 'Yayasan Pendidikan Ihsanul Adab')
where
  account_holder ilike '%Yayasan Pendidikan Islam Al Atsari%'
  or instructions ilike '%Yayasan Pendidikan Islam Al Atsari%';
