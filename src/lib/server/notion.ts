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

const getOptionalIds = (...keys: string[]) =>
  keys
    .flatMap((key) => (process.env[key] || "").split(","))
    .map((id) => id.trim())
    .filter(Boolean);

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

const normalizeKey = (value?: string) =>
  (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const SECTION_PROPERTY_KEYS = [
  "sezione",
  "section",
  "modulo",
  "module",
  "capitolo",
  "chapter",
  "unita",
  "unit",
  "lezione",
  "lesson"
];

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

const getTypeText = (properties: any) => {
  const explicitType = getPropertyById(properties, TYPE_PROPERTY_ID);
  const explicitTypeValue = propertyValueToText(explicitType);
  if (explicitTypeValue) return explicitTypeValue;

  const namedType = Object.entries<any>(properties || {}).find(([name, property]) => {
    const normalizedName = normalizeKey(name);
    return (
      ["tipologia", "tipo", "type", "categoria"].some((key) => normalizedName.includes(key)) &&
      ["select", "status", "multi_select", "rich_text"].includes(property?.type)
    );
  });

  const namedTypeValue = namedType ? propertyValueToText(namedType[1]) : "";
  if (namedTypeValue) return namedTypeValue;

  const firstOptionProperty = Object.values<any>(properties || {}).find((property) =>
    ["select", "status", "multi_select"].includes(property?.type)
  );

  return propertyValueToText(firstOptionProperty);
};

const splitPropertyLabels = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const getSectionNames = (properties: any) => {
  const names = Object.entries<any>(properties || {})
    .filter(([name, property]) => {
      const normalizedName = normalizeKey(name);
      return (
        SECTION_PROPERTY_KEYS.some((key) => normalizedName.includes(key)) &&
        ["select", "status", "multi_select", "rich_text"].includes(property?.type)
      );
    })
    .flatMap(([, property]) => splitPropertyLabels(propertyValueToText(property)));

  return [...new Set(names)];
};

const mapAtomRow = (row: any) => {
  const titleProperty = getTitleProperty(row?.properties);
  const courseProperty = getPropertyById(row?.properties, COURSE_PROPERTY_ID);

  return {
    id: row.id,
    name: titleProperty?.title?.map((item: any) => item?.plain_text).join("") ?? "",
    type: getTypeText(row?.properties),
    sectionNames: getSectionNames(row?.properties),
    courseIds: (courseProperty?.relation || []).map((course: any) => course?.id),
    relationIds: getAllRelationIds(row?.properties),
    properties: summarizeProperties(row?.properties)
  };
};

const mapCourseViewRow = (row: any) => {
  const titleProperty = getTitleProperty(row?.properties);

  return {
    id: row.id,
    name: titleProperty?.title?.map((item: any) => item?.plain_text).join("").trim() ?? "",
    type: getTypeText(row?.properties),
    relationIds: getAllRelationIds(row?.properties),
    properties: summarizeProperties(row?.properties)
  };
};

const blockTitle = (block: any) => {
  const type = block?.type;
  const payload = type ? block?.[type] : undefined;
  return (
    payload?.title ||
    payload?.caption?.map((item: any) => item?.plain_text).join("") ||
    payload?.rich_text?.map((item: any) => item?.plain_text).join("") ||
    ""
  ).trim();
};

const extractChildPageSections = (blocks: any[] = []) => {
  const seen = new Set<string>();
  const sections: { id: string; name: string; relationIds: string[] }[] = [];

  for (const block of blocks) {
    if (block?.type !== "child_page") continue;

    const id = block.id;
    const name = blockTitle(block);
    if (!id || !name || seen.has(id)) continue;

    seen.add(id);
    sections.push({ id, name, relationIds: [] });
  }

  return sections;
};

const findCourseViewBlocks = (blocks: any[] = [], key: "sections" | "resources") => {
  const matchers =
    key === "sections"
      ? ["sezioni", "section"]
      : ["risorse", "resources", "materiale", "materiali"];

  return blocks.filter((block) => {
    if (block?.type !== "child_database") return false;
    const title = normalizeKey(blockTitle(block));
    return matchers.some((matcher) => title.includes(matcher));
  });
};

const queryAllDataSourceRows = async (dataSourceId: string) => {
  const notion = getNotion();
  let hasMore = true;
  let nextCursor: string | undefined;
  const rows: any[] = [];

  while (hasMore) {
    const response: any = await notion.dataSources.query({
      data_source_id: dataSourceId,
      start_cursor: nextCursor,
      page_size: 100
    });

    rows.push(...(response.results || []));
    hasMore = !!response.has_more;
    nextCursor = response.next_cursor ?? undefined;
  }

  return rows;
};

const queryRowsFromDatabaseBlock = async (blockId: string) => {
  const notion = getNotion();
  const dataSourceIds: string[] = [];

  try {
    const database: any = await notion.databases.retrieve({ database_id: blockId });
    dataSourceIds.push(
      ...(database?.data_sources || []).map((dataSource: any) => dataSource?.id).filter(Boolean)
    );
  } catch {
    // Some Notion blocks can be queried directly as data sources.
  }

  if (dataSourceIds.length === 0) {
    dataSourceIds.push(blockId);
  }

  const rows: any[] = [];
  for (const dataSourceId of dataSourceIds) {
    try {
      rows.push(...(await queryAllDataSourceRows(dataSourceId)));
    } catch {
      // Linked database views may not expose their rows through the block id.
    }
  }

  return rows;
};

const queryRowsFromCourseViews = async (
  blocks: any[],
  key: "sections" | "resources",
  courseId: string
) => {
  const seen = new Set<string>();
  const rows: any[] = [];
  const configuredIds =
    key === "sections"
      ? getOptionalIds("NOTION_SECTIONS_ID", "NOTION_SECTIONS_DATABASE_ID")
      : getOptionalIds("NOTION_RESOURCES_ID", "NOTION_RESOURCES_DATABASE_ID");

  for (const block of findCourseViewBlocks(blocks, key)) {
    const blockRows = await queryRowsFromDatabaseBlock(block.id);
    for (const row of blockRows.map(mapCourseViewRow)) {
      if (!row.id || seen.has(row.id)) continue;
      seen.add(row.id);
      rows.push(row);
    }
  }

  for (const configuredId of configuredIds) {
    const configuredRows = await queryRowsFromDatabaseBlock(configuredId);
    for (const row of configuredRows.map(mapCourseViewRow)) {
      if (!row.id || seen.has(row.id)) continue;
      seen.add(row.id);
      rows.push(row);
    }
  }

  const namedRows = rows.filter((row) => !!row.name);
  const rowsLinkedToCourse = namedRows.filter((row) => row.relationIds?.includes(courseId));

  return rowsLinkedToCourse.length > 0 ? rowsLinkedToCourse : namedRows;
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

  const [sectionRows, resourceRows] = await Promise.all([
    queryRowsFromCourseViews(content, "sections", courseId),
    queryRowsFromCourseViews(content, "resources", courseId)
  ]);

  return {
    id: page.id,
    name: getTitleProperty(page?.properties)?.title?.map((item: any) => item?.plain_text).join("") ?? "",
    properties: summarizeProperties(page?.properties),
    sections: sectionRows.length > 0 ? sectionRows : extractChildPageSections(content),
    resources: resourceRows,
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
    type: getTypeText(page?.properties),
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
