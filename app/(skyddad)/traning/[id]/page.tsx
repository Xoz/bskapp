import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { get } from "@/lib/db";
import { validPlan, type TrainingPlan } from "@/lib/training/model";
import TrainingBuilder from "@/components/training/TrainingBuilder";
export const dynamic = "force-dynamic";
export default async function TrainingEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user?.permissions.includes("manage_evaluations")) redirect("/idag");
  const { id } = await params;
  const saved =
    id === "nytt"
      ? null
      : await get<{ document: TrainingPlan; revision: number }>(
          "SELECT document,revision FROM training_plans WHERE id=? AND created_by=?",
          [id, user.id],
        );
  if (id !== "nytt" && (!saved || !validPlan(saved.document))) notFound();
  return (
    <TrainingBuilder
      scope={String(user.id)}
      planId={id}
      initial={
        saved?.document ?? {
          version: 1,
          title: "Nytt träningspass",
          date: "",
          blocks: [],
        }
      }
      initialRevision={saved?.revision ?? 0}
    />
  );
}
