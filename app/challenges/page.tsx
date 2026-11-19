import { Suspense } from "react";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { JobMarketplace } from "@/components/hireyou/job-marketplace";

function MarketplaceLoading() {
  return <main className="market-shell"><p className="market-eyebrow">Loading open roles…</p></main>;
}

export default function ChallengesPage() {
  return (
    <Suspense fallback={<MarketplaceLoading />}>
      <OpenRoles />
    </Suspense>
  );
}

async function OpenRoles() {
  const supabase = await getSupabaseServerClient();

  if (!supabase) {
    return (
      <JobMarketplace
        jobs={[]}
        loadError="Add your Supabase project URL and publishable key to .env.local, then restart the app."
      />
    );
  }

  const { data, error } = await supabase
    .from("job_vacancies")
    .select("id, employer_id, title, company_name, description, category, location, employment_type, salary_range, deadline, task_title, task_brief, task_config, status, created_at, employer:profiles!job_vacancies_employer_id_fkey(company_bio, company_logo_url, company_city, company_region, company_website)")
    .eq("status", "open")
    .gt("deadline", new Date().toISOString())
    .order("created_at", { ascending: false });

  if (error) {
    const schemaMissing = ["PGRST204", "PGRST205", "42P01", "42703"].includes(error.code);
    return (
      <JobMarketplace
        jobs={[]}
        loadError={
          schemaMissing
            ? "The HIREYOU database schema needs an update. Run the latest supabase/schema.sql in your Supabase SQL Editor, then refresh."
            : `The job board could not be loaded: ${error.message}`
        }
      />
    );
  }

  return <JobMarketplace jobs={data ?? []} />;
}
