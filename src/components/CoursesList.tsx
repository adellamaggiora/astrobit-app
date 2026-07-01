import { For, Show } from "solid-js";

export type CourseListItem = {
  id: string;
  name: string;
  properties?: { name: string; value: string }[];
};

export default function CoursesList(props: {
  items: CourseListItem[];
  selectedId?: string;
  isLoading?: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <div class="rounded-lg border border-base-300 bg-base-100 shadow-sm">
      <div class="max-h-[52vh] min-h-[220px] overflow-auto p-2">
        <Show
          when={props.items.length > 0}
          fallback={
            <div class="rounded-lg border border-dashed border-base-300 bg-base-200/30 p-3 text-sm text-base-content/70">
              {props.isLoading ? "Caricamento corsi..." : "Nessun corso trovato."}
            </div>
          }
        >
          <div class="overflow-hidden rounded-lg border border-base-300 divide-y divide-base-300">
            <For each={props.items}>
              {(item) => (
                <button
                  type="button"
                  class={`w-full px-3 py-3 text-left transition-colors ${
                    props.selectedId === item.id
                      ? "bg-primary text-primary-content"
                      : "bg-base-200/50 hover:bg-base-300/70"
                  }`}
                  onClick={() => props.onSelect(item.id)}
                >
                  <span class="block break-words text-sm font-semibold leading-snug">
                    {item.name || "Senza titolo"}
                  </span>
                  <Show when={item.properties?.[0]}>
                    {(property) => (
                      <span class="mt-1 block truncate text-xs opacity-70">
                        {property().name}: {property().value}
                      </span>
                    )}
                  </Show>
                </button>
              )}
            </For>
          </div>
        </Show>
      </div>
    </div>
  );
}
