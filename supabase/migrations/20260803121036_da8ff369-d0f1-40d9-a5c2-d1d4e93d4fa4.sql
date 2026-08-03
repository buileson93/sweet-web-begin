ALTER TABLE public.exam_events DROP CONSTRAINT IF EXISTS exam_events_kind_check;
ALTER TABLE public.exam_events ADD CONSTRAINT exam_events_kind_check CHECK (kind IN (
  'tab_hidden','window_blur','copy','paste','contextmenu','fullscreen_exit',
  'resize_suspect','reconnect','multi_tab','devtools_open','liveness_failed'
));