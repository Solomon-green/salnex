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
  upwork_url: string;
  posted_at: Date;
}

function parseExperienceLevel(text: string): "ENTRY" | "INTERMEDIATE" | "EXPERT" {
  const t = (text ?? "").toLowerCase();
  if (t.includes("entry") || t.includes("beginner")) return "ENTRY";
  if (t.includes("expert") || t.includes("senior")) return "EXPERT";
  return "INTERMEDIATE";
}

function generateJobId(url: string): string {
  const match = url.match(/~([a-zA-Z0-9]+)/);
  if (match) return match[1];
  // Hash the URL for a stable ID
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    hash = ((hash << 5) - hash) + url.charCodeAt(i);
    hash |= 0;
  }
  return `uw_${Math.abs(hash).toString(16)}`;
}

// Scrape Upwork using Playwright with headless Chromium
export async function scrapeUpworkJobs(query: string): Promise<ScrapedJob[]> {
  // Dynamic imports — only load Playwright at runtime on Vercel
  const { chromium } = await import("playwright-core");

  let executablePath: string | undefined;
  if (process.env.AWS_EXECUTION_ENV || process.env.VERCEL) {
    // Use sparticuz chromium on serverless
    const chromiumPkg = await import("@sparticuz/chromium-min");
    executablePath = await chromiumPkg.default.executablePath(
      `https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar`
    );
  }

  const browser = await chromium.launch({
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--single-process",
      "--no-zygote",
    ],
    executablePath,
    headless: true,
  });

  const jobs: ScrapedJob[] = [];

  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 800 },
      locale: "en-US",
    });

    const page = await context.newPage();
    const encodedQuery = encodeURIComponent(query);
    const url = `https://www.upwork.com/nx/search/jobs/?q=${encodedQuery}&sort=recency&per_page=50`;

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

    // Wait for job listings to appear
    await page.waitForSelector('[data-test="job-tile-list"], .job-tile, section[data-test]', {
      timeout: 15000,
    }).catch(() => null);

    // Extract job data from the page
    const rawJobs = await page.evaluate(() => {
      const results: Array<{
        id: string;
        title: string;
        description: string;
        budgetText: string;
        skills: string[];
        experience: string;
        category: string;
        url: string;
        postedAt: string;
      }> = [];

      const tiles = document.querySelectorAll('[data-test="job-tile"]');
      tiles.forEach((tile) => {
        const titleEl = tile.querySelector('[data-test="job-title"] a, h2 a');
        const descEl = tile.querySelector('[data-test="job-description-text"], .description');
        const budgetEl = tile.querySelector('[data-test="budget"], [data-test="job-type-label"]');
        const skillsEls = tile.querySelectorAll('[data-test="token"] span, .skill-badge, [data-test="attr-item-skill"]');
        const expEl = tile.querySelector('[data-test="contractor-tier"]');
        const timeEl = tile.querySelector('[data-test="job-pubilshed-date"], time');

        if (!titleEl) return;

        const href = titleEl.getAttribute("href") ?? "";
        const fullUrl = href.startsWith("http") ? href : `https://www.upwork.com${href}`;
        const idMatch = fullUrl.match(/~([a-zA-Z0-9]+)/);

        results.push({
          id: idMatch ? idMatch[1] : `tile_${Math.random().toString(36).slice(2)}`,
          title: titleEl.textContent?.trim() ?? "",
          description: descEl?.textContent?.trim() ?? "",
          budgetText: budgetEl?.textContent?.trim() ?? "",
          skills: Array.from(skillsEls).map((s) => s.textContent?.trim() ?? "").filter(Boolean),
          experience: expEl?.textContent?.trim() ?? "",
          category: "",
          url: fullUrl,
          postedAt: timeEl?.getAttribute("datetime") ?? new Date().toISOString(),
        });
      });

      return results;
    });

    for (const raw of rawJobs) {
      if (!raw.title || !raw.url) continue;

      // Parse budget
      let budget: number | undefined;
      let hourly_rate_min: number | undefined;
      let hourly_rate_max: number | undefined;
      let job_type: "HOURLY" | "FIXED_PRICE" = "HOURLY";

      const budgetLower = raw.budgetText.toLowerCase();
      if (budgetLower.includes("/hr") || budgetLower.includes("hourly")) {
        job_type = "HOURLY";
        const rateMatch = raw.budgetText.match(/\$([0-9.]+).*?\$([0-9.]+)/);
        if (rateMatch) {
          hourly_rate_min = parseFloat(rateMatch[1]);
          hourly_rate_max = parseFloat(rateMatch[2]);
        } else {
          const singleRate = raw.budgetText.match(/\$([0-9.]+)/);
          if (singleRate) hourly_rate_min = parseFloat(singleRate[1]);
        }
      } else if (raw.budgetText.includes("$") && !budgetLower.includes("/hr")) {
        job_type = "FIXED_PRICE";
        const fixed = raw.budgetText.match(/\$([0-9,]+)/);
        if (fixed) budget = parseFloat(fixed[1].replace(/,/g, ""));
      }

      jobs.push({
        id: raw.id || generateJobId(raw.url),
        title: raw.title,
        description: raw.description || raw.title,
        budget,
        hourly_rate_min,
        hourly_rate_max,
        job_type,
        experience_level: parseExperienceLevel(raw.experience),
        category: raw.category || undefined,
        skills_required: raw.skills,
        upwork_url: raw.url,
        posted_at: raw.postedAt ? new Date(raw.postedAt) : new Date(),
      });
    }
  } finally {
    await browser.close();
  }

  return jobs;
}

// Keep the alias for backwards compat with cron route
export const scrapeUpworkRSS = scrapeUpworkJobs;

// Build a search query from a filter
export function buildRssQuery(filter: {
  skills: string[];
  categories: string[];
  keywords: string[];
}): string {
  const terms = [...new Set([...filter.keywords, ...filter.skills.slice(0, 5)])];
  return terms.slice(0, 6).join(" ") || "freelance developer";
}
