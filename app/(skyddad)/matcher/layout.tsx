import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/auth";

export default async function MatchesLayout({ children }: { children: React.ReactNode }) {
  if (!(await hasPermission("view_matches"))) redirect("/oversikt?behorighet=saknas");
  return children;
}
