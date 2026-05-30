import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Users, BarChart3, CalendarDays, Receipt, Settings, Clock } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tempo — Team Time Tracking & Utilization" },
      {
        name: "description",
        content:
          "Log time, track availability, and monitor team utilization in real time.",
      },
    ],
  }),
  component: HomePage,
});

const TILES = [
  {
    to: "/staff",
    title: "Log my time",
    description: "Sign in as yourself and log hours (Manager user is read-only and should not be used by staff).",
    icon: Clock,
    accent: "text-status-in-progress",
  },
  {
    to: "/dashboard",
    title: "Team dashboard",
    description: "Live availability, utilization, and overruns.",
    icon: BarChart3,
    accent: "text-status-complete",
  },
  {
    to: "/planner",
    title: "Planner",
    description: "Calendar of capacity, leave, and holidays.",
    icon: CalendarDays,
    accent: "text-status-on-hold",
  },
  {
    to: "/billing",
    title: "Billing",
    description: "Monthly hours per client per staff.",
    icon: Receipt,
    accent: "text-primary",
  },
  {
    to: "/settings",
    title: "Settings",
    description: "Manage staff, clients, projects, holidays.",
    icon: Settings,
    accent: "text-muted-foreground",
  },
] as const;

function HomePage() {
  return (
    <main className="min-h-screen">
      <section className="mx-auto max-w-5xl px-4 pt-16 pb-10 text-center">
        <div className="mx-auto mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Users className="h-6 w-6" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight md:text-5xl">Tempo</h1>
        <p className="mx-auto mt-3 max-w-xl text-base text-muted-foreground">
          Log time against tasks, watch team availability change in real time,
          and roll everything up into monthly billing.
        </p>
      </section>

      <section className="mx-auto grid max-w-5xl grid-cols-1 gap-4 px-4 pb-20 sm:grid-cols-2 lg:grid-cols-3">
        {TILES.map((t) => {
          const Icon = t.icon;
          return (
            <Link key={t.to} to={t.to}>
              <Card className="group h-full transition-all hover:border-primary/50 hover:shadow-md">
                <CardContent className="flex flex-col gap-3 p-5">
                  <div
                    className={`inline-flex h-10 w-10 items-center justify-center rounded-lg bg-accent ${t.accent}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold">{t.title}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </section>
    </main>
  );
}
