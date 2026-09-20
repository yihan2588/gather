"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Button } from "@/components/ui/button";
import type { DemoContext } from "@/lib/reviewer-demo";

export function GuestSignIn() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function enter() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const client = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      );
      const { data, error: contextError } = await client.rpc("demo_context");
      if (contextError || !(data as DemoContext)?.enabled)
        throw new Error(
          "Guest access is unavailable. Please continue with Google.",
        );
      // Reuse a valid session; create guests directly in the browser so Auth's
      // IP rate limits apply to the visitor, not a shared deployment server.
      const { data: existing } = await client.auth.getUser();
      if (!existing.user) {
        const { error: signInError } = await client.auth.signInAnonymously();
        if (signInError)
          throw new Error(
            signInError.status === 429
              ? "Too many attempts. Please wait a moment or continue with Google."
              : "Guest sign-in did not complete. Please try again or continue with Google.",
          );
      }
      router.replace("/demo");
      router.refresh();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Guest sign-in did not complete. Please try again.",
      );
      setBusy(false);
    }
  }
  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="guest-button"
        onClick={enter}
        disabled={busy}
      >
        {busy ? "Opening demo…" : "Continue as guest"}
      </Button>
      {error && (
        <p role="alert" className="form-message failure">
          {error}
        </p>
      )}
    </>
  );
}
