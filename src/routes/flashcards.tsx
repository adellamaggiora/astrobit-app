import { createAsync, useSearchParams } from "@solidjs/router";
import { createEffect, createMemo, createSignal, Show } from "solid-js";
import FlashcardsFilter from "~/components/FlashcardsFilter";
import FlashcardsList from "~/components/FlashcardsList";
import FlashcardViewer from "~/components/FlashcardViewer";
import notion from "~/lib/server/notion";
import { FlashcardsFilterValue } from "~/models/flashcard-filter-value";
import store from "~/store/store";

type AtomSummary = {
  id: string;
  name: string;
  type?: string;
  courseIds: string[];
};

export default function FlashcardsPage() {
  const [searchParams] = useSearchParams();
  const atomTypes = createAsync(() => notion.getAtomsDb());
  const courses = createAsync(() => notion.getAtomsCourses());
  const flashcardCache = new Map<string, any>();

  const [filters, setFilters] = createSignal<FlashcardsFilterValue>({});
  const filtersKey = createMemo(
    () => `${filters().type?.trim() || ""}::${filters().course?.trim() || ""}`
  );

  const [cursor, setCursor] = createSignal<string | undefined>();
  const [nextCursor, setNextCursor] = createSignal<string | undefined>();
  const [hasMore, setHasMore] = createSignal(false);
  const [isLoadingMore, setIsLoadingMore] = createSignal(false);
  const [hasLoadedFirstPage, setHasLoadedFirstPage] = createSignal(false);
  const [atoms, setAtoms] = createSignal<AtomSummary[]>([]);
  const [orderedIds, setOrderedIds] = createSignal<string[]>([]);
  const [selectedId, setSelectedId] = createSignal<string | undefined>();
  const [listScrollResetCounter, setListScrollResetCounter] = createSignal(0);
  const [isFlipped, setIsFlipped] = createSignal(false);
  const [pendingFlashcardRequests, setPendingFlashcardRequests] = createSignal(0);

  const atomsPage = createAsync(async () => {
    const requestCursor = cursor();
    const requestFiltersKey = filtersKey();
    const response = await notion.getAtoms(filters().type, filters().course, requestCursor);

    return {
      ...response,
      requestCursor,
      requestFiltersKey
    };
  });

  createEffect(() => {
    filters();
    setCursor(undefined);
    setNextCursor(undefined);
    setHasMore(false);
    setIsLoadingMore(false);
    setHasLoadedFirstPage(false);
    setAtoms([]);
    setOrderedIds([]);
    setSelectedId(undefined);
    setIsFlipped(false);
    flashcardCache.clear();
  });

  createEffect(() => {
    const page = atomsPage();
    if (!page) return;
    if (page.requestFiltersKey !== filtersKey()) return;

    const incoming = page.results || [];
    const incomingIds = incoming.map((item: AtomSummary) => item.id);

    setHasLoadedFirstPage(true);
    setHasMore(!!page.hasMore);
    setNextCursor(page.nextCursor);
    setIsLoadingMore(false);

    if (page.requestCursor) {
      setAtoms((prev) => {
        const seen = new Set(prev.map((item) => item.id));
        const uniqueIncoming = incoming.filter((item: AtomSummary) => !seen.has(item.id));
        return [...prev, ...uniqueIncoming];
      });

      setOrderedIds((prev) => {
        const seen = new Set(prev);
        const uniqueIncomingIds = incomingIds.filter((id) => !seen.has(id));
        return [...prev, ...uniqueIncomingIds];
      });
      return;
    }

    setAtoms(incoming);
    setOrderedIds(incomingIds);
  });

  const atomsById = createMemo(() => new Map(atoms().map((item) => [item.id, item])));

  createEffect(() => {
    const ids = orderedIds();
    const selected = selectedId();

    if (ids.length === 0) {
      setSelectedId(undefined);
      return;
    }

    if (!selected || !ids.includes(selected)) {
      setSelectedId(ids[0]);
    }
  });

  const currentAtom = createMemo(() => {
    const id = selectedId();
    return id ? atomsById().get(id) : undefined;
  });

  const flashcard = createAsync(async () => {
    const id = selectedId()?.trim();
    if (!id) return null;

    if (flashcardCache.has(id)) {
      return flashcardCache.get(id);
    }

    setPendingFlashcardRequests((prev) => prev + 1);
    try {
      const card = await notion.getFlashcardById(id);
      if (card) {
        flashcardCache.set(id, card);
      }
      return card;
    } finally {
      setPendingFlashcardRequests((prev) => Math.max(0, prev - 1));
    }
  });
  const flashcardData = createMemo(() => flashcard.latest ?? null);
  const isFlashcardLoading = createMemo(() => pendingFlashcardRequests() > 0);

  createEffect(() => {
    selectedId();
    setIsFlipped(false);
  });

  createEffect(() => {
    if (isFlashcardLoading() && selectedId()) {
      store.spinner.show("Caricamento flashcard...");
      return;
    }
    store.spinner.hide();
  });

  const currentIndex = createMemo(() => {
    const selected = selectedId();
    if (!selected) return -1;
    return orderedIds().indexOf(selected);
  });

  const canGoPrev = createMemo(() => currentIndex() > 0);
  const canGoNext = createMemo(
    () => currentIndex() >= 0 && currentIndex() < orderedIds().length - 1
  );

  const listItems = createMemo(() => {
    const byId = atomsById();
    return orderedIds().map((id) => ({
      id,
      title: byId.get(id)?.name || ""
    }));
  });

  const goPrev = () => {
    if (!canGoPrev()) return;
    const nextIndex = currentIndex() - 1;
    const nextId = orderedIds()[nextIndex];
    if (nextId) selectFlashcard(nextId);
  };

  const goNext = () => {
    if (!canGoNext()) return;
    const nextIndex = currentIndex() + 1;
    const nextId = orderedIds()[nextIndex];
    if (nextId) selectFlashcard(nextId);
  };

  const shuffleList = () => {
    const prev = orderedIds();
    if (prev.length < 2) return;

    const next = [...prev];
    for (let i = next.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [next[i], next[j]] = [next[j], next[i]];
    }

    const current = selectedId();
    const nextSelected = next.find((id) => id !== current) ?? next[0];

    setOrderedIds(next);
    setSelectedId(nextSelected);
    setListScrollResetCounter((prev) => prev + 1);
  };

  const loadMore = () => {
    const next = nextCursor();
    if (!next || !hasMore() || isLoadingMore()) return;
    setIsLoadingMore(true);
    setCursor(next);
  };

  const selectFlashcard = (id: string) => {
    const nextId = id.trim();
    if (!nextId || nextId === selectedId()) return;
    setSelectedId(nextId);
  };

  const openFlashcardById = (id: string) => {
    const nextId = id.trim();
    if (!nextId) return;

    setAtoms((prev) => {
      if (prev.some((item) => item.id === nextId)) return prev;
      return [...prev, { id: nextId, name: "", courseIds: [] }];
    });

    setOrderedIds((prev) => {
      if (prev.includes(nextId)) return prev;
      return [...prev, nextId];
    });

    selectFlashcard(nextId);
  };

  createEffect(() => {
    const id = typeof searchParams.card === "string" ? searchParams.card.trim() : "";
    if (!id) return;
    openFlashcardById(id);
  });

  return (
    <section class="space-y-5 pb-8">
      {/* <h1 class="text-3xl font-bold">Flashcards</h1> */}

      <FlashcardsFilter
        typeOptions={atomTypes() ?? []}
        courseOptions={courses() ?? []}
        value={filters()}
        onChange={(next) => setFilters(next)}
      />

      <div class="grid grid-cols-1 items-start gap-2">
        <div class="space-y-3">
          <div class="w-full space-y-3">
            <Show
              when={orderedIds().length > 0}
              fallback={
                <div class="academic-surface rounded border p-4 text-sm text-base-content/80">
                  {hasLoadedFirstPage()
                    ? "Nessuna flashcard trovata con i filtri selezionati."
                    : "Caricamento flashcard..."}
                </div>
              }
            >
              <Show
                when={flashcardData()}
                fallback={
                  <div class="academic-surface rounded border p-4 text-sm text-base-content/80">
                    Caricamento flashcard...
                  </div>
                }
              >
                {(card) => (
                  <div class="space-y-2">
                    {/* <Show when={isFlashcardLoading()}>
                      <p class="text-xs text-base-content/60">Aggiornamento flashcard...</p>
                    </Show> */}
                    <FlashcardViewer
                      front={card()?.name || currentAtom()?.name || ""}
                      back={card()?.content || ""}
                      type={card()?.type || currentAtom()?.type}
                      isFlipped={isFlipped()}
                      onFlip={() => setIsFlipped((prev) => !prev)}
                      canGoPrev={canGoPrev()}
                      canGoNext={canGoNext()}
                      canShuffle={orderedIds().length > 1}
                      onPrev={goPrev}
                      onNext={goNext}
                      onShuffle={shuffleList}
                      onOpenFlashcard={openFlashcardById}
                    />
                  </div>
                )}
              </Show>
            </Show>
          </div>
        </div>

        <aside class="space-y-2">
          <FlashcardsList
            items={listItems()}
            selectedId={selectedId()}
            hasMore={hasMore()}
            isLoadingInitial={!hasLoadedFirstPage()}
            isLoadingMore={isLoadingMore()}
            scrollToTopTrigger={listScrollResetCounter()}
            onSelect={selectFlashcard}
            onLoadMore={loadMore}
          />
        </aside>
      </div>
    </section>
  );
}
