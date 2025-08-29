"use client";

import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ShareLink } from "@/components/ShareLink";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { withPreservedQuery } from "@/lib/url-preserve";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            {/* Brand and Navigation */}
            <div className="flex items-center space-x-6">
              <Link
                href={withPreservedQuery("/")}
                className="flex items-center space-x-2"
              >
                <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center">
                  <span className="text-primary-foreground font-bold text-sm">
                    R
                  </span>
                </div>
                <span className="font-semibold text-lg hidden sm:inline-block">
                  Ranked Elections
                </span>
              </Link>

              <nav className="hidden md:flex items-center space-x-6">
                <Link
                  href={withPreservedQuery("/e")}
                  className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
                >
                  Elections
                </Link>
                <Link
                  href={withPreservedQuery("/learn")}
                  className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
                >
                  Learn
                </Link>
                <Link
                  href={withPreservedQuery("/about")}
                  className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
                >
                  About
                </Link>
              </nav>
            </div>

            {/* Mobile navigation and Share button */}
            <div className="flex items-center space-x-4">
              {/* Mobile navigation menu - simplified for now */}
              <div className="md:hidden">
                <Button variant="ghost" size="sm" asChild>
                  <Link href={withPreservedQuery("/e")}>Elections</Link>
                </Button>
              </div>

              <ShareLink />
            </div>
          </div>
        </div>
      </header>

      {/* Breadcrumbs */}
      <div className="border-b bg-muted/40">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-3">
            <Breadcrumbs />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-muted/40">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-8">
            <div className="flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
              <div className="text-sm text-muted-foreground">
                <p>Ranked Elections Analyzer</p>
                <p className="mt-1">
                  Comprehensive analysis platform for ranked-choice voting
                  elections
                </p>
              </div>

              <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                <Link
                  href={withPreservedQuery("/about")}
                  className="hover:text-primary transition-colors"
                >
                  About
                </Link>
                <Separator orientation="vertical" className="h-4" />
                <Link
                  href={withPreservedQuery("/learn")}
                  className="hover:text-primary transition-colors"
                >
                  Documentation
                </Link>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
