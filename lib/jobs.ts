export type JobTaskChoice = {
  id: string;
  text: string;
};

export type JobTaskQuestion = {
  id: string;
  prompt: string;
  choices: JobTaskChoice[];
};

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
  task_config: { questions: JobTaskQuestion[] };
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
};
