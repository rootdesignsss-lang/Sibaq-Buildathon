export type JobTaskChoice = {
  id: string;
  text: string;
};

export type JobTaskQuestion = {
  id: string;
  prompt: string;
  choices: JobTaskChoice[];
};

export type JobTaskType = "multiple_choice" | "written_response" | "file_upload" | "link_submission";

export type JobTask = {
  id: string;
  title: string;
  type: JobTaskType;
  instructions: string;
  questions?: JobTaskQuestion[];
  maxFiles?: number;
};

export type JobTaskConfig = {
  tasks?: JobTask[];
  questions?: JobTaskQuestion[];
};

export type TaskSubmissionFile = {
  name: string;
  path: string;
  size: number;
  type: string;
};

export type TaskSubmission = {
  answers?: Record<string, string>;
  text?: string;
  link?: string;
  files?: TaskSubmissionFile[];
};

export type ApplicationTaskAnswers = Record<string, TaskSubmission | string>;

export type EmployerPublicProfile = Pick<
  CandidateProfile,
  "company_bio" | "company_logo_url" | "company_city" | "company_region" | "company_website"
>;

export type JobListing = {
  id: string;
  employer_id: string;
  title: string;
  company_name: string;
  description: string;
  category: string;
  location: string;
  employment_type: string;
  salary_range: string;
  deadline: string;
  task_title: string;
  task_brief: string;
  task_config: JobTaskConfig;
  employer?: EmployerPublicProfile | EmployerPublicProfile[] | null;
  status: "open" | "closed";
  created_at: string;
};

export type CandidateProfile = {
  user_id: string;
  role: "candidate" | "employer";
  full_name: string;
  bio: string;
  interests: string[];
  company_name: string;
  company_bio?: string;
  company_logo_url?: string;
  company_city?: string;
  company_region?: string;
  company_website?: string;
};

export function getJobTasks(job: JobListing): JobTask[] {
  if (job.task_config.tasks?.length) {
    return job.task_config.tasks;
  }

  return [{
    id: "legacy-work-sample",
    title: job.task_title,
    type: "multiple_choice",
    instructions: job.task_brief,
    questions: job.task_config.questions ?? [],
  }];
}

export function getEmployerProfile(
  profile: JobListing["employer"],
): EmployerPublicProfile | null {
  return Array.isArray(profile) ? profile[0] ?? null : profile ?? null;
}
