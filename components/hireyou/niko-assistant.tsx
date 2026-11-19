"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bell,
  Check,
  CircleHelp,
  Sparkles,
  Target,
  Wallet,
} from "lucide-react";
import type { CandidateProfile, JobListing } from "@/lib/jobs";

type NikoMode = "matches" | "salary" | "tasks";

const reminderStorageKey = (userId: string) => `hireyou:niko-reminders:${userId}`;

function salaryEstimate(value: string) {
  const normalized = value.toLowerCase().replace(/,/g, "");
  const unitMultiplier = /\b(crore|crores|cr)\b/.test(normalized)
    ? 10_000_000
    : /\b(lpa|lakh|lakhs|lac|lacs)\b/.test(normalized)
      ? 100_000
      : 1;
  const monthlyMultiplier = /\b(per month|monthly|\/month|\/mo)\b/.test(normalized) ? 12 : 1;
  const amounts = [...normalized.matchAll(/(\d+(?:\.\d+)?)\s*(k|m)?/g)]
    .map((match) => Number(match[1]) * (match[2] === "k" ? 1_000 : match[2] === "m" ? 1_000_000 : unitMultiplier) * monthlyMultiplier)
    .filter(Number.isFinite);
  return amounts.length ? Math.max(...amounts) : 0;
}

