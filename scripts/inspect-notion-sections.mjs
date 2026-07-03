import { Client } from "@notionhq/client";

const ATOMS_ID = "2a0752f1-f8bc-8115-9858-000b04b52557";
const COURSES_ID = "2a0752f1-f8bc-816f-aede-000b42a6a7af";
const COURSE_PROPERTY_ID = "emhw";
const SECTION_ID_ENV_KEYS = ["NOTION_SECTIONS_ID", "NOTION_SECTIONS_DATABASE_ID"];
const SECTION_PROPERTY_ID_ENV_KEYS = [
  "NOTION_ATOM_SECTION_PROPERTY_ID",
  "NOTION_SECTION_PROPERTY_ID",
  "NOTION_SECTIONS_PROPERTY_ID"
];
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

const notionToken = process.env.NOTION_TOKEN?.trim();
if (!notionToken) {
  console.error("Missing NOTION_TOKEN. Export it before running this inspection.");
  process.exit(2);
}

const notion = new Client({ auth: notionToken });

const normalizeKey = (value = "") =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const getEnvIds = (...keys) =>
  keys
    .flatMap((key) => (process.env[key] || "").split(","))
    .map((id) => id.trim())
    .filter(Boolean);

const titleFromProperties = (properties = {}) => {
  const titleProperty = Object.values(properties).find((property) => property?.type === "title");
  return titleProperty?.title?.map((item) => item?.plain_text).join("").trim() || "";
};

const propertyValueToText = (property) => {
  if (!property) return "";
  if (property.type === "select") return property.select?.name || "";
  if (property.type === "status") return property.status?.name || "";
  if (property.type === "multi_select") {
    return (property.multi_select || []).map((item) => item?.name).filter(Boolean).join(", ");
  }
  if (property.type === "rich_text") {
    return (property.rich_text || []).map((item) => item?.plain_text).join("").trim();
  }
  return "";
};

const getPropertyById = (properties, id) =>
  Object.values(properties || {}).find((property) => property?.id === id);

const getTypeText = (properties) => {
  const explicitTypeValue = propertyValueToText(getPropertyById(properties, "vIEZ"));
  if (explicitTypeValue) return explicitTypeValue;

  const namedType = Object.entries(properties || {}).find(([name, property]) => {
    const normalizedName = normalizeKey(name);
    return (
      ["tipologia", "tipo", "type", "categoria"].some((key) => normalizedName.includes(key)) &&
      ["select", "status", "multi_select", "rich_text"].includes(property?.type)
    );
  });

  return namedType ? propertyValueToText(namedType[1]) : "";
};

const isResourceAtom = (atom) => {
  const value = normalizeKey(`${atom.type || ""} ${atom.name || ""}`);
  return RESOURCE_TYPE_PATTERNS.some((pattern) => value.includes(pattern));
};

const resolveDataSourceIds = async (id) => {
  try {
    await notion.dataSources.retrieve({ data_source_id: id });
    return [id];
  } catch {
    // The configured value may be a database id instead of a data source id.
  }

  try {
    const database = await notion.databases.retrieve({ database_id: id });
    return (database?.data_sources || []).map((dataSource) => dataSource?.id).filter(Boolean);
  } catch {
    return [];
  }
};

const relationTargetIds = (property) =>
  [property?.relation?.data_source_id, property?.relation?.database_id].filter(Boolean);

const queryAllDataSourceRows = async (dataSourceId, query = {}) => {
  const rows = [];
  let hasMore = true;
  let nextCursor;

  while (hasMore) {
    const page = await notion.dataSources.query({
      data_source_id: dataSourceId,
      start_cursor: nextCursor,
      page_size: 100,
      ...query
    });

    rows.push(...(page.results || []));
    hasMore = !!page.has_more;
    nextCursor = page.next_cursor ?? undefined;
  }

  return rows;
};

const getSectionName = async (sectionId, cache) => {
  if (cache.has(sectionId)) return cache.get(sectionId);
  const page = await notion.pages.retrieve({ page_id: sectionId });
  const name = titleFromProperties(page?.properties) || sectionId;
  cache.set(sectionId, name);
  return name;
};

