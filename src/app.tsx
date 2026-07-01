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
import PwaInstallPrompt from "./components/PwaInstallPrompt";

const themes = Object.values(AppTheme);
const resolveTheme = (theme?: AppTheme) =>
  theme === AppTheme.Forest ? AppTheme.Forest : AppTheme.Emerald;

export default function App() {

  createEffect(
    on(
      () => store.get.appConfig?.theme,
      (theme: AppTheme) => {
        if (typeof document === "undefined") return
        document.documentElement.setAttribute("data-theme", resolveTheme(theme))
      }
    )
  )

  return (
    <Router
      root={(props) => (
        <div class="min-h-screen w-full">
          <Notifier notification={store.get.notification} onClose={() => store.notification.clear()} />
          <Spinner spinner={store.get.spinner} />
          <PwaInstallPrompt />

          <Toolbar
            routes={toolbarRoutes()}
            themes={themes}
            selectedTheme={resolveTheme(store.get.appConfig?.theme)}
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
