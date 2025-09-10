export const runtime = "nodejs";

import Link from "next/link";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CandidateAffinityProximityView } from "@/features/coalitions/views/CandidateAffinityProximityView";
import { loadCandidateAffinityMatrixForContest } from "@/lib/manifest/candidate-affinity-loader";
import { loadCandidateAffinityProximityForContest } from "@/lib/manifest/candidate-affinity-proximity-loader";
import { loadCandidatesForContest } from "@/lib/manifest/loaders";

interface AffinityProximityPageProps {
  params: Promise<{ electionId: string; contestId: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function AffinityProximityPage({
  params,
}: AffinityProximityPageProps) {
  const { electionId, contestId } = await params;

  try {
    // Load all required data - Proximity, Matrix (for stats), and Candidates
    const [{ data: proximityData, contest }, matrixResult, candidatesResult] =
      await Promise.all([
        loadCandidateAffinityProximityForContest(electionId, contestId),
        loadCandidateAffinityMatrixForContest(electionId, contestId).catch(
          () => ({
            data: undefined,
          }),
        ),
        loadCandidatesForContest(electionId, contestId).catch(() => ({
          data: undefined,
        })),
      ]);

    const candidates = candidatesResult.data;
    const matrixData = matrixResult?.data;

    // Calculate stats from actual data
    // For total_ballots_considered, use the matrix data when available since it has
    // the fraction field that allows accurate calculation. Fall back to approximation.
    let totalBallotsConsidered = 0;
    if (matrixData && matrixData.length > 0) {
      // Use matrix data to get accurate total: cooccurrence_count / cooccurrence_frac
      const firstMatrixRow = matrixData[0];
      totalBallotsConsidered = Math.round(
        firstMatrixRow.cooccurrence_count / firstMatrixRow.cooccurrence_frac,
      );
    } else if (proximityData.length > 0) {
      // Fallback: approximate using max pair_count (will be underestimated)
      totalBallotsConsidered = Math.max(
        ...proximityData.map((d) => d.pair_count),
      );
    }

    const stats = {
      total_ballots_considered: totalBallotsConsidered,
      unique_pairs: proximityData.length,
      alpha: 0.5,
      max_weight_sum:
        proximityData.length > 0
          ? Math.max(...proximityData.map((d) => d.weight_sum))
          : 0,
      compute_ms: 0, // Not available from artifact, only from live computation
    };

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">
            Proximity-Weighted Affinity Matrix
          </h1>
          <p className="text-muted-foreground mt-2">
            Analyze proximity-weighted affinity between candidates. This metric
            emphasizes pairs that appear close together in rank order, with
            adjacent ranks contributing full weight and distant ranks
            contributing exponentially less.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-start">
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href={`/e/${electionId}/c/${contestId}/coalitions/raw`}>
                View Raw Co-occurrence
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/e/${electionId}/c/${contestId}/coalitions/jaccard`}>
                View Jaccard Matrix
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
            <Badge variant="outline">Proximity-weighted</Badge>
            <Badge variant="outline">α = {stats.alpha}</Badge>
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

        <CandidateAffinityProximityView
          proximityData={proximityData}
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
            Proximity-Weighted Affinity Matrix Not Available
          </h1>
          <p className="text-muted-foreground mt-2">
            Proximity-weighted affinity matrix data for this contest could not
            be loaded.
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
