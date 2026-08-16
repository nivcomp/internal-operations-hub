import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, "..");
const sourcePath = resolve(root, "src/integrations/supabase/types.ts");
const outputPath = resolve(root, "docs/api/table-catalog.json");
const source = readFileSync(sourcePath, "utf8").replace(/\r\n/g, "\n");
const lines = source.split("\n");

function findLine(value, from = 0) {
  const index = lines.findIndex((line, lineIndex) => lineIndex >= from && line === value);
  if (index === -1) throw new Error(`Could not find schema marker: ${value}`);
  return index;
}

function parseFields(block, label) {
  const start = block.findIndex((line) => line === `        ${label}: {`);
  if (start === -1) return {};
  const fields = {};
  for (let index = start + 1; index < block.length; index += 1) {
    const line = block[index];
    if (line === "        }") break;
    const match = line.match(/^          ([A-Za-z0-9_]+)(\?)?: (.+)$/);
    if (!match) continue;
    fields[match[1]] = {
      type: match[3],
      required: label === "Insert" && !match[2],
    };
  }
  return fields;
}

function parseRelationships(block) {
  const relationships = [];
  for (let index = 0; index < block.length; index += 1) {
    const foreignKey = block[index]?.match(/foreignKeyName: "([^"]+)"/);
    if (!foreignKey) continue;
    const snippet = block.slice(index, index + 12).join("\n");
    const columns = snippet.match(/columns: \[([^\]]*)\]/)?.[1]
      ?.split(",").map((value) => value.trim().replaceAll('"', "")).filter(Boolean) ?? [];
    const referencedColumns = snippet.match(/referencedColumns: \[([^\]]*)\]/)?.[1]
      ?.split(",").map((value) => value.trim().replaceAll('"', "")).filter(Boolean) ?? [];
    relationships.push({
      foreignKeyName: foreignKey[1],
      columns,
      isOneToOne: snippet.match(/isOneToOne: (true|false)/)?.[1] === "true",
      referencedRelation: snippet.match(/referencedRelation: "([^"]+)"/)?.[1] ?? null,
      referencedColumns,
    });
  }
  return relationships;
}

function parseTables() {
  const start = findLine("    Tables: {") + 1;
  const end = findLine("    Views: {", start);
  const tables = [];
  let index = start;
  while (index < end) {
    const tableMatch = lines[index].match(/^      ([A-Za-z0-9_]+): \{$/);
    if (!tableMatch) {
      index += 1;
      continue;
    }
    const blockStart = index;
    index += 1;
    while (index < end && !lines[index].match(/^      [A-Za-z0-9_]+: \{$/)) index += 1;
    const block = lines.slice(blockStart, index);
    tables.push({
      name: tableMatch[1],
      row: parseFields(block, "Row"),
      insert: parseFields(block, "Insert"),
      update: parseFields(block, "Update"),
      relationships: parseRelationships(block),
    });
  }
  return tables;
}

function parseFunctions() {
  const start = findLine("    Functions: {") + 1;
  const end = findLine("    Enums: {", start);
  const functions = [];
  for (let index = start; index < end; index += 1) {
    const match = lines[index].match(/^      ([A-Za-z0-9_]+): \{$/);
    const compactMatch = lines[index].match(/^      ([A-Za-z0-9_]+): \{ Args: (.+); Returns: (.+) \}$/);
    if (compactMatch) {
      functions.push({ name: compactMatch[1], args: compactMatch[2], returns: compactMatch[3] });
      continue;
    }
    if (!match) continue;
    const block = [];
    let depth = 0;
    for (; index < end; index += 1) {
      const line = lines[index];
      block.push(line.trim());
      depth += (line.match(/\{/g) ?? []).length;
      depth -= (line.match(/\}/g) ?? []).length;
      if (depth === 0) break;
    }
    functions.push({ name: match[1], signature: block.join(" ") });
  }
  return functions;
}

const tables = parseTables();
const functions = parseFunctions();
const catalog = {
  formatVersion: 1,
  source: "src/integrations/supabase/types.ts",
  database: "PostgreSQL via Supabase",
  schema: "public",
  postgrestVersion: source.match(/PostgrestVersion: "([^"]+)"/)?.[1] ?? null,
  tableCount: tables.length,
  functionCount: functions.length,
  tables,
  functions,
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
console.log(`Wrote ${tables.length} tables and ${functions.length} functions to ${outputPath}`);
