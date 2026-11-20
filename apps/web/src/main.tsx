import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserServices } from "./app/browser-services";
import { Icon } from "./ui/Icon";
import { ReportPage } from "./ui/ReportPage";
import "./styles.css";

const services = createBrowserServices();

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");
createRoot(root).render(
  <StrictMode>
    <header className="topbar">
      <div className="topbar-inner">
        <Icon name="logo" size={28} />
        <span className="brand">Asaase Ani</span>
        <span className="brand-sub">Protect our land and water</span>
      </div>
    </header>
    <main>
      <ReportPage services={services} />
    </main>
  </StrictMode>,
);
