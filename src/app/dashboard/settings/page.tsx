"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { User, Send, Bell, Shield, CheckCircle, Play, Link2 } from "lucide-react";

const SKILLS_SUGGESTIONS = [
  "React", "Next.js", "TypeScript", "Node.js", "Python", "Django",
  "FastAPI", "Vue.js", "Angular", "PostgreSQL", "MongoDB", "AWS",
  "Docker", "GraphQL", "REST API", "Tailwind CSS", "Flutter", "Swift",
];

function TelegramConnect({ username, onUsernameChange }: { username: string; onUsernameChange: (u: string) => void }) {
  const [connecting, setConnecting] = useState(false);
  const [result, setResult] = useState<{ ok?: boolean; error?: string } | null>(null);
  const BOT_NAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? "SalnexAlertsBot";

  async function handleConnect() {
    if (!username) return;
    setConnecting(true);
    setResult(null);
    const res = await fetch("/api/telegram/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ telegram_username: username }),
    });
    const data = await res.json();
    setResult(res.ok ? { ok: true } : { error: data.error });
    setConnecting(false);
  }

  return (
    <div className="rounded-lg bg-muted p-4 space-y-3">
      <p className="text-sm font-medium flex items-center gap-1.5"><Link2 className="h-3.5 w-3.5" /> Connect Telegram</p>
      <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
        <li>Open Telegram → search <strong>@{BOT_NAME}</strong></li>
        <li>Send <code className="bg-background px-1 rounded">/start</code> to the bot</li>
        <li>Enter your username and click Connect</li>
      </ol>
      <div className="flex gap-2">
        <Input
          placeholder="@yourusername"
          value={username}
          onChange={e => onUsernameChange(e.target.value)}
        />
        <Button type="button" variant="outline" onClick={handleConnect} disabled={connecting || !username}>
          {connecting ? "Connecting..." : "Connect"}
        </Button>
      </div>
      {result?.ok && <p className="text-sm text-green-600">Connected! Check Telegram for confirmation.</p>}
      {result?.error && <p className="text-sm text-destructive">{result.error}</p>}
    </div>
  );
}

