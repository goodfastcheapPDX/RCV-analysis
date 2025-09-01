export const runtime = "nodejs";

import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  loadCandidatesForContest,
  loadStvForContest,
} from "@/lib/manifest/loaders";
import type { CandidatesOutput } from "@/packages/contracts/slices/ingest_cvr/index.contract";
import { StvRoundsView } from "@/packages/contracts/slices/stv_rounds/view";

interface ContestPageProps {
  params: Promise<{ electionId: string; contestId: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function ContestPage({ params }: ContestPageProps) {
  const { electionId, contestId } = await params;

  try {
    const { roundsData, metaData, stats, contest } = await loadStvForContest(
      electionId,
      contestId,
    );

    // Load candidates for linking
    let candidates: CandidatesOutput[] | undefined;
    try {
      const candidatesResult = await loadCandidatesForContest(
        electionId,
        contestId,
      );
      candidates = candidatesResult.data;
    } catch (error) {
      // Candidates may not be available, continue without them
      console.warn("Candidates data not available for links:", error);
    }

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">{contest.title}</h1>
          <p className="text-muted-foreground mt-2">
            Interactive visualization of Single Transferable Vote election
            rounds. Watch how votes transfer between candidates as the election
            progresses.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-start">
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href={`/e/${electionId}/c/${contestId}/first-choice`}>
                First Choice Breakdown
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/e/${electionId}`}>Back to Election</Link>
            </Button>
          </div>
          <div className="flex gap-2 items-center">
            <Badge variant="outline">
              {contest.seat_count} seat{contest.seat_count !== 1 ? "s" : ""}
            </Badge>
            {stats && (
              <Badge variant="secondary">
                {stats.number_of_rounds} round
                {stats.number_of_rounds !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>
        </div>

        {stats ? (
          <StvRoundsView
            roundsData={roundsData}
            metaData={metaData}
            stats={stats}
            candidates={candidates}
            electionId={electionId}
            contestId={contestId}
          />
        ) : (
          <p>No stats available.</p>
        )}
      </div>
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Contest Not Available</h1>
          <p className="text-muted-foreground mt-2">
            STV rounds data for this contest could not be loaded.
          </p>
        </div>

        <Alert>
          <AlertDescription>
            <strong>Error:</strong> {errorMessage}
            <br />
            <br />
            Make sure to run the data build commands first:
            <code className="bg-muted px-2 py-1 rounded mt-2 block text-sm">
              npm run build:data && npm run build:data:stv
            </code>
          </AlertDescription>
        </Alert>

        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/e/${electionId}`}>Back to Election</Link>
          </Button>
        </div>
      </div>
    );
  }
}
