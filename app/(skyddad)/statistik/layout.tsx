import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/auth";

export default async function StatisticsLayout({ children }: { children: React.ReactNode }) {
  if (!(await hasPermission("view_statistics"))) redirect("/oversikt?behorighet=saknas");
  return children;
}
