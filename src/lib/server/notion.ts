import { Client } from "@notionhq/client";
import { query } from "@solidjs/router";

const ATOMS_ID = "2a0752f1-f8bc-8115-9858-000b04b52557";
const COURSES_ID = "2a0752f1-f8bc-816f-aede-000b42a6a7af";
const TYPE_PROPERTY_ID = "vIEZ";
const COURSE_PROPERTY_ID = "emhw";

let notionClient: Client | undefined;

const hasNotionToken = () => !!process.env.NOTION_TOKEN?.trim();
const hasNotionDatabaseId = () => !!process.env.NOTION_DATABASE_ID?.trim();

const getNotion = () => {
  const token = process.env.NOTION_TOKEN?.trim();
  if (!token) {
    throw new Error("Missing NOTION_TOKEN environment variable");
  }

  if (!notionClient) {
    notionClient = new Client({ auth: token });
  }

  return notionClient;
};

const getDbId = () => {
  const id = process.env.NOTION_DATABASE_ID?.trim();
  if (!id) {
    throw new Error("Missing NOTION_DATABASE_ID environment variable");
  }
  return id;
};

const getPropertyById = (properties: any, id: string) =>
  Object.values<any>(properties || {}).find((property) => property?.id === id);

const getTitleProperty = (properties: any) =>
  Object.values<any>(properties || {}).find((property) => property?.type === "title");

const propertyValueToText = (property: any): string => {
  if (!property) return "";

  if (property.type === "select") return property.select?.name || "";
  if (property.type === "status") return property.status?.name || "";
  if (property.type === "multi_select") {
    return (property.multi_select || []).map((item: any) => item?.name).filter(Boolean).join(", ");
  }
  if (property.type === "number") return property.number == null ? "" : String(property.number);
  if (property.type === "date") {
    const start = property.date?.start;
    const end = property.date?.end;
    return [start, end].filter(Boolean).join(" - ");
  }
  if (property.type === "rich_text") {
    return (property.rich_text || []).map((item: any) => item?.plain_text).join("").trim();
  }
  if (property.type === "checkbox") return property.checkbox ? "Si" : "No";
  if (property.type === "url") return property.url || "";
  if (property.type === "email") return property.email || "";
  if (property.type === "phone_number") return property.phone_number || "";

  return "";
};

const summarizeProperties = (properties: any) =>
  Object.entries<any>(properties || [])
    .filter(([, property]) => property?.type !== "title")
    .map(([name, property]) => ({
      name,
      value: propertyValueToText(property)
    }))
    .filter((property) => !!property.value);

const getAllRelationIds = (properties: any) =>
  Object.values<any>(properties || {})
    .filter((property) => property?.type === "relation")
    .flatMap((property) => (property?.relation || []).map((item: any) => item?.id))
    .filter(Boolean);

const mapAtomRow = (row: any) => {
  const titleProperty = getTitleProperty(row?.properties);
  const typeProperty = getPropertyById(row?.properties, TYPE_PROPERTY_ID);
  const courseProperty = getPropertyById(row?.properties, COURSE_PROPERTY_ID);

  return {
    id: row.id,
    name: titleProperty?.title?.map((item: any) => item?.plain_text).join("") ?? "",
    type: typeProperty?.select?.name,
    courseIds: (courseProperty?.relation || []).map((course: any) => course?.id),
    relationIds: getAllRelationIds(row?.properties)
  };
};

const extractCourseSections = (blocks: any[] = []) => {
  const seen = new Set<string>();
  const sections: { id: string; name: string }[] = [];

  for (const block of blocks) {
    if (block?.type !== "child_page") continue;

    const id = block.id;
    const name = block.child_page?.title?.trim();
    if (!id || !name || seen.has(id)) continue;

    seen.add(id);
    sections.push({ id, name });
  }

  return sections;
};

const listAtomsForCourse = async (courseId: string) => {
  const notion = getNotion();
  let hasMore = true;
  let nextCursor: string | undefined;
  const results: any[] = [];

  while (hasMore) {
    const response: any = await notion.dataSources.query({
      data_source_id: ATOMS_ID,
      start_cursor: nextCursor,
      page_size: 100,
      filter: {
        property: COURSE_PROPERTY_ID,
        relation: { contains: courseId }
      }
    });

    results.push(...(response.results || []).map(mapAtomRow));
    hasMore = !!response.has_more;
    nextCursor = response.next_cursor ?? undefined;
  }

  return results;
};

const listAllBlockChildren = async (blockId: string): Promise<any[]> => {
  const notion = getNotion();
  let hasMore = true;
  let nextCursor: string | undefined;
  const allBlocks: any[] = [];

  while (hasMore) {
    const page: any = await notion.blocks.children.list({
      block_id: blockId,
      start_cursor: nextCursor,
      page_size: 100
    });

    for (const block of page.results || []) {
      allBlocks.push(block);
      if (block?.has_children) {
        const nestedChildren = await listAllBlockChildren(block.id);
        allBlocks.push(...nestedChildren);
      }
    }

    hasMore = !!page.has_more;
    nextCursor = page.next_cursor ?? undefined;
  }

  return allBlocks;
};

const getDb = query(async () => {
  "use server";
  if (!hasNotionToken() || !hasNotionDatabaseId()) {
    return {
      title: "Astrobit",
      description: "Configura NOTION_TOKEN e NOTION_DATABASE_ID per caricare i dati"
    };
  }

  const notion = getNotion();
  const db: any = await notion.databases.retrieve({
    database_id: getDbId()
  });

  return {
    title: db?.title?.map((item: any) => item?.plain_text).join("").trim() || "Astrobit",
    description:
      db?.description?.map((item: any) => item?.plain_text).join(" ").trim() || ""
  };
}, "notion-db-summary");

