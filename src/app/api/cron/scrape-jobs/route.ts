import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { calculateMatchScore } from "@/lib/scraper/matcher";
import { sendMessage, formatJobAlert } from "@/lib/telegram/bot";
import type { ScrapedJob } from "@/lib/scraper/upwork-rss";

export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return runScraper();
}

// Also allow manual trigger from dashboard (authenticated)
export async function POST() {
  return runScraper();
}

async function runScraper() {
  const stats = { jobs_in_db: 0, matches: 0, notifications: 0 };

  try {
    // 1. Get all active filters + user data
    const { data: filters, error: filterError } = await supabase
      .from("job_filters")
      .select("*, users!inner(id, notify_telegram, notify_email, telegram_chat_id, email)")
      .eq("is_active", true);

    if (filterError) throw filterError;
    if (!filters?.length) {
      return NextResponse.json({ ...stats, message: "No active filters" });
    }

    // 2. Get recent jobs scraped in the last 2 hours
    const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { data: recentJobs } = await supabase
      .from("jobs")
      .select("*")
      .gte("scraped_at", since)
      .order("scraped_at", { ascending: false })
      .limit(200);

    stats.jobs_in_db = recentJobs?.length ?? 0;

    if (!recentJobs?.length) {
      return NextResponse.json({ ...stats, message: "No recently scraped jobs to match" });
    }

    // 3. Match each job against each user's active filters
    for (const filter of filters) {
      const user = filter.users as {
        id: string;
        notify_telegram: boolean;
        telegram_chat_id: string | null;
        email: string;
      };

      for (const job of recentJobs) {
        const jobForScoring = job as unknown as ScrapedJob;
        const score = calculateMatchScore(jobForScoring, filter);
        if (score < 40) continue;

        // Skip if already matched
        const { data: existing } = await supabase
          .from("job_matches")
          .select("id")
          .eq("user_id", user.id)
          .eq("job_id", job.id)
          .maybeSingle();

        if (existing) continue;

        // Create match record
        await supabase.from("job_matches").insert({
          user_id: user.id,
          job_id: job.id,
          filter_id: filter.id,
          relevance_score: score,
        });
        stats.matches++;

        // Create in-app notification
        await supabase.from("notifications").insert({
          user_id: user.id,
          job_id: job.id,
          type: "NEW_JOB",
          title: `New match: ${job.title.slice(0, 60)}`,
          message: `Matched your filter "${filter.name}" with ${score}% relevance.`,
          status: "SENT",
        });

        // Send Telegram alert if enabled
        if (user.notify_telegram && user.telegram_chat_id) {
          try {
            await sendMessage({
              chat_id: user.telegram_chat_id,
              parse_mode: "HTML",
              text: formatJobAlert({
                ...jobForScoring,
                skills_required: job.skills_required ?? [],
                relevance_score: score,
              }),
            });
            stats.notifications++;
          } catch (err) {
            console.error("Telegram send error:", err);
          }
        }
      }
    }

    return NextResponse.json({ success: true, ...stats, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error("Match error:", err);
    return NextResponse.json({ error: String(err), ...stats }, { status: 500 });
  }
}
