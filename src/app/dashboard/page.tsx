import type { Metadata } from "next";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  CreditCard,
  DollarSign,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";

import { EmptyState } from "@/components/patterns/empty-state";
import { HeroCard } from "@/components/patterns/hero-card";
import { ListItem } from "@/components/patterns/list-item";
import { SectionCard } from "@/components/patterns/section-card";
import { StatCard } from "@/components/patterns/stat-card";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Revenue, user stats, and recent activity overview.",
};

// Status colors — tokens where available, impact hex only for
// colors that have no semantic token (pending/urgent per DESIGN-LANGUAGE.md).
const STATUS = {
  completed: { label: "Completed", color: "var(--success)" },
  inProgress: { label: "In Progress", color: "var(--info)" },
  pending: { label: "Pending", color: "#F59E0B" }, // impact: pending
  churned: { label: "Churned", color: "#C85A54" }, // impact: urgent
} as const;

const stats = [
  {
    icon: DollarSign,
    label: "Today's Revenue",
    value: "$48.2",
    unit: "K",
    trend: { value: "+8.2%", direction: "up" as const },
  },
  {
    icon: Users,
    label: "Active Users",
    value: "12,438",
    trend: { value: "+3.1%", direction: "up" as const },
  },
  {
    icon: UserPlus,
    label: "New Signups",
    value: "324",
    trend: { value: "+12.6%", direction: "up" as const },
  },
  {
    icon: CreditCard,
    label: "Churn Rate",
    value: "2.4",
    unit: "%",
    trend: { value: "-0.4%", direction: "down" as const },
  },
];

const activity = [
  {
    title: "Acme Corp upgraded to Pro",
    status: STATUS.completed,
    trailing: "+$1,280",
  },
  {
    title: "Seed Studio · new team member",
    status: STATUS.inProgress,
    trailing: "5 seats",
  },
  {
    title: "Orbit Labs invoice pending",
    status: STATUS.pending,
    trailing: "$840",
  },
  {
    title: "Nova Inc. cancelled subscription",
    status: STATUS.churned,
    trailing: "-$320",
  },
  {
    title: "Lumen Co. added 3 new integrations",
    status: STATUS.completed,
    trailing: "—",
  },
];

const topCustomers = [
  { name: "Acme Corp", plan: "Enterprise", value: "128.4", unit: "K" },
  { name: "Seed Studio", plan: "Pro", value: "84.2", unit: "K" },
  { name: "Orbit Labs", plan: "Pro", value: "62.0", unit: "K" },
  { name: "Lumen Co.", plan: "Team", value: "48.6", unit: "K" },
];

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-surface-page">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <div>
            <p className="text-[12px] font-medium uppercase tracking-[0.05em] text-text-secondary">
              Overview
            </p>
            <h1 className="mt-1.5 text-[24px] font-bold leading-snug tracking-[-0.01em] text-text-primary">
              Dashboard
            </h1>
          </div>
          <div
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-tint px-3 py-1.5"
            role="status"
            aria-live="polite"
          >
            <span
              className="size-1.5 rounded-full bg-brand"
              aria-hidden="true"
            />
            <span className="sr-only">Data status:</span>
            <span className="text-[11px] font-bold uppercase tracking-[0.05em] text-brand">
              Live · updated just now
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-6">
        <div className="space-y-6">
          {/* Hero: total revenue */}
          <HeroCard
            className="mx-0"
            icon={Wallet}
            label="Total Revenue This Month"
            value="3.8"
            unit="M"
            trend={{
              value: "+12.4%",
              direction: "up",
              label: "vs. last month",
            }}
            watermarkIcon={Wallet}
          />

          {/* KPI grid */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((s) => (
              <StatCard
                key={s.label}
                icon={s.icon}
                label={s.label}
                value={s.value}
                unit={s.unit}
                trend={s.trend}
              />
            ))}
          </div>

          {/* Revenue + Top customers row */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <SectionCard
              className="mx-0 lg:col-span-2"
              title="Revenue Trend"
              headerRight={
                <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-muted px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.05em] text-text-tertiary">
                  Coming soon
                </span>
              }
              footer={
                <div className="grid grid-cols-3 gap-6 border-t border-border pt-6">
                  {[
                    { label: "Web", value: "1,648" },
                    { label: "Mobile", value: "1,520" },
                    { label: "API", value: "612" },
                  ].map((item) => (
                    <div key={item.label}>
                      <p className="text-[12px] font-medium uppercase tracking-[0.05em] text-text-secondary">
                        {item.label}
                      </p>
                      <p className="mt-1.5 text-[18px] font-bold leading-none tracking-[-0.01em] text-text-primary">
                        {item.value}
                        <span className="ms-0.5 text-[10px] font-medium text-text-tertiary">
                          /mo
                        </span>
                      </p>
                    </div>
                  ))}
                </div>
              }
            >
              <EmptyState
                className="rounded-xl bg-surface-subtle"
                icon={BarChart3}
                title="Chart not connected yet"
                description="Revenue trend visualization will appear here once the data source is wired up."
              />
            </SectionCard>

            <SectionCard className="mx-0" title="Top Customers">
              <ol className="space-y-3">
                {topCustomers.map((c, i) => (
                  <li
                    key={c.name}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="flex size-6 items-center justify-center rounded-md bg-surface-muted text-[11px] font-bold text-text-secondary"
                        aria-hidden="true"
                      >
                        {i + 1}
                      </span>
                      <div>
                        <p className="text-[14px] font-bold leading-snug text-text-primary">
                          <span className="sr-only">Rank {i + 1}: </span>
                          {c.name}
                        </p>
                        <p className="text-[11px] font-medium text-text-tertiary">
                          {c.plan}
                        </p>
                      </div>
                    </div>
                    <p className="text-[17px] font-bold leading-none text-text-primary">
                      ${c.value}
                      <span className="ms-0.5 text-[11px]">{c.unit}</span>
                    </p>
                  </li>
                ))}
              </ol>
            </SectionCard>
          </div>

          {/* Recent activity */}
          <SectionCard
            className="mx-0"
            title="Recent Activity"
            headerRight={
              <a
                href="/dashboard/activity"
                className={`inline-flex min-h-11 items-center gap-1 rounded-md px-3 text-[12px] font-bold text-brand transition-colors hover:text-brand/80 ${FOCUS_RING}`}
              >
                View all
                <ArrowUpRight
                  className="size-3.5"
                  strokeWidth={2.5}
                  aria-hidden="true"
                />
              </a>
            }
          >
            <div className="space-y-3">
              {activity.map((a) => (
                <ListItem
                  key={a.title}
                  leading={
                    <div className="flex size-9 items-center justify-center rounded-xl bg-brand/10">
                      <Activity
                        className="size-4 text-brand"
                        strokeWidth={2}
                        aria-hidden="true"
                      />
                    </div>
                  }
                  title={a.title}
                  status={a.status}
                  trailing={
                    <span className="text-[14px] font-bold text-text-primary">
                      {a.trailing}
                    </span>
                  }
                />
              ))}
            </div>
          </SectionCard>
        </div>
      </main>
    </div>
  );
}
