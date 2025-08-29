import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function AboutPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">About</h1>
        <p className="text-muted-foreground mt-2">
          Comprehensive analysis platform for ranked-choice voting elections
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ranked Elections Analyzer</CardTitle>
          <CardDescription>
            Advanced tools for understanding ranked-choice voting patterns and
            outcomes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            This platform provides comprehensive analysis tools for
            ranked-choice voting elections, featuring Single Transferable Vote
            (STV) tabulation, coalition analysis, and interactive
            visualizations.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <h3 className="font-semibold mb-2">Key Features</h3>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• STV tabulation engine</li>
                <li>• Coalition analysis</li>
                <li>• Interactive visualizations</li>
                <li>• Cast vote record processing</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Technology Stack</h3>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">Next.js</Badge>
                <Badge variant="secondary">TypeScript</Badge>
                <Badge variant="secondary">Tailwind CSS</Badge>
                <Badge variant="secondary">DuckDB</Badge>
                <Badge variant="secondary">Zod</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Data Sources</CardTitle>
            <CardDescription>Election data and formats</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Supports Cast Vote Record (CVR) data in CSV format for
              comprehensive ballot-level analysis of ranked-choice elections.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Use Cases</CardTitle>
            <CardDescription>Who benefits from this platform</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>• Election administrators</li>
              <li>• Political researchers</li>
              <li>• Campaign strategists</li>
              <li>• Civic organizations</li>
              <li>• Curious citizens</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
