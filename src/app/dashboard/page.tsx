import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Briefcase, TrendingUp, CheckCircle, Filter, ExternalLink, Clock } from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [
    { count: totalMatched },
    { count: appliedCount },
    { count: activeFilters },
    { count: matchedToday },
    { data: recentMatches },
  ] = await Promise.all([
    supabase.from("job_matches").select("*", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("job_matches").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("is_applied", true),
    supabase.from("job_filters").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("is_active", true),
    supabase.from("job_matches").select("*", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", todayStart.toISOString()),
    supabase.from("job_matches")
      .select("*, job:jobs(*), filter:job_filters(id, name)")
      .eq("user_id", user.id)
      .eq("is_dismissed", false)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const stats = [
    { label: "Jobs Matched", value: totalMatched ?? 0, icon: Briefcase, color: "text-blue-500" },
    { label: "Matched Today", value: matchedToday ?? 0, icon: TrendingUp, color: "text-green-500" },
    { label: "Applied", value: appliedCount ?? 0, icon: CheckCircle, color: "text-purple-500" },
    { label: "Active Filters", value: activeFilters ?? 0, icon: Filter, color: "text-orange-500" },
  ];

  const matches = recentMatches ?? [];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Job Feed</h1>
        <p className="text-muted-foreground">Jobs matching your filters, updated daily</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
              <Icon className={`h-4 w-4 ${color}`} />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Job Feed */}
      {matches.length === 0 ? (
        <Card className="text-center py-16">
          <CardContent>
            <Briefcase className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-lg">No jobs yet</h3>
            <p className="text-muted-foreground mt-1 mb-4">
              Set up your filters to start receiving matched jobs from Upwork.
            </p>
            <Link href="/dashboard/filters">
              <Button>Create your first filter</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {matches.map((match: Record<string, unknown>) => {
            const job = match.job as Record<string, unknown> | null;
            const filter = match.filter as Record<string, unknown> | null;
            if (!job) return null;
            return (
              <Card key={match.id as string} className="hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-semibold text-base truncate">{job.title as string}</h3>
                        {(match.relevance_score as number) >= 80 && (
                          <Badge variant="default" className="text-xs bg-green-500">Hot Match</Badge>
                        )}
                        {!!match.is_applied && (
                          <Badge variant="outline" className="text-xs">Applied</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                        {(job.description as string).slice(0, 200)}...
                      </p>
                      <div className="flex items-center gap-3 flex-wrap text-sm">
                        {!!job.budget && (
                          <span className="font-medium text-green-600">${(job.budget as number).toLocaleString()}</span>
                        )}
                        {!!job.hourly_rate_min && (
                          <span className="font-medium text-green-600">
                            ${job.hourly_rate_min as number}–${job.hourly_rate_max as number}/hr
                          </span>
                        )}
                        <Badge variant="secondary" className="text-xs">{job.experience_level as string}</Badge>
                        {!!job.category && <span className="text-muted-foreground">{job.category as string}</span>}
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(job.posted_at as string), { addSuffix: true })}
                        </span>
                      </div>
                      <div className="flex gap-2 flex-wrap mt-2">
                        {((job.skills_required as string[]) ?? []).slice(0, 5).map((skill: string) => (
                          <Badge key={skill} variant="outline" className="text-xs">{skill}</Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 shrink-0">
                      <a href={job.upwork_url as string} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" className="w-full">
                          <ExternalLink className="h-3 w-3 mr-1" /> Apply
                        </Button>
                      </a>
                      <p className="text-xs text-muted-foreground text-center">
                        via {filter ? (filter.name as string) : "filter"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
