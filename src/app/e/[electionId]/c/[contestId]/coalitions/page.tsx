export const runtime = "nodejs";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Contest } from "@/contracts/manifest";
import type { CandidatesOutput } from "@/contracts/slices/ingest_cvr/index.contract";
import { loadCandidatesForContest } from "@/lib/manifest/loaders";

interface CoalitionsPageProps {
  params: Promise<{ electionId: string; contestId: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function CoalitionsPage({ params }: CoalitionsPageProps) {
  const { electionId, contestId } = await params;

  // Load candidates for context
  let candidates: CandidatesOutput[] | undefined;
  let contest: Contest | undefined;
  try {
    const candidatesResult = await loadCandidatesForContest(
      electionId,
      contestId,
    );
    candidates = candidatesResult.data;
    contest = candidatesResult.contest;
  } catch (error) {
    console.warn("Candidates data not available:", error);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Coalition Analysis</h1>
        <p className="text-muted-foreground mt-2">
          Explore voting patterns and coalition structures in this contest.
          Understand how candidates group together in voter preferences.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-start">
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/e/${electionId}/c/${contestId}`}>
              Back to Contest
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/e/${electionId}`}>Back to Election</Link>
          </Button>
        </div>
        {contest && (
          <div className="flex gap-2 items-center">
            <Badge variant="outline">
              {contest.seat_count} seat{contest.seat_count !== 1 ? "s" : ""}
            </Badge>
            {candidates && (
              <Badge variant="secondary">
                {candidates.length} candidate
                {candidates.length !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Candidate Affinity Matrix</CardTitle>
            <CardDescription>
              Analyze how often pairs of candidates appear together on the same
              ballot. This heatmap reveals coalition patterns and voter
              preferences across candidates.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                <strong>What you'll see:</strong>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Heatmap showing candidate co-occurrence rates</li>
                  <li>Interactive filtering by threshold and top pairs</li>
                  <li>Detailed tooltips with ballot counts and percentages</li>
                  <li>Statistical summary of voting patterns</li>
                </ul>
              </div>
              <Button asChild className="w-full">
                <Link
                  href={`/e/${electionId}/c/${contestId}/coalitions/affinity`}
                >
                  View Affinity Matrix
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>More Coalition Analyses</CardTitle>
            <CardDescription>
              Additional coalition analysis tools will be available here as they
              are developed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                <strong>Coming soon:</strong>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Transfer flow analysis between candidate groups</li>
                  <li>Statistical clustering of similar candidates</li>
                  <li>Coalition strength metrics and rankings</li>
                  <li>Cross-round coalition stability analysis</li>
                </ul>
              </div>
              <Button disabled className="w-full" variant="secondary">
                Coming Soon
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
