import { For } from "solid-js";
import { FlashcardsFilterValue } from "~/models/flashcard-filter-value";


export default function FlashcardsFilter(props: {
  typeOptions: string[];
  courseOptions?: { id: string; name: string }[];
  value: FlashcardsFilterValue;
  onChange: (next: FlashcardsFilterValue) => void;
}) {
  return (
    <div class="grid grid-cols-2 gap-2 md:gap-3">
      <label class="form-control min-w-0">
        <span class="label-text mb-1 text-sm">Tipologia</span>
        <select
          class="select select-bordered select-sm w-full min-w-0 md:select-md"
          value={props.value.type ?? ""}
          onInput={(event) =>
            props.onChange({
              ...props.value,
              type: event.currentTarget.value || undefined
            })
          }
        >
          <option value="">Tutte</option>
          <For each={props.typeOptions}>
            {(type) => <option value={type}>{type}</option>}
          </For>
        </select>
      </label>

      <label class="form-control min-w-0">
        <span class="label-text mb-1 text-sm">Corso</span>
        <select
          class="select select-bordered select-sm w-full min-w-0 md:select-md"
          value={props.value.course ?? ""}
          onInput={(event) =>
            props.onChange({
              ...props.value,
              course: event.currentTarget.value || undefined
            })
          }
        >
          <option value="">Tutti</option>
          <For each={props.courseOptions ?? []}>
            {(course) => <option value={course.id}>{course.name}</option>}
          </For>
        </select>
      </label>
    </div>
  );
}
