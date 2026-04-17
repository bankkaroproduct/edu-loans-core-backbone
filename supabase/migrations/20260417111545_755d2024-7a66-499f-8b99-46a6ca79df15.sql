-- Enable realtime for student_leads so Admin Dashboard auto-refreshes on new/updated leads
ALTER TABLE public.student_leads REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.student_leads;