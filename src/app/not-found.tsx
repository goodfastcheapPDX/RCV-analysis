import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="max-w-md mx-auto py-16">
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Page Not Found</AlertTitle>
        <AlertDescription className="mt-2">
          The election or contest you're looking for doesn't exist or may have
          been moved.
        </AlertDescription>
      </Alert>

      <div className="mt-6 flex gap-3 justify-center">
        <Button asChild>
          <Link href="/e">Browse Elections</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/">Go Home</Link>
        </Button>
      </div>
    </div>
  );
}
