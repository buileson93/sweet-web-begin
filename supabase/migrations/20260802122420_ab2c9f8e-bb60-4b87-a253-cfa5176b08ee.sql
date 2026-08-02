ALTER TABLE public.device_visits
  ADD COLUMN IF NOT EXISTS employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS employee_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS employee_unit text NOT NULL DEFAULT '';

ALTER TABLE public.carousel_events
  ADD COLUMN IF NOT EXISTS employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS employee_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS employee_unit text NOT NULL DEFAULT '';

ALTER TABLE public.bug_reports
  ADD COLUMN IF NOT EXISTS employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS employee_unit text NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS device_visits_employee_idx ON public.device_visits (employee_id);
CREATE INDEX IF NOT EXISTS carousel_events_employee_idx ON public.carousel_events (employee_id);
CREATE INDEX IF NOT EXISTS bug_reports_employee_idx ON public.bug_reports (employee_id);