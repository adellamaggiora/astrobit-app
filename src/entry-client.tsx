// @refresh reload
import { mount, StartClient } from "@solidjs/start/client";

mount(() => <StartClient />, document.getElementById("app")!);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    if (!import.meta.env.PROD) {
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => registrations.forEach((registration) => registration.unregister()))
        .catch(() => {});
      return;
    }

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => registration.update())
      .catch(() => {
        // The app remains usable if the browser blocks service worker registration.
      });
  });
}
