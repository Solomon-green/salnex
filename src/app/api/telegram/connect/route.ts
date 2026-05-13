import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendMessage } from "@/lib/telegram/bot";
import { createClient as createAdmin } from "@supabase/supabase-js";

const supabaseAdmin = createAdmin(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { telegram_username } = await request.json();
  if (!telegram_username) return NextResponse.json({ error: "Username required" }, { status: 400 });

  const clean = telegram_username.replace(/^@/, "");

  // Look up the chat ID by username using Telegram's getUpdates
  const res = await fetch(
    `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getUpdates?limit=100`
  );
  const data = await res.json();

  const match = data.result?.find(
    (u: { message?: { from?: { username?: string; id?: number } } }) =>
      u.message?.from?.username?.toLowerCase() === clean.toLowerCase()
  );

  const chatId = match?.message?.from?.id;

  if (!chatId) {
    return NextResponse.json(
      { error: "Username not found. Make sure you've sent /start to the bot first." },
      { status: 404 }
    );
  }

  // Save the chat ID to the user's profile
  await supabaseAdmin.from("users").upsert({
    id: user.id,
    email: user.email,
    telegram_username: clean,
    telegram_chat_id: String(chatId),
    notify_telegram: true,
  });

  // Send confirmation to Telegram
  await sendMessage({
    chat_id: chatId,
    parse_mode: "HTML",
    text: `🎉 <b>Account linked!</b>\n\nYour Salnex account is now connected. You'll receive job alerts here instantly.\n\nUse /stop to disable, /status to check your connection.`,
  });

  return NextResponse.json({ success: true, chat_id: chatId });
}
