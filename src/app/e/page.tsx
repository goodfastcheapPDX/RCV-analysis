import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Manifest } from "@/contracts/manifest";
import { loadManifest } from "@/lib/manifest";

export default async function ElectionsIndexPage() {
  const manifest = Manifest.parse(await loadManifest());
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Elections</h1>
        <p className="-foreground mt-2">
          Browse available elections and their contests
        </p>
      </div>

      <div className="grid gap-4">
        {manifest.elections.map((election) => (
          <Card
            key={election.election_id}
            className="hover:shadow-md transition-shadow"
          >
            <CardHeader>
              <CardTitle>
                <Link
                  href={`/e/${election.election_id}`}
                  className="hover:underline"
                >
                  {election.title}
                </Link>
              </CardTitle>
              <CardDescription>
                <Badge variant="secondary">
                  {election.contests.length} contest
                  {election.contests.length !== 1 ? "s" : ""}
                </Badge>
              </CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
