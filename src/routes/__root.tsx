import {
  Outlet,
  Link,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
  useLocation,
  useNavigate,
} from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";

import appCss from "../styles.css?url";

interface RouterContext {
  queryClient: QueryClient;
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Tempo — Team Time Tracking & Utilization" },
      {
        name: "description",
        content:
          "Log time, track availability, and monitor team utilization in real time.",
      },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AppShell>
        <Outlet />
      </AppShell>
      <Toaster />
    </QueryClientProvider>
  );
}

function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const onHome = location.pathname === "/";

  return (
    <div className="min-h-screen bg-background text-foreground">
      {!onHome && <TopNav />}
      {children}
    </div>
  );
}

function TopNav() {
  const linkCls =
    "px-3 py-1.5 rounded-md text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors";
  const activeCls = "bg-accent text-foreground";

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-4">
        <Link to="/" className="mr-4 text-base font-semibold tracking-tight">
          Tempo
        </Link>
        <nav className="flex items-center gap-1 overflow-x-auto">
          <Link
            to="/staff"
            className={linkCls}
            activeProps={{ className: `${linkCls} ${activeCls}` }}
          >
            My work
          </Link>
          <Link
            to="/dashboard"
            className={linkCls}
            activeProps={{ className: `${linkCls} ${activeCls}` }}
          >
            Dashboard
          </Link>
          <Link
            to="/planner"
            className={linkCls}
            activeProps={{ className: `${linkCls} ${activeCls}` }}
          >
            Planner
          </Link>
          <Link
            to="/billing"
            className={linkCls}
            activeProps={{ className: `${linkCls} ${activeCls}` }}
          >
            Billing
          </Link>
          <Link
            to="/settings"
            className={linkCls}
            activeProps={{ className: `${linkCls} ${activeCls}` }}
          >
            Settings
          </Link>
        </nav>
        <div className="ml-auto">
          <RoleBadge />
        </div>
      </div>
    </header>
  );
}

function RoleBadge() {
  const [isViewer, setIsViewer] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    try {
      setIsViewer(window.localStorage.getItem("tt.userRole") === "viewer");
    } catch {
      // ignore
    }
  }, []);
  if (!isViewer) return null;
  const switchUser = () => {
    try {
      window.localStorage.removeItem("tt.userRole");
      window.localStorage.removeItem("tt.selectedStaffId");
    } catch {
      // ignore
    }
    navigate({ to: "/staff" });
    // Force re-evaluation of role-aware screens
    if (typeof window !== "undefined") window.location.reload();
  };
  return (
    <div className="flex items-center gap-2">
      <span className="rounded-full border border-border bg-accent px-2.5 py-0.5 text-[11px] font-medium text-foreground">
        Manager
      </span>
      <Button variant="ghost" size="sm" onClick={switchUser}>
        Switch user
      </Button>
    </div>
  );
}
