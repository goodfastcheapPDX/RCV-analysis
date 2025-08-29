import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Manifest } from "@/contracts/manifest";
import { loadManifest } from "@/lib/manifest";

interface ElectionPageProps {
  params: Promise<{ electionId: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}
export default async function ElectionPage({
  params,
  searchParams,
}: ElectionPageProps) {
  const { electionId } = await params;
  const manifest = Manifest.parse(await loadManifest());

  const election = manifest.elections.find((e) => e.election_id === electionId);
  if (!election) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{election.title}</h1>
        <p className="-foreground mt-2">
          Analyze contests within this election
        </p>
      </div>

      <div className="grid gap-4">
        <h2 className="text-xl font-semibold">Contests</h2>
        {election.contests.map((contest) => (
          <Card
            key={contest.contest_id}
            className="hover:shadow-md transition-shadow"
          >
            <CardHeader>
              <CardTitle>
                <Link
                  href={`/e/${electionId}/c/${contest.contest_id}`}
                  className="hover:underline"
                >
                  {contest.title}
                </Link>
              </CardTitle>
              <CardDescription>
                <Badge variant="outline">
                  {contest.seat_count} seat{contest.seat_count !== 1 ? "s" : ""}
                </Badge>
              </CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
