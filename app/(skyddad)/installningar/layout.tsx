import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/auth";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  if (!(await hasPermission("manage_settings"))) redirect("/oversikt?behorighet=saknas");
  return children;
}
