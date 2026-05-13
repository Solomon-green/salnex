export type JobType = "HOURLY" | "FIXED_PRICE";
export type ExperienceLevel = "ENTRY" | "INTERMEDIATE" | "EXPERT";

export interface Job {
  id: string;
  title: string;
  description: string;
  budget?: number;
  hourly_rate_min?: number;
  hourly_rate_max?: number;
  job_type: JobType;
  experience_level: ExperienceLevel;
  category?: string;
  subcategory?: string;
  skills_required: string[];
  client_name?: string;
  client_country?: string;
  client_rating?: number;
  client_jobs_posted?: number;
  client_hire_rate?: number;
  upwork_url: string;
  posted_at: Date;
  scraped_at: Date;
}

export interface JobFilter {
  id: string;
  user_id: string;
  name: string;
  is_active: boolean;
  skills: string[];
  categories: string[];
  job_types: JobType[];
  experience_levels: ExperienceLevel[];
  min_budget?: number;
  max_budget?: number;
  min_hourly_rate?: number;
  max_hourly_rate?: number;
  keywords: string[];
  excluded_keywords: string[];
  client_rating_min?: number;
  created_at: Date;
  updated_at: Date;
}

export interface JobMatch {
  id: string;
  user_id: string;
  job_id: string;
  filter_id: string;
  relevance_score: number;
  is_seen: boolean;
  is_saved: boolean;
  is_applied: boolean;
  is_dismissed: boolean;
  created_at: Date;
  job?: Job;
  filter?: JobFilter;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  telegram_chat_id?: string;
  telegram_username?: string;
  skills: string[];
  experience_level: ExperienceLevel;
  upwork_profile_url?: string;
  notify_telegram: boolean;
  notify_email: boolean;
}

export interface JobMatchWithRelations {
  id: string;
  user_id: string;
  job_id: string;
  filter_id: string;
  relevance_score: number;
  is_seen: boolean;
  is_saved: boolean;
  is_applied: boolean;
  is_dismissed: boolean;
  created_at: Date;
  job: {
    id: string;
    title: string;
    description: string;
    budget: number | null;
    hourly_rate_min: number | null;
    hourly_rate_max: number | null;
    job_type: JobType;
    experience_level: ExperienceLevel;
    category: string | null;
    skills_required: string[];
    client_country: string | null;
    client_rating: number | null;
    upwork_url: string;
    posted_at: Date;
  };
  filter: {
    id: string;
    name: string;
  } | null;
}

export interface DashboardStats {
  total_matched: number;
  matched_today: number;
  applied_count: number;
  active_filters: number;
}
