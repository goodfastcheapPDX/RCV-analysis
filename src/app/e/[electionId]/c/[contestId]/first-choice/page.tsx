export const runtime = "nodejs";

import Link from "next/link";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  loadCandidatesForContest,
  loadFirstChoiceForContest,
} from "@/lib/manifest/loaders";
import { FirstChoiceBreakdownView } from "@/packages/contracts/slices/first_choice_breakdown/view";

interface FirstChoicePageProps {
  params: Promise<{ electionId: string; contestId: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function FirstChoicePage({
  params,
}: FirstChoicePageProps) {
  const { electionId, contestId } = await params;

  try {
    const { data, contest } = await loadFirstChoiceForContest(
      electionId,
      contestId,
    );

    // Load candidates to get ID mapping for links
    const { data: candidates } = await loadCandidatesForContest(
      electionId,
      contestId,
    );

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">First Choice Breakdown</h1>
          <p className="text-muted-foreground mt-2">
            Visualization of candidate first-choice vote counts from
            ranked-choice voting data for {contest.title}.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-start">
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href={`/e/${electionId}/c/${contestId}`}>STV Rounds</Link>
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
              {data.length} candidate{data.length !== 1 ? "s" : ""}
            </Badge>
          </div>
        </div>

        <FirstChoiceBreakdownView
          data={data}
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
            First Choice Data Not Available
          </h1>
          <p className="text-muted-foreground mt-2">
            First choice breakdown data for this contest could not be loaded.
          </p>
        </div>

        <Alert>
          <AlertDescription>
            <strong>Error:</strong> {errorMessage}
            <br />
            <br />
            Make sure to run the data build commands first:
            <code className="bg-muted px-2 py-1 rounded mt-2 block text-sm">
              npm run build:data && npm run build:data:first-choice
            </code>
          </AlertDescription>
        </Alert>

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
      </div>
    );
  }
}
