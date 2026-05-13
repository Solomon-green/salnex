import { chromium } from "playwright-core";
import { prisma } from "@/lib/prisma";

export interface ScrapedJob {
  id: string;
  title: string;
  description: string;
  budget?: number;
  hourly_rate_min?: number;
  hourly_rate_max?: number;
  job_type: "HOURLY" | "FIXED_PRICE";
  experience_level: "ENTRY" | "INTERMEDIATE" | "EXPERT";
  category?: string;
  skills_required: string[];
  client_country?: string;
  client_rating?: number;
  client_jobs_posted?: number;
  upwork_url: string;
  posted_at: Date;
}

function parseExperienceLevel(text: string): "ENTRY" | "INTERMEDIATE" | "EXPERT" {
  const lower = text.toLowerCase();
  if (lower.includes("entry") || lower.includes("beginner")) return "ENTRY";
  if (lower.includes("expert") || lower.includes("senior")) return "EXPERT";
  return "INTERMEDIATE";
}

function parseBudget(text: string): { budget?: number; hourly_rate_min?: number; hourly_rate_max?: number; job_type: "HOURLY" | "FIXED_PRICE" } {
  if (!text) return { job_type: "HOURLY" };

  const clean = text.replace(/[$,]/g, "").trim();

  // Hourly range: "$20.00 - $50.00 /hr"
  const hourlyRange = clean.match(/(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)\s*\/hr/i);
  if (hourlyRange) {
    return {
      job_type: "HOURLY",
      hourly_rate_min: parseFloat(hourlyRange[1]),
      hourly_rate_max: parseFloat(hourlyRange[2]),
    };
  }

  // Fixed: "$500"
  const fixed = clean.match(/^(\d+(?:\.\d+)?)$/);
  if (fixed) {
    return { job_type: "FIXED_PRICE", budget: parseFloat(fixed[1]) };
  }

  return { job_type: "HOURLY" };
}

export async function scrapeUpworkJobs(searchQuery?: string): Promise<ScrapedJob[]> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });

  const page = await context.newPage();
  const jobs: ScrapedJob[] = [];

  try {
    const query = searchQuery ?? "";
    const url = `https://www.upwork.com/nx/find-work/best-matches${query ? `?q=${encodeURIComponent(query)}` : ""}`;

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(3000);

    // Extract job listings
    const jobCards = await page.$$eval(
      '[data-test="job-tile-list"] article, .job-tile, [data-job-uid]',
      (elements: Element[]) =>
        elements.map((el: Element) => {
          const titleEl = el.querySelector('[data-test="job-title"] a, h2 a, .job-title a');
          const descEl = el.querySelector('[data-test="job-description-text"], .job-description');
          const budgetEl = el.querySelector('[data-test="job-type-label"], .budget');
          const skillsEls = el.querySelectorAll('[data-test="token"] span, .skill-badge');
          const expEl = el.querySelector('[data-test="contractor-tier"] span');
          const categoryEl = el.querySelector('[data-test="job-category"] span');
          const clientEl = el.querySelector('[data-test="client-spendings"] strong');

          const href = titleEl?.getAttribute("href") ?? "";
          const idMatch = href.match(/~(\w+)/);

          return {
            id: idMatch ? idMatch[1] : `upwork_${Date.now()}_${Math.random()}`,
            title: titleEl?.textContent?.trim() ?? "",
            description: descEl?.textContent?.trim() ?? "",
            budget_text: budgetEl?.textContent?.trim() ?? "",
            skills: Array.from(skillsEls).map((s) => s.textContent?.trim() ?? "").filter(Boolean),
            experience: expEl?.textContent?.trim() ?? "",
            category: categoryEl?.textContent?.trim(),
            client_spending: clientEl?.textContent?.trim(),
            href: href.startsWith("http") ? href : `https://www.upwork.com${href}`,
          };
        })
    );

    for (const card of jobCards) {
      if (!card.title || !card.href) continue;

      const budgetData = parseBudget(card.budget_text);

      jobs.push({
        id: card.id,
        title: card.title,
        description: card.description,
        ...budgetData,
        experience_level: parseExperienceLevel(card.experience),
        category: card.category,
        skills_required: card.skills,
        upwork_url: card.href,
        posted_at: new Date(),
      });
    }
  } finally {
    await browser.close();
  }

  return jobs;
}

