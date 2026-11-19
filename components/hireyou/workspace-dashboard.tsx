"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  LogOut,
  RefreshCw,
  Sparkles,
  Users,
} from "lucide-react";
import type { CandidateProfile, JobListing } from "@/lib/jobs";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { JobComposer } from "@/components/hireyou/job-composer";
import { ApplicationChat } from "@/components/hireyou/application-chat";
import { NikoAssistant } from "@/components/hireyou/niko-assistant";

type EmployerApplication = {
  id: string;
  vacancy_id: string;
  candidate_id: string;
  status: string;
  result_score: number | null;
  result_feedback: { correct?: number; total?: number };
  created_at: string;
  candidate?: CandidateProfile | null;
};

type CandidateApplication = {
  id: string;
  vacancy_id: string;
  status: string;
  result_score: number | null;
  result_feedback: { correct?: number; total?: number };
  created_at: string;
  job: Pick<JobListing, "id" | "title" | "company_name" | "category" | "deadline" | "task_title"> | null;
};

export function WorkspaceDashboard({ profile }: { profile: CandidateProfile }) {
  const supabase = getSupabaseBrowserClient();
  const router = useRouter();
  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [openJobs, setOpenJobs] = useState<JobListing[]>([]);
  const [employerApplications, setEmployerApplications] = useState<EmployerApplication[]>([]);
  const [candidateApplications, setCandidateApplications] = useState<CandidateApplication[]>([]);
  const [busy, setBusy] = useState(Boolean(supabase));
  const [loadError, setLoadError] = useState(
    supabase ? "" : "Supabase is not configured. Add the project settings to .env.local and restart the app.",
  );
  const [bio, setBio] = useState(profile.bio);
  const [profileStatus, setProfileStatus] = useState("");
  const [profileError, setProfileError] = useState("");

  const loadWorkspace = useCallback(async () => {
    if (!supabase) return;
    if (profile.role === "employer") {
      const { data: jobRows, error: jobsError } = await supabase
        .from("job_vacancies")
        .select("id, employer_id, title, company_name, description, category, location, employment_type, salary_range, deadline, task_title, task_brief, task_config, status, created_at")
        .eq("employer_id", profile.user_id)
        .order("created_at", { ascending: false });

      if (jobsError) {
        setLoadError(`Your roles could not be loaded: ${jobsError.message}`);
        setBusy(false);
        return;
      }

      setLoadError("");
      const ownedJobs = (jobRows ?? []) as JobListing[];
      setJobs(ownedJobs);
      if (ownedJobs.length) {
        const { data: applicationRows, error: applicationsError } = await supabase
          .from("applications")
          .select("id, vacancy_id, candidate_id, status, result_score, result_feedback, created_at")
          .in("vacancy_id", ownedJobs.map((job) => job.id))
          .order("result_score", { ascending: false });

        if (applicationsError) {
          setLoadError(`Applicant results could not be loaded: ${applicationsError.message}`);
        } else {
          const applications = (applicationRows ?? []) as EmployerApplication[];
          const candidateIds = [...new Set(applications.map((application) => application.candidate_id))];
          const { data: profiles, error: profileLoadError } = candidateIds.length
            ? await supabase
                .from("profiles")
                .select("user_id, role, full_name, bio, interests, company_name")
                .in("user_id", candidateIds)
            : { data: [], error: null };

          if (profileLoadError) {
            setLoadError(`Candidate profiles could not be loaded: ${profileLoadError.message}`);
          } else {
            const candidateProfiles = (profiles ?? []) as CandidateProfile[];
            setEmployerApplications(applications.map((application) => ({
              ...application,
              candidate: candidateProfiles.find((item) => item.user_id === application.candidate_id) ?? null,
            })));
          }
        }
      } else {
        setEmployerApplications([]);
      }
    } else {
      const [applicationsResult, jobsResult] = await Promise.all([
        supabase
          .from("applications")
          .select("id, vacancy_id, status, result_score, result_feedback, created_at, job:job_vacancies(id, title, company_name, category, deadline, task_title)")
          .eq("candidate_id", profile.user_id)
          .order("created_at", { ascending: false }),
        supabase
          .from("job_vacancies")
          .select("id, employer_id, title, company_name, description, category, location, employment_type, salary_range, deadline, task_title, task_brief, task_config, status, created_at")
          .eq("status", "open")
          .gt("deadline", new Date().toISOString())
          .order("created_at", { ascending: false }),
      ]);

      const errors = [
        applicationsResult.error && `Your applications could not be loaded: ${applicationsResult.error.message}`,
        jobsResult.error && `Niko couldn't load open roles: ${jobsResult.error.message}`,
      ].filter(Boolean);
      setLoadError(errors.join(" "));
      if (!applicationsResult.error) setCandidateApplications((applicationsResult.data ?? []) as CandidateApplication[]);
      if (!jobsResult.error) setOpenJobs((jobsResult.data ?? []) as JobListing[]);
    }
    setBusy(false);
  }, [profile.role, profile.user_id, supabase]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) void loadWorkspace();
    });
    return () => {
      active = false;
    };
  }, [loadWorkspace]);

  const saveBio = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;
    setProfileError("");
    setProfileStatus("");
    const { error } = await supabase
      .from("profiles")
      .update({ bio: bio.trim() })
      .eq("user_id", profile.user_id);

    if (error) {
      setProfileError(`Your bio could not be saved: ${error.message}`);
    } else {
      setProfileStatus("Bio saved.");
    }
  };

  const signOut = async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) {
      setLoadError(`Could not sign out: ${error.message}`);
      return;
    }
    router.push("/auth");
    router.refresh();
  };

  if (busy) {
    return <main className="workspace-shell"><p>Loading your workspace…</p></main>;
  }

  return (
    <main className="workspace-shell">
      <header className="market-header">
        <Link href="/" className="market-brand">HIREYOU<span>.</span></Link>
        <nav aria-label="Workspace navigation">
          <Link href="/challenges">Browse work</Link>
          <button type="button" className="workspace-signout" onClick={signOut}><LogOut size={15} /> Sign out</button>
        </nav>
      </header>

      <section className="workspace-welcome">
        <div>
          <p className="market-eyebrow">{profile.role === "candidate" ? "Candidate workspace" : "Employer workspace"}</p>
          <h1>Welcome, <span>{profile.full_name || profile.company_name || "there"}.</span></h1>
          <p>{profile.role === "candidate" ? "Your skills should get the first look. Track work samples and keep in touch with hiring teams." : "Meet people through their work. Publish roles and review applicant work samples."}</p>
        </div>
        <div className="workspace-role-badge">
          {profile.role === "candidate" ? <Sparkles size={18} /> : <BriefcaseBusiness size={18} />}
          {profile.role === "candidate" ? "Looking for work" : `Hiring · ${profile.company_name}`}
        </div>
      </section>

      {loadError && <p className="workspace-error" role="alert">{loadError}</p>}

      <section className="workspace-profile-card">
        <div className="workspace-profile-heading">
          <div className="workspace-avatar">{(profile.full_name || profile.company_name || "H").slice(0, 1).toUpperCase()}</div>
          <div><p className="market-eyebrow">Your introduction</p><h2>{profile.role === "candidate" ? "Profile before paperwork." : profile.company_name}</h2></div>
        </div>
        {profile.role === "candidate" ? (
          <form onSubmit={saveBio} className="workspace-bio-form">
            <label htmlFor="candidate-bio">A short bio</label>
            <textarea id="candidate-bio" value={bio} maxLength={600} onChange={(event) => setBio(event.target.value)} placeholder="Tell people what kind of work you enjoy." />
            <div className="workspace-bio-footer">
              <span>{bio.length}/600 characters</span>
              <button type="submit">Save bio</button>
            </div>
            {profile.interests.length > 0 && (
              <div className="workspace-interest-tags">
                {profile.interests.map((interest) => <span key={interest}>{interest}</span>)}
              </div>
            )}
            {profileStatus && <p className="job-inline-success" role="status">{profileStatus}</p>}
            {profileError && <p className="job-inline-error" role="alert">{profileError}</p>}
          </form>
        ) : (
          <p className="workspace-company-note">Your open jobs and applicant results are only visible to your hiring team.</p>
        )}
      </section>

      {profile.role === "employer" ? (
        <>
          <section className="workspace-section-heading">
            <div><p className="market-eyebrow">Find your next teammate</p><h2>Your roles & applicants</h2></div>
            <div className="workspace-count"><Users size={17} /> {employerApplications.length} applicants</div>
          </section>
          <JobComposer profile={profile} onPublished={() => void loadWorkspace()} />

          {jobs.length === 0 ? (
            <div className="workspace-empty">
              <BriefcaseBusiness size={24} />
              <h3>Your next great hire starts with a role.</h3>
              <p>Post a position and add a short work sample so applicants can show what they can do.</p>
            </div>
          ) : (
            <div className="workspace-role-list">
              {jobs.map((job) => {
                const applicants = employerApplications.filter((application) => application.vacancy_id === job.id);
                return (
                  <article className="workspace-role-card" key={job.id}>
                    <div className="workspace-role-card-heading">
                      <div><p className="market-eyebrow">{job.category} · {job.location}</p><h3>{job.title}</h3></div>
                      <span className={`workspace-status ${job.status === "open" ? "is-open" : ""}`}>{job.status}</span>
                    </div>
                    <p className="workspace-role-task"><Sparkles size={15} /> {job.task_title}</p>
                    <p className="workspace-role-deadline"><Clock3 size={15} /> Apply by {new Date(job.deadline).toLocaleDateString()}</p>
                    <div className="workspace-applicant-list">
                      <h4>{applicants.length ? "Applicants · ranked by work sample" : "No applicants yet"}</h4>
                      {applicants.map((application) => (
                        <div className="workspace-applicant" key={application.id}>
                          <div className="applicant-avatar">{(application.candidate?.full_name || "C").slice(0, 1).toUpperCase()}</div>
                          <div className="applicant-details">
                            <strong>{application.candidate?.full_name || "Candidate"}</strong>
                            <span>{application.candidate?.bio || "Building skills through real work."}</span>
                            <div className="workspace-interest-tags">
                              {(application.candidate?.interests ?? []).map((interest) => <span key={interest}>{interest}</span>)}
                            </div>
                          </div>
                          <div className={`applicant-score${application.result_score === null ? " is-pending" : ""}`}>
                            {application.result_score === null ? "In progress" : `${application.result_score}/100`}
                          </div>
                          <ApplicationChat
                            applicationId={application.id}
                            currentUserId={profile.user_id}
                            otherName={application.candidate?.full_name || "candidate"}
                          />
                        </div>
                      ))}
                    </div>
                    <Link href={`/challenges/${job.id}`} className="workspace-view-job">View role <ArrowRight size={15} /></Link>
                  </article>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <>
          <NikoAssistant
            profile={profile}
            jobs={openJobs}
            applications={candidateApplications}
          />
          <section className="workspace-section-heading">
            <div><p className="market-eyebrow">Every application tells a story</p><h2>Your work samples</h2></div>
            <Link href="/challenges" className="market-nav-cta">Find a role <ArrowRight size={15} /></Link>
          </section>
          {candidateApplications.length === 0 ? (
            <div className="workspace-empty">
              <Sparkles size={24} />
              <h3>Your next opportunity is waiting.</h3>
              <p>Find a role that fits, then start with a short job-specific work sample.</p>
              <Link href="/challenges" className="job-apply-button">Explore open roles <ArrowRight size={16} /></Link>
            </div>
          ) : (
            <div className="candidate-application-list">
              {candidateApplications.map((application) => (
                <article className="candidate-application-card" key={application.id}>
                  <div className="candidate-application-head">
                    <div>
                      <p className="market-eyebrow">{application.job?.company_name || "Hiring team"} · {application.job?.category}</p>
                      <h3>{application.job?.title || "Role no longer available"}</h3>
                    </div>
                    <span className={`workspace-status ${application.status === "submitted" ? "is-open" : ""}`}>{application.status}</span>
                  </div>
                  <div className="candidate-application-result">
                    {application.result_score === null
                      ? <><Clock3 size={16} /> Work sample in progress</>
                      : <><CheckCircle2 size={16} /> Your score <strong>{application.result_score}/100</strong></>}
                  </div>
                  <div className="candidate-application-actions">
                    <Link href={`/challenges/${application.vacancy_id}`} className="workspace-view-job">
                      {application.result_score === null ? "Continue work sample" : "View application"} <ArrowRight size={15} />
                    </Link>
                    <ApplicationChat applicationId={application.id} currentUserId={profile.user_id} otherName={application.job?.company_name || "the hiring team"} />
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}

      <footer className="workspace-footer">
        <span>HIREYOU · Skills first.</span>
        <button type="button" onClick={() => void loadWorkspace()}><RefreshCw size={14} /> Refresh workspace</button>
      </footer>
    </main>
  );
}
