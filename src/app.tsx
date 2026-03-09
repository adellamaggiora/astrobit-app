import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { createEffect, on, Suspense } from "solid-js";
import "./app.css";
import Notifier from "./components/Notifier";
import Spinner from "./components/Spinner";
import store from "./store/store";
import toolbarRoutes from "./toolbar-routes";
import { AppTheme } from "./models/app-theme";
import Toolbar from "./components/Toolbar";

const themes = Object.values(AppTheme);

export default function App() {

  createEffect(
    on(
      () => store.get.appConfig?.theme,
      (theme: AppTheme) => {
        if (!theme || typeof document === "undefined") return
        document.documentElement.setAttribute("data-theme", theme)
      }
    )
  )

  return (
    <Router
      root={(props) => (
        <div class="min-h-screen w-full">
          <Notifier notification={store.get.notification} onClose={() => store.notification.clear()} />
          <Spinner spinner={store.get.spinner} />

          <Toolbar
            routes={toolbarRoutes()}
            themes={themes}
            selectedTheme={store.get.appConfig?.theme}
            onThemeChange={(theme) => store.theme.set(theme)}
          >
            <Suspense>{props.children}</Suspense>
          </Toolbar>
        </div>
      )}
    >
      <FileRoutes />
    </Router>
  );
}
