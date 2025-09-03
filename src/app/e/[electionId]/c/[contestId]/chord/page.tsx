export const runtime = "nodejs";

import Link from "next/link";
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
import type { CandidatesOutput } from "@/contracts/slices/ingest_cvr/index.contract";
import {
  loadCandidatesForContest,
  loadStvForContest,
} from "@/lib/manifest/loaders";
import { loadTransferMatrixForContest } from "@/lib/manifest/transfer-matrix-loader";
import { ChordChartView } from "./chord-chart-view";

interface ChordPageProps {
  params: Promise<{ electionId: string; contestId: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function ChordPage({ params }: ChordPageProps) {
  const { electionId, contestId } = await params;

  try {
    // Load all required data
    const [
      { roundsData, metaData, stats, contest },
      { data: transferData },
      candidatesResult,
    ] = await Promise.all([
      loadStvForContest(electionId, contestId),
      loadTransferMatrixForContest(electionId, contestId),
      loadCandidatesForContest(electionId, contestId).catch(() => ({
        data: undefined,
      })),
    ]);

    const candidates = candidatesResult.data;

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Transfer Flow Chord Chart</h1>
          <p className="text-muted-foreground mt-2">
            Visualize vote transfers between candidates across STV rounds using
            an interactive chord diagram. Each arc represents a candidate, and
            ribbons show transfer flows.
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
          <div className="flex gap-2 items-center">
            <Badge variant="outline">
              {contest.seat_count} seat{contest.seat_count !== 1 ? "s" : ""}
            </Badge>
            <Badge variant="secondary">
              {stats.number_of_rounds} round
              {stats.number_of_rounds !== 1 ? "s" : ""}
            </Badge>
            <Badge variant="secondary">{transferData.length} transfers</Badge>
          </div>
        </div>

        <ChordChartView
          transferData={transferData}
          roundsData={roundsData}
          metaData={metaData}
          stats={stats}
          candidates={candidates}
          electionId={electionId}
          contestId={contestId}
        />
      </div>
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Chord Chart Not Available</h1>
          <p className="text-muted-foreground mt-2">
            Transfer matrix or STV rounds data for this contest could not be
            loaded.
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
            <Link href={`/e/${electionId}/c/${contestId}`}>
              Back to Contest
            </Link>
          </Button>
        </div>
      </div>
    );
  }
}
