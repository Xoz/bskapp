import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/auth";

export default async function PlayersLayout({ children }: { children: React.ReactNode }) {
  if (!(await hasPermission("view_players"))) redirect("/oversikt?behorighet=saknas");
  return children;
}
