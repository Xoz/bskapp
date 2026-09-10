"use server";
import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { hasPermission } from "../auth";
import { run } from "../db";
import { REQUEST_KEY } from "./model";
export async function requestSvenskaLagSync() {
  if (!(await hasPermission("manage_settings"))) redirect("/idag?behorighet=saknas");
  await run("INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO NOTHING",[REQUEST_KEY,randomUUID()]);
  revalidatePath("/installningar");
  redirect("/installningar#svenskalag-synk");
}
