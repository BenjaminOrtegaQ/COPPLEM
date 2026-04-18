import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import "./styles.css";

if (window.api?.onOpenLoginFromMain) {
  window.api.onOpenLoginFromMain((slug: string) => {
    const target = `#/login/${encodeURIComponent(slug)}`;

    if (location.hash !== target) {
      location.hash = target;
    } else {
      location.reload();
    }
  });
}

(function handleLoginSlugFromMain() {
  const sp = new URLSearchParams(window.location.search);
  const slug = sp.get("loginSlug");
  if (!slug) return;

  const target = `#/login/${encodeURIComponent(slug)}`;

  const url = new URL(window.location.href);
  url.searchParams.delete("loginSlug");
  history.replaceState({}, "", url.pathname + url.search + url.hash);

  if (location.hash !== target) {
    location.hash = target;
  }
})();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
