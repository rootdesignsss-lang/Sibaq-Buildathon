import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { WorkspaceDashboard } from "@/components/hireyou/workspace-dashboard";
import type { CandidateProfile } from "@/lib/jobs";

function SetupNotice({ details }: { details: string }) {
  return (
    <main className="workspace-shell">
      <section className="workspace-setup-card">
        <p className="market-eyebrow">One-time setup</p>
        <h1>Connect your HIREYOU workspace.</h1>
        <p>{details}</p>
        <ol>
          <li>Open your Supabase project and choose <strong>SQL Editor</strong>.</li>
          <li>Run the setup script in <code>supabase/schema.sql</code>.</li>
          <li>Refresh this page and create your candidate or employer profile.</li>
        </ol>
        <Link href="/auth" className="job-apply-button">Back to sign in</Link>
      </section>
    </main>
  );
}

function DashboardLoading() {
  return <main className="workspace-shell"><p>Loading your workspace…</p></main>;
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <DashboardContent />
    </Suspense>
  );
}

async function DashboardContent() {
  const supabase = await getSupabaseServerClient();

  if (!supabase) {
    return <SetupNotice details="Supabase credentials are missing. Add your project URL and publishable key to .env.local, then restart Next.js." />;
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) {
    return <SetupNotice details={`Supabase could not verify your session: ${authError.message}`} />;
  }
  if (!user) redirect("/auth");

  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, role, full_name, bio, interests, company_name, company_bio, company_logo_url, company_city, company_region, company_website")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    const schemaMissing = ["PGRST204", "PGRST205", "42P01", "42703"].includes(error.code);
    return (
      <SetupNotice
        details={
          schemaMissing
            ? "The database schema needs an update. Run the latest supabase/schema.sql in the Supabase SQL Editor to enable company profiles, varied tasks, private file submissions, reviews, and chat."
            : `Your profile could not be loaded: ${error.message}`
        }
      />
    );
  }
  if (!data) {
    return (
      <SetupNotice details="We couldn't find your profile. Confirm your email if required, then sign in again. If the problem continues, run supabase/schema.sql in the Supabase SQL Editor." />
    );
  }

  const profile: CandidateProfile = data;
  return <WorkspaceDashboard profile={profile} />;
}
