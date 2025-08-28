import { loadManifest } from "@/lib/manifest";

export async function generateStaticParams() {
  const manifest = await loadManifest();
  const params = [];

  for (const election of manifest.elections) {
    for (const contest of election.contests) {
      params.push({
        electionId: election.id,
        contestId: contest.id,
      });
    }
  }

  return params;
}

interface ContestPageProps {
  params: Promise<{ electionId: string; contestId: string }>;
}

export default async function ContestPage({ params }: ContestPageProps) {
  const { electionId, contestId } = await params;

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Contest: {contestId}</h1>
      <p className="text-gray-600 mb-2">Election: {electionId}</p>
      <p className="text-gray-600">Contest placeholder page</p>
    </div>
  );
}
