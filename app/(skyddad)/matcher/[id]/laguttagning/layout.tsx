import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/auth";

export default async function SquadLayout({ children }: { children: React.ReactNode }) {
  if (!(await hasPermission("manage_squads"))) redirect("/matcher?behorighet=saknas");
  return children;
}
