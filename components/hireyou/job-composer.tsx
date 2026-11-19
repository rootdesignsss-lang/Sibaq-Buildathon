"use client";

import { FormEvent, useState } from "react";
import { BriefcaseBusiness, Plus, Trash2 } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import type { CandidateProfile, JobTaskType } from "@/lib/jobs";

type DraftQuestion = {
  id: string;
  prompt: string;
  choices: { id: string; text: string }[];
  correctId: string;
};

type DraftTask = {
  id: string;
  title: string;
  type: JobTaskType;
  instructions: string;
  questions: DraftQuestion[];
};

function createQuestion(index: number): DraftQuestion {
  return {
    id: `question-${index}`,
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

function createTask(index: number): DraftTask {
  return {
    id: `task-${index}`,
    title: "",
    type: "multiple_choice",
    instructions: "",
    questions: [createQuestion(1)],
  };
}

function nextNumber(items: { id: string }[], prefix: string) {
  return items.reduce((maximum, item) => {
    const number = Number(item.id.replace(`${prefix}-`, ""));
    return Number.isInteger(number) ? Math.max(maximum, number) : maximum;
  }, 0) + 1;
}

const taskTypeLabels: Record<JobTaskType, string> = {
  multiple_choice: "Multiple choice",
  written_response: "Written response",
  file_upload: "File upload",
  link_submission: "Link submission",
};

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
  const [tasks, setTasks] = useState<DraftTask[]>([createTask(1)]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const updateTask = (taskId: string, update: (task: DraftTask) => DraftTask) => {
    setTasks((current) => current.map((task) => task.id === taskId ? update(task) : task));
  };

  const updateQuestion = (taskId: string, questionId: string, update: (question: DraftQuestion) => DraftQuestion) => {
    updateTask(taskId, (task) => ({
      ...task,
      questions: task.questions.map((question) => question.id === questionId ? update(question) : question),
    }));
  };

  const handlePublish = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) {
      setError("Supabase is not connected. Check your .env.local settings.");
      return;
    }

    setError("");
    setSuccess("");
    if (!tasks.length || tasks.length > 10) {
      setError("A role must have between 1 and 10 tasks.");
      return;
    }

    const incompleteTask = tasks.find((task) =>
      !task.title.trim()
      || !task.instructions.trim()
      || (task.type === "multiple_choice" && (
        !task.questions.length
        || task.questions.some((question) =>
          !question.prompt.trim() || question.choices.some((choice) => !choice.text.trim()),
        )
      )),
    );
    if (incompleteTask) {
      setError("Add a title and instructions to every task, and complete every multiple-choice question.");
      return;
    }

    const deadlineDate = new Date(`${deadline}T23:59:59`);
    if (!Number.isFinite(deadlineDate.getTime()) || deadlineDate.getTime() <= Date.now()) {
      setError("Choose a deadline in the future.");
      return;
    }

    setBusy(true);
    const savedTasks = tasks.map((task) => ({
      id: task.id,
      title: task.title.trim(),
      type: task.type,
      instructions: task.instructions.trim(),
      ...(task.type === "multiple_choice" ? {
        questions: task.questions.map(({ id, prompt, choices }) => ({
          id,
          prompt: prompt.trim(),
          choices: choices.map((choice) => ({ id: choice.id, text: choice.text.trim() })),
        })),
      } : {}),
      ...(task.type === "file_upload" ? { maxFiles: 5 } : {}),
    }));

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
        deadline: deadlineDate.toISOString(),
        task_title: savedTasks[0].title,
        task_brief: savedTasks[0].instructions,
        task_config: { tasks: savedTasks },
        status: "open",
      })
      .select("id")
      .single();

    if (jobError) {
      setError(`The role could not be published: ${jobError.message}`);
      setBusy(false);
      return;
    }

    const answerKey = Object.fromEntries(tasks
      .filter((task) => task.type === "multiple_choice")
      .map((task) => [
        task.id,
        Object.fromEntries(task.questions.map((question) => [question.id, question.correctId])),
      ]));
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
    setTasks([createTask(1)]);
    setSuccess("Your role is live. Candidates can now complete its tasks and submit work for review.");
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
          <div>
            <p className="market-eyebrow">The work sample</p>
            <h3>Create up to 10 clear, role-related tasks.</h3>
            <p className="composer-hint">Candidates complete every task before submitting. Written answers, links, and files are reviewed by your team.</p>
          </div>
        </div>

        <div className="composer-question-list">
          {tasks.map((task, index) => (
            <fieldset className="composer-question composer-task" key={task.id}>
              <legend>
                Task {index + 1}
                {tasks.length > 1 && (
                  <button type="button" className="composer-remove" aria-label={`Remove task ${index + 1}`} onClick={() => setTasks((current) => current.filter((item) => item.id !== task.id))}>
                    <Trash2 size={15} />
                  </button>
                )}
              </legend>
              <div className="composer-fields">
                <label>
                  Task title
                  <input required maxLength={120} value={task.title} onChange={(event) => updateTask(task.id, (item) => ({ ...item, title: event.target.value }))} placeholder="Design a short campaign concept" />
                </label>
                <label>
                  Task type
                  <select
                    value={task.type}
                    onChange={(event) => {
                      const type = event.target.value as JobTaskType;
                      updateTask(task.id, (item) => ({
                        ...item,
                        type,
                        questions: type === "multiple_choice" && !item.questions.length ? [createQuestion(1)] : item.questions,
                      }));
                    }}
                  >
                    {Object.entries(taskTypeLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                  </select>
                </label>
              </div>
              <label>
                Instructions
                <textarea required maxLength={3000} value={task.instructions} onChange={(event) => updateTask(task.id, (item) => ({ ...item, instructions: event.target.value }))} placeholder="Explain the context, expected output, and any constraints." />
              </label>

              {task.type === "multiple_choice" && (
                <div className="composer-question-list">
                  {task.questions.map((question, questionIndex) => (
                    <fieldset className="composer-question" key={question.id}>
                      <legend>
                        Question {questionIndex + 1}
                        {task.questions.length > 1 && (
                          <button
                            type="button"
                            className="composer-remove"
                            aria-label={`Remove question ${questionIndex + 1} from task ${index + 1}`}
                            onClick={() => updateTask(task.id, (item) => ({ ...item, questions: item.questions.filter((candidate) => candidate.id !== question.id) }))}
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </legend>
                      <label>
                        Scenario / question
                        <input required maxLength={400} value={question.prompt} onChange={(event) => updateQuestion(task.id, question.id, (item) => ({ ...item, prompt: event.target.value }))} placeholder="What would you do first in this situation?" />
                      </label>
                      <div className="composer-options">
                        {question.choices.map((choice) => (
                          <label className="composer-option" key={choice.id}>
                            <input type="radio" name={`correct-${task.id}-${question.id}`} checked={question.correctId === choice.id} onChange={() => updateQuestion(task.id, question.id, (item) => ({ ...item, correctId: choice.id }))} aria-label={`Mark choice ${choice.id} correct`} />
                            <input required maxLength={240} value={choice.text} onChange={(event) => updateQuestion(task.id, question.id, (item) => ({ ...item, choices: item.choices.map((option) => option.id === choice.id ? { ...option, text: event.target.value } : option) }))} placeholder={`Choice ${choice.id.toUpperCase()}`} />
                          </label>
                        ))}
                      </div>
                      <p className="composer-hint">Select the best answer. The answer key stays private and is scored securely.</p>
                    </fieldset>
                  ))}
                  {task.questions.length < 10 && (
                    <button
                      type="button"
                      className="composer-add"
                      onClick={() => updateTask(task.id, (item) => ({ ...item, questions: [...item.questions, createQuestion(nextNumber(item.questions, "question"))] }))}
                    >
                      <Plus size={15} /> Add a question
                    </button>
                  )}
                </div>
              )}
              {task.type === "written_response" && <p className="composer-hint">Applicants will write a response of up to 10,000 characters for your team to review.</p>}
              {task.type === "file_upload" && <p className="composer-hint">Applicants can upload up to 5 files per upload task, 25 MB each, and 100 MB total per application. Executable and script file extensions are blocked.</p>}
              {task.type === "link_submission" && <p className="composer-hint">Applicants will submit a secure web link beginning with http:// or https://.</p>}
            </fieldset>
          ))}
        </div>
        {tasks.length < 10 && (
          <button type="button" className="composer-add" onClick={() => setTasks((current) => [...current, createTask(nextNumber(current, "task"))])}>
            <Plus size={15} /> Add another task
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
