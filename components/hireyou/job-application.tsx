"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, LoaderCircle, LockKeyhole, Sparkles } from "lucide-react";
import { ApplicationChat } from "@/components/hireyou/application-chat";
import type { CandidateProfile, JobListing } from "@/lib/jobs";
import { getSupabaseBrowserClient } from "@/lib/supabase";

type ApplicationRecord = {
  id: string;
  status: string;
  task_answers: Record<string, string>;
  result_score: number | null;
  result_feedback: { correct?: number; total?: number };
};

export function JobApplication({
  job,
  currentUserId,
  currentUserEmail,
  candidateProfile,
}: {
  job: JobListing;
  currentUserId: string | null;
  currentUserEmail: string;
  candidateProfile: CandidateProfile | null;
}) {
  const supabase = getSupabaseBrowserClient();
  const [application, setApplication] = useState<ApplicationRecord | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(Boolean(currentUserId && supabase));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const loadApplication = useCallback(async () => {
    if (!currentUserId || !supabase) return;

    const { data, error: loadError } = await supabase
      .from("applications")
      .select("id, status, task_answers, result_score, result_feedback")
      .eq("candidate_id", currentUserId)
      .eq("vacancy_id", job.id)
      .maybeSingle();

    if (loadError) {
      setError(`Your application could not be loaded: ${loadError.message}`);
    } else if (data) {
      setApplication(data);
      setAnswers(data.task_answers ?? {});
    }
    setLoading(false);
  }, [currentUserId, job.id, supabase]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) void loadApplication();
    });
    return () => {
      active = false;
    };
  }, [loadApplication]);

  const startApplication = async () => {
    if (!currentUserId || !supabase) return;
    setBusy(true);
    setError("");

    const { data, error: applyError } = await supabase
      .from("applications")
      .insert({ candidate_id: currentUserId, vacancy_id: job.id })
      .select("id, status, task_answers, result_score, result_feedback")
      .single();

    if (applyError) {
      if (applyError.code === "23505") {
        await loadApplication();
      } else {
        setError(`We couldn't start your application: ${applyError.message}`);
      }
    } else {
      setApplication(data);
    }
    setBusy(false);
  };

  const submitTask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!application || !currentUserId || !supabase) return;

    const unanswered = job.task_config.questions.filter((question) => !answers[question.id]);
    if (unanswered.length) {
      setError(`Answer all ${job.task_config.questions.length} questions to submit your work.`);
      return;
    }

    setBusy(true);
    setError("");
    const { data, error: submitError } = await supabase
      .from("applications")
      .update({ task_answers: answers })
      .eq("id", application.id)
      .eq("candidate_id", currentUserId)
      .select("id, status, task_answers, result_score, result_feedback")
      .single();

    if (submitError) {
      setError(`Your work couldn't be submitted: ${submitError.message}`);
    } else {
      setApplication(data);
    }
    setBusy(false);
  };

  if (!currentUserId) {
    const next = `/challenges/${job.id}`;
    return (
      <div className="job-apply-panel">
        <span className="job-apply-icon"><LockKeyhole size={19} /></span>
        <h3>Ready to show how you think?</h3>
        <p>Create a free candidate profile to start the work sample for this role.</p>
        <Link className="job-apply-button" href={`/auth?next=${encodeURIComponent(next)}`}>
          Sign in to apply <ArrowRight size={16} />
        </Link>
      </div>
    );
  }

  if (candidateProfile?.role === "employer") {
    return (
      <div className="job-apply-panel">
        <span className="job-apply-icon"><LockKeyhole size={19} /></span>
        <h3>You&apos;re signed in as an employer.</h3>
        <p>Candidate work samples and results are available from your employer workspace.</p>
        <Link className="job-apply-button" href="/dashboard">Open workspace <ArrowRight size={16} /></Link>
      </div>
    );
  }

  if (loading) {
    return <div className="job-apply-panel"><LoaderCircle className="animate-spin" size={20} /> Loading your application…</div>;
  }

  if (!candidateProfile) {
    return (
      <div className="job-apply-panel">
        <h3>Finish setting up your profile</h3>
        <p>Your candidate profile is not available yet. Sign out and back in after confirming your email, or contact support.</p>
        <p className="application-email">{currentUserEmail}</p>
      </div>
    );
  }

  if (!application) {
    return (
      <div className="job-apply-panel">
        <span className="job-apply-icon"><Sparkles size={19} /></span>
        <p className="market-eyebrow">Your work sample</p>
        <h3>One small task. A much stronger signal.</h3>
        <p>Answer {job.task_config.questions.length} short, role-specific questions. The hiring team sees your result with your application.</p>
        {error && <p className="job-inline-error" role="alert">{error}</p>}
        <button type="button" className="job-apply-button" onClick={startApplication} disabled={busy}>
          {busy ? "Starting…" : "Apply & start the task"} <ArrowRight size={16} />
        </button>
      </div>
    );
  }

  if (application.result_score !== null) {
    return (
      <div className="job-task-active">
        <div className="task-result">
          <span className="task-result-icon"><CheckCircle2 size={22} /></span>
          <p className="market-eyebrow">Work sample complete</p>
          <strong>{application.result_score}<small>/100</small></strong>
          <p>
            {application.result_feedback.correct ?? 0} of {application.result_feedback.total ?? job.task_config.questions.length} decisions matched the role rubric.
          </p>
          <span className="task-result-note">Your result is attached to your application for {job.company_name || "the hiring team"}.</span>
        </div>
        <ApplicationChat
          applicationId={application.id}
          currentUserId={currentUserId}
          otherName={job.company_name || "the hiring team"}
        />
      </div>
    );
  }

  return (
    <div className="job-task-active">
      <form className="job-task-form" onSubmit={submitTask}>
        <div className="job-task-form-heading">
          <span className="market-eyebrow">Your application · {job.task_config.questions.length} rounds</span>
          <span className="task-status-pill">In progress</span>
        </div>
        {job.task_config.questions.map((question, index) => (
          <fieldset className="task-question" key={question.id}>
            <legend><span>{String(index + 1).padStart(2, "0")}</span>{question.prompt}</legend>
            <div className="task-choice-list">
              {question.choices.map((choice) => (
                <label className={`task-choice${answers[question.id] === choice.id ? " is-selected" : ""}`} key={choice.id}>
                  <input
                    type="radio"
                    name={question.id}
                    value={choice.id}
                    checked={answers[question.id] === choice.id}
                    onChange={() => setAnswers((current) => ({ ...current, [question.id]: choice.id }))}
                  />
                  <span>{choice.text}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        {error && <p className="job-inline-error" role="alert">{error}</p>}
        <button className="job-apply-button" type="submit" disabled={busy}>
          {busy ? "Scoring your work…" : "Submit work sample"} <ArrowRight size={16} />
        </button>
        <p className="task-privacy-note">Your score is calculated securely and shared with this hiring team.</p>
      </form>
      <ApplicationChat
        applicationId={application.id}
        currentUserId={currentUserId}
        otherName={job.company_name || "the hiring team"}
      />
    </div>
  );
}
