import Link from "next/link";
import { reviewerDemo } from "@/lib/reviewer-demo";
import { BookOpen, Users, FileBarChart, LogOut } from "lucide-react";
import { signOut } from "@/app/actions";
import { localDemo } from "@/lib/local-demo";
import type { Row } from "@/lib/domain";
export async function Shell({
  member,
  active,
  children,
}: {
  member: Row<"memberships">;
  active: string;
  children: React.ReactNode;
}) {
  const demo = await reviewerDemo();
  const staff = member.role === "staff";
  const links = staff
    ? [
        { href: "/staff/people", label: "People & assignments", icon: Users },
        {
          href: "/staff/reports",
          label: "Monthly reports",
          icon: FileBarChart,
        },
      ]
    : [{ href: "/tutor", label: "My students", icon: Users }];
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link
          href={staff ? "/staff" : "/tutor"}
          className="brand"
          aria-label={staff ? "Gather home" : "My students home"}
        >
          <span className="brand-icon">
            <BookOpen size={23} />
          </span>
          gather<span className="brand-dot">.</span>
        </Link>
        <div className="organization">
          LVA ESSEX / PASSAIC<span>Tutor reporting workspace</span>
        </div>
        <span className="nav-label">
          {staff ? "PROGRAM MANAGEMENT" : "YOUR WORKSPACE"}
        </span>
        <nav aria-label="Main navigation">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={active === l.href ? "nav-item active" : "nav-item"}
              aria-current={active === l.href ? "page" : undefined}
            >
              <l.icon size={19} />
              {l.label}
              {active === l.href && <span className="nav-dot" />}
            </Link>
          ))}
        </nav>
        {demo.allowed && (
          <Link href="/demo" className="nav-item">
            Switch demo account
          </Link>
        )}
        <div className="profile">
          <span className="avatar">
            {member.display_name
              .split(" ")
              .map((x) => x[0])
              .slice(0, 2)
              .join("")}
          </span>
          <div>
            <strong>{member.display_name}</strong>
            <small>{staff ? "Program staff" : "Volunteer tutor"}</small>
          </div>
          <form action={signOut}>
            <button aria-label="Sign out" title="Sign out">
              <LogOut size={18} />
            </button>
          </form>
        </div>
      </aside>
      <div className="content-shell">
        <header className="topbar">
          <span>
            <span className="live-dot" />{" "}
            {localDemo()
              ? "LOCAL DEMO · FICTIONAL DATA"
              : demo.allowed
                ? "SHARED DEMO · FICTIONAL DATA"
                : "LITERACY VOLUNTEERS OF AMERICA"}
          </span>
        </header>
        <main id="main" className="main-content">
          {children}
        </main>
        <footer>
          <span>LVAEP · Session reporting</span>
        </footer>
      </div>
    </div>
  );
}
export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="description">{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function Stat({
  label,
  value,
  note,
  icon,
}: {
  label: string;
  value: string | number;
  note?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="stat">
      <span className="stat-icon">{icon}</span>
      <p>{label}</p>
      <strong>{value}</strong>
      {note && <small>{note}</small>}
    </div>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <BookOpen size={28} />
      <h3>{title}</h3>
      {children && <p>{children}</p>}
    </div>
  );
}
