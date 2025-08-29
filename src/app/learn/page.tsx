import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function LearnPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Learn</h1>
        <p className="-foreground mt-2">
          Educational resources about ranked-choice voting
        </p>
      </div>

      <Alert>
        <AlertDescription>
          Educational content and tutorials will be added in future stages.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Ranked-Choice Voting Basics</CardTitle>
            <CardDescription>Understanding how RCV works</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="-foreground">
              Interactive guides and examples coming soon.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Single Transferable Vote</CardTitle>
            <CardDescription>Multi-winner election systems</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="-foreground">
              STV tabulation and analysis tutorials coming soon.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Data Analysis</CardTitle>
            <CardDescription>Interpreting election results</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="-foreground">
              Coalition analysis and visualization guides coming soon.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Technical Reference</CardTitle>
            <CardDescription>API documentation and schemas</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="-foreground">
              Technical documentation and examples coming soon.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