export async function saveAndMatchJobs(jobs: ScrapedJob[]) {
  let newJobsCount = 0;

  for (const job of jobs) {
    // Upsert job
    await prisma.job.upsert({
      where: { id: job.id },
      update: { scraped_at: new Date() },
      create: {
        id: job.id,
        title: job.title,
        description: job.description,
        budget: job.budget,
        hourly_rate_min: job.hourly_rate_min,
        hourly_rate_max: job.hourly_rate_max,
        job_type: job.job_type,
        experience_level: job.experience_level,
        category: job.category,
        skills_required: job.skills_required,
        client_country: job.client_country,
        upwork_url: job.upwork_url,
        posted_at: job.posted_at,
      },
    });

    // Check if it's a new job (posted within last 10 minutes)
    const isNew = Date.now() - job.posted_at.getTime() < 10 * 60 * 1000;
    if (!isNew) continue;

    newJobsCount++;

    // Match against all active filters
    const filters = await prisma.jobFilter.findMany({
      where: { is_active: true },
      include: { user: true },
    });

    for (const filter of filters) {
      const score = calculateMatchScore(job, filter);
      if (score < 30) continue;

      // Create match (skip if already exists)
      const existing = await prisma.jobMatch.findUnique({
        where: { user_id_job_id: { user_id: filter.user_id, job_id: job.id } },
      });

      if (!existing) {
        await prisma.jobMatch.create({
          data: {
            user_id: filter.user_id,
            job_id: job.id,
            filter_id: filter.id,
            relevance_score: score,
          },
        });

        // Queue notification
        await prisma.notification.create({
          data: {
            user_id: filter.user_id,
            job_id: job.id,
            type: "NEW_JOB",
            title: `New job match: ${job.title}`,
            message: `A new job matched your filter "${filter.name}" with ${score}% relevance.`,
          },
        });
      }
    }
  }

  return newJobsCount;
}

function calculateMatchScore(
  job: ScrapedJob,
  filter: { skills: string[]; keywords: string[]; excluded_keywords: string[]; job_types: string[]; min_budget?: number | null; max_budget?: number | null; min_hourly_rate?: number | null; max_hourly_rate?: number | null }
): number {
  let score = 0;
  const titleDesc = `${job.title} ${job.description}`.toLowerCase();

  // Skills match (40 points)
  if (filter.skills.length > 0) {
    const matched = filter.skills.filter(
      (skill) =>
        job.skills_required.some((s) => s.toLowerCase().includes(skill.toLowerCase())) ||
        titleDesc.includes((skill as string).toLowerCase())
    );
    score += (matched.length / filter.skills.length) * 40;
  } else {
    score += 20; // No skill filter = neutral
  }

  // Keyword match (20 points)
  if (filter.keywords.length > 0) {
    const matched = filter.keywords.filter((kw) => titleDesc.includes(kw.toLowerCase()));
    score += (matched.length / filter.keywords.length) * 20;
  } else {
    score += 10;
  }

  // Excluded keywords (instant disqualify)
  if (filter.excluded_keywords.some((kw) => titleDesc.includes(kw.toLowerCase()))) {
    return 0;
  }

  // Job type match (20 points)
  if (filter.job_types.length === 0 || filter.job_types.includes(job.job_type)) {
    score += 20;
  }

  // Budget / rate match (20 points)
  if (job.job_type === "FIXED_PRICE" && job.budget) {
    const minOk = !filter.min_budget || job.budget >= filter.min_budget;
    const maxOk = !filter.max_budget || job.budget <= filter.max_budget;
    if (minOk && maxOk) score += 20;
  } else if (job.job_type === "HOURLY" && job.hourly_rate_min) {
    const minOk = !filter.min_hourly_rate || job.hourly_rate_min >= filter.min_hourly_rate;
    const maxOk = !filter.max_hourly_rate || job.hourly_rate_max! <= filter.max_hourly_rate;
    if (minOk && maxOk) score += 20;
  } else {
    score += 10;
  }

  return Math.min(Math.round(score), 100);
}
