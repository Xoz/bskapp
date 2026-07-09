import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/auth";

export default async function UtvecklingLayout({ children }: { children: React.ReactNode }) {
  if (!(await hasPermission("manage_evaluations"))) redirect("/spelare?behorighet=saknas");
  return children;
}
