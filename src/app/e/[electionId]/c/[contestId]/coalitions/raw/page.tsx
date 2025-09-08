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
import { CandidateAffinityMatrixView } from "@/features/coalitions/views/CandidateAffinityMatrixView";
import { loadCandidateAffinityMatrixForContest } from "@/lib/manifest/candidate-affinity-loader";
import { loadCandidatesForContest } from "@/lib/manifest/loaders";

interface AffinityRawPageProps {
  params: Promise<{ electionId: string; contestId: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function AffinityRawPage({
  params,
}: AffinityRawPageProps) {
  const { electionId, contestId } = await params;

  try {
    // Load all required data
    const [{ data: affinityData, contest }, candidatesResult] =
      await Promise.all([
        loadCandidateAffinityMatrixForContest(electionId, contestId),
        loadCandidatesForContest(electionId, contestId).catch(() => ({
          data: undefined,
        })),
      ]);

    const candidates = candidatesResult.data;

    // Calculate stats from data (derive since we don't have manifest stats yet)
    const stats = {
      total_ballots_considered:
        affinityData.length > 0
          ? Math.round(
              affinityData[0].cooccurrence_count /
                affinityData[0].cooccurrence_frac,
            )
          : 0,
      unique_pairs: affinityData.length,
      max_pair_frac:
        affinityData.length > 0
          ? Math.max(...affinityData.map((d) => d.cooccurrence_frac))
          : 0,
      compute_ms: 0, // Not available from data file
    };

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Raw Co-occurrence Matrix</h1>
          <p className="text-muted-foreground mt-2">
            Analyze raw co-occurrence rates between candidates on the same
            ballot. This shows how often pairs of candidates appear together,
            regardless of ranking order.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-start">
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href={`/e/${electionId}/c/${contestId}/coalitions/jaccard`}>
                View Jaccard Similarity
              </Link>
            </Button>
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
            <Badge variant="outline">Raw Co-occurrence</Badge>
            <Badge variant="outline">
              {contest.seat_count} seat{contest.seat_count !== 1 ? "s" : ""}
            </Badge>
            <Badge variant="secondary">
              {stats.unique_pairs} pair{stats.unique_pairs !== 1 ? "s" : ""}
            </Badge>
            <Badge variant="secondary">
              {stats.total_ballots_considered.toLocaleString()} ballots
            </Badge>
          </div>
        </div>

        <CandidateAffinityMatrixView
          affinityData={affinityData}
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
          <h1 className="text-3xl font-bold">
            Raw Co-occurrence Matrix Not Available
          </h1>
          <p className="text-muted-foreground mt-2">
            Raw co-occurrence matrix data for this contest could not be loaded.
          </p>
        </div>

        <Alert>
          <AlertDescription>
            <strong>Error:</strong> {errorMessage}
            <br />
            <br />
            Make sure to run the data build command first:
            <code className="bg-muted px-2 py-1 rounded mt-2 block text-sm">
              npm run build:data:all
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
