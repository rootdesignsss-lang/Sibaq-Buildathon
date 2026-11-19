"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  Home,
  LayoutDashboard,
  LogOut,
  MapPin,
  MessageCircle,
  RefreshCw,
  Search,
  Sparkles,
  UserRound,
  Users,
} from "lucide-react";
import { getEmployerProfile } from "@/lib/jobs";
import type { CandidateProfile, JobListing } from "@/lib/jobs";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { JobComposer } from "@/components/hireyou/job-composer";
import { ApplicationChat } from "@/components/hireyou/application-chat";
import { NikoAssistant } from "@/components/hireyou/niko-assistant";
import { EmployerProfileSettings } from "@/components/hireyou/employer-profile-settings";
import { SubmissionReview } from "@/components/hireyou/submission-review";
import type { ApplicationTaskAnswers } from "@/lib/jobs";

type EmployerApplication = {
  id: string;
  vacancy_id: string;
  candidate_id: string;
  status: string;
  task_answers: ApplicationTaskAnswers;
  result_score: number | null;
  result_feedback: { correct?: number; total?: number; review_required?: boolean };
  employer_feedback: string;
  reviewed_at: string | null;
  created_at: string;
  candidate?: CandidateProfile | null;
};

type CandidateApplication = {
  id: string;
  vacancy_id: string;
  status: string;
  employer_feedback: string;
  result_score: number | null;
  result_feedback: { correct?: number; total?: number };
  created_at: string;
  job: (Pick<JobListing, "id" | "title" | "company_name" | "category" | "deadline" | "task_title"> & {
    employer?: JobListing["employer"];
  }) | null;
};

type CandidateSection = "home" | "jobs" | "messages" | "dashboard" | "account";

const candidateTabs: { id: CandidateSection; label: string; icon: typeof Home }[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "jobs", label: "Search jobs", icon: Search },
  { id: "messages", label: "Messages", icon: MessageCircle },
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "account", label: "Account", icon: UserRound },
];

function CandidateOpportunityCard({ job }: { job: JobListing }) {
  const employer = getEmployerProfile(job.employer);
  return (
    <article className="candidate-opportunity-card">
      <div className="candidate-company">
        {employer?.company_logo_url
          ? <img src={employer.company_logo_url} alt="" />
          : <span>{(job.company_name || "H").slice(0, 1).toUpperCase()}</span>}
        <div>
          <p className="market-eyebrow">{job.company_name || "Hiring team"} · {job.category}</p>
          {(employer?.company_city || employer?.company_region) && (
            <small>{[employer?.company_city, employer?.company_region].filter(Boolean).join(", ")}</small>
          )}
        </div>
      </div>
      <h3><Link href={`/challenges/${job.id}`}>{job.title}</Link></h3>
      <p className="candidate-opportunity-description">{job.description}</p>
      <div className="candidate-opportunity-facts">
        <span><MapPin size={14} />{job.location}</span>
        <span>{job.salary_range || "Salary not listed"}</span>
        <span><Clock3 size={14} />Apply by {new Date(job.deadline).toLocaleDateString()}</span>
      </div>
      <Link href={`/challenges/${job.id}`} className="candidate-opportunity-link">
        View opportunity <ArrowRight size={15} />
      </Link>
    </article>
  );
}

