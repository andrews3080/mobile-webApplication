import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserServices } from "./app/browser-services";
import { App } from "./ui/App";
import "./styles.css";

const services = createBrowserServices();

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");
createRoot(root).render(
  <StrictMode>
    <App services={services} />
  </StrictMode>,
);