export default function SettingsPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [profile, setProfile] = useState({
    full_name: "",
    upwork_profile_url: "",
    skills: [] as string[],
    experience_level: "INTERMEDIATE",
    notify_email: true,
    notify_telegram: false,
    telegram_username: "",
  });
  const [skillInput, setSkillInput] = useState("");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("users")
        .select("*")
        .eq("id", user.id)
        .single();

      if (data) {
        setProfile({
          full_name: data.full_name ?? user.user_metadata?.full_name ?? "",
          upwork_profile_url: data.upwork_profile_url ?? "",
          skills: data.skills ?? [],
          experience_level: data.experience_level ?? "INTERMEDIATE",
          notify_email: data.notify_email ?? true,
          notify_telegram: data.notify_telegram ?? false,
          telegram_username: data.telegram_username ?? "",
        });
      } else {
        // Create user record if it doesn't exist
        await supabase.from("users").upsert({
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name ?? "",
        });
        setProfile(p => ({ ...p, full_name: user.user_metadata?.full_name ?? "" }));
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addSkill(skill: string) {
    const s = skill.trim();
    if (s && !profile.skills.includes(s)) {
      setProfile(p => ({ ...p, skills: [...p.skills, s] }));
    }
    setSkillInput("");
  }

  function removeSkill(skill: string) {
    setProfile(p => ({ ...p, skills: p.skills.filter(s => s !== skill) }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("users").upsert({
      id: user.id,
      email: user.email,
      ...profile,
    });

    setSaved(true);
    setLoading(false);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your profile and notification preferences</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Profile */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4" /> Profile
            </CardTitle>
            <CardDescription>Your basic info used to personalise job matching</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Full Name</Label>
              <Input value={profile.full_name}
                onChange={e => setProfile(p => ({ ...p, full_name: e.target.value }))}
                placeholder="Solomon Bwire" />
            </div>
            <div className="space-y-1.5">
              <Label>Upwork Profile URL</Label>
              <Input value={profile.upwork_profile_url}
                onChange={e => setProfile(p => ({ ...p, upwork_profile_url: e.target.value }))}
                placeholder="https://www.upwork.com/freelancers/~..." />
            </div>
            <div className="space-y-1.5">
              <Label>Experience Level</Label>
              <div className="flex gap-2">
                {["ENTRY", "INTERMEDIATE", "EXPERT"].map(lvl => (
                  <Badge
                    key={lvl}
                    variant={profile.experience_level === lvl ? "default" : "outline"}
                    className="cursor-pointer capitalize"
                    onClick={() => setProfile(p => ({ ...p, experience_level: lvl }))}
                  >
                    {lvl.charAt(0) + lvl.slice(1).toLowerCase()}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Skills */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4" /> Your Skills
            </CardTitle>
            <CardDescription>Used to auto-set up filters when you paste your Upwork profile</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Add a skill..."
                value={skillInput}
                onChange={e => setSkillInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addSkill(skillInput); } }}
              />
              <Button type="button" variant="outline" onClick={() => addSkill(skillInput)}>Add</Button>
            </div>
            {profile.skills.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {profile.skills.map(skill => (
                  <Badge key={skill} variant="secondary" className="cursor-pointer"
                    onClick={() => removeSkill(skill)}>
                    {skill} ×
                  </Badge>
                ))}
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground mb-2">Suggestions:</p>
              <div className="flex flex-wrap gap-1.5">
                {SKILLS_SUGGESTIONS.filter(s => !profile.skills.includes(s)).slice(0, 10).map(s => (
                  <Badge key={s} variant="outline" className="cursor-pointer text-xs"
                    onClick={() => addSkill(s)}>
                    + {s}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-4 w-4" /> Notifications
            </CardTitle>
            <CardDescription>Choose how you receive job alerts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Email alerts</p>
                <p className="text-xs text-muted-foreground">Receive matched jobs to your inbox</p>
              </div>
              <Badge
                variant={profile.notify_email ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setProfile(p => ({ ...p, notify_email: !p.notify_email }))}
              >
                {profile.notify_email ? "On" : "Off"}
              </Badge>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm flex items-center gap-1.5">
                  <Send className="h-3.5 w-3.5" /> Telegram alerts
                </p>
                <p className="text-xs text-muted-foreground">Instant alerts via Telegram bot</p>
              </div>
              <Badge
                variant={profile.notify_telegram ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setProfile(p => ({ ...p, notify_telegram: !p.notify_telegram }))}
              >
                {profile.notify_telegram ? "On" : "Off"}
              </Badge>
            </div>

            {profile.notify_telegram && (
              <TelegramConnect
                username={profile.telegram_username}
                onUsernameChange={u => setProfile(p => ({ ...p, telegram_username: u }))}
              />
            )}
          </CardContent>
        </Card>

        <Button type="submit" className="w-full" disabled={loading}>
          {saved
            ? <><CheckCircle className="h-4 w-4 mr-2" /> Saved!</>
            : loading ? "Saving..." : "Save Settings"
          }
        </Button>
      </form>

      {/* Manual Scraper Trigger */}
      <ManualScraper />
    </div>
  );
}

function ManualScraper() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  async function runScraper() {
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch("/api/cron/scrape-jobs", { method: "POST" });
      const data = await res.json();
      setResult(data);
    } catch {
      setResult({ error: "Failed to run scraper" });
    }
    setRunning(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Play className="h-4 w-4" /> Run Scraper Manually
        </CardTitle>
        <CardDescription>Trigger the Upwork job scraper right now without waiting for the daily cron</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button onClick={runScraper} disabled={running} variant="outline" className="w-full">
          {running ? "Scraping Upwork..." : "Run Scraper Now"}
        </Button>
        {result && !result.error && (
          <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
            <p>Scraped: <strong>{result.scraped as number}</strong> jobs</p>
            <p>New matches: <strong>{result.matches as number}</strong></p>
            <p>Telegram alerts sent: <strong>{result.notifications as number}</strong></p>
          </div>
        )}
        {!!result?.error && <p className="text-sm text-destructive">{String(result.error)}</p>}
      </CardContent>
    </Card>
  );
}
