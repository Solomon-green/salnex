const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

export interface TelegramMessage {
  chat_id: string | number;
  text: string;
  parse_mode?: "HTML" | "Markdown";
  reply_markup?: object;
}

export async function sendMessage(msg: TelegramMessage) {
  if (!process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN === "placeholder_add_later") {
    console.log("[Telegram] Bot token not configured, skipping message");
    return null;
  }

  const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(msg),
  });

  return res.json();
}

export async function setWebhook(webhookUrl: string) {
  const res = await fetch(`${TELEGRAM_API}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: webhookUrl }),
  });
  return res.json();
}

export function formatJobAlert(job: {
  title: string;
  description: string;
  budget?: number | null;
  hourly_rate_min?: number | null;
  hourly_rate_max?: number | null;
  job_type: string;
  experience_level: string;
  category?: string | null;
  skills_required: string[];
  upwork_url: string;
  relevance_score?: number;
}) {
  const budget =
    job.job_type === "FIXED_PRICE" && job.budget
      ? `💰 Fixed: $${job.budget.toLocaleString()}`
      : job.hourly_rate_min
      ? `💰 Hourly: $${job.hourly_rate_min}–$${job.hourly_rate_max}/hr`
      : "";

  const skills = job.skills_required.slice(0, 5).join(", ");
  const desc = job.description.slice(0, 200).replace(/\n+/g, " ").trim();
  const score = job.relevance_score ? `\n🎯 Match: ${job.relevance_score}%` : "";

  return `🔔 <b>New Job Match!</b>\n\n<b>${job.title}</b>\n\n${desc}...\n\n${budget}${score}\n📂 ${job.experience_level} | ${job.category ?? "General"}\n🛠 ${skills}\n\n<a href="${job.upwork_url}">Apply on Upwork →</a>`;
}
