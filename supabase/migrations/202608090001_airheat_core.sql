create extension if not exists pgcrypto;

create type public.app_user_role as enum ('admin', 'employee');
create type public.service_status as enum ('future', 'pending', 'missed', 'completed', 'cancelled');
create type public.warranty_status as enum ('active', 'expired', 'two_year', 'declined');
create type public.import_status as enum ('started', 'validated', 'completed', 'failed');
create type public.audit_action as enum ('create', 'update', 'delete');

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  role public.app_user_role not null default 'employee',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_email_not_blank check (length(trim(email)) > 0)
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  customer_kind text not null default 'person',
  name text not null,
  phone text,
  email text,
  address_summary text,
  notes text,
  created_by uuid references public.users(id) on delete set null,
  assigned_to uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customers_name_not_blank check (length(trim(name)) > 0),
  constraint customers_kind_valid check (customer_kind in ('person', 'company'))
);

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete restrict,
  name text not null,
  full_address text not null,
  latitude double precision,
  longitude double precision,
  notes text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint properties_name_not_blank check (length(trim(name)) > 0),
  constraint properties_address_not_blank check (length(trim(full_address)) > 0),
  constraint properties_latitude_valid check (latitude is null or latitude between -90 and 90),
  constraint properties_longitude_valid check (longitude is null or longitude between -180 and 180),
  constraint properties_coordinates_complete check ((latitude is null) = (longitude is null))
);

create table public.equipment (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete restrict,
  category text not null,
  manufacturer text,
  model text,
  serial_number text,
  installed_at date,
  commissioned_at date,
  notes text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint equipment_category_not_blank check (length(trim(category)) > 0),
  constraint equipment_identity_present check (
    nullif(trim(coalesce(manufacturer, '')), '') is not null
    or nullif(trim(coalesce(model, '')), '') is not null
    or nullif(trim(coalesce(serial_number, '')), '') is not null
  )
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references public.equipment(id) on delete restrict,
  service_kind text not null,
  status public.service_status not null,
  scheduled_date date,
  completed_date date,
  service_year integer,
  notes text,
  technician_id uuid references public.users(id) on delete set null,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint services_kind_not_blank check (length(trim(service_kind)) > 0),
  constraint services_date_present check (scheduled_date is not null or completed_date is not null),
  constraint services_completed_has_date check (status <> 'completed' or completed_date is not null),
  constraint services_year_valid check (service_year is null or service_year between 1900 and 2200)
);

create table public.warranties (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null unique references public.equipment(id) on delete restrict,
  status public.warranty_status not null,
  starts_on date,
  ends_on date,
  duration_years integer,
  declined_reason text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint warranties_duration_valid check (duration_years is null or duration_years between 1 and 50),
  constraint warranties_date_order check (starts_on is null or ends_on is null or ends_on >= starts_on),
  constraint warranties_declined_consistent check (status <> 'declined' or declined_reason is not null)
);

create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  source_system text not null,
  source_name text not null,
  source_checksum text not null unique,
  status public.import_status not null default 'started',
  record_counts jsonb not null default '{}'::jsonb,
  error_details jsonb,
  started_by uuid references public.users(id) on delete set null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint import_batches_source_not_blank check (length(trim(source_system)) > 0 and length(trim(source_name)) > 0),
  constraint import_batches_checksum_not_blank check (length(trim(source_checksum)) > 0)
);

create table public.legacy_id_map (
  id uuid primary key default gen_random_uuid(),
  import_batch_id uuid references public.import_batches(id) on delete restrict,
  source_system text not null,
  entity_type text not null,
  legacy_id text not null,
  target_table text not null,
  target_id uuid not null,
  created_at timestamptz not null default now(),
  constraint legacy_id_map_entity_valid check (entity_type in ('customer', 'property', 'equipment', 'service', 'warranty')),
  constraint legacy_id_map_table_valid check (target_table in ('customers', 'properties', 'equipment', 'services', 'warranties')),
  constraint legacy_id_map_source_not_blank check (length(trim(source_system)) > 0 and length(trim(legacy_id)) > 0),
  unique (source_system, entity_type, legacy_id),
  unique (source_system, entity_type, target_id)
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  actor_user_id uuid references public.users(id) on delete set null,
  action public.audit_action not null,
  table_name text not null,
  record_id uuid not null,
  old_data jsonb,
  new_data jsonb,
  occurred_at timestamptz not null default now()
);

create index properties_customer_id_idx on public.properties(customer_id);
create index equipment_property_id_idx on public.equipment(property_id);
create index services_equipment_id_date_idx on public.services(equipment_id, completed_date desc, scheduled_date desc);
create index customers_assigned_to_idx on public.customers(assigned_to);
create index audit_events_record_idx on public.audit_events(table_name, record_id, occurred_at desc);
create index legacy_id_map_target_idx on public.legacy_id_map(target_table, target_id);

