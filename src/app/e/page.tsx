import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { withPreservedQuerySSR } from "@/lib/url-preserve";
import { loadManifestFromFs } from "@/packages/contracts/lib/manifest";

interface ElectionsIndexPageProps {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function ElectionsIndexPage({
  searchParams,
}: ElectionsIndexPageProps) {
  const manifest = await loadManifestFromFs();
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const urlSearchParams = new URLSearchParams();

  Object.entries(resolvedSearchParams).forEach(([key, value]) => {
    if (typeof value === "string") {
      urlSearchParams.set(key, value);
    }
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Elections</h1>
        <p className="text-muted-foreground mt-2">
          Browse available elections and their contests
        </p>
      </div>

      <div className="grid gap-4">
        {manifest.elections.map((election) => (
          <Card key={election.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle>
                <Link
                  href={withPreservedQuerySSR(
                    `/e/${election.id}`,
                    urlSearchParams,
                  )}
                  className="hover:underline"
                >
                  {election.name}
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
