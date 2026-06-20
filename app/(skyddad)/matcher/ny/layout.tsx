import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/auth";

export default async function NewMatchLayout({ children }: { children: React.ReactNode }) {
  if (!(await hasPermission("manage_matches"))) redirect("/matcher?behorighet=saknas");
  return children;
}
