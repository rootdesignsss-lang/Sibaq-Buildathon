import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Clock3, MapPin } from "lucide-react";
import { JobApplication } from "@/components/hireyou/job-application";
import type { CandidateProfile, JobListing } from "@/lib/jobs";
import { getSupabaseServerClient } from "@/lib/supabase-server";

async function JobDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getSupabaseServerClient();

  if (!supabase) {
    return (
      <main className="job-detail-shell">
        <p>Connect Supabase to view this job and apply.</p>
        <Link href="/auth">Open your workspace <ArrowUpRight size={16} /></Link>
      </main>
    );
  }

  const { data: job, error } = await supabase
    .from("job_vacancies")
    .select("id, employer_id, title, company_name, description, category, location, employment_type, salary_range, deadline, task_title, task_brief, task_config, status, created_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return (
      <main className="job-detail-shell">
        <h1>We couldn&apos;t load this opportunity.</h1>
        <p>{error.message}</p>
        <Link href="/challenges">Back to open roles <ArrowLeft size={16} /></Link>
      </main>
    );
  }
  if (!job) notFound();

  const { data: { user } } = await supabase.auth.getUser();
  let profile: CandidateProfile | null = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("user_id, role, full_name, bio, interests, company_name")
      .eq("user_id", user.id)
      .maybeSingle();
    profile = data;
  }

  const listing: JobListing = job;

  return (
    <main className="job-detail-shell">
      <header className="market-header">
        <Link href="/" className="market-brand">HIREYOU<span>.</span></Link>
        <nav aria-label="Job navigation">
          <Link href="/challenges"><ArrowLeft size={15} /> All opportunities</Link>
          <Link href="/dashboard">Your workspace</Link>
        </nav>
      </header>

      <section className="job-detail-hero">
        <div className="job-detail-photo" role="img" aria-label={`${job.category} team collaborating`} />
        <div className="job-detail-intro">
          <p className="market-eyebrow">{job.category} · {job.company_name || "Hiring team"}</p>
          <h1>{job.title}</h1>
          <p className="job-detail-description">{job.description}</p>
          <div className="job-detail-facts">
            <span><MapPin size={16} />{job.location}</span>
            <span>{job.employment_type}</span>
            {job.salary_range && <span>{job.salary_range}</span>}
            <span><Clock3 size={16} />Apply by {new Date(job.deadline).toLocaleDateString()}</span>
          </div>
        </div>
      </section>

      <section className="job-task-layout">
        <div className="job-task-brief">
          <p className="market-eyebrow">A chance to show your approach</p>
          <h2>{job.task_title}</h2>
          <p>{job.task_brief}</p>
          <div className="job-task-note">
            No CV screen. Complete this short work sample so the team can see how you think.
          </div>
        </div>
        <JobApplication
          job={listing}
          currentUserId={user?.id ?? null}
          candidateProfile={profile}
          currentUserEmail={user?.email ?? ""}
        />
      </section>

      <footer className="market-footer">
        <Link href="/" className="market-brand">HIREYOU<span>.</span></Link>
        <p>Let the work speak for itself.</p>
      </footer>
    </main>
  );
}

export default function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<main className="job-detail-shell"><p>Loading this opportunity…</p></main>}>
      <JobDetail params={params} />
    </Suspense>
  );
}
