import { useState } from "react";
import { LOGO_URI, postMessage } from "../vscode";

export function Login() {
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    postMessage({ type: "loginSubmit", email, password });
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      {LOGO_URI && (
        <img src={LOGO_URI} alt="CodeSquare" className="mb-1 h-20 w-20 object-contain" />
      )}
      <div className="font-ui text-[15px] font-semibold text-fg">CodeSquareAgent</div>
      <p className="-mt-2 font-mono text-xs text-dim">Sign in to get started</p>

      {!showForm ? (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="rounded-lg border border-primary/40 bg-primary/15 px-6 py-2 text-[13px] text-primary hover:bg-primary/25"
        >
          Login
        </button>
      ) : (
        <form onSubmit={submit} className="flex w-full max-w-[230px] flex-col gap-1.5">
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-line bg-white/[0.05] p-2 font-mono text-xs text-fg outline-none focus:border-primary/50"
          />
          <input
            type="password"
            required
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-line bg-white/[0.05] p-2 font-mono text-xs text-fg outline-none focus:border-primary/50"
          />
          <button
            type="submit"
            className="rounded-md border border-primary/40 bg-primary/15 p-2 text-[13px] text-primary hover:bg-primary/25"
          >
            Sign in
          </button>
        </form>
      )}
    </div>
  );
}
