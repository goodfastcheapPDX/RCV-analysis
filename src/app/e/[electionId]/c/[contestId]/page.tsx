import Link from "next/link";
import { notFound } from "next/navigation";
import { createLinkWithVersion } from "@/lib/link-utils";
import { loadManifestFromFs } from "@/packages/contracts/lib/manifest";

export async function generateStaticParams() {
  const manifest = await loadManifestFromFs();
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
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function ContestPage({
  params,
  searchParams,
}: ContestPageProps) {
  const { electionId, contestId } = await params;
  const manifest = await loadManifestFromFs();

  const election = manifest.elections.find((e) => e.id === electionId);
  if (!election) {
    notFound();
  }

  const contest = election.contests.find((c) => c.id === contestId);
  if (!contest) {
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
      <nav className="mb-4 space-x-2">
        <Link
          href={createLinkWithVersion("/e", urlSearchParams)}
          className="text-blue-600 hover:text-blue-800 hover:underline"
        >
          Elections
        </Link>
        <span className="text-gray-400">→</span>
        <Link
          href={createLinkWithVersion(`/e/${electionId}`, urlSearchParams)}
          className="text-blue-600 hover:text-blue-800 hover:underline"
        >
          {election.name}
        </Link>
      </nav>

      <h1 className="text-2xl font-bold mb-4">{contest.name}</h1>
      <div className="space-y-2 mb-6">
        <p className="text-gray-600">
          <span className="font-medium">Election:</span> {election.name}
        </p>
        <p className="text-gray-600">
          <span className="font-medium">Seats:</span> {contest.seats}
        </p>
      </div>

      <div className="bg-gray-50 p-4 rounded-lg">
        <p className="text-gray-700">
          Contest analysis and visualization will be implemented in later
          stages.
        </p>
      </div>
    </div>
  );
}
