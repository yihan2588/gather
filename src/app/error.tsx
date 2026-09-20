"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main" className="standalone">
      <h1>We couldn’t load this page.</h1>
      <p>Your saved records are safe. Please try again.</p>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