const inspectCourse = async (course, sectionPropertyIds, sectionNameCache, { showDistribution }) => {
  const courseId = course.id;
  const courseName = titleFromProperties(course?.properties) || courseId;
  const atoms = await queryAllDataSourceRows(ATOMS_ID, {
    filter: {
      property: COURSE_PROPERTY_ID,
      relation: { contains: courseId }
    }
  });

  const mappedAtoms = atoms.map((atom) => ({
    id: atom.id,
    name: titleFromProperties(atom?.properties),
    type: getTypeText(atom?.properties),
    sectionIds: Object.values(atom?.properties || {})
      .filter((property) => property?.type === "relation" && sectionPropertyIds.has(property.id))
      .flatMap((property) => (property?.relation || []).map((relation) => relation?.id))
      .filter(Boolean)
  }));
  const contentAtoms = mappedAtoms.filter((atom) => !isResourceAtom(atom));
  const resourceAtoms = mappedAtoms.filter(isResourceAtom);
  const unassignedAtoms = contentAtoms.filter((atom) => atom.sectionIds.length === 0);
  const sectionIds = [...new Set(contentAtoms.flatMap((atom) => atom.sectionIds))];
  const sectionNames = new Map();

  for (const sectionId of sectionIds) {
    sectionNames.set(sectionId, await getSectionName(sectionId, sectionNameCache));
  }

  console.log(
    `- ${courseName}: ${contentAtoms.length} atomi, ${sectionIds.length} sezioni, ${unassignedAtoms.length} senza sezione, ${resourceAtoms.length} risorse`
  );

  if (showDistribution) {
    console.log("\nSection distribution:");
    for (const [sectionId, sectionName] of sectionNames.entries()) {
      const count = contentAtoms.filter((atom) => atom.sectionIds.includes(sectionId)).length;
      console.log(`- ${sectionName} (${count})`);
    }
  }

  if (unassignedAtoms.length > 0) {
    console.log("\nUnassigned content atom samples:");
    for (const atom of unassignedAtoms.slice(0, 10)) {
      console.log(`- ${atom.name || atom.id}`);
    }
  }

  return {
    courseId,
    courseName,
    atomCount: contentAtoms.length,
    sectionCount: sectionIds.length,
    unassignedCount: unassignedAtoms.length,
    resourceCount: resourceAtoms.length
  };
};

const inspect = async () => {
  const configuredSectionIds = getEnvIds(...SECTION_ID_ENV_KEYS);
  const configuredSectionTargetIds = new Set(
    (await Promise.all(configuredSectionIds.map(resolveDataSourceIds))).flat().concat(configuredSectionIds)
  );
  const configuredPropertyIds = new Set(getEnvIds(...SECTION_PROPERTY_ID_ENV_KEYS));

  const atomsDataSource = await notion.dataSources.retrieve({ data_source_id: ATOMS_ID });
  const relationProperties = Object.values(atomsDataSource?.properties || {}).filter(
    (property) => property?.type === "relation"
  );

  console.log("Relation properties in Atomi:");
  for (const property of relationProperties) {
    console.log(
      `- ${property.name} (${property.id}) -> ${relationTargetIds(property).join(", ") || "unknown target"}`
    );
  }

  const sectionRelationProperties = relationProperties.filter((property) => {
    const normalizedName = normalizeKey(property.name || "");
    const targetIds = relationTargetIds(property);
    return (
      configuredPropertyIds?.has(property.id) ||
      targetIds.some((id) => configuredSectionTargetIds.has(id)) ||
      normalizedName.includes("sezion") ||
      normalizedName.includes("section")
    );
  });

  if (sectionRelationProperties.length === 0) {
    console.error("No section relation property found on Atomi.");
    process.exit(1);
  }

  console.log("\nSelected section relation properties:");
  for (const property of sectionRelationProperties) {
    console.log(`- ${property.name} (${property.id})`);
  }

  const testCourseId = process.env.NOTION_TEST_COURSE_ID?.trim();
  const courses = testCourseId
    ? [{ id: testCourseId, properties: {} }]
    : (await queryAllDataSourceRows(COURSES_ID)).filter((course) =>
        titleFromProperties(course?.properties)
      );

  if (courses.length === 0) {
    console.error("No course found to inspect.");
    process.exit(1);
  }

  const sectionPropertyIds = new Set(sectionRelationProperties.map((property) => property.id));
  const sectionNameCache = new Map();

  console.log(`\nCourses inspected: ${courses.length}`);
  const results = [];
  for (const course of courses) {
    results.push(
      await inspectCourse(course, sectionPropertyIds, sectionNameCache, {
        showDistribution: courses.length === 1
      })
    );
  }

  const problematic = results.filter(
    (result) => result.atomCount > 0 && (result.sectionCount === 0 || result.unassignedCount > 0)
  );

  if (problematic.length > 0) {
    console.error(`\nCourses with section issues: ${problematic.length}`);
    process.exit(1);
  }
};

inspect().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
