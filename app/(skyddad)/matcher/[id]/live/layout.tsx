import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/auth";

export default async function LiveAdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await hasPermission("report_matches"))) redirect("/matcher?behorighet=saknas");
  return children;
}
