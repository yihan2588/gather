import Link from "next/link";
export default function NotFound() {
  return (
    <main id="main" className="standalone">
      <h1>Record unavailable</h1>
      <p>It may not exist, or you may not have access.</p>
      <Link href="/">Return home →</Link>
    </main>
  );
}