create function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create function public.write_audit_event() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare row_id uuid;
begin
  row_id := case when tg_op = 'DELETE' then old.id else new.id end;
  insert into public.audit_events(actor_user_id, action, table_name, record_id, old_data, new_data)
  values (
    auth.uid(),
    case tg_op when 'INSERT' then 'create'::public.audit_action when 'UPDATE' then 'update'::public.audit_action else 'delete'::public.audit_action end,
    tg_table_name,
    row_id,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end
  );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create function public.is_active_user() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists(select 1 from public.users where id = auth.uid() and active);
$$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists(select 1 from public.users where id = auth.uid() and active and role = 'admin');
$$;

revoke all on function public.is_active_user() from public;
revoke all on function public.is_admin() from public;
revoke all on function public.write_audit_event() from public;
revoke all on function public.set_updated_at() from public;
grant execute on function public.is_active_user() to authenticated;
grant execute on function public.is_admin() to authenticated;

create trigger users_updated_at before update on public.users for each row execute function public.set_updated_at();
create trigger customers_updated_at before update on public.customers for each row execute function public.set_updated_at();
create trigger properties_updated_at before update on public.properties for each row execute function public.set_updated_at();
create trigger equipment_updated_at before update on public.equipment for each row execute function public.set_updated_at();
create trigger services_updated_at before update on public.services for each row execute function public.set_updated_at();
create trigger warranties_updated_at before update on public.warranties for each row execute function public.set_updated_at();

create trigger customers_audit after insert or update or delete on public.customers for each row execute function public.write_audit_event();
create trigger properties_audit after insert or update or delete on public.properties for each row execute function public.write_audit_event();
create trigger equipment_audit after insert or update or delete on public.equipment for each row execute function public.write_audit_event();
create trigger services_audit after insert or update or delete on public.services for each row execute function public.write_audit_event();
create trigger warranties_audit after insert or update or delete on public.warranties for each row execute function public.write_audit_event();

alter table public.users enable row level security;
alter table public.customers enable row level security;
alter table public.properties enable row level security;
alter table public.equipment enable row level security;
alter table public.services enable row level security;
alter table public.warranties enable row level security;
alter table public.audit_events enable row level security;
alter table public.import_batches enable row level security;
alter table public.legacy_id_map enable row level security;

revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
grant select, insert, update, delete on public.users, public.customers, public.properties, public.equipment, public.services, public.warranties, public.import_batches, public.legacy_id_map to authenticated;
grant select on public.audit_events to authenticated;
grant usage, select on sequence public.audit_events_id_seq to authenticated;

create policy users_read_self_or_admin on public.users for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));
create policy users_admin_insert on public.users for insert to authenticated with check ((select public.is_admin()));
create policy users_admin_update on public.users for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy users_admin_delete on public.users for delete to authenticated using ((select public.is_admin()));

create policy customers_active_read on public.customers for select to authenticated using ((select public.is_active_user()));
create policy properties_active_read on public.properties for select to authenticated using ((select public.is_active_user()));
create policy equipment_active_read on public.equipment for select to authenticated using ((select public.is_active_user()));
create policy services_active_read on public.services for select to authenticated using ((select public.is_active_user()));
create policy warranties_active_read on public.warranties for select to authenticated using ((select public.is_active_user()));

create policy customers_admin_insert on public.customers for insert to authenticated with check ((select public.is_admin()));
create policy customers_admin_update on public.customers for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy customers_admin_delete on public.customers for delete to authenticated using ((select public.is_admin()));
create policy properties_admin_insert on public.properties for insert to authenticated with check ((select public.is_admin()));
create policy properties_admin_update on public.properties for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy properties_admin_delete on public.properties for delete to authenticated using ((select public.is_admin()));
create policy equipment_admin_insert on public.equipment for insert to authenticated with check ((select public.is_admin()));
create policy equipment_admin_update on public.equipment for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy equipment_admin_delete on public.equipment for delete to authenticated using ((select public.is_admin()));
create policy services_admin_insert on public.services for insert to authenticated with check ((select public.is_admin()));
create policy services_admin_update on public.services for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy services_admin_delete on public.services for delete to authenticated using ((select public.is_admin()));
create policy warranties_admin_insert on public.warranties for insert to authenticated with check ((select public.is_admin()));
create policy warranties_admin_update on public.warranties for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy warranties_admin_delete on public.warranties for delete to authenticated using ((select public.is_admin()));

create policy audit_events_admin_read on public.audit_events for select to authenticated using ((select public.is_admin()));
create policy import_batches_admin_all on public.import_batches for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy legacy_id_map_admin_all on public.legacy_id_map for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

comment on table public.legacy_id_map is 'Idempotent bridge from immutable legacy/import identifiers to normalized UUID records.';
comment on function public.write_audit_event() is 'Server-side audit trail for normalized domain create/update/delete operations.';
