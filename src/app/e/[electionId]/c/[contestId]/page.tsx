import { notFound } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { loadManifestFromFs } from "@/packages/contracts/lib/manifest";

export async function generateStaticParams() {
  const manifest = await loadManifestFromFs();
  const params = [];

  for (const election of manifest.elections) {
    for (const contest of election.contests) {
      params.push({
        electionId: election.id,
        contestId: contest.id,
      });
    }
  }

  return params;
}

interface ContestPageProps {
  params: Promise<{ electionId: string; contestId: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function ContestPage({ params }: ContestPageProps) {
  const { electionId, contestId } = await params;
  const manifest = await loadManifestFromFs();

  const election = manifest.elections.find((e) => e.id === electionId);
  if (!election) {
    notFound();
  }

  const contest = election.contests.find((c) => c.id === contestId);
  if (!contest) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{contest.name}</h1>
        <p className="text-muted-foreground mt-2">
          Analysis and visualization for this contest
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Contest Details</CardTitle>
          <CardDescription>
            Information about this ranked-choice voting contest
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-medium text-sm text-muted-foreground">
                Election
              </h3>
              <p className="text-base">{election.name}</p>
            </div>
            <div>
              <h3 className="font-medium text-sm text-muted-foreground">
                Available Seats
              </h3>
              <Badge variant="outline">{contest.seats}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Alert>
        <AlertDescription>
          Contest analysis and visualization will be implemented in later
          stages. This placeholder shows the contest structure from the
          manifest.
        </AlertDescription>
      </Alert>
    </div>
  );
}
