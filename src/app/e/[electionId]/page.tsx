import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { withPreservedQuerySSR } from "@/lib/url-preserve";
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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{election.name}</h1>
        <p className="text-muted-foreground mt-2">
          Analyze contests within this election
        </p>
      </div>

      <div className="grid gap-4">
        <h2 className="text-xl font-semibold">Contests</h2>
        {election.contests.map((contest) => (
          <Card key={contest.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle>
                <Link
                  href={withPreservedQuerySSR(
                    `/e/${electionId}/c/${contest.id}`,
                    urlSearchParams,
                  )}
                  className="hover:underline"
                >
                  {contest.name}
                </Link>
              </CardTitle>
              <CardDescription>
                <Badge variant="outline">
                  {contest.seats} seat{contest.seats !== 1 ? "s" : ""}
                </Badge>
              </CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
