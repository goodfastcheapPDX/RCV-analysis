import { loadManifest } from "@/lib/manifest";

export async function generateStaticParams() {
  const manifest = await loadManifest();
  return manifest.elections.map((election) => ({
    electionId: election.id,
  }));
}

interface ElectionPageProps {
  params: Promise<{ electionId: string }>;
}

export default async function ElectionPage({ params }: ElectionPageProps) {
  const { electionId } = await params;

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Election: {electionId}</h1>
      <p className="text-gray-600">Election placeholder page</p>
    </div>
  );
}
