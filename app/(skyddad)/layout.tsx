import { redirect } from "next/navigation";
import { getRealRole } from "@/lib/auth";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import InstallPrompt from "@/components/InstallPrompt";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const role = await getRealRole();
  if (!role) redirect("/");

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1 p-4 md:p-8 max-w-6xl w-full mx-auto rise pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-8">
        {children}
      </main>
      <BottomNav role={role} />
      <InstallPrompt />
    </div>
  );
}
