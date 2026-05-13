import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/dashboard/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        userEmail={user.email}
        userName={user.user_metadata?.full_name}
      />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
