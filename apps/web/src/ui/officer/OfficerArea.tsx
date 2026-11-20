import { useCallback, useState } from "react";
import type { OfficerApi, TokenStore } from "../../core/officer";
import { LoginForm } from "./LoginForm";
import { ReportDetail } from "./ReportDetail";
import { ReportList } from "./ReportList";

interface Props {
  api: OfficerApi;
  tokens: TokenStore;
}

// Login, then the list, then one report. The open report is kept in memory, NOT in the address:
// a report code is the reporter's key to the public tracking page, and must not pile up in a shared browser's history.
export function OfficerArea({ api, tokens }: Props) {
  const [token, setToken] = useState<string | null>(() => tokens.load());
  const [openCode, setOpenCode] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | undefined>(undefined);
  const [filter, setFilter] = useState<string | null>(null);

  const endSession = useCallback(
    (message?: string) => {
      tokens.clear();
      setToken(null);
      setOpenCode(null);
      setNotice(message);
    },
    [tokens],
  );

  const onSessionEnded = useCallback(() => endSession("Your session has ended. Please log in again."), [endSession]);

  if (!token) {
    return (
      <LoginForm
        api={api}
        notice={notice}
        onLoggedIn={(newToken) => {
          tokens.save(newToken);
          setNotice(undefined);
          setToken(newToken);
        }}
      />
    );
  }

  return (
    <div className="officer">
      <div className="officer-bar">
        <span className="officer-label">Officer area</span>
        <button type="button" className="link" onClick={() => endSession("You have logged out.")}>
          Log out
        </button>
      </div>
      {openCode ? (
        <ReportDetail api={api} token={token} code={openCode} onBack={() => setOpenCode(null)} onSessionEnded={onSessionEnded} />
      ) : (
        <ReportList api={api} token={token} onOpen={setOpenCode} onSessionEnded={onSessionEnded} filter={filter} onFilter={setFilter} />
      )}
    </div>
  );
}
