import { redirect } from "next/navigation";
import { getCurrentUser, isStaffRole } from "@/lib/auth";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import InstallPrompt from "@/components/InstallPrompt";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1 p-4 md:p-8 max-w-6xl w-full mx-auto rise pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-8">
        {children}
      </main>
      <BottomNav permissions={user.permissions} staff={isStaffRole(user.primaryRole)} />
      <InstallPrompt />
    </div>
  );
}
