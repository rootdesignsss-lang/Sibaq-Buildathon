"use client";

import { FormEvent, useState } from "react";
import { BriefcaseBusiness, Plus, Trash2 } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import type { CandidateProfile } from "@/lib/jobs";

type DraftQuestion = {
  id: string;
  prompt: string;
  choices: { id: string; text: string }[];
  correctId: string;
};

function createQuestion(index: number): DraftQuestion {
  return {
    id: `round-${index + 1}`,
    prompt: "",
    choices: [
      { id: "a", text: "" },
      { id: "b", text: "" },
      { id: "c", text: "" },
      { id: "d", text: "" },
    ],
    correctId: "a",
  };
}

function createNextQuestion(questions: DraftQuestion[]) {
  const lastNumber = questions.reduce((max, question) => {
    const number = Number(question.id.replace("round-", ""));
    return Number.isInteger(number) ? Math.max(max, number) : max;
  }, 0);

  return createQuestion(lastNumber);
}

export function JobComposer({
  profile,
  onPublished,
}: {
  profile: CandidateProfile;
  onPublished: () => void;
}) {
  const supabase = getSupabaseBrowserClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Product");
  const [location, setLocation] = useState("Remote");
  const [employmentType, setEmploymentType] = useState("Full-time");
  const [salaryRange, setSalaryRange] = useState("");
  const [deadline, setDeadline] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskBrief, setTaskBrief] = useState("");
  const [questions, setQuestions] = useState<DraftQuestion[]>([
    createQuestion(0),
    createQuestion(1),
    createQuestion(2),
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const updateQuestion = (questionId: string, update: (question: DraftQuestion) => DraftQuestion) => {
    setQuestions((current) => current.map((question) => question.id === questionId ? update(question) : question));
  };

  const handlePublish = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) {
      setError("Supabase is not connected. Check your .env.local settings.");
      return;
    }

    setError("");
    setSuccess("");
    const incompleteQuestion = questions.find((question) =>
      !question.prompt.trim() || question.choices.some((choice) => !choice.text.trim()),
    );
    if (incompleteQuestion) {
      setError("Add a prompt and four answer choices to every work-sample round.");
      return;
    }

    const deadlineAt = new Date(`${deadline}T23:59:59`).toISOString();
    if (new Date(deadlineAt).getTime() <= Date.now()) {
      setError("Choose a deadline in the future.");
      return;
    }

    setBusy(true);
    const { data: job, error: jobError } = await supabase
      .from("job_vacancies")
      .insert({
        employer_id: profile.user_id,
        title: title.trim(),
        company_name: profile.company_name.trim(),
        description: description.trim(),
        category,
        location: location.trim() || "Remote",
        employment_type: employmentType,
        salary_range: salaryRange.trim(),
        deadline: deadlineAt,
        task_title: taskTitle.trim(),
        task_brief: taskBrief.trim(),
        task_config: {
          questions: questions.map(({ id, prompt, choices }) => ({
            id,
            prompt: prompt.trim(),
            choices: choices.map((choice) => ({ id: choice.id, text: choice.text.trim() })),
          })),
        },
        status: "open",
      })
      .select("id")
      .single();

    if (jobError) {
      setError(`The role could not be published: ${jobError.message}`);
      setBusy(false);
      return;
    }

    const answerKey = Object.fromEntries(questions.map((question) => [question.id, question.correctId]));
    const { error: keyError } = await supabase
      .from("job_task_keys")
      .insert({ vacancy_id: job.id, answer_key: answerKey });

    if (keyError) {
      const { error: rollbackError } = await supabase.from("job_vacancies").delete().eq("id", job.id);
      setError(
        rollbackError
          ? `The role was created, but its private task key failed to save. Contact support with job ID ${job.id}.`
          : `The task answer key could not be saved: ${keyError.message}. The draft role was removed.`,
      );
      setBusy(false);
      return;
    }

    setTitle("");
    setDescription("");
    setDeadline("");
    setSalaryRange("");
    setTaskTitle("");
    setTaskBrief("");
    setQuestions([createQuestion(0), createQuestion(1), createQuestion(2)]);
    setSuccess("Your role is live. Candidates can now apply and complete its work sample.");
    setBusy(false);
    onPublished();
  };

  return (
    <details className="job-composer">
      <summary><BriefcaseBusiness size={18} /> Post a new role <Plus size={16} /></summary>
      <form className="job-composer-form" onSubmit={handlePublish}>
        <div className="composer-fields">
          <label>
            Role title
            <input required maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Product designer" />
          </label>
          <label>
            Work area
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              {["Design", "Engineering", "Product", "Marketing", "Data", "Operations"].map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label>
            Work arrangement
            <input required maxLength={100} value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Remote" />
          </label>
          <label>
            Employment type
            <select value={employmentType} onChange={(event) => setEmploymentType(event.target.value)}>
              {["Full-time", "Part-time", "Contract", "Internship"].map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label>
            Salary or rate (optional)
            <input maxLength={100} value={salaryRange} onChange={(event) => setSalaryRange(event.target.value)} placeholder="Share a fair range" />
          </label>
          <label>
            Apply by
            <input required type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} />
          </label>
        </div>
        <label>
          What will this person do?
          <textarea required maxLength={2500} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe the role, outcomes, and the kind of teammate you need." />
        </label>
        <div className="composer-task-heading">
          <div><p className="market-eyebrow">The work sample</p><h3>Give applicants a fair, useful way to show their thinking.</h3></div>
        </div>
        <label>
          Task title
          <input required maxLength={120} value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="A real-world scenario from this role" />
        </label>
        <label>
          Task introduction
          <textarea required maxLength={1200} value={taskBrief} onChange={(event) => setTaskBrief(event.target.value)} placeholder="Explain the context and what the applicant should consider." />
        </label>

        <div className="composer-question-list">
          {questions.map((question, index) => (
            <fieldset className="composer-question" key={question.id}>
              <legend>
                Round {index + 1}
                {questions.length > 1 && (
                  <button type="button" className="composer-remove" aria-label={`Remove round ${index + 1}`} onClick={() => setQuestions((current) => current.filter((item) => item.id !== question.id))}>
                    <Trash2 size={15} />
                  </button>
                )}
              </legend>
              <label>
                Scenario / question
                <input required maxLength={400} value={question.prompt} onChange={(event) => updateQuestion(question.id, (item) => ({ ...item, prompt: event.target.value }))} placeholder="What would you do first in this situation?" />
              </label>
              <div className="composer-options">
                {question.choices.map((choice) => (
                  <label className="composer-option" key={choice.id}>
                    <input type="radio" name={`correct-${question.id}`} checked={question.correctId === choice.id} onChange={() => updateQuestion(question.id, (item) => ({ ...item, correctId: choice.id }))} aria-label={`Mark choice ${choice.id} correct`} />
                    <input required maxLength={240} value={choice.text} onChange={(event) => updateQuestion(question.id, (item) => ({ ...item, choices: item.choices.map((option) => option.id === choice.id ? { ...option, text: event.target.value } : option) }))} placeholder={`Choice ${choice.id.toUpperCase()}`} />
                  </label>
                ))}
              </div>
              <p className="composer-hint">Select the best answer. The answer key stays private; candidates only see their score after submitting.</p>
            </fieldset>
          ))}
        </div>
        {questions.length < 5 && (
          <button type="button" className="composer-add" onClick={() => setQuestions((current) => [...current, createNextQuestion(current)])}>
            <Plus size={15} /> Add another round
          </button>
        )}
        {error && <p className="job-inline-error" role="alert">{error}</p>}
        {success && <p className="job-inline-success" role="status">{success}</p>}
        <button className="job-apply-button" type="submit" disabled={busy}>
          {busy ? "Publishing…" : "Publish role"} <Plus size={16} />
        </button>
      </form>
    </details>
  );
}
