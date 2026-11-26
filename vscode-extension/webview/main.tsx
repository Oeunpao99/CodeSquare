import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
// style.css is built separately by Tailwind and loaded via <link> in the host HTML.

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
