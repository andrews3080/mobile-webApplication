import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

// Temporary page that only proves the web app can reach the API through the dev proxy.
// The real reporting form arrives in Step 6b.
function App() {
  const [status, setStatus] = useState("checking...");

  useEffect(() => {
    fetch("/api/health")
      .then((response) => response.json())
      .then((body: { status?: string }) => setStatus(body.status ?? "unknown"))
      .catch(() => setStatus("cannot reach the API"));
  }, []);

  return (
    <main>
      <h1>Asaase Ani</h1>
      <p>API status: {status}</p>
    </main>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
