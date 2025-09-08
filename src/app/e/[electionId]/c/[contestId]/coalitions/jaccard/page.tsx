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
import { CandidateAffinityJaccardView } from "@/features/coalitions/views/CandidateAffinityJaccardView";
import { loadCandidateAffinityMatrixForContest } from "@/lib/manifest/candidate-affinity-loader";
import { loadCandidatesForContest } from "@/lib/manifest/loaders";

interface AffinityJaccardPageProps {
  params: Promise<{ electionId: string; contestId: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function AffinityJaccardPage({
  params,
}: AffinityJaccardPageProps) {
  const { electionId, contestId } = await params;

  try {
    // Load all required data - for now using the same raw data
    // In a real implementation, this would load Jaccard-specific data
    const [{ data: rawData, contest }, candidatesResult] = await Promise.all([
      loadCandidateAffinityMatrixForContest(electionId, contestId),
      loadCandidatesForContest(electionId, contestId).catch(() => ({
        data: undefined,
      })),
    ]);

    const candidates = candidatesResult.data;

    // PLACEHOLDER: Transform raw data to Jaccard format
    // In real implementation, this would come from a dedicated Jaccard slice
    const jaccardData = rawData.map((item) => ({
      ...item,
      // Mock Jaccard calculation (intersection / union)
      jaccard: item.cooccurrence_frac * 0.7, // Simplified mock
      pair_count: item.cooccurrence_count,
      union_count: Math.round(item.cooccurrence_count * 1.4), // Mock
      presence_a: Math.round(item.cooccurrence_count * 1.2), // Mock
      presence_b: Math.round(item.cooccurrence_count * 1.3), // Mock
    }));

    // Calculate stats from data
    const stats = {
      total_ballots_considered:
        rawData.length > 0
          ? Math.round(
              rawData[0].cooccurrence_count / rawData[0].cooccurrence_frac,
            )
          : 0,
      unique_pairs: rawData.length,
      max_pair_frac:
        rawData.length > 0
          ? Math.max(...rawData.map((d) => d.cooccurrence_frac))
          : 0,
      max_jaccard:
        jaccardData.length > 0
          ? Math.max(...jaccardData.map((d) => d.jaccard))
          : 0,
      compute_ms: 0,
    };

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Jaccard Similarity Matrix</h1>
          <p className="text-muted-foreground mt-2">
            Analyze Jaccard similarity between candidates' voter bases. This
            normalized measure reduces bias toward popular candidates by
            considering the union of their supporters.
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
              <Link href={`/e/${electionId}/c/${contestId}`}>
                Back to Contest
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/e/${electionId}`}>Back to Election</Link>
            </Button>
          </div>
          <div className="flex gap-2 items-center">
            <Badge variant="outline">Jaccard Similarity</Badge>
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

        {/* Placeholder Notice */}
        <Alert>
          <AlertDescription>
            <strong>Note:</strong> This is a placeholder implementation using
            mock Jaccard calculations. In a real implementation, this would use
            data from a dedicated candidate_affinity_jaccard slice with proper
            Jaccard coefficient computation.
          </AlertDescription>
        </Alert>

        <CandidateAffinityJaccardView
          jaccardData={jaccardData}
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
            Jaccard Similarity Matrix Not Available
          </h1>
          <p className="text-muted-foreground mt-2">
            Jaccard similarity matrix data for this contest could not be loaded.
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
