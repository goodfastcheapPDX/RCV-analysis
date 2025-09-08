import { redirect } from "next/navigation";

interface AffinityPageProps {
  params: Promise<{ electionId: string; contestId: string }>;
}

export default async function AffinityPage({ params }: AffinityPageProps) {
  const { electionId, contestId } = await params;

  // Redirect to the new raw route for backward compatibility
  redirect(`/e/${electionId}/c/${contestId}/coalitions/raw`);
}
