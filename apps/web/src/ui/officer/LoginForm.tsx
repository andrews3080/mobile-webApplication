import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { ApiError } from "../../core/errors";
import type { OfficerApi } from "@asaase-ani/shared";
import { officerErrorMessage } from "@asaase-ani/shared";

interface Props {
  api: OfficerApi;
  notice?: string; // e.g. why the officer is seeing this screen again
  onLoggedIn(token: string): void;
}

export function LoginForm({ api, notice, onLoggedIn }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (email.trim() === "" || password === "") {
      setError("Please enter your email and password.");
      emailRef.current?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      onLoggedIn(await api.login(email.trim(), password));
    } catch (failure) {
      setPassword("");
      setError(
        failure instanceof ApiError && failure.status === 401
          ? "Email or password is incorrect."
          : failure instanceof ApiError && failure.kind === "rate_limited"
            ? "Too many login attempts. Please wait 15 minutes and try again."
            : officerErrorMessage(failure),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <div className="intro">
        <h1>Officer login</h1>
        <p className="lead">For officers who review reports. Reporters do not need an account.</p>
      </div>
      {notice && <p className="notice">{notice}</p>}
      <form className="card login-form" onSubmit={(event) => void onSubmit(event)} noValidate aria-busy={busy}>
        <div className="field">
          <label htmlFor="officer-email">Email</label>
          <input
            ref={emailRef}
            id="officer-email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="officer-password">Password</label>
          <div className="password-row">
            <input
              id="officer-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button type="button" className="secondary" aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="full-width" disabled={busy}>
          {busy ? "Logging in…" : "Log in"}
        </button>
      </form>
    </div>
  );
}
