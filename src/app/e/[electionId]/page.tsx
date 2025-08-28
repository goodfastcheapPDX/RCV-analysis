import Link from "next/link";
import { notFound } from "next/navigation";
import { createLinkWithVersion } from "@/lib/link-utils";
import { loadManifestFromFs } from "@/packages/contracts/lib/manifest";

export async function generateStaticParams() {
  const manifest = await loadManifestFromFs();
  return manifest.elections.map((election) => ({
    electionId: election.id,
  }));
}

interface ElectionPageProps {
  params: Promise<{ electionId: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function ElectionPage({
  params,
  searchParams,
}: ElectionPageProps) {
  const { electionId } = await params;
  const manifest = await loadManifestFromFs();

  const election = manifest.elections.find((e) => e.id === electionId);
  if (!election) {
    notFound();
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const urlSearchParams = new URLSearchParams();

  Object.entries(resolvedSearchParams).forEach(([key, value]) => {
    if (typeof value === "string") {
      urlSearchParams.set(key, value);
    }
  });

  return (
    <div className="container mx-auto p-6">
      <nav className="mb-4">
        <Link
          href={createLinkWithVersion("/e", urlSearchParams)}
          className="text-blue-600 hover:text-blue-800 hover:underline"
        >
          ← Back to Elections
        </Link>
      </nav>

      <h1 className="text-2xl font-bold mb-6">{election.name}</h1>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Contests</h2>
        {election.contests.map((contest) => (
          <div key={contest.id} className="border rounded-lg p-4">
            <h3 className="text-lg font-medium mb-2">
              <Link
                href={createLinkWithVersion(
                  `/e/${electionId}/c/${contest.id}`,
                  urlSearchParams,
                )}
                className="text-blue-600 hover:text-blue-800 hover:underline"
              >
                {contest.name}
              </Link>
            </h3>
            <p className="text-gray-600">
              {contest.seats} seat{contest.seats !== 1 ? "s" : ""}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
