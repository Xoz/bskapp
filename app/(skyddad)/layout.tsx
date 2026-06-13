import { redirect } from "next/navigation";
import { getRole, getRealRole } from "@/lib/auth";
import Navbar from "@/components/Navbar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const role = await getRole();
  if (!role) {
    // Tränare som förhandsvisar som spelare ska till publika vyn, inte login
    const real = await getRealRole();
    redirect(real === "coach" ? "/rapportera" : "/login");
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1 p-4 md:p-8 max-w-6xl w-full mx-auto rise">{children}</main>
    </div>
  );
}
