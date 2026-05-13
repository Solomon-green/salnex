import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, Briefcase, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Mark all as read
  await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", user.id)
    .eq("is_read", false);

  const { data: notifications } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const items = notifications ?? [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Alerts</h1>
          <p className="text-muted-foreground">Job match notifications and system alerts</p>
        </div>
        {items.length > 0 && (
          <Badge variant="secondary">{items.length} total</Badge>
        )}
      </div>

      {items.length === 0 ? (
        <Card className="text-center py-16">
          <CardContent>
            <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-lg">No alerts yet</h3>
            <p className="text-muted-foreground mt-1">
              Alerts appear here when new jobs match your filters.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((n: Record<string, unknown>) => (
            <Card key={n.id as string} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 p-2 rounded-full bg-primary/10 shrink-0">
                    {n.type === "NEW_JOB"
                      ? <Briefcase className="h-4 w-4 text-primary" />
                      : <Bell className="h-4 w-4 text-primary" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <p className="font-medium text-sm">{n.title as string}</p>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {formatDistanceToNow(new Date(n.created_at as string), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{n.message as string}</p>
                  </div>
                  {!!n.job_id && (
                    <a
                      href={`https://www.upwork.com/jobs/~${n.job_id as string}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-muted-foreground hover:text-primary"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
