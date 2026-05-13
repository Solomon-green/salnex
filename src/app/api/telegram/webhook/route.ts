import { NextResponse } from "next/server";
import { sendMessage } from "@/lib/telegram/bot";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  const body = await request.json();
  const message = body?.message;

  if (!message) return NextResponse.json({ ok: true });

  const chatId = message.chat?.id;
  const text = message.text?.trim() ?? "";
  const username = message.from?.username ?? "";
  const firstName = message.from?.first_name ?? "there";

  // /start command — link Telegram to Salnex account
  if (text.startsWith("/start")) {
    await sendMessage({
      chat_id: chatId,
      parse_mode: "HTML",
      text: `👋 Welcome to <b>Salnex</b>, ${firstName}!\n\nI'll send you instant Upwork job alerts based on your filters.\n\nTo link your account:\n1. Go to <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings">Salnex Settings</a>\n2. Enable Telegram alerts\n3. Enter your username: <b>@${username}</b>\n\nOnce linked, you'll get job alerts here the moment they're scraped! 🚀`,
    });
    return NextResponse.json({ ok: true });
  }

  // /status command
  if (text === "/status") {
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("full_name, notify_telegram")
      .eq("telegram_chat_id", String(chatId))
      .single();

    if (user) {
      await sendMessage({
        chat_id: chatId,
        parse_mode: "HTML",
        text: `✅ <b>Linked!</b>\nAccount: ${user.full_name}\nAlerts: ${user.notify_telegram ? "Enabled" : "Disabled"}\n\nUse /stop to disable alerts.`,
      });
    } else {
      await sendMessage({
        chat_id: chatId,
        parse_mode: "HTML",
        text: `❌ No Salnex account linked to this chat.\n\nVisit <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings">Settings</a> to connect.`,
      });
    }
    return NextResponse.json({ ok: true });
  }

  // /stop command
  if (text === "/stop") {
    await supabaseAdmin
      .from("users")
      .update({ notify_telegram: false })
      .eq("telegram_chat_id", String(chatId));

    await sendMessage({
      chat_id: chatId,
      text: "🔕 Telegram alerts disabled. You can re-enable them in Salnex Settings.",
    });
    return NextResponse.json({ ok: true });
  }

  // /help
  if (text === "/help") {
    await sendMessage({
      chat_id: chatId,
      parse_mode: "HTML",
      text: `<b>Salnex Bot Commands</b>\n\n/start — Set up and link account\n/status — Check connection status\n/stop — Disable alerts\n/help — Show this message`,
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}
