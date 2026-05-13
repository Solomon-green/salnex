import type { ScrapedJob } from "./upwork-rss";

interface JobFilter {
  id: string;
  user_id: string;
  skills: string[];
  categories: string[];
  job_types: string[];
  experience_levels: string[];
  keywords: string[];
  excluded_keywords: string[];
  min_budget?: number | null;
  max_budget?: number | null;
  min_hourly_rate?: number | null;
  max_hourly_rate?: number | null;
}

export function calculateMatchScore(job: ScrapedJob, filter: JobFilter): number {
  const text = `${job.title} ${job.description}`.toLowerCase();
  let score = 0;

  // Skills match — 40 points
  if (filter.skills.length > 0) {
    const matched = filter.skills.filter(
      (skill) =>
        job.skills_required.some((s) => s.toLowerCase().includes(skill.toLowerCase())) ||
        text.includes(skill.toLowerCase())
    );
    score += (matched.length / filter.skills.length) * 40;
  } else {
    score += 20;
  }

  // Keywords — 20 points
  if (filter.keywords.length > 0) {
    const matched = filter.keywords.filter((kw) => text.includes(kw.toLowerCase()));
    score += (matched.length / filter.keywords.length) * 20;
  } else {
    score += 10;
  }

  // Excluded keywords — instant fail
  if (filter.excluded_keywords.some((kw) => text.includes(kw.toLowerCase()))) return 0;

  // Job type — 15 points
  if (filter.job_types.length === 0 || filter.job_types.includes(job.job_type)) {
    score += 15;
  }

  // Experience level — 15 points
  if (filter.experience_levels.length === 0 || filter.experience_levels.includes(job.experience_level)) {
    score += 15;
  }

  // Budget / rate — 10 points
  if (job.job_type === "FIXED_PRICE" && job.budget) {
    const minOk = !filter.min_budget || job.budget >= filter.min_budget;
    const maxOk = !filter.max_budget || job.budget <= filter.max_budget;
    if (minOk && maxOk) score += 10;
  } else if (job.job_type === "HOURLY" && job.hourly_rate_min) {
    const minOk = !filter.min_hourly_rate || job.hourly_rate_min >= filter.min_hourly_rate;
    const maxOk = !filter.max_hourly_rate || (job.hourly_rate_max ?? 999) <= filter.max_hourly_rate;
    if (minOk && maxOk) score += 10;
  } else {
    score += 5;
  }

  return Math.min(Math.round(score), 100);
}
