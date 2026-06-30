import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppSidebar } from "@/components/app-sidebar";
import { UserMenu } from "@/components/user-menu";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Respaldo del middleware: sin sesión, a login.
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b bg-background px-4">
        <Link href="/" className="flex items-center gap-2">
          <img src="/oliva-logo.png" alt="Oliva" className="h-9 w-auto" />
        </Link>
        <UserMenu email={user.email ?? ""} />
      </header>

      <div className="flex flex-1">
        <aside className="hidden w-56 shrink-0 border-r bg-background md:block">
          <AppSidebar />
        </aside>
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
