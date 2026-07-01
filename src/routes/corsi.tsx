import { A, createAsync } from "@solidjs/router";
import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import { FiExternalLink, FiLock } from "solid-icons/fi";
import CoursesList from "~/components/CoursesList";
import NotionMarkdown from "~/components/NotionMarkdown";
import notion from "~/lib/server/notion";
import store from "~/store/store";

export default function CoursesPage() {
  const courses = createAsync(() => notion.getCourses());
  const [selectedId, setSelectedId] = createSignal<string | undefined>();

  createEffect(() => {
    const firstCourse = courses()?.[0];
    if (!selectedId() && firstCourse?.id) {
      setSelectedId(firstCourse.id);
    }
  });

  const course = createAsync(async () => {
    const id = selectedId()?.trim();
    if (!id) return null;
    return notion.getCourseById(id);
  });

  createEffect(() => {
    if (selectedId() && !course.latest) {
      store.spinner.show("Caricamento corso...");
      return;
    }
    store.spinner.hide();
  });

  const groupedAtoms = createMemo(() => {
    const groups = new Map<string, any[]>();
    for (const atom of course()?.atoms || []) {
      const key = atom.type || "Materiale";
      groups.set(key, [...(groups.get(key) || []), atom]);
    }
    return [...groups.entries()].map(([type, items]) => ({ type, items }));
  });

  return (
    <section class="grid grid-cols-1 gap-4 pb-24 lg:grid-cols-[20rem_minmax(0,1fr)]">
      <aside class="space-y-2">
        <div class="flex items-center justify-between">
          <h1 class="text-xl font-bold">Corsi</h1>
          <span class="badge badge-outline gap-1">
            <FiLock class="h-3.5 w-3.5" />
            Sola lettura
          </span>
        </div>
        <CoursesList
          items={courses() ?? []}
          selectedId={selectedId()}
          isLoading={!courses()}
          onSelect={setSelectedId}
        />
      </aside>

      <Show
        when={course()}
        fallback={
          <div class="rounded-lg border border-base-300 bg-base-100 p-4 text-sm text-base-content/70">
            Seleziona un corso dall'elenco.
          </div>
        }
      >
        {(selectedCourse) => (
          <article class="min-w-0 rounded-lg border border-base-300 bg-base-100 p-4 shadow-sm md:p-5">
            <div class="flex flex-wrap items-start justify-between gap-3 border-b border-base-300 pb-4">
              <div class="min-w-0">
                <h2 class="break-words text-2xl font-bold leading-tight md:text-3xl">
                  {selectedCourse().name || "Senza titolo"}
                </h2>
                <div class="mt-2 flex flex-wrap gap-2">
                  <For each={selectedCourse().properties}>
                    {(property) => (
                      <span class="badge badge-ghost h-auto max-w-full gap-1 py-1">
                        <span class="opacity-70">{property.name}</span>
                        <span class="min-w-0 truncate">{property.value}</span>
                      </span>
                    )}
                  </For>
                </div>
              </div>
              <span class="badge badge-outline gap-1">
                <FiLock class="h-3.5 w-3.5" />
                Non modificabile
              </span>
            </div>

            <Show when={(selectedCourse().content || []).length > 0}>
              <NotionMarkdown
                content={selectedCourse().content}
                class="mt-5 text-base leading-relaxed"
              />
            </Show>

            <Show when={groupedAtoms().length > 0}>
              <section class="mt-6 space-y-4">
                <h3 class="text-lg font-bold">Viste del corso</h3>
                <For each={groupedAtoms()}>
                  {(group) => (
                    <div class="rounded-lg border border-base-300 bg-base-200/30 p-3">
                      <h4 class="mb-2 text-sm font-semibold">{group.type}</h4>
                      <div class="grid grid-cols-1 gap-2 md:grid-cols-2">
                        <For each={group.items}>
                          {(item) => (
                            <A
                              href={`/flashcards?card=${item.id}`}
                              class="flex min-h-12 items-center justify-between gap-3 rounded-md border border-base-300 bg-base-100 px-3 py-2 text-sm transition-colors hover:bg-base-200"
                            >
                              <span class="min-w-0 truncate">{item.name || "Senza titolo"}</span>
                              <FiExternalLink class="h-4 w-4 shrink-0 opacity-60" />
                            </A>
                          )}
                        </For>
                      </div>
                    </div>
                  )}
                </For>
              </section>
            </Show>
          </article>
        )}
      </Show>
    </section>
  );
}
