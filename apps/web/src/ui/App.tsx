import { useEffect, useState } from "react";
import type { TrackApi } from "../core/ports";
import { Icon } from "./Icon";
import { ReportPage } from "./ReportPage";
import type { ReportServices } from "./services";
import { TrackPage } from "./TrackPage";

export interface AppServices extends ReportServices {
  tracking: TrackApi;
}

type Route = "report" | "track";

// Hash addresses (#/track) work on any static host with no server setup, and the back button just works
function routeFromHash(hash: string): Route {
  return hash.replace(/^#\/?/, "").split(/[/?]/)[0] === "track" ? "track" : "report";
}

const HREF: Record<Route, string> = { report: "#/", track: "#/track" };

function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(() => routeFromHash(window.location.hash));
  useEffect(() => {
    const onChange = () => {
      setRoute(routeFromHash(window.location.hash));
      window.scrollTo?.(0, 0);
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

export function App({ services, autosaveMs }: { services: AppServices; autosaveMs?: number }) {
  const route = useHashRoute();

  useEffect(() => {
    document.title = route === "track" ? "Check a report · Asaase Ani" : "Report illegal mining · Asaase Ani";
  }, [route]);

  const navLink = (target: Route, text: string) => (
    <a href={HREF[target]} className="nav-link" aria-current={route === target ? "page" : undefined}>
      {text}
    </a>
  );

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <a href={HREF.report} className="brand-link">
            <Icon name="logo" size={28} />
            <span className="brand">Asaase Ani</span>
          </a>
          <nav aria-label="Main">
            {navLink("report", "Report")}
            {navLink("track", "Check a report")}
          </nav>
        </div>
      </header>
      <main>
        {/* The report page stays mounted (just hidden) so switching pages never interrupts a send in progress */}
        <div hidden={route !== "report"}>
          <ReportPage services={services} autosaveMs={autosaveMs} />
        </div>
        {route === "track" && <TrackPage tracking={services.tracking} />}
      </main>
    </>
  );
}
