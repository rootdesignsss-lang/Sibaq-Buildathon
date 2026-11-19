"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, FileUp, LoaderCircle, LockKeyhole, Sparkles, Trash2 } from "lucide-react";
import { ApplicationChat } from "@/components/hireyou/application-chat";
import type {
  ApplicationTaskAnswers,
  CandidateProfile,
  JobListing,
  JobTask,
  JobTaskType,
  TaskSubmission,
  TaskSubmissionFile,
} from "@/lib/jobs";
import { getJobTasks } from "@/lib/jobs";
import { getSupabaseBrowserClient } from "@/lib/supabase";

type ApplicationRecord = {
  id: string;
  status: string;
  task_answers: ApplicationTaskAnswers;
  result_score: number | null;
  result_feedback: { correct?: number; total?: number; review_required?: boolean };
  employer_feedback: string;
};

type DraftSubmission = {
  answers: Record<string, string>;
  text: string;
  link: string;
  files: File[];
};

const emptySubmission = (): DraftSubmission => ({ answers: {}, text: "", link: "", files: [] });
const maxFileSize = 25 * 1024 * 1024;
const maxSubmissionSize = 100 * 1024 * 1024;
const blockedExtensions = new Set([
  "exe", "dll", "so", "dylib", "bat", "cmd", "com", "scr", "msi", "msp", "apk", "app",
  "dmg", "pkg", "sh", "bash", "zsh", "command", "run", "elf", "bin", "iso", "ps1",
  "ps1xml", "psd1", "psm1", "vbs", "vbe", "js", "mjs", "cjs", "jsx", "ts", "tsx",
  "jse", "ws", "wsf", "wsh", "py", "pyc", "pyo", "pyw", "rb", "pl", "php", "lua",
  "ipynb", "jar", "class", "hta", "lnk", "reg", "cpl", "ocx", "sys", "drv", "pif",
  "appx", "msix", "msc", "html", "htm", "xhtml", "shtml", "svg", "desktop",
]);
const taskTypeLabels: Record<JobTaskType, string> = {
  multiple_choice: "multiple choice",
  written_response: "written response",
  file_upload: "file upload",
  link_submission: "link submission",
};

function isTaskSubmission(value: TaskSubmission | string | undefined): value is TaskSubmission {
  return typeof value === "object" && value !== null;
}

function loadDraftSubmission(
  answers: ApplicationTaskAnswers | undefined,
  task: JobTask,
): DraftSubmission {
  const saved = answers?.[task.id];
  if (isTaskSubmission(saved)) {
    return {
      answers: saved.answers ?? {},
      text: saved.text ?? "",
      link: saved.link ?? "",
      files: [],
    };
  }

  if (task.id === "legacy-work-sample" && answers) {
    const legacyAnswers: Record<string, string> = {};
    for (const question of task.questions ?? []) {
      const savedAnswer = answers[question.id];
      if (typeof savedAnswer === "string") legacyAnswers[question.id] = savedAnswer;
    }
    return { ...emptySubmission(), answers: legacyAnswers };
  }
  return emptySubmission();
}

function safeFileName(fileName: string) {
  return fileName
    .normalize("NFKC")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^\.+/, "")
    .slice(-180) || "submission-file";
}

function blockedFile(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return blockedExtensions.has(extension);
}

