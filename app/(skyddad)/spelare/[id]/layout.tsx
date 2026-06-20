import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/auth";

export default async function PrivatePlayerLayout({ children }: { children: React.ReactNode }) {
  if (!(await hasPermission("view_private_player_data"))) redirect("/spelare?behorighet=saknas");
  return children;
}
