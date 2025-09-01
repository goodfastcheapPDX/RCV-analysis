export const runtime = "nodejs";

import Link from "next/link";
import { notFound } from "next/navigation";
import { CandidateTabs } from "@/components/candidate/Tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
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

interface CandidatePageProps {
  params: Promise<{
    electionId: string;
    contestId: string;
    candidateId: string;
  }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function CandidatePage({
  params,
  searchParams,
}: CandidatePageProps) {
  const { electionId, contestId, candidateId } = await params;
  const { tab } = (await searchParams) || {};

  try {
    // Load candidates and STV data
    const {
      data: candidates,
      contest,
      election,
    } = await loadCandidatesForContest(electionId, contestId);

    // Find the specific candidate
    const candidate = candidates.find(
      (c) => c.candidate_id.toString() === candidateId,
    );

    if (!candidate) {
      notFound();
    }

    // Load STV data for badge logic
    let elected = false;
    let eliminated = false;

    try {
      const { roundsData } = await loadStvForContest(electionId, contestId);

      // Check if candidate was elected
      elected = roundsData.some(
        (r) =>
          r.candidate_name === candidate.candidate_name &&
          r.status === "elected",
      );

      // Check if candidate was eliminated
      eliminated = roundsData.some(
        (r) =>
          r.candidate_name === candidate.candidate_name &&
          r.status === "eliminated",
      );
    } catch (error) {
      // STV data may not be available, continue without badges
      console.warn("STV data not available for badge logic:", error);
    }

    const defaultTab = "rank";
    const currentTab = Array.isArray(tab) ? tab[0] : tab || defaultTab;

    return (
      <div className="space-y-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href={`/e/${electionId}`}>{election.title}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href={`/e/${electionId}/c/${contestId}`}>
                  {contest.title}
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{candidate.candidate_name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-bold">{candidate.candidate_name}</h1>
              {elected && (
                <Badge
                  variant="default"
                  className="bg-green-600 hover:bg-green-700"
                >
                  Elected
                </Badge>
              )}
              {eliminated && !elected && (
                <Badge variant="destructive">Eliminated</Badge>
              )}
            </div>
            <p className="text-muted-foreground mt-2">
              Detailed analysis for this candidate in the {contest.title}{" "}
              election.
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href={`/e/${electionId}/c/${contestId}`}>
                Back to Contest
              </Link>
            </Button>
          </div>
        </div>

        <CandidateTabs
          electionId={electionId}
          contestId={contestId}
          candidateId={candidateId}
          candidateName={candidate.candidate_name}
          currentTab={currentTab}
        />
      </div>
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Candidate Not Available</h1>
          <p className="text-muted-foreground mt-2">
            This candidate could not be loaded for this contest.
          </p>
        </div>

        <Alert>
          <AlertDescription>
            <strong>Error:</strong> {errorMessage}
            <br />
            <br />
            Make sure the candidate exists in this contest and that data has
            been built.
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
