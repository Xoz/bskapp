import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function EvaluatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/spelare/${id}/utveckling/avstamning`);
}
