import { createAsync } from "@solidjs/router";
import { createEffect, createMemo, createResource, createSignal, For, Show } from "solid-js";
import { FiFileText, FiFolder } from "solid-icons/fi";
import CoursesList from "~/components/CoursesList";
import NotionMarkdown from "~/components/NotionMarkdown";
import notion from "~/lib/server/notion";
import store from "~/store/store";

type CourseAtom = {
  id: string;
  name: string;
  type?: string;
  order?: number;
  sectionNames?: string[];
  sectionIds?: string[];
  relationIds?: string[];
};

type CourseSection = {
  id: string;
  name: string;
  order?: number;
  relationIds?: string[];
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

const sortByOrder = <T extends { name?: string; order?: number }>(items: T[]) =>
  [...items].sort((a, b) => {
    if (a.order !== undefined && b.order !== undefined && a.order !== b.order) {
      return a.order - b.order;
    }
    if (a.order !== undefined) return -1;
    if (b.order !== undefined) return 1;

    return (a.name || "").localeCompare(b.name || "", "it");
  });

const atomBelongsToSection = (
  atom: CourseAtom,
  section: { id: string; name: string; relationIds?: string[] }
) => {
  return (
    atom.sectionIds?.includes(section.id) ||
    atom.relationIds?.includes(section.id) ||
    section.relationIds?.includes(atom.id)
  );
};

const groupByType = (items: CourseAtom[], fallbackTitle: string): CourseGroup[] => {
  const groups = new Map<string, CourseAtom[]>();

  for (const item of sortByOrder(items)) {
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
    <details class="academic-surface rounded border" open={props.open}>
      <summary class="flex cursor-pointer list-none items-center gap-3 px-3 py-3">
        <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-base-300 bg-base-100 text-primary">
          {props.icon === "file" ? <FiFileText class="h-4 w-4" /> : <FiFolder class="h-4 w-4" />}
        </span>
        <span class="min-w-0 flex-1 break-words text-sm font-bold">{props.title}</span>
        <Show when={props.count !== undefined}>
          <span class="badge badge-outline shrink-0">{props.count}</span>
        </Show>
      </summary>
      <div class="space-y-2 border-t academic-rule bg-base-100 p-3">{props.children}</div>
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
        class={`flex min-h-11 w-full items-center gap-3 rounded border px-3 py-2 text-left text-sm transition-colors ${
          isSelected()
            ? "border-primary bg-primary text-primary-content"
            : "border-base-300 bg-base-100 hover:border-primary/50 hover:bg-base-200/50"
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
    <div class="rounded border border-base-300 bg-base-100 p-3">
      <Show
        when={props.card}
        fallback={<p class="text-sm text-base-content/60">Caricamento flashcard...</p>}
      >
        {(card) => (
          <div class="space-y-3">
            <div>
              <p class="text-xs font-bold uppercase tracking-[0.08em] text-base-content/50">
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

  const [selectedFlashcard] = createResource(selectedAtomId, async (selectedId) => {
    const id = selectedId?.trim();
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
  const sectionSource = createMemo<
    { id: string; name: string; order?: number; relationIds?: string[] }[]
  >(
    () => course()?.sections || []
  );
  const resources = createMemo<CourseAtom[]>(() => course()?.resources || []);

  const courseSections = createMemo<CourseSection[]>(() => {
    const sectionAtoms = atoms().filter((atom) => !isResourceAtom(atom));
    const used = new Set<string>();
    const sections = sortByOrder(sectionSource()).map((section) => {
      const items = sectionAtoms.filter((atom) => atomBelongsToSection(atom, section));
      for (const item of items) used.add(item.id);
      return {
        ...section,
        atoms: sortByOrder(items)
      };
    }).filter((section) => section.atoms.length > 0);

    const unassigned = sectionAtoms.filter((atom) => !used.has(atom.id));
    const result = [...sections];

    if (unassigned.length > 0) {
      result.push({
        id: "unassigned-atoms",
        name: "Senza sezione",
        atoms: sortByOrder(unassigned)
      });
    }

    return result;
  });

  const resourceGroups = createMemo(() => {
    const viewResources = resources();
    if (viewResources.length > 0) return groupByType(viewResources, "Risorse");
    return groupByType(atoms().filter(isResourceAtom), "Risorse");
  });
  const courseAtomCount = createMemo(() =>
    courseSections().reduce((total, section) => total + section.atoms.length, 0)
  );
  const resourceCount = createMemo(() =>
    resourceGroups().reduce((total, group) => total + group.items.length, 0)
  );

  const selectAtom = (id: string) => {
    const scrollTop = typeof window === "undefined" ? undefined : window.scrollY;
    setSelectedAtomId((current) => (current === id ? undefined : id));

    if (scrollTop === undefined) return;
    requestAnimationFrame(() => {
      window.scrollTo({ top: scrollTop });
    });
  };

  return (
    <section class="space-y-4 pb-24">
      <div>
        <CoursesList
          items={courses() ?? []}
          selectedId={selectedId()}
          isLoading={!courses()}
          onSelect={setSelectedId}
        />
      </div>

      <Show
        when={course()}
        fallback={
          <div class="text-sm text-base-content/70">
            Seleziona un corso dall'elenco.
          </div>
        }
      >
        {() => (
          <article class="min-w-0 space-y-3">
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
                                <FlashcardInline
                                  card={selectedFlashcard()}
                                  isLoading={selectedFlashcard.loading}
                                />
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

            {/* <Accordion title="Risorse" count={resourceCount()} icon="folder">
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
                              <FlashcardInline
                                card={selectedFlashcard()}
                                isLoading={selectedFlashcard.loading}
                              />
                            </AtomButton>
                          )}
                        </For>
                      </div>
                    </Accordion>
                  )}
                </For>
              </Show>
            </Accordion> */}
          </article>
        )}
      </Show>
    </section>
  );
}
