import { createAsync } from "@solidjs/router";
import { For, ParentComponent, createMemo } from "solid-js";
import { A, useLocation } from "@solidjs/router";
import { ToolbarRoute } from "~/models/toolbar-route";
import { AppTheme } from "~/models/app-theme";
import notion from "~/lib/server/notion";


const Toolbar: ParentComponent<{
    routes: ToolbarRoute[];
    themes?: AppTheme[];
    selectedTheme?: AppTheme;
    onThemeChange?: (theme: AppTheme) => void;
}> = (props) => {
    const db = createAsync(() => notion.getDb());
    const location = useLocation();

    const dbTitle = createMemo(() => {
        const title = db.latest?.title;
        if (typeof title === "string") return title || "Astrobit";

        return (title || [])
            .map((item: any) => item?.plain_text)
            .join("")
            .trim() || "Astrobit";
    });

    const dbDescription = createMemo(() => {
        const description = db.latest?.description;
        if (typeof description === "string") return description;

        return (description || [])
            .map((item: any) => item?.plain_text)
            .join(" ")
            .trim();
    });

    const dbEmojis = createMemo(() => {
        const matches = dbDescription().match(/\p{Extended_Pictographic}/gu) || [];
        return matches.join("");
    });

    const dbTagline = createMemo(() =>
        dbDescription()
            .replace(/\p{Extended_Pictographic}/gu, "")
            .trim()
    );

    const isRouteActive = (path: string) => {
        const pathname = location.pathname;
        if (path === "/") return pathname === "/";
        return pathname === path || pathname.startsWith(`${path}/`);
    };

    const themeLabel = (theme: AppTheme) => {
        if (theme === AppTheme.Emerald) return "light";
        if (theme === AppTheme.Forest) return "dark";
        return theme;
    };

    return (
        <div class="min-h-screen">
            <header class="fixed top-0 z-50 w-full border-b border-base-300 bg-base-200/95 backdrop-blur">
                <div class="mx-auto flex min-h-12 max-w-7xl items-center gap-2 px-3 py-1.5 sm:min-h-14 sm:px-4">
                    <div class="min-w-0 flex-1 leading-tight sm:max-w-xs">
                        <span class="block truncate whitespace-nowrap text-sm font-semibold sm:text-base">
                            {dbTitle()}
                            {dbEmojis() ? ` ${dbEmojis()}` : ""}
                        </span>
                        <span class="hidden truncate text-xs italic text-base-content/70 sm:block">
                            {dbTagline()}
                        </span>
                    </div>
                    <nav class="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-1">
                        <For each={props.routes}>
                            {(r) => (
                                <A
                                    href={r.path}
                                    class={`btn btn-xs shrink-0 gap-1.5 sm:btn-sm ${isRouteActive(r.path)
                                        ? "btn-primary text-primary-content"
                                        : "btn-ghost"
                                        }`}
                                >
                                    {r.icon && <r.icon class="h-4 w-4 sm:h-5 sm:w-5" />}
                                    <span>{r.label}</span>
                                </A>
                            )}
                        </For>
                    </nav>
                    <div class="flex shrink-0 items-center gap-2">
                    {props.themes && props.themes.length > 0 && (
                        <select
                            class="select select-bordered select-xs sm:select-sm"
                            value={props.selectedTheme ?? ""}
                            onChange={(event) => {
                                const theme = event.currentTarget.value as AppTheme;
                                if (props.themes?.includes(theme)) props.onThemeChange?.(theme);
                            }}
                        >
                            <option value="" disabled>
                                Theme
                            </option>
                            <For each={props.themes}>
                                {(theme) => <option value={theme}>{themeLabel(theme)}</option>}
                            </For>
                        </select>
                    )}
                    </div>
                </div>
            </header>

            <main class="container mx-auto px-3 pt-14 sm:px-4 sm:pt-16">
                {props.children}
            </main>
        </div>
    );
};

export default Toolbar;
