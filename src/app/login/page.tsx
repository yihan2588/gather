import { BookOpen, ArrowRight, Check } from "lucide-react";
import { signIn, demoSignIn } from "@/app/actions";
import { localDemo } from "@/lib/local-demo";
import { configured } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main id="main" className="login-layout">
      <section className="login-story">
        <div className="brand">
          <span className="brand-icon">
            <BookOpen />
          </span>
          gather.
        </div>
        <div className="story-content">
          <h1>Tutor session reporting</h1>
          <p>Record sessions, track attendance, and prepare monthly reports.</p>
          <div className="story-illustration" aria-hidden="true">
            <div className="sun" />
            <div className="book-lines">
              <BookOpen size={126} strokeWidth={1} />
            </div>
          </div>
        </div>
        <small>Literacy Volunteers of America · Essex & Passaic County</small>
      </section>
      <section className="login-panel">
        <div className="login-card">
          <h2>Sign in to Gather</h2>
          {error && (
            <p role="alert" className="form-message failure">
              {error === "setup"
                ? "Google sign-in needs Supabase and APP_URL configuration."
                : "Sign-in did not complete. Please try again."}
            </p>
          )}
          {configured() && !localDemo() ? (
            <form action={signIn}>
              <Button className="google-button" type="submit">
                <span className="google-g">G</span>Continue with Google
                <ArrowRight size={18} />
              </Button>
            </form>
          ) : !localDemo() ? (
            <div className="setup-note">
              <strong>Ready for your Supabase connection</strong>
              <p>
                Configure the environment values in .env.example to enable
                Google sign-in. For a local walkthrough, run{" "}
                <code>pnpm dev:demo</code>.
              </p>
            </div>
          ) : null}
          <div className="login-trust">
            <Check size={15} /> Access is approved by your program staff.
          </div>
          {localDemo() && (
            <div className="demo-options">
              <span className="eyebrow">LOCAL WALKTHROUGH</span>
              <p>Fictional accounts and student records.</p>
              <div>
                {[
                  ["tutor", "Enter as Maya · Tutor"],
                  ["leo", "Enter as Leo · Tutor"],
                  ["staff", "Enter as Sam · Staff"],
                  ["pending", "Preview pending access"],
                ].map(([value, label]) => (
                  <form action={demoSignIn} key={value}>
                    <input type="hidden" name="persona" value={value} />
                    <Button variant="outline" type="submit">
                      {label}
                      <ArrowRight size={15} />
                    </Button>
                  </form>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
