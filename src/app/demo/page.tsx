import { redirect } from "next/navigation";
import { identity } from "@/lib/data";
import { reviewerDemo, demoAccounts } from "@/lib/reviewer-demo";
import { switchDemoAccount, signOut } from "@/app/actions";
import { Button } from "@/components/ui/button";
export default async function Demo() {
  if (!(await identity())) redirect("/login");
  if (!(await reviewerDemo()).allowed) redirect("/");
  return (
    <main id="main" className="standalone">
      <h1>Choose a demo account</h1>
      <p>
        Explore the tutor and staff workflows. Changes to these fictional
        records are shared with other reviewers.
      </p>
      <div className="demo-account-grid">
        {demoAccounts.map(([persona, name, description]) => (
          <form action={switchDemoAccount} key={persona} className="panel">
            <input type="hidden" name="persona" value={persona} />
            <h2>{name}</h2>
            <p>{description}</p>
            <Button type="submit">Continue as {name.split(" · ")[0]}</Button>
          </form>
        ))}
      </div>
      <form action={signOut}>
        <Button variant="outline">Sign out</Button>
      </form>
    </main>
  );
}
