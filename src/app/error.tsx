"use client";

import { AlertCircle } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    // Log the error to the console in development
    if (process.env.NODE_ENV === "development") {
      console.error("Application error:", error);
    }
  }, [error]);

  return (
    <div className="max-w-md mx-auto py-16">
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Something went wrong!</AlertTitle>
        <AlertDescription className="mt-2">
          An unexpected error occurred while loading this page.
          {process.env.NODE_ENV === "development" && error.message && (
            <details className="mt-2">
              <summary className="cursor-pointer text-sm font-medium">
                Error details (development only)
              </summary>
              <code className="text-xs mt-1 block p-2 bg-muted rounded">
                {error.message}
              </code>
            </details>
          )}
        </AlertDescription>
      </Alert>

      <div className="mt-6 flex gap-3 justify-center">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" asChild>
          <Link href="/e">Browse Elections</Link>
        </Button>
      </div>
    </div>
  );
}