export function WorkspaceDashboard({ profile }: { profile: CandidateProfile }) {
  const supabase = getSupabaseBrowserClient();
  const router = useRouter();
  const [candidateSection, setCandidateSection] = useState<CandidateSection>("home");
  const [jobSearch, setJobSearch] = useState("");
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
  const [employerCompanyName, setEmployerCompanyName] = useState(profile.company_name);

  const filteredOpenJobs = useMemo(() => {
    const query = jobSearch.trim().toLowerCase();
    if (!query) return openJobs;
    return openJobs.filter((job) =>
      `${job.title} ${job.company_name} ${job.category} ${job.description} ${job.location}`
        .toLowerCase()
        .includes(query),
    );
  }, [jobSearch, openJobs]);

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
          .select("id, vacancy_id, candidate_id, status, task_answers, result_score, result_feedback, employer_feedback, reviewed_at, created_at")
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
          .select("id, vacancy_id, status, employer_feedback, result_score, result_feedback, created_at, job:job_vacancies(id, title, company_name, category, deadline, task_title, employer:profiles!job_vacancies_employer_id_fkey(company_logo_url, company_city, company_region, company_website))")
          .eq("candidate_id", profile.user_id)
          .order("created_at", { ascending: false }),
        supabase
          .from("job_vacancies")
          .select("id, employer_id, title, company_name, description, category, location, employment_type, salary_range, deadline, task_title, task_brief, task_config, status, created_at, employer:profiles!job_vacancies_employer_id_fkey(company_logo_url, company_city, company_region, company_website)")
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
        <nav aria-label="Workspace navigation" className={profile.role === "candidate" ? "candidate-nav" : ""}>
          {profile.role === "candidate" ? candidateTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                type="button"
                key={tab.id}
                className={`candidate-nav-button${candidateSection === tab.id ? " is-active" : ""}`}
                aria-current={candidateSection === tab.id ? "page" : undefined}
                onClick={() => setCandidateSection(tab.id)}
              >
                <Icon size={16} /><span>{tab.label}</span>
              </button>
            );
          }) : <Link href="/challenges">Browse work</Link>}
          <button type="button" className="workspace-signout" onClick={signOut}><LogOut size={15} /> Sign out</button>
        </nav>
      </header>

      <section className="workspace-welcome">
        <div>
          <p className="market-eyebrow">{profile.role === "candidate" ? "Candidate workspace" : "Employer workspace"}</p>
          <h1>Welcome, <span>{profile.full_name || employerCompanyName || "there"}.</span></h1>
          <p>{profile.role === "candidate" ? "Your skills should get the first look. Track work samples and keep in touch with hiring teams." : "Meet people through their work. Publish roles and review applicant work samples."}</p>
        </div>
        <div className="workspace-role-badge">
          {profile.role === "candidate" ? <Sparkles size={18} /> : <BriefcaseBusiness size={18} />}
          {profile.role === "candidate" ? "Looking for work" : `Hiring · ${employerCompanyName}`}
        </div>
      </section>

      {loadError && <p className="workspace-error" role="alert">{loadError}</p>}

      {(profile.role === "employer" || candidateSection === "account") && (
        <section className="workspace-profile-card">
          <div className="workspace-profile-heading">
            <div className="workspace-avatar">{(profile.full_name || employerCompanyName || "H").slice(0, 1).toUpperCase()}</div>
            <div><p className="market-eyebrow">{profile.role === "candidate" ? "Profile & account settings" : "Your company profile"}</p><h2>{profile.role === "candidate" ? "Profile before paperwork." : employerCompanyName}</h2></div>
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
            <EmployerProfileSettings profile={{ ...profile, company_name: employerCompanyName }} onSaved={setEmployerCompanyName} />
          )}
        </section>
      )}

      {profile.role === "employer" ? (
        <>
          <section className="workspace-section-heading">
            <div><p className="market-eyebrow">Find your next teammate</p><h2>Your roles & applicants</h2></div>
            <div className="workspace-count"><Users size={17} /> {employerApplications.length} applicants</div>
          </section>
          <JobComposer profile={{ ...profile, company_name: employerCompanyName }} onPublished={() => void loadWorkspace()} />

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
                    <p className="workspace-role-task"><Sparkles size={15} /> {job.task_config.tasks?.length ?? 1} task{(job.task_config.tasks?.length ?? 1) === 1 ? "" : "s"} · {job.task_title}</p>
                    <p className="workspace-role-deadline"><Clock3 size={15} /> Apply by {new Date(job.deadline).toLocaleDateString()}</p>
                    <div className="workspace-applicant-list">
                      <h4>{applicants.length ? "Applicants · ranked by work sample" : "No applicants yet"}</h4>
                      {applicants.map((application) => (
                        <div className="workspace-applicant-record" key={application.id}>
                          <div className="workspace-applicant">
                            <div className="applicant-avatar">{(application.candidate?.full_name || "C").slice(0, 1).toUpperCase()}</div>
                            <div className="applicant-details">
                              <strong>{application.candidate?.full_name || "Candidate"}</strong>
                              <span>{application.candidate?.bio || "Building skills through real work."}</span>
                              <div className="workspace-interest-tags">
                                {(application.candidate?.interests ?? []).map((interest) => <span key={interest}>{interest}</span>)}
                              </div>
                            </div>
                            <div className={`applicant-score${application.result_score === null ? " is-pending" : ""}`}>
                              {application.result_score === null
                                ? application.status === "started" ? "In progress" : "Manual review"
                                : `${application.result_score}/100`}
                            </div>
                            <ApplicationChat
                              applicationId={application.id}
                              currentUserId={profile.user_id}
                              otherName={application.candidate?.full_name || "candidate"}
                            />
                          </div>
                          <SubmissionReview job={job} application={application} />
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
          {candidateSection === "home" && (
            <>
              <section className="workspace-section-heading">
                <div><p className="market-eyebrow">Fresh opportunities</p><h2>Your job feed</h2></div>
                <button type="button" className="market-nav-cta" onClick={() => setCandidateSection("jobs")}>
                  Search all jobs <ArrowRight size={15} />
                </button>
              </section>
              {openJobs.length ? (
                <div className="candidate-feed-grid">
                  {openJobs.slice(0, 6).map((job) => <CandidateOpportunityCard key={job.id} job={job} />)}
                </div>
              ) : (
                <div className="workspace-empty">
                  <BriefcaseBusiness size={24} />
                  <h3>No new jobs yet.</h3>
                  <p>New opportunities will appear here when employers post them.</p>
                </div>
              )}
            </>
          )}

          {candidateSection === "jobs" && (
            <>
              <section className="workspace-section-heading">
                <div><p className="market-eyebrow">Explore open opportunities</p><h2>Search jobs</h2></div>
                <span className="workspace-count">{filteredOpenJobs.length} open roles</span>
              </section>
              <label className="market-search candidate-job-search">
                <Search size={17} />
                <input
                  type="search"
                  value={jobSearch}
                  onChange={(event) => setJobSearch(event.target.value)}
                  placeholder="Search roles, companies, skills"
                  aria-label="Search open jobs"
                />
              </label>
              {filteredOpenJobs.length ? (
                <div className="candidate-feed-grid">
                  {filteredOpenJobs.map((job) => <CandidateOpportunityCard key={job.id} job={job} />)}
                </div>
              ) : (
                <div className="workspace-empty">
                  <Search size={24} />
                  <h3>{openJobs.length ? "No jobs match your search." : "No open jobs right now."}</h3>
                  <p>{openJobs.length ? "Try a different title, company, or skill." : "Check back soon for new opportunities."}</p>
                </div>
              )}
            </>
          )}

          {candidateSection === "messages" && (
            <>
              <section className="workspace-section-heading">
                <div><p className="market-eyebrow">Conversations with hiring teams</p><h2>Messages</h2></div>
              </section>
              {candidateApplications.length ? (
                <div className="candidate-application-list">
                  {candidateApplications.map((application, index) => (
                    <article className="candidate-application-card" key={application.id}>
                      <div className="candidate-application-head">
                        <div>
                          <p className="market-eyebrow">{application.job?.company_name || "Hiring team"} · {application.job?.category}</p>
                          <h3>{application.job?.title || "Role no longer available"}</h3>
                        </div>
                        <span className={`workspace-status ${application.status === "submitted" ? "is-open" : ""}`}>{application.status}</span>
                      </div>
                      <ApplicationChat
                        applicationId={application.id}
                        currentUserId={profile.user_id}
                        otherName={application.job?.company_name || "the hiring team"}
                        defaultOpen={index === 0}
                      />
                    </article>
                  ))}
                </div>
              ) : (
                <div className="workspace-empty">
                  <MessageCircle size={24} />
                  <h3>Your conversations will show up here.</h3>
                  <p>Apply to a role to start messaging its hiring team.</p>
                  <button type="button" className="job-apply-button" onClick={() => setCandidateSection("jobs")}>
                    Find a role <ArrowRight size={16} />
                  </button>
                </div>
              )}
            </>
          )}

          {candidateSection === "dashboard" && (
            <>
              <section className="workspace-section-heading">
                <div><p className="market-eyebrow">Your progress</p><h2>My dashboard</h2></div>
              </section>
              <div className="candidate-stats-grid">
                <article><span>Applications</span><strong>{candidateApplications.length}</strong></article>
                <article><span>Work samples submitted</span><strong>{candidateApplications.filter((application) => application.status !== "started").length}</strong></article>
                <article><span>Open opportunities</span><strong>{openJobs.length}</strong></article>
              </div>
              <section className="workspace-section-heading">
                <div><p className="market-eyebrow">Keep moving forward</p><h2>Your work samples</h2></div>
              </section>
              {candidateApplications.length ? (
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
                        {application.status === "started"
                          ? <><Clock3 size={16} /> Work sample in progress</>
                          : application.result_score === null
                            ? <><Clock3 size={16} /> Submitted · under employer review</>
                          : <><CheckCircle2 size={16} /> Your score <strong>{application.result_score}/100</strong></>}
                      </div>
                      {application.employer_feedback && <p className="candidate-employer-feedback">Employer feedback: {application.employer_feedback}</p>}
                      <div className="candidate-application-actions">
                        <Link href={`/challenges/${application.vacancy_id}`} className="workspace-view-job">
                          {application.status === "started" ? "Continue work sample" : "View application"} <ArrowRight size={15} />
                        </Link>
                        <ApplicationChat applicationId={application.id} currentUserId={profile.user_id} otherName={application.job?.company_name || "the hiring team"} />
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="workspace-empty">
                  <Sparkles size={24} />
                  <h3>Your next opportunity is waiting.</h3>
                  <p>Find a role that fits, then start with a short job-specific work sample.</p>
                  <button type="button" className="job-apply-button" onClick={() => setCandidateSection("jobs")}>
                    Explore open roles <ArrowRight size={16} />
                  </button>
                </div>
              )}
            </>
          )}

          {candidateSection === "account" && (
            <>
              <section className="workspace-section-heading">
                <div><p className="market-eyebrow">Your details</p><h2>Account settings</h2></div>
              </section>
              <div className="workspace-empty candidate-account-note">
                <UserRound size={24} />
                <h3>{profile.full_name || "Your candidate account"}</h3>
                <p>Your interests and introduction help Niko find relevant opportunities. To change your password, use “Reset password” on the sign-in page.</p>
                <Link href="/auth" className="workspace-view-job">Password & sign-in settings <ArrowRight size={15} /></Link>
              </div>
            </>
          )}
        </>
      )}

      {profile.role === "candidate" && (
        <NikoAssistant profile={profile} jobs={openJobs} applications={candidateApplications} />
      )}

      <footer className="workspace-footer">
        <span>HIREYOU · Skills first.</span>
        <button type="button" onClick={() => void loadWorkspace()}><RefreshCw size={14} /> Refresh workspace</button>
      </footer>
    </main>
  );
}
