import Link from "next/link";
import { createLinkWithVersion } from "@/lib/link-utils";
import { loadManifestFromFs } from "@/packages/contracts/lib/manifest";

interface ElectionsIndexPageProps {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function ElectionsIndexPage({
  searchParams,
}: ElectionsIndexPageProps) {
  const manifest = await loadManifestFromFs();
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const urlSearchParams = new URLSearchParams();

  Object.entries(resolvedSearchParams).forEach(([key, value]) => {
    if (typeof value === "string") {
      urlSearchParams.set(key, value);
    }
  });

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Elections</h1>
      <div className="space-y-4">
        {manifest.elections.map((election) => (
          <div key={election.id} className="border rounded-lg p-4">
            <h2 className="text-xl font-semibold mb-2">
              <Link
                href={createLinkWithVersion(
                  `/e/${election.id}`,
                  urlSearchParams,
                )}
                className="text-blue-600 hover:text-blue-800 hover:underline"
              >
                {election.name}
              </Link>
            </h2>
            <p className="text-gray-600">
              {election.contests.length} contest
              {election.contests.length !== 1 ? "s" : ""}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
