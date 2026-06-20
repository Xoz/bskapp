import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/auth";

export default async function InterviewsLayout({ children }: { children: React.ReactNode }) {
  if (!(await hasPermission("view_interviews"))) redirect("/oversikt?behorighet=saknas");
  return children;
}
