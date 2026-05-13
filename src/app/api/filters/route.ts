import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("job_filters")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();

  const { data, error } = await supabase
    .from("job_filters")
    .insert({
      user_id: user.id,
      name: body.name,
      skills: body.skills ?? [],
      categories: body.categories ?? [],
      job_types: body.job_types ?? [],
      experience_levels: body.experience_levels ?? [],
      keywords: body.keywords ?? [],
      excluded_keywords: body.excluded_keywords ?? [],
      min_budget: body.min_budget ?? null,
      max_budget: body.max_budget ?? null,
      min_hourly_rate: body.min_hourly_rate ?? null,
      max_hourly_rate: body.max_hourly_rate ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
