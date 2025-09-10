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

      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Raw Co-occurrence</CardTitle>
            <CardDescription>
              Basic co-occurrence analysis showing how often pairs of candidates
              appear together on ballots, regardless of rank position.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                <strong>Shows:</strong>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Raw ballot counts and co-occurrence fractions</li>
                  <li>Basic coalition patterns</li>
                  <li>Foundation for other coalition metrics</li>
                </ul>
              </div>
              <Button asChild className="w-full">
                <Link href={`/e/${electionId}/c/${contestId}/coalitions/raw`}>
                  View Raw Co-occurrence
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Normalized (Jaccard)</CardTitle>
            <CardDescription>
              Jaccard similarity analysis that normalizes for candidate
              popularity, revealing true coalition strength.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                <strong>Shows:</strong>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Popularity-adjusted similarity scores</li>
                  <li>True coalition strength beyond raw counts</li>
                  <li>Jaccard index (intersection/union)</li>
                </ul>
              </div>
              <Button asChild className="w-full">
                <Link
                  href={`/e/${electionId}/c/${contestId}/coalitions/jaccard`}
                >
                  View Jaccard Matrix
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Proximity-weighted</CardTitle>
            <CardDescription>
              Proximity-weighted affinity that emphasizes candidates ranked
              close together, with adjacent ranks contributing more weight.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                <strong>Shows:</strong>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Rank-distance weighted scores (α = 0.5)</li>
                  <li>Adjacent ranks contribute full weight</li>
                  <li>Distant ranks contribute exponentially less</li>
                </ul>
              </div>
              <Button asChild className="w-full">
                <Link
                  href={`/e/${electionId}/c/${contestId}/coalitions/proximity`}
                >
                  View Proximity Matrix
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
