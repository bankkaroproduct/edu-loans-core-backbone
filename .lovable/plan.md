

# Connect EduLoans Partner Portal to External Supabase

## What This Means

You will create your own Supabase project at [supabase.com](https://supabase.com), and this app will be reconfigured to use that project as its backend instead of the current Lovable Cloud backend.

## Prerequisites (You Need to Do First)

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new Supabase project (pick a name, set a database password, choose a region)
3. Once the project is ready, copy these two values from **Project Settings > API**:
   - **Project URL** (e.g. `https://abcdefgh.supabase.co`)
   - **Anon/Public key** (the `anon` key, starts with `eyJ...`)

## Implementation Steps

### Step 1: Connect the External Supabase Project
Use the Supabase connector to link your external project to this Lovable app. This will update the environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`) to point to your project.

### Step 2: Run Full Schema Migration on Your Supabase Project
Export and execute all existing migrations from `supabase/migrations/` into your new project. This includes:
- All 22+ tables (users, student_leads, partner_organizations, etc.)
- All custom enums (app_role, lead_stage_enum, document_status_enum, etc.)
- All RLS policies for partner scoping and admin access
- All database functions (has_role, get_user_role, get_user_partner_id, is_admin_or_super, etc.)
- All triggers (lead ID generation, stage change logging, updated_at)
- All sequences (lead_id_seq, batch_id_seq)

### Step 3: Seed Master Data
Re-run all seed data inserts on the new project:
- 15 countries, 20 universities, 15 courses, 10 lenders
- 15 document types, 14 lifecycle stages, 28 statuses, 9 intakes
- 2 partner organizations (PTR-001, PTR-002)
- 6 test users (super_admin, admin, partner admins, agents)
- 2 payout rules

### Step 4: Configure Auth
- Enable email/password auth in the external Supabase project dashboard
- Set up the `handle_new_auth_user` trigger on `auth.users` to auto-create entries in the `public.users` table on signup
- Configure email confirmation settings as needed

### Step 5: Verify
- Test login/signup flow
- Confirm RLS policies work (partner users only see their own data)
- Confirm dashboard loads with seeded data

## Important Notes
- The app code itself (React components, hooks, pages) requires zero changes -- it already uses the Supabase JS client correctly
- Only the connection credentials change
- You will manage your database directly from the Supabase dashboard going forward
- The current Lovable Cloud backend will no longer be used once the switch is made

## Next Step for You
**Create your Supabase project first**, then come back and say "ready to connect" with your project URL and anon key. I will then connect it and run the full migration.