function interestScore(job: JobListing, interests: string[]) {
  const searchable = `${job.title} ${job.company_name} ${job.description} ${job.category}`.toLowerCase();
  return interests.reduce((score, interest) => {
    const normalized = interest.trim().toLowerCase();
    if (!normalized) return score;
    if (searchable.includes(normalized)) return score + 3;
    const words = normalized.split(/[^a-z0-9+#.]+/).filter((word) => word.length > 2);
    return score + (words.some((word) => searchable.includes(word)) ? 1 : 0);
  }, 0);
}

function formatDeadline(deadline: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(deadline));
}

export function NikoAssistant({
  profile,
  jobs,
  applications,
}: {
  profile: CandidateProfile;
  jobs: JobListing[];
  applications: { vacancy_id: string; status: string }[];
}) {
  const [mode, setMode] = useState<NikoMode>("matches");
  const [reminders, setReminders] = useState<string[]>([]);
  const [remindersLoaded, setRemindersLoaded] = useState(false);
  const [reminderError, setReminderError] = useState("");

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      try {
        const saved = window.localStorage.getItem(reminderStorageKey(profile.user_id));
        if (saved) {
          const parsed: unknown = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) {
            setReminders(parsed);
          }
        }
      } catch {
        setReminderError("Saved reminders are unavailable in this browser.");
      } finally {
        setRemindersLoaded(true);
      }
    });
    return () => {
      active = false;
    };
  }, [profile.user_id]);

  const appliedJobIds = new Set(applications.map((application) => application.vacancy_id));
  const recommendedJobs = [...jobs]
    .filter((job) => !appliedJobIds.has(job.id))
    .sort((left, right) => {
      const matchDifference = interestScore(right, profile.interests) - interestScore(left, profile.interests);
      return matchDifference || salaryEstimate(right.salary_range) - salaryEstimate(left.salary_range);
    });
  const bestPaidJobs = [...jobs].sort(
    (left, right) => salaryEstimate(right.salary_range) - salaryEstimate(left.salary_range),
  );
  const activeApplication = applications.find((application) => application.status === "started");
  const taskJob = jobs.find((job) => job.id === activeApplication?.vacancy_id) ?? recommendedJobs[0] ?? jobs[0];
  const shownJobs = mode === "salary" ? bestPaidJobs : recommendedJobs;
  const savedReminderJobs = jobs.filter((job) => reminders.includes(job.id));

  const toggleReminder = (jobId: string) => {
    const next = reminders.includes(jobId)
      ? reminders.filter((id) => id !== jobId)
      : [...reminders, jobId];
    try {
      window.localStorage.setItem(reminderStorageKey(profile.user_id), JSON.stringify(next));
      setReminders(next);
      setReminderError("");
    } catch {
      setReminderError("Niko couldn't save that reminder. Check your browser storage settings.");
    }
  };

  return (
    <section className="niko-card" aria-labelledby="niko-title">
      <div className="niko-heading">
        <div className="niko-avatar" aria-hidden="true"><Sparkles size={20} /></div>
        <div>
          <p className="market-eyebrow">Your job-search co-pilot</p>
          <h2 id="niko-title">Meet Niko<span>.</span></h2>
        </div>
        <span className="niko-online"><span /> Ready to help</span>
      </div>
      <p className="niko-intro">
        I use your interests and the open roles here to find a closer fit, compare listed pay, and help you plan your work samples.
      </p>

      <div className="niko-actions" role="group" aria-label="Ask Niko">
        <button type="button" aria-pressed={mode === "matches"} className={mode === "matches" ? "is-active" : ""} onClick={() => setMode("matches")}>
          <Target size={16} /> Find my matches
        </button>
        <button type="button" aria-pressed={mode === "salary"} className={mode === "salary" ? "is-active" : ""} onClick={() => setMode("salary")}>
          <Wallet size={16} /> Best listed pay
        </button>
        <button type="button" aria-pressed={mode === "tasks"} className={mode === "tasks" ? "is-active" : ""} onClick={() => setMode("tasks")}>
          <CircleHelp size={16} /> Help with a task
        </button>
      </div>

      {mode === "tasks" ? (
        taskJob ? (
          <div className="niko-task-help">
            <p className="market-eyebrow">A good way to tackle it</p>
            <h3>{taskJob.task_title}</h3>
            <p className="niko-task-brief">{taskJob.task_brief}</p>
            <ol>
              <li>Read the brief and note the outcome the hiring team needs.</li>
              <li>Use the role description and your experience to compare each option.</li>
              <li>Review your choices, then submit before <strong>{formatDeadline(taskJob.deadline)}</strong>.</li>
            </ol>
            <Link href={`/challenges/${taskJob.id}`} className="niko-link">Open the work sample <ArrowRight size={15} /></Link>
          </div>
        ) : (
          <p className="niko-empty">There are no open work samples to break down right now. Check the job board again soon.</p>
        )
      ) : (
        <div className="niko-recommendations">
          <div className="niko-result-heading">
            <strong>{mode === "salary" ? "Roles with the highest listed pay" : "Roles that fit your interests"}</strong>
            {mode === "salary" && <span>Ranked by listed amount; currencies aren&apos;t converted</span>}
          </div>
          {shownJobs.length ? shownJobs.slice(0, 3).map((job) => {
            const score = interestScore(job, profile.interests);
            return (
              <article className="niko-job" key={job.id}>
                <div className="niko-job-copy">
                  <p>{job.company_name || "Hiring team"} · {job.category}</p>
                  <h3><Link href={`/challenges/${job.id}`}>{job.title}</Link></h3>
                  <span>{job.salary_range || "Salary not listed"} · Apply by {formatDeadline(job.deadline)}</span>
                </div>
                <div className="niko-job-actions">
                  {mode === "matches" && score > 0 && <span className="niko-match-label">Interest match</span>}
                  {mode === "salary" && salaryEstimate(job.salary_range) === 0 && <span className="niko-match-label">Pay not listed</span>}
                  <button
                    type="button"
                    className={reminders.includes(job.id) ? "is-saved" : ""}
                    onClick={() => toggleReminder(job.id)}
                    disabled={!remindersLoaded}
                    aria-label={`${reminders.includes(job.id) ? "Remove" : "Remind me about"} ${job.title}`}
                  >
                    {reminders.includes(job.id) ? <Check size={15} /> : <Bell size={15} />}
                    {reminders.includes(job.id) ? "Saved" : "Remind me"}
                  </button>
                </div>
              </article>
            );
          }) : (
            <p className="niko-empty">
              {jobs.length
                ? "You’ve applied to all the open roles we found. Nice work—Niko can still help you with an active work sample."
                : "No open roles are available right now. Your saved interests will help Niko find a fit when new jobs appear."}
            </p>
          )}
          {mode === "matches" && profile.interests.length === 0 && shownJobs.length > 0 && (
            <p className="niko-note">Add interests to your profile to make these recommendations more personal. For now, they’re ordered by listed pay.</p>
          )}
        </div>
      )}

      {savedReminderJobs.length > 0 && (
        <div className="niko-reminders" aria-live="polite">
          <strong><Bell size={15} /> Your job reminders</strong>
          {savedReminderJobs.map((job) => (
            <p key={job.id}><span>{job.title}</span><span>Apply by {formatDeadline(job.deadline)}</span></p>
          ))}
          <small>Saved in this browser. Check back here before each deadline.</small>
        </div>
      )}
      {reminderError && <p className="niko-error" role="alert">{reminderError}</p>}
    </section>
  );
}
