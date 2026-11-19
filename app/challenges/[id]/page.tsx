import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Clock3, MapPin } from "lucide-react";
import { JobApplication } from "@/components/hireyou/job-application";
import type { CandidateProfile, JobListing } from "@/lib/jobs";
import { getEmployerProfile, getJobTasks } from "@/lib/jobs";
import { getSupabaseServerClient } from "@/lib/supabase-server";

function safeExternalUrl(value?: string) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

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
    .select("id, employer_id, title, company_name, description, category, location, employment_type, salary_range, deadline, task_title, task_brief, task_config, status, created_at, employer:profiles!job_vacancies_employer_id_fkey(company_bio, company_logo_url, company_city, company_region, company_website)")
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
      .select("user_id, role, full_name, bio, interests, company_name, company_bio, company_logo_url, company_city, company_region, company_website")
      .eq("user_id", user.id)
      .maybeSingle();
    profile = data;
  }

  const listing: JobListing = job;
  const tasks = getJobTasks(listing);
  const employer = getEmployerProfile(listing.employer);
  const companyWebsite = safeExternalUrl(employer?.company_website);

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
          <div className="job-company-profile">
            {employer?.company_logo_url
              ? <img src={employer.company_logo_url} alt="" />
              : <span>{(job.company_name || "H").slice(0, 1).toUpperCase()}</span>}
            <div>
              <p className="market-eyebrow">{job.company_name || "Hiring team"}</p>
              {(employer?.company_city || employer?.company_region) && (
                <small>{[employer?.company_city, employer?.company_region].filter(Boolean).join(", ")}</small>
              )}
            </div>
          </div>
          <p className="market-eyebrow">{job.category}</p>
          <h1>{job.title}</h1>
          <p className="job-detail-description">{job.description}</p>
          {employer?.company_bio && <p className="job-company-bio">{employer.company_bio}</p>}
          {companyWebsite && (
            <a className="job-company-website" href={companyWebsite} target="_blank" rel="noopener noreferrer">
              Company website <ArrowUpRight size={14} />
            </a>
          )}
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
          <p className="market-eyebrow">{tasks.length} task{tasks.length === 1 ? "" : "s"} · A chance to show your approach</p>
          {tasks.map((task, index) => (
            <article className="job-task-preview" key={task.id}>
              <p className="market-eyebrow">Task {index + 1} · {task.type.replace(/_/g, " ")}</p>
              <h2>{task.title}</h2>
              <p>{task.instructions}</p>
              {task.type === "multiple_choice" && <small>{task.questions?.length ?? 0} question{task.questions?.length === 1 ? "" : "s"}</small>}
              {task.type === "file_upload" && <small>Up to {task.maxFiles ?? 5} files · 25 MB each · 100 MB total per application</small>}
            </article>
          ))}
          <div className="job-task-note">
            Complete all assigned tasks. Your answers, links, and files will be attached to your application for the hiring team to review.
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
