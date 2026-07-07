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
    <Show
      when={props.items.length > 0}
      fallback={
        <div class="rounded-lg border border-dashed border-base-300 bg-base-200/30 p-3 text-sm text-base-content/70">
          {props.isLoading ? "Caricamento corsi..." : "Nessun corso trovato."}
        </div>
      }
    >
      <label class="form-control w-full">
        <span class="label pb-1">
          <span class="label-text text-xs font-bold uppercase tracking-[0.08em] text-base-content/60">
            Corso
          </span>
        </span>
        <select
          class="select select-bordered w-full bg-base-100"
          value={props.selectedId || ""}
          onChange={(event) => props.onSelect(event.currentTarget.value)}
        >
          <For each={props.items}>
            {(item) => (
              <option value={item.id}>
                {item.name || "Senza titolo"}
              </option>
            )}
          </For>
        </select>
      </label>
    </Show>
  );
}