const getAtomsDb = query(async () => {
  "use server";
  if (!hasNotionToken()) return [];

  const notion = getNotion();
  return notion.dataSources
    .retrieve({
      data_source_id: ATOMS_ID
    })
    .then((_: any) =>
      _.properties?.Tipologia?.select?.options?.map((option: any) => option?.name)
    );
}, "atoms-table");

const getAtomsTypes = query(async (type?: string) => {
  "use server";
  if (!hasNotionToken()) return { results: [] };

  const notion = getNotion();
  const selectedType = type?.trim();

  return notion.dataSources.query({
    data_source_id: ATOMS_ID,
    ...(selectedType
      ? {
          filter: {
            property: TYPE_PROPERTY_ID,
            select: { equals: selectedType }
          }
        }
      : {})
  });
}, "atoms");

const getAtoms = query(async (type?: string, courseId?: string, cursor?: string) => {
  "use server";
  if (!hasNotionToken()) {
    return {
      hasMore: false,
      nextCursor: undefined,
      results: []
    };
  }

  const notion = getNotion();
  const selectedType = type?.trim();
  const selectedCourseId = courseId?.trim();

  const filters: any[] = [];

  if (selectedType) {
    filters.push({
      property: TYPE_PROPERTY_ID,
      select: { equals: selectedType }
    });
  }

  if (selectedCourseId) {
    filters.push({
      property: COURSE_PROPERTY_ID,
      relation: { contains: selectedCourseId }
    });
  }

  const response: any = await notion.dataSources.query({
    data_source_id: ATOMS_ID,
    start_cursor: cursor,
    page_size: 30,
    ...(filters.length > 1
      ? { filter: { and: filters } }
      : filters.length === 1
        ? { filter: filters[0] }
        : {})
  });

  return {
    hasMore: !!response.has_more,
    nextCursor: response.next_cursor ?? undefined,
    results: (response.results || []).map(mapAtomRow)
  };
}, "atoms-page");

const getAtomsCourses = query(async () => {
  "use server";
  if (!hasNotionToken()) return [];

  const notion = getNotion();

  return notion.dataSources
    .query({
      data_source_id: COURSES_ID,
      page_size: 100
    })
    .then((_: any) =>
      (_.results || [])
        .map((row: any) => {
          const titleProperty = getTitleProperty(row?.properties);
          const name = titleProperty?.title
            ?.map((item: any) => item?.plain_text)
            .join("")
            .trim();

          return {
            id: row.id,
            name
          };
        })
        .filter((course: any) => !!course?.name)
    );
}, "atoms-courses");

const getCourses = query(async () => {
  "use server";
  if (!hasNotionToken()) return [];

  const notion = getNotion();
  let hasMore = true;
  let nextCursor: string | undefined;
  const courses: any[] = [];

  while (hasMore) {
    const response: any = await notion.dataSources.query({
      data_source_id: COURSES_ID,
      start_cursor: nextCursor,
      page_size: 100
    });

    courses.push(
      ...(response.results || [])
        .map((row: any) => {
          const titleProperty = getTitleProperty(row?.properties);
          const name = titleProperty?.title
            ?.map((item: any) => item?.plain_text)
            .join("")
            .trim();

          return {
            id: row.id,
            name,
            properties: summarizeProperties(row?.properties)
          };
        })
        .filter((course: any) => !!course?.name)
    );

    hasMore = !!response.has_more;
    nextCursor = response.next_cursor ?? undefined;
  }

  return courses;
}, "courses");

const getCourseById = query(async (id: string) => {
  "use server";
  if (!hasNotionToken()) return null;

  const courseId = id?.trim();
  if (!courseId) return null;

  const notion = getNotion();
  const [page, content, atoms]: any = await Promise.all([
    notion.pages.retrieve({
      page_id: courseId
    }),
    listAllBlockChildren(courseId),
    listAtomsForCourse(courseId)
  ]);

  return {
    id: page.id,
    name: getTitleProperty(page?.properties)?.title?.map((item: any) => item?.plain_text).join("") ?? "",
    properties: summarizeProperties(page?.properties),
    sections: extractCourseSections(content),
    content,
    atoms
  };
}, "course-by-id");

const getFlashcardById = query(async (id: string) => {
  "use server";
  if (!hasNotionToken()) return null;

  const notion = getNotion();
  const flashcardId = id?.trim();

  if (!flashcardId) {
    return null;
  }

  const [page, content]: any = await Promise.all([
    notion.pages.retrieve({
      page_id: flashcardId
    }),
    listAllBlockChildren(flashcardId)
  ]);

  return {
    id: page.id,
    name: getTitleProperty(page?.properties)?.title?.map((item: any) => item?.plain_text).join("") ?? "",
    type: getPropertyById(page?.properties, TYPE_PROPERTY_ID)?.select?.name,
    courses:
      (getPropertyById(page?.properties, COURSE_PROPERTY_ID)?.relation || []).map(
        (course: any) => course?.id
      ),
    content
  };
}, "flashcard-by-id");

export default {
  getDb,
  getAtomsDb,
  getAtomsTypes,
  getAtoms,
  getAtomsCourses,
  getCourses,
  getCourseById,
  getFlashcardById
};
