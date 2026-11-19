"use client";

import { useState } from "react";
import { Download, ExternalLink, Save } from "lucide-react";
import type { ApplicationTaskAnswers, JobListing, JobTask, TaskSubmission } from "@/lib/jobs";
import { getJobTasks } from "@/lib/jobs";
import { getSupabaseBrowserClient } from "@/lib/supabase";

type ReviewApplication = {
  id: string;
  status: string;
  task_answers: ApplicationTaskAnswers;
  result_score: number | null;
  employer_feedback: string;
  reviewed_at: string | null;
};

function isTaskSubmission(value: TaskSubmission | string | undefined): value is TaskSubmission {
  return typeof value === "object" && value !== null;
}

function submissionForTask(
  answers: ApplicationTaskAnswers,
  task: JobTask,
): TaskSubmission {
  const saved = answers[task.id];
  if (isTaskSubmission(saved)) return saved;
  if (task.id === "legacy-work-sample") {
    const legacy: Record<string, string> = {};
    for (const question of task.questions ?? []) {
      const savedAnswer = answers[question.id];
      if (typeof savedAnswer === "string") legacy[question.id] = savedAnswer;
    }
    return { answers: legacy };
  }
  return {};
}

function safeWebLink(value?: string) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function safeDownloadName(name: string) {
  return name.replace(/[^\w .()-]/g, "_").slice(0, 180) || "submission-file";
}

export function SubmissionReview({
  job,
  application,
}: {
  job: JobListing;
  application: ReviewApplication;
}) {
  const supabase = getSupabaseBrowserClient();
  const tasks = getJobTasks(job);
  const [feedback, setFeedback] = useState(application.employer_feedback ?? "");
  const [status, setStatus] = useState(application.status);
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const saveReview = async () => {
    if (!supabase) {
      setError("Supabase is not connected. Check your .env.local settings.");
      return;
    }

    setBusy(true);
    setError("");
    setSuccess("");
    const { error: saveError } = await supabase
      .from("applications")
      .update({
        status,
        employer_feedback: feedback.trim(),
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", application.id);

    if (saveError) {
      setError(`Your review could not be saved: ${saveError.message}`);
    } else {
      setSuccess("Review saved. The candidate can see your feedback in their workspace.");
    }
    setBusy(false);
  };

  const downloadFile = async (path: string, name: string) => {
    if (!supabase) {
      setError("Supabase is not connected. Check your .env.local settings.");
      return;
    }

    setDownloading(path);
    setError("");
    const { data, error: signedUrlError } = await supabase.storage
      .from("task-submissions")
      .createSignedUrl(path, 60, { download: safeDownloadName(name) });
    if (signedUrlError) {
      setError(`The submitted file could not be opened: ${signedUrlError.message}`);
    } else {
      window.location.assign(data.signedUrl);
    }
    setDownloading("");
  };

  return (
    <section className="submission-review">
      <div className="submission-review-heading">
        <h5>Candidate work</h5>
        <span>{application.status === "started" ? "In progress" : application.result_score === null ? "Manual review" : `${application.result_score}/100`}</span>
      </div>
      {tasks.map((task, index) => {
        const submission = submissionForTask(application.task_answers ?? {}, task);
        const submittedLink = safeWebLink(submission.link);
        return (
          <div className="submission-task" key={task.id}>
            <strong>{index + 1}. {task.title}</strong>
            {task.type === "multiple_choice" && (task.questions ?? []).map((question) => {
              const answerId = submission.answers?.[question.id];
              const choice = question.choices.find((item) => item.id === answerId);
              return (
                <p key={question.id}>
                  <span>{question.prompt}</span>
                  <b>{choice?.text ?? (application.status === "started" ? "Not answered" : "No answer recorded")}</b>
                </p>
              );
            })}
            {task.type === "written_response" && (
              <p className="submission-written-answer">{submission.text || (application.status === "started" ? "Not submitted yet" : "No response recorded")}</p>
            )}
            {task.type === "link_submission" && submittedLink && (
              <a className="submission-link" href={submittedLink} target="_blank" rel="noopener noreferrer">
                Open submitted link <ExternalLink size={14} />
              </a>
            )}
            {task.type === "link_submission" && !submittedLink && (
              <p>{submission.link || (application.status === "started" ? "Not submitted yet" : "No link recorded")}</p>
            )}
            {task.type === "file_upload" && (
              submission.files?.length ? (
                <ul className="submission-file-list">
                  {submission.files.map((file) => (
                    <li key={file.path}>
                      <span>{file.name} · {(file.size / (1024 * 1024)).toFixed(1)} MB</span>
                      <button type="button" onClick={() => void downloadFile(file.path, file.name)} disabled={downloading === file.path}>
                        <Download size={14} /> {downloading === file.path ? "Preparing…" : "Download"}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : <p>{application.status === "started" ? "Not submitted yet" : "No files recorded"}</p>
            )}
          </div>
        );
      })}
      {application.status !== "started" && (
        <div className="submission-review-form">
          <label>
            Review status
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="submitted">Submitted</option>
              <option value="reviewing">Reviewing</option>
              <option value="shortlisted">Shortlisted</option>
              <option value="rejected">Not selected</option>
            </select>
          </label>
          <label>
            Written feedback for the candidate
            <textarea maxLength={2000} rows={4} value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder="Share specific, constructive feedback." />
          </label>
          <button type="button" className="workspace-view-job" onClick={() => void saveReview()} disabled={busy}>
            {busy ? "Saving review…" : "Save review"} <Save size={14} />
          </button>
        </div>
      )}
      {error && <p className="job-inline-error" role="alert">{error}</p>}
      {success && <p className="job-inline-success" role="status">{success}</p>}
      {application.reviewed_at && <small className="submission-reviewed-at">Last reviewed {new Date(application.reviewed_at).toLocaleString()}</small>}
    </section>
  );
}
