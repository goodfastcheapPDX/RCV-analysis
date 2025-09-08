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
import { loadCandidateAffinityJaccardForContest } from "@/lib/manifest/candidate-affinity-jaccard-loader";
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
    // Load all required data using the actual Jaccard loader
    const [{ data: jaccardData, contest }, candidatesResult] =
      await Promise.all([
        loadCandidateAffinityJaccardForContest(electionId, contestId),
        loadCandidatesForContest(electionId, contestId).catch(() => ({
          data: undefined,
        })),
      ]);

    const candidates = candidatesResult.data;

    // Calculate stats from actual data
    const stats = {
      total_ballots_considered:
        jaccardData.length > 0
          ? Math.max(
              ...jaccardData.map((d) => Math.max(d.presence_a, d.presence_b)),
            )
          : 0,
      unique_pairs: jaccardData.length,
      max_jaccard:
        jaccardData.length > 0
          ? Math.max(...jaccardData.map((d) => d.jaccard))
          : 0,
      zero_union_pairs: jaccardData.filter((d) => d.union_count === 0).length,
      compute_ms: 0, // Not available from artifact, only from live computation
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
