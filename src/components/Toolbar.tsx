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

    return (
        <div class="min-h-screen">
            <header class="navbar fixed top-0 z-50 !h-14 !min-h-14 bg-base-200 py-0 sm:!h-16 sm:!min-h-16">
                <div class="flex min-w-0 flex-1 items-center gap-2 px-4">
                    <div class="mr-2 min-w-0 flex flex-col leading-tight">
                        <span class="block truncate whitespace-nowrap font-semibold text-base sm:text-lg">
                            {dbTitle()}
                            {dbEmojis() ? ` ${dbEmojis()}` : ""}
                        </span>
                        <span class="hidden truncate text-xs italic text-base-content/70 sm:block">
                            {dbTagline()}
                        </span>
                    </div>
                    <For each={props.routes}>
                        {(r) => (
                            <A
                                href={r.path}
                                class={`btn btn-sm shrink-0 gap-2 ${isRouteActive(r.path)
                                    ? "btn-primary text-primary-content"
                                    : "btn-ghost"
                                    }`}
                            >
                                {r.icon && <r.icon class="w-5 h-5" />}
                                <span>{r.label}</span>
                            </A>
                        )}
                    </For>
                </div>
                <div class="flex shrink-0 items-center gap-2 px-4">
                    {props.themes && props.themes.length > 0 && (
                        <select
                            class="select select-sm select-bordered"
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
                                {(theme) => <option value={theme}>{theme}</option>}
                            </For>
                        </select>
                    )}
                </div>
            </header>

            <main class="pt-16 container mx-auto px-4">
                {props.children}
            </main>
        </div>
    );
};

export default Toolbar;
