/**
 * GitHub Actions scraper runner.
 * Scrapes Upwork jobs using Playwright, then POSTs job data
 * to the Vercel API which handles matching + Telegram notifications.
 */
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const APP_URL = process.env.APP_URL || "https://salnex.vercel.app";
const CRON_SECRET = process.env.CRON_SECRET;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// ── helpers ──────────────────────────────────────────────────────────────────

function parseExperience(text = "") {
  const t = text.toLowerCase();
  if (t.includes("entry") || t.includes("beginner")) return "ENTRY";
  if (t.includes("expert") || t.includes("senior")) return "EXPERT";
  return "INTERMEDIATE";
}

function jobIdFromUrl(url = "") {
  const m = url.match(/~([a-zA-Z0-9]+)/);
  return m ? m[1] : `uw_${Buffer.from(url).toString("base64").slice(0, 12)}`;
}

function parseBudget(text = "") {
  const clean = text.trim();
  const hourlyRange = clean.match(/\$([0-9.]+)\s*[-–]\s*\$([0-9.]+)\s*\/hr/i);
  if (hourlyRange) return { job_type: "HOURLY", hourly_rate_min: +hourlyRange[1], hourly_rate_max: +hourlyRange[2] };

  const singleHourly = clean.match(/\$([0-9.]+)\s*\/hr/i);
  if (singleHourly) return { job_type: "HOURLY", hourly_rate_min: +singleHourly[1] };

  const fixed = clean.match(/\$([0-9,]+)/);
  if (fixed) return { job_type: "FIXED_PRICE", budget: parseFloat(fixed[1].replace(/,/g, "")) };

  return { job_type: "HOURLY" };
}

// ── scraper ──────────────────────────────────────────────────────────────────

async function scrapeQuery(page, query) {
  const url = `https://www.upwork.com/nx/search/jobs/?q=${encodeURIComponent(query)}&sort=recency&per_page=50`;
  console.log(`  Fetching: ${url}`);

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(3000);

  // Wait for job tiles
  await page.waitForSelector('[data-test="job-tile"], [data-ev-label="job_link"]', { timeout: 10000 })
    .catch(() => console.log("  No job tiles found — page might require login"));

  return page.evaluate(() => {
    const jobs = [];
    const tiles = document.querySelectorAll('[data-test="job-tile"]');

    tiles.forEach((tile) => {
      const titleEl = tile.querySelector('[data-test="job-title"] a, h2 a, [data-ev-label="job_link"]');
      const descEl  = tile.querySelector('[data-test="job-description-text"]');
      const budgetEl= tile.querySelector('[data-test="budget"], [data-test="job-type-label"], [data-test="is-fixed-price"]');
      const expEl   = tile.querySelector('[data-test="contractor-tier"] li');
      const timeEl  = tile.querySelector('[data-test="job-pubilshed-date"] span, time');
      const skills  = [...tile.querySelectorAll('[data-test="token"] span, [data-test="attr-item-skill"] span')].map(s => s.textContent?.trim()).filter(Boolean);

      if (!titleEl) return;
      const href = titleEl.getAttribute("href") ?? "";
      jobs.push({
        href: href.startsWith("http") ? href : "https://www.upwork.com" + href,
        title: titleEl.textContent?.trim() ?? "",
        description: descEl?.textContent?.trim() ?? "",
        budgetText: budgetEl?.textContent?.trim() ?? "",
        experience: expEl?.textContent?.trim() ?? "",
        skills,
        postedAt: timeEl?.getAttribute("datetime") ?? new Date().toISOString(),
      });
    });
    return jobs;
  });
}

// ── main ──────────────────────────────────────────────────────────────────────

console.log("Salnex Scraper starting...");

// 1. Get all active filters
const { data: filters, error } = await supabase
  .from("job_filters")
  .select("*")
  .eq("is_active", true);

if (error || !filters?.length) {
  console.log("No active filters found. Exiting.");
  process.exit(0);
}

// 2. Build unique queries
const querySet = new Set();
for (const f of filters) {
  const terms = [...(f.keywords ?? []), ...(f.skills ?? []).slice(0, 4)].filter(Boolean);
  if (terms.length) querySet.add(terms.slice(0, 6).join(" "));
}
if (!querySet.size) querySet.add("freelance web developer");

console.log(`Running ${querySet.size} queries for ${filters.length} filters...`);

// 3. Launch Playwright
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
});
const context = await browser.newContext({
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  viewport: { width: 1280, height: 800 },
});
const page = await context.newPage();

const allJobs = new Map();

for (const query of querySet) {
  try {
    console.log(`Scraping: "${query}"`);
    const raw = await scrapeQuery(page, query);
    console.log(`  Found ${raw.length} jobs`);

    for (const r of raw) {
      if (!r.title || !r.href) continue;
      const id = jobIdFromUrl(r.href);
      if (!allJobs.has(id)) {
        const budgetData = parseBudget(r.budgetText);
        allJobs.set(id, {
          id,
          title: r.title,
          description: r.description || r.title,
          ...budgetData,
          experience_level: parseExperience(r.experience),
          skills_required: r.skills,
          upwork_url: r.href,
          posted_at: r.postedAt ? new Date(r.postedAt).toISOString() : new Date().toISOString(),
          scraped_at: new Date().toISOString(),
        });
      }
    }
  } catch (err) {
    console.error(`Query "${query}" failed:`, err.message);
  }
}

await browser.close();
console.log(`Total unique jobs scraped: ${allJobs.size}`);

if (!allJobs.size) {
  console.log("No jobs scraped. Exiting.");
  process.exit(0);
}

// 4. Upsert jobs into DB
const jobRows = Array.from(allJobs.values());
const { error: upsertErr } = await supabase.from("jobs").upsert(jobRows, { onConflict: "id" });
if (upsertErr) console.error("Upsert error:", upsertErr.message);
else console.log(`Upserted ${jobRows.length} jobs to DB`);

// 5. Call Vercel API to run matching + Telegram notifications
const res = await fetch(`${APP_URL}/api/cron/scrape-jobs`, {
  method: "POST",
  headers: { Authorization: `Bearer ${CRON_SECRET}`, "Content-Type": "application/json" },
});
const result = await res.json();
console.log("Match + notify result:", JSON.stringify(result));
console.log("Done.");
