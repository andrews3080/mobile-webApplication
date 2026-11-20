import { useEffect, useState } from "react";
import type { OfficerApi, TokenStore } from "../core/officer";
import type { TrackApi } from "../core/ports";
import { Icon } from "./Icon";
import { OfficerArea } from "./officer/OfficerArea";
import { ReportPage } from "./ReportPage";
import type { ReportServices } from "./services";
import { TrackPage } from "./TrackPage";

export interface AppServices extends ReportServices {
  tracking: TrackApi;
  officer: OfficerApi;
  officerTokens: TokenStore;
}

type Route = "report" | "track" | "officer";

// Hash addresses (#/track) work on any static host with no server setup, and the back button just works
function routeFromHash(hash: string): Route {
  const first = hash.replace(/^#\/?/, "").split(/[/?]/)[0];
  return first === "track" || first === "officer" ? first : "report";
}

const HREF: Record<Route, string> = { report: "#/", track: "#/track", officer: "#/officer" };

const TITLES: Record<Route, string> = {
  report: "Report illegal mining · Asaase Ani",
  track: "Check a report · Asaase Ani",
  officer: "Officers · Asaase Ani",
};

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
    document.title = TITLES[route];
  }, [route]);

  const navLink = (target: Route, text: string) => (
    <a href={HREF[target]} className="nav-link" aria-current={route === target ? "page" : undefined}>
      {text}
    </a>
  );

  return (
    <>
      <header className="topbar">
        <div className={route === "officer" ? "topbar-inner wide" : "topbar-inner"}>
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
      <main className={route === "officer" ? "wide" : undefined}>
        {/* The report page stays mounted (just hidden) so switching pages never interrupts a send in progress */}
        <div hidden={route !== "report"}>
          <ReportPage services={services} autosaveMs={autosaveMs} />
        </div>
        {route === "track" && <TrackPage tracking={services.tracking} />}
        {route === "officer" && <OfficerArea api={services.officer} tokens={services.officerTokens} />}
      </main>
      {route !== "officer" && (
        <footer className="site-footer">
          <a href={HREF.officer}>Officer login</a>
        </footer>
      )}
    </>
  );
}
