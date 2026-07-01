import { createAsync } from "@solidjs/router";
import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import { FiFileText, FiFolder, FiLock } from "solid-icons/fi";
import CoursesList from "~/components/CoursesList";
import NotionMarkdown from "~/components/NotionMarkdown";
import notion from "~/lib/server/notion";
import store from "~/store/store";

type CourseAtom = {
  id: string;
  name: string;
  type?: string;
  relationIds?: string[];
};

type CourseSection = {
  id: string;
  name: string;
  atoms: CourseAtom[];
};

type CourseGroup = {
  title: string;
  items: CourseAtom[];
};

const RESOURCE_TYPE_PATTERNS = [
  "appunti",
  "cheatsheet",
  "dispensa",
  "esame",
  "esercizio",
  "libro",
  "prova",
  "repository",
  "ricevimento",
  "sito",
  "risorsa",
  "materiale"
];

const normalizeText = (value?: string) =>
  (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const isResourceAtom = (atom: CourseAtom) => {
  const value = normalizeText(`${atom.type || ""} ${atom.name || ""}`);
  return RESOURCE_TYPE_PATTERNS.some((pattern) => value.includes(pattern));
};

const sortByName = (items: CourseAtom[]) =>
  [...items].sort((a, b) => (a.name || "").localeCompare(b.name || "", "it"));

const groupByType = (items: CourseAtom[], fallbackTitle: string): CourseGroup[] => {
  const groups = new Map<string, CourseAtom[]>();

  for (const item of sortByName(items)) {
    const key = item.type?.trim() || fallbackTitle;
    groups.set(key, [...(groups.get(key) || []), item]);
  }

  return [...groups.entries()]
    .map(([title, groupItems]) => ({ title, items: groupItems }))
    .sort((a, b) => a.title.localeCompare(b.title, "it"));
};

function Accordion(props: {
  title: string;
  count?: number;
  icon?: "file" | "folder";
  open?: boolean;
  children: any;
}) {
  return (
    <details class="rounded-lg border border-base-300 bg-base-100 shadow-sm" open={props.open}>
      <summary class="flex cursor-pointer list-none items-center gap-3 px-3 py-3">
        <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-base-200 text-base-content/70">
          {props.icon === "file" ? <FiFileText class="h-4 w-4" /> : <FiFolder class="h-4 w-4" />}
        </span>
        <span class="min-w-0 flex-1 break-words text-sm font-semibold">{props.title}</span>
        <Show when={props.count !== undefined}>
          <span class="badge badge-ghost shrink-0">{props.count}</span>
        </Show>
      </summary>
      <div class="space-y-2 border-t border-base-300 bg-base-200/30 p-3">{props.children}</div>
    </details>
  );
}

function AtomButton(props: {
  item: CourseAtom;
  selectedId?: string;
  onSelect: (id: string) => void;
  children?: any;
}) {
  const isSelected = () => props.selectedId === props.item.id;

  return (
    <div class="space-y-2">
      <button
        type="button"
        class={`flex min-h-11 w-full items-center gap-3 rounded-md border px-3 py-2 text-left text-sm transition-colors ${
          isSelected()
            ? "border-primary bg-primary text-primary-content"
            : "border-base-300 bg-base-100 hover:bg-base-200"
        }`}
        onClick={() => props.onSelect(props.item.id)}
      >
        <FiFileText class="h-4 w-4 shrink-0 opacity-70" />
        <span class="min-w-0 flex-1 break-words">{props.item.name || "Senza titolo"}</span>
      </button>
      <Show when={isSelected()}>{props.children}</Show>
    </div>
  );
}

function FlashcardInline(props: { card: any; isLoading?: boolean }) {
  return (
    <div class="rounded-lg border border-base-300 bg-base-100 p-3">
      <Show
        when={props.card}
        fallback={<p class="text-sm text-base-content/60">Caricamento flashcard...</p>}
      >
        {(card) => (
          <div class="space-y-3">
            <div>
              <p class="text-xs font-semibold uppercase tracking-wide text-base-content/50">
                Flashcard
              </p>
              <h4 class="break-words text-base font-semibold">{card().name || "Senza titolo"}</h4>
              <Show when={card().type}>
                <span class="badge badge-ghost mt-2">{card().type}</span>
              </Show>
            </div>
            <NotionMarkdown content={card().content || ""} class="text-sm leading-relaxed" />
          </div>
        )}
      </Show>
    </div>
  );
}

export default function CoursesPage() {
  const courses = createAsync(() => notion.getCourses());
  const [selectedId, setSelectedId] = createSignal<string | undefined>();
  const [selectedAtomId, setSelectedAtomId] = createSignal<string | undefined>();

  createEffect(() => {
    const firstCourse = courses()?.[0];
    if (!selectedId() && firstCourse?.id) {
      setSelectedId(firstCourse.id);
    }
  });

  createEffect(() => {
    selectedId();
    setSelectedAtomId(undefined);
  });

  const course = createAsync(async () => {
    const id = selectedId()?.trim();
    if (!id) return null;
    return notion.getCourseById(id);
  });

  const selectedFlashcard = createAsync(async () => {
    const id = selectedAtomId()?.trim();
    if (!id) return null;
    return notion.getFlashcardById(id);
  });

  createEffect(() => {
    if (selectedId() && !course.latest) {
      store.spinner.show("Caricamento corso...");
      return;
    }
    store.spinner.hide();
  });

  const atoms = createMemo<CourseAtom[]>(() => course()?.atoms || []);
  const sectionSource = createMemo<{ id: string; name: string }[]>(() => course()?.sections || []);

  const courseSections = createMemo<CourseSection[]>(() => {
    const sectionAtoms = atoms().filter((atom) => !isResourceAtom(atom));
    const used = new Set<string>();
    const sections = sectionSource().map((section) => {
      const items = sectionAtoms.filter((atom) => atom.relationIds?.includes(section.id));
      for (const item of items) used.add(item.id);
      return {
        ...section,
        atoms: sortByName(items)
      };
    });

    const unassigned = sectionAtoms.filter((atom) => !used.has(atom.id));
    if (unassigned.length > 0) {
      sections.push({
        id: "unassigned",
        name: "Senza sezione",
        atoms: sortByName(unassigned)
      });
    }

    return sections;
  });

  const resourceGroups = createMemo(() => groupByType(atoms().filter(isResourceAtom), "Risorse"));
  const courseAtomCount = createMemo(() =>
    courseSections().reduce((total, section) => total + section.atoms.length, 0)
  );
  const resourceCount = createMemo(() =>
    resourceGroups().reduce((total, group) => total + group.items.length, 0)
  );

  const selectAtom = (id: string) => {
    setSelectedAtomId((current) => (current === id ? undefined : id));
  };

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
          <article class="min-w-0 space-y-4">
            <header class="rounded-lg border border-base-300 bg-base-100 p-4 shadow-sm md:p-5">
              <div class="flex flex-wrap items-start justify-between gap-3">
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
            </header>

            <Accordion title="Corso completo" count={courseAtomCount()} icon="file" open>
              <Show
                when={courseSections().length > 0}
                fallback={
                  <p class="text-sm text-base-content/60">
                    Nessuna sezione collegata a questo corso.
                  </p>
                }
              >
                <For each={courseSections()}>
                  {(section) => (
                    <Accordion title={section.name} count={section.atoms.length} icon="folder">
                      <Show
                        when={section.atoms.length > 0}
                        fallback={
                          <p class="text-sm text-base-content/60">
                            Nessuna flashcard in questa sezione.
                          </p>
                        }
                      >
                        <div class="space-y-2">
                          <For each={section.atoms}>
                            {(item) => (
                              <AtomButton
                                item={item}
                                selectedId={selectedAtomId()}
                                onSelect={selectAtom}
                              >
                                <FlashcardInline card={selectedFlashcard()} />
                              </AtomButton>
                            )}
                          </For>
                        </div>
                      </Show>
                    </Accordion>
                  )}
                </For>
              </Show>
            </Accordion>

            <Accordion title="Risorse" count={resourceCount()} icon="folder">
              <Show
                when={resourceGroups().length > 0}
                fallback={
                  <p class="text-sm text-base-content/60">
                    Nessuna risorsa collegata a questo corso.
                  </p>
                }
              >
                <For each={resourceGroups()}>
                  {(group) => (
                    <Accordion title={group.title} count={group.items.length} icon="folder">
                      <div class="space-y-2">
                        <For each={group.items}>
                          {(item) => (
                            <AtomButton
                              item={item}
                              selectedId={selectedAtomId()}
                              onSelect={selectAtom}
                            >
                              <FlashcardInline card={selectedFlashcard()} />
                            </AtomButton>
                          )}
                        </For>
                      </div>
                    </Accordion>
                  )}
                </For>
              </Show>
            </Accordion>
          </article>
        )}
      </Show>
    </section>
  );
}
