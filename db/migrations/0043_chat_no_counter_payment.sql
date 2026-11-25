-- ---------------------------------------------------------------------------
-- 0043: chat patients cannot choose "pay at the hospital" (PAY-03, D6 reversed)
--
-- "Pay at the counter" is for walk-in patients only (front-desk bookings).
-- A self-paying chat booking must pay by QR Ph. This trigger refuses a new
-- counter payment that is still awaiting payment, so the booking functions
-- from 0034 and 0038 need no copy.
--
-- Left alone on purpose:
--   * collect_at_counter rows (front desk, and the HMO denial under 2 h away
--     in 0037), since their status is not awaiting_payment.
--   * existing rows, since this only fires on insert.
-- ---------------------------------------------------------------------------

create or replace function public.cammi_connect_refuse_chat_counter_payment()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.method = 'counter' and new.status = 'awaiting_payment' then
    raise exception 'counter_payment_not_allowed_in_chat'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists payments_refuse_chat_counter on public.payments;
create trigger payments_refuse_chat_counter
before insert on public.payments
for each row execute function public.cammi_connect_refuse_chat_counter_payment();
