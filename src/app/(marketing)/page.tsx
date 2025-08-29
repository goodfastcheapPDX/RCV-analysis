import type { Metadata } from "next";
import Link from "next/link";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { withPreservedQuery } from "@/lib/url-preserve";

function CTALink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const preservedHref =
    typeof window !== "undefined" ? withPreservedQuery(href) : href;
  return <Link href={preservedHref}>{children}</Link>;
}

export function generateMetadata(): Metadata {
  return {
    title: "Ranked Choice Analysis - Represent Who?",
    description:
      "Understanding proportional representation in ranked-choice elections. Comprehensive analysis platform for STV tabulation, coalition analysis, and interactive visualizations.",
  };
}

export default function MarketingPage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      {/* Hero Section */}
      <div className="text-center space-y-6 mb-12">
        <div className="flex items-center justify-center gap-3">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            Ranked Choice Analysis
          </h1>
          <Badge variant="secondary" className="text-xs">
            alpha
          </Badge>
        </div>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Represent who? Understanding proportional representation in
          ranked-choice elections.
        </p>
      </div>

      {/* CTA Cards */}
      <div className="grid md:grid-cols-2 gap-6 mb-12">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle>Explore Elections</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Browse available election data and start your analysis journey.
            </p>
            <Button asChild className="w-full">
              <CTALink href="/e">Explore Elections</CTALink>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle>Jump to Demo</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              See the platform in action with Portland's 2024 City Council
              District 2 election.
            </p>
            <Button asChild className="w-full">
              <CTALink href="/e/portland-2024-general/c/council-district-2">
                View Demo
              </CTALink>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Separator className="my-8" />

      {/* How It Works */}
      <div className="text-center space-y-4">
        <h2 className="text-2xl font-semibold">How It Works</h2>
        <Alert>
          <AlertDescription className="text-left">
            <strong>CSV → Static Artifacts → Interactive UI</strong>
            <br />
            Upload Cast Vote Record (CVR) data in CSV format. Our analysis
            engine processes the data to generate static artifacts including STV
            tabulation results, coalition analysis, and vote transfer patterns.
            The interactive dashboard then provides comprehensive visualizations
            and insights into ranked-choice voting dynamics.
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}