function isValidWebLink(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

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
  const tasks = useMemo(() => getJobTasks(job), [job]);
  const [application, setApplication] = useState<ApplicationRecord | null>(null);
  const [responses, setResponses] = useState<Record<string, DraftSubmission>>({});
  const [loading, setLoading] = useState(Boolean(currentUserId && supabase));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const loadApplication = useCallback(async () => {
    if (!currentUserId || !supabase) return;

    const { data, error: loadError } = await supabase
      .from("applications")
      .select("id, status, task_answers, result_score, result_feedback, employer_feedback")
      .eq("candidate_id", currentUserId)
      .eq("vacancy_id", job.id)
      .maybeSingle();

    if (loadError) {
      setError(`Your application could not be loaded: ${loadError.message}`);
    } else if (data) {
      setApplication(data);
      setResponses(Object.fromEntries(tasks.map((task) => [
        task.id,
        loadDraftSubmission(data.task_answers, task),
      ])));
    }
    setLoading(false);
  }, [currentUserId, job.id, supabase, tasks]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) void loadApplication();
    });
    return () => {
      active = false;
    };
  }, [loadApplication]);

  const updateResponse = (taskId: string, update: (response: DraftSubmission) => DraftSubmission) => {
    setResponses((current) => ({
      ...current,
      [taskId]: update(current[taskId] ?? emptySubmission()),
    }));
  };

  const startApplication = async () => {
    if (!currentUserId || !supabase) return;
    setBusy(true);
    setError("");

    const { data, error: applyError } = await supabase
      .from("applications")
      .insert({ candidate_id: currentUserId, vacancy_id: job.id })
      .select("id, status, task_answers, result_score, result_feedback, employer_feedback")
      .single();

    if (applyError) {
      if (applyError.code === "23505") {
        await loadApplication();
      } else {
        setError(`We couldn't start your application: ${applyError.message}`);
      }
    } else {
      setApplication(data);
      setResponses(Object.fromEntries(tasks.map((task) => [task.id, emptySubmission()])));
    }
    setBusy(false);
  };

  const addFiles = (taskId: string, event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    updateResponse(taskId, (response) => ({ ...response, files: [...response.files, ...selected] }));
  };

  const submitTask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!application || !currentUserId || !supabase) return;

    for (const task of tasks) {
      const response = responses[task.id] ?? emptySubmission();
      if (task.type === "multiple_choice") {
        const unanswered = (task.questions ?? []).some((question) => !response.answers[question.id]);
        if (unanswered) {
          setError(`Answer every question in “${task.title}” before submitting.`);
          return;
        }
      } else if (task.type === "written_response" && !response.text.trim()) {
        setError(`Complete the written response for “${task.title}”.`);
        return;
      } else if (task.type === "link_submission" && !isValidWebLink(response.link.trim())) {
        setError(`Enter a valid http:// or https:// link for “${task.title}”.`);
        return;
      } else if (task.type === "file_upload") {
        const maxFiles = task.maxFiles ?? 5;
        if (!response.files.length || response.files.length > maxFiles) {
          setError(`Upload between 1 and ${maxFiles} files for “${task.title}”.`);
          return;
        }
        const oversizedFile = response.files.find((file) => file.size > maxFileSize);
        if (oversizedFile) {
          setError(`${oversizedFile.name} is larger than the 25 MB per-file limit.`);
          return;
        }
        const unsupportedFile = response.files.find(blockedFile);
        if (unsupportedFile) {
          setError(`${unsupportedFile.name} uses a blocked executable or script file extension.`);
          return;
        }
      }
    }
    const totalFileSize = tasks.reduce((total, task) => (
      total + (task.type === "file_upload"
        ? (responses[task.id]?.files ?? []).reduce((size, file) => size + file.size, 0)
        : 0)
    ), 0);
    if (totalFileSize > maxSubmissionSize) {
      setError("All files combined must be 100 MB or less per application.");
      return;
    }

    setBusy(true);
    setError("");
    const uploadedPaths: string[] = [];
    const submittedAnswers: ApplicationTaskAnswers = {};

    for (const task of tasks) {
      const response = responses[task.id] ?? emptySubmission();
      const submission: TaskSubmission = {};
      if (task.type === "multiple_choice") submission.answers = response.answers;
      if (task.type === "written_response") submission.text = response.text.trim();
      if (task.type === "link_submission") submission.link = response.link.trim();

      if (task.type === "file_upload") {
        const files: TaskSubmissionFile[] = [];
        for (const file of response.files) {
          const path = `${application.id}/${task.id}/${crypto.randomUUID()}_${safeFileName(file.name)}`;
          const { error: uploadError } = await supabase.storage
            .from("task-submissions")
            .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });

          if (uploadError) {
            const cleanup = uploadedPaths.length
              ? await supabase.storage.from("task-submissions").remove(uploadedPaths)
              : { error: null };
            const cleanupMessage = cleanup.error
              ? ` Some earlier uploaded files may remain in your private submission.`
              : "";
            setError(`A file could not be uploaded: ${uploadError.message}.${cleanupMessage}`);
            setBusy(false);
            return;
          }
          uploadedPaths.push(path);
          files.push({ name: file.name, path, size: file.size, type: file.type });
        }
        submission.files = files;
      }
      if (task.id === "legacy-work-sample" && task.type === "multiple_choice") {
        Object.assign(submittedAnswers, response.answers);
      } else {
        submittedAnswers[task.id] = submission;
      }
    }

    const { data, error: submitError } = await supabase
      .from("applications")
      .update({ task_answers: submittedAnswers })
      .eq("id", application.id)
      .eq("candidate_id", currentUserId)
      .select("id, status, task_answers, result_score, result_feedback, employer_feedback")
      .single();

    if (submitError) {
      const cleanup = uploadedPaths.length
        ? await supabase.storage.from("task-submissions").remove(uploadedPaths)
        : { error: null };
      setError(
        `Your work couldn't be submitted: ${submitError.message}.`
        + (cleanup.error ? " Some uploaded files may remain in your private submission." : ""),
      );
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
        <h3>Show the hiring team how you work.</h3>
        <p>This role has {tasks.length} task{tasks.length === 1 ? "" : "s"}: {tasks.map((task) => taskTypeLabels[task.type].toLowerCase()).join(", ")}.</p>
        {error && <p className="job-inline-error" role="alert">{error}</p>}
        <button type="button" className="job-apply-button" onClick={startApplication} disabled={busy}>
          {busy ? "Starting…" : "Apply & start the tasks"} <ArrowRight size={16} />
        </button>
      </div>
    );
  }

  if (application.status !== "started") {
    const applicationStatus = application.status === "shortlisted"
      ? "Shortlisted"
      : application.status === "rejected"
        ? "Not selected"
        : application.status === "reviewing"
          ? "Under employer review"
          : "Submitted · awaiting employer review";
    return (
      <div className="job-task-active">
        <div className="task-result">
          <span className="task-result-icon"><CheckCircle2 size={22} /></span>
          <p className="market-eyebrow">Work sample submitted</p>
          <h3>{applicationStatus}</h3>
          {application.result_score !== null && (
            <p>Your score: <strong>{application.result_score}/100</strong> · {application.result_feedback.correct ?? 0} of {application.result_feedback.total ?? 0} multiple-choice decisions matched the role rubric.</p>
          )}
          <p className="task-result-note">
            {application.employer_feedback
              ? `Employer feedback: ${application.employer_feedback}`
              : "Your submission is attached to your application. The hiring team can review it and leave feedback."}
          </p>
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
          <span className="market-eyebrow">Your application · {tasks.length} task{tasks.length === 1 ? "" : "s"}</span>
          <span className="task-status-pill">In progress</span>
        </div>
        {tasks.map((task, index) => {
          const response = responses[task.id] ?? emptySubmission();
          return (
            <fieldset className="task-assignment" key={task.id}>
              <legend><span>{String(index + 1).padStart(2, "0")}</span>{task.title}</legend>
              <p className="task-instructions">{task.instructions}</p>
              {task.type === "multiple_choice" && (task.questions ?? []).map((question, questionIndex) => (
                <fieldset className="task-question" key={question.id}>
                  <legend><span>{String(questionIndex + 1).padStart(2, "0")}</span>{question.prompt}</legend>
                  <div className="task-choice-list">
                    {question.choices.map((choice) => (
                      <label className={`task-choice${response.answers[question.id] === choice.id ? " is-selected" : ""}`} key={choice.id}>
                        <input
                          type="radio"
                          name={`${task.id}-${question.id}`}
                          value={choice.id}
                          checked={response.answers[question.id] === choice.id}
                          onChange={() => updateResponse(task.id, (current) => ({
                            ...current,
                            answers: { ...current.answers, [question.id]: choice.id },
                          }))}
                        />
                        <span>{choice.text}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
              {task.type === "written_response" && (
                <label className="task-response-field">
                  Your response
                  <textarea
                    required
                    maxLength={10000}
                    rows={8}
                    value={response.text}
                    onChange={(event) => updateResponse(task.id, (current) => ({ ...current, text: event.target.value }))}
                    placeholder="Write your response for the hiring team."
                  />
                  <span>{response.text.length}/10,000 characters</span>
                </label>
              )}
              {task.type === "link_submission" && (
                <label className="task-response-field">
                  Link to your work
                  <input
                    required
                    type="url"
                    value={response.link}
                    onChange={(event) => updateResponse(task.id, (current) => ({ ...current, link: event.target.value }))}
                    placeholder="https://..."
                  />
                </label>
              )}
              {task.type === "file_upload" && (
                <div className="task-file-upload">
                  <label className="task-response-field">
                    Upload files (up to {task.maxFiles ?? 5}, 25 MB each)
                    <input
                      type="file"
                      multiple
                      onChange={(event) => addFiles(task.id, event)}
                    />
                  </label>
                  <p>Executable and script file extensions are blocked. All files combined must be 100 MB or less per application. Files are private to you and the hiring team, and shared as downloads.</p>
                  {response.files.length > 0 && (
                    <ul>
                      {response.files.map((file, fileIndex) => (
                        <li key={`${file.name}-${file.lastModified}-${fileIndex}`}>
                          <span><FileUp size={15} />{file.name} · {(file.size / (1024 * 1024)).toFixed(1)} MB</span>
                          <button
                            type="button"
                            aria-label={`Remove ${file.name}`}
                            onClick={() => updateResponse(task.id, (current) => ({ ...current, files: current.files.filter((_, index) => index !== fileIndex) }))}
                          >
                            <Trash2 size={14} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </fieldset>
          );
        })}
        {error && <p className="job-inline-error" role="alert">{error}</p>}
        <button className="job-apply-button" type="submit" disabled={busy}>
          {busy ? "Submitting your work…" : "Submit all tasks"} <ArrowRight size={16} />
        </button>
        <p className="task-privacy-note">Multiple-choice results are calculated securely. Written work, links, and files are reviewed by the hiring team.</p>
      </form>
      <ApplicationChat
        applicationId={application.id}
        currentUserId={currentUserId}
        otherName={job.company_name || "the hiring team"}
      />
    </div>
  );
}
