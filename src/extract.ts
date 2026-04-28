import { XMLParser } from "fast-xml-parser";
import type { AccessInfo, Bitstream, ParsedItem, SourceResult, FieldResult } from "./types";
import fieldDefs from "./field-definitions.json";

// ---------------------------------------------------------------------------
// Parser setup
// ---------------------------------------------------------------------------

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  isArray: (name) => {
    const arrayTags = [
      "name", "identifier", "subject", "note", "extension",
      "accessCondition", "field", "fileGrp", "file", "dmdSec",
      "amdSec", "structMap", "agent", "div", "object", "FLocat",
    ];
    return arrayTags.includes(name);
  },
  textNodeName: "#text",
});

// ---------------------------------------------------------------------------
// Types for field definitions
// ---------------------------------------------------------------------------

interface DimQuery {
  mdschema: string;
  element: string;
  qualifier?: string;
  role?: string;
  includeAuthority?: boolean;
}

interface XmlSearchDef {
  tag: string;
  context?: string;
  contexts?: string[];
  all?: boolean;
}

interface SourceDef {
  strategy: string;
  mods?: Record<string, unknown>;
  dim?: DimQuery | DimQuery[];
  customExtractor?: string;
  config?: Record<string, unknown>;
  xpath: string;
  xmlSearch: XmlSearchDef;
}

interface FieldDef {
  key: string;
  label: string;
  type: string;
  sources: Record<string, SourceDef>;
  hardcoded?: string;
  display?: { nested?: { headers: string[]; roleColumn?: boolean } };
}

const fields: FieldDef[] = fieldDefs.fields as FieldDef[];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function asArray<T>(val: T | T[] | undefined | null): T[] {
  if (val === undefined || val === null) return [];
  return Array.isArray(val) ? val : [val];
}

function textOf(node: unknown): string {
  if (node === undefined || node === null) return "";
  if (typeof node === "string") return node.trim();
  if (typeof node === "number") return String(node);
  if (typeof node === "object" && node !== null && "#text" in node) {
    return String((node as Record<string, unknown>)["#text"]).trim();
  }
  return "";
}

// ---------------------------------------------------------------------------
// Section finders
// ---------------------------------------------------------------------------

interface MetsDoc {
  mets: Record<string, unknown>;
}

function findDmdSecs(doc: MetsDoc): Record<string, unknown>[] {
  return asArray(doc.mets?.["dmdSec"] as Record<string, unknown>[]);
}

function findModsSection(doc: MetsDoc): Record<string, unknown> | null {
  for (const dmd of findDmdSecs(doc)) {
    const wrap = dmd?.["mdWrap"] as Record<string, unknown> | undefined;
    if (wrap?.["@_MDTYPE"] === "MODS") {
      const xmlData = wrap["xmlData"] as Record<string, unknown> | undefined;
      return (xmlData?.["mods"] as Record<string, unknown>) ?? null;
    }
  }
  return null;
}

function findDimSection(doc: MetsDoc): Record<string, unknown> | null {
  for (const dmd of findDmdSecs(doc)) {
    const wrap = dmd?.["mdWrap"] as Record<string, unknown> | undefined;
    if (wrap?.["@_MDTYPE"] === "OTHER" && wrap?.["@_OTHERMDTYPE"] === "DIM") {
      const xmlData = wrap["xmlData"] as Record<string, unknown> | undefined;
      return (xmlData?.["dim"] as Record<string, unknown>) ?? null;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// DIM query helpers
// ---------------------------------------------------------------------------

interface DimField {
  "@_mdschema"?: string;
  "@_element"?: string;
  "@_qualifier"?: string;
  "@_authority"?: string;
  "#text"?: string | number;
}

function dimFieldsQuery(
  dim: Record<string, unknown> | null,
  q: DimQuery
): DimField[] {
  if (!dim) return [];
  const allFields = asArray(dim["field"] as DimField[]);
  return allFields.filter((f) => {
    if (f["@_mdschema"] !== q.mdschema) return false;
    if (f["@_element"] !== q.element) return false;
    if (q.qualifier !== undefined) return f["@_qualifier"] === q.qualifier;
    return f["@_qualifier"] === undefined;
  });
}

function dimText(dim: Record<string, unknown> | null, q: DimQuery): string | null {
  const results = dimFieldsQuery(dim, q);
  if (results.length === 0) return null;
  return textOf(results[0]) || null;
}

function dimTexts(dim: Record<string, unknown> | null, q: DimQuery): string[] {
  return dimFieldsQuery(dim, q)
    .map((f) => textOf(f))
    .filter((t) => t.length > 0);
}

// ---------------------------------------------------------------------------
// Strategy extractors — each returns a value based on the field def
// ---------------------------------------------------------------------------

interface ExtractContext {
  mods: Record<string, unknown> | null;
  dim: Record<string, unknown> | null;
  parsed: MetsDoc;
}

function extractByStrategy(source: SourceDef, ctx: ExtractContext): unknown {
  switch (source.strategy) {
    case "dim":
      return extractDimStrategy(source, ctx);
    case "dimMulti":
      return extractDimMultiStrategy(source, ctx);
    case "modsPath":
      return extractModsPathStrategy(source, ctx);
    case "modsName":
      return extractModsNameStrategy(source, ctx);
    case "modsIdentifier":
      return extractModsIdentifierStrategy(source, ctx);
    case "modsSubjects":
      return extractModsSubjectsStrategy(ctx);
    case "modsExtension":
      return extractModsExtensionStrategy(source, ctx);
    case "modsAccessCondition":
      return extractModsAccessConditionStrategy(source, ctx);
    case "custom":
      return extractCustomStrategy(source, ctx);
    default:
      return null;
  }
}

function extractDimStrategy(source: SourceDef, ctx: ExtractContext): string | null {
  const q = source.dim as DimQuery;
  if (q.includeAuthority) {
    const results = dimFieldsQuery(ctx.dim, q);
    if (results.length === 0) return null;
    const f = results[0]!;
    const name = textOf(f);
    const authority = f["@_authority"] ?? "";
    return authority ? `${name} (${authority})` : name;
  }
  return dimText(ctx.dim, q);
}

function extractDimMultiStrategy(source: SourceDef, ctx: ExtractContext): string[] {
  const queries = source.dim as DimQuery[];
  const results: string[] = [];
  for (const q of queries) {
    const texts = dimTexts(ctx.dim, q);
    if (q.role === "chair") {
      results.push(...texts.map((t) => `${t} (chair)`));
    } else {
      results.push(...texts);
    }
  }
  return results;
}

function extractModsPathStrategy(source: SourceDef, ctx: ExtractContext): string | null {
  if (!ctx.mods) return null;
  const path = (source.mods as { path: string[] }).path;
  let current: unknown = ctx.mods;
  for (const segment of path) {
    if (current === null || current === undefined || typeof current !== "object") return null;
    current = (current as Record<string, unknown>)[segment];
  }
  return textOf(current) || null;
}

function extractModsNameStrategy(source: SourceDef, ctx: ExtractContext): string | null {
  if (!ctx.mods) return null;
  const role = (source.mods as { role: string }).role;
  const names = asArray(ctx.mods["name"] as Record<string, unknown>[]);
  for (const name of names) {
    const roleEl = name["role"] as Record<string, unknown> | undefined;
    if (!roleEl) continue;
    const roleTerm = roleEl["roleTerm"];
    const roleText = typeof roleTerm === "object" && roleTerm !== null
      ? textOf(roleTerm)
      : String(roleTerm ?? "");
    if (roleText === role) {
      return textOf(name["namePart"]) || null;
    }
  }
  return null;
}

function extractModsIdentifierStrategy(source: SourceDef, ctx: ExtractContext): string | null {
  if (!ctx.mods) return null;
  const config = source.mods as { identifierType: string; prefix?: string };
  const identifiers = asArray(ctx.mods["identifier"] as Record<string, unknown>[]);
  for (const id of identifiers) {
    if (id["@_type"] === config.identifierType) {
      const val = textOf(id);
      if (config.prefix) {
        if (val.startsWith(config.prefix)) {
          return val.replace(new RegExp(`^${config.prefix}\\s*`), "").trim() || null;
        }
      } else {
        return val || null;
      }
    }
  }
  return null;
}

function extractModsSubjectsStrategy(ctx: ExtractContext): string[] {
  if (!ctx.mods) return [];
  const subjects = asArray(ctx.mods["subject"] as Record<string, unknown>[]);
  return subjects
    .map((s) => textOf(s["topic"]))
    .filter((t) => t.length > 0);
}

function extractModsExtensionStrategy(source: SourceDef, ctx: ExtractContext): string | null {
  if (!ctx.mods) return null;
  const field = (source.mods as { extensionField: string }).extensionField;
  const extensions = asArray(ctx.mods["extension"] as Record<string, unknown>[]);
  for (const ext of extensions) {
    const val = ext[field];
    if (val !== undefined) return textOf(val) || null;
  }
  return null;
}

function extractModsAccessConditionStrategy(source: SourceDef, ctx: ExtractContext): string | null {
  if (!ctx.mods) return null;
  const condType = (source.mods as { conditionType: string }).conditionType;
  const conditions = asArray(ctx.mods["accessCondition"] as Record<string, unknown>[]);
  const match = conditions.find((c) => c["@_type"] === condType);
  if (match) return textOf(match) || null;
  if (conditions.length > 0) return textOf(conditions[0]) || null;
  return null;
}

function extractCustomStrategy(source: SourceDef, ctx: ExtractContext): unknown {
  switch (source.customExtractor) {
    case "community":
      return extractCommunity(ctx.parsed);
    case "bitstreams":
      return extractBitstreams(ctx.parsed, source.config);
    case "embargo":
      return extractEmbargo(ctx.dim, source.config);
    case "redaction":
      return extractRedaction(ctx.dim, ctx.parsed, source.config);
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Custom extractors
// ---------------------------------------------------------------------------

function extractCommunity(parsed: MetsDoc): string | null {
  const structMaps = asArray(parsed.mets?.["structMap"] as Record<string, unknown>[]);
  const parentMap = structMaps.find((sm) => sm["@_LABEL"] === "Parent");
  if (!parentMap) return null;
  const divs = asArray(parentMap["div"] as Record<string, unknown>[]);
  for (const div of divs) {
    const mptr = div["mptr"] as Record<string, unknown> | undefined;
    if (mptr) {
      const href = (mptr["@_xlink:href"] as string) ?? (mptr["@_href"] as string) ?? null;
      return href ? `hdl:${href}` : null;
    }
  }
  return null;
}

function extractBitstreams(parsed: MetsDoc, config?: Record<string, unknown>): Bitstream[] {
  const useTypes = new Set((config?.["useTypes"] as string[]) ?? ["ORIGINAL", "LICENSE", "CC-LICENSE"]);
  const fileSec = parsed.mets?.["fileSec"] as Record<string, unknown> | undefined;
  if (!fileSec) return [];

  const fileGrps = asArray(fileSec["fileGrp"] as Record<string, unknown>[]);
  const amdSecs = asArray(parsed.mets?.["amdSec"] as Record<string, unknown>[]);
  const premisNames = new Map<string, string>();
  for (const amd of amdSecs) {
    const amdId = amd["@_ID"] as string | undefined;
    if (!amdId) continue;
    const techMD = amd["techMD"] as Record<string, unknown> | undefined;
    if (!techMD) continue;
    const wrap = techMD["mdWrap"] as Record<string, unknown> | undefined;
    if (wrap?.["@_MDTYPE"] !== "PREMIS") continue;
    const xmlData = wrap["xmlData"] as Record<string, unknown> | undefined;
    const premis = xmlData?.["premis"] as Record<string, unknown> | undefined;
    const objects = asArray(premis?.["object"] as Record<string, unknown>[]);
    for (const obj of objects) {
      const origName = textOf(obj["originalName"]);
      if (origName) premisNames.set(amdId, origName);
    }
  }

  const bitstreams: Bitstream[] = [];
  for (const grp of fileGrps) {
    const use = (grp["@_USE"] as string) ?? "";
    if (!useTypes.has(use)) continue;
    const files = asArray(grp["file"] as Record<string, unknown>[]);
    for (const f of files) {
      const admid = (f["@_ADMID"] as string) ?? "";
      const filename = premisNames.get(admid) ?? (f["@_ID"] as string) ?? "";
      bitstreams.push({
        filename,
        mimeType: (f["@_MIMETYPE"] as string) ?? "",
        size: parseInt((f["@_SIZE"] as string) ?? "0", 10),
        checksum: (f["@_CHECKSUM"] as string) ?? "",
        checksumType: (f["@_CHECKSUMTYPE"] as string) ?? "",
        use,
      });
    }
  }
  return bitstreams;
}

interface EmbargoResult {
  type: AccessInfo["embargoType"];
  date: string | null;
}

function extractEmbargo(dim: Record<string, unknown> | null, config?: Record<string, unknown>): EmbargoResult {
  const thresholdYears = (config?.["permanentThresholdYears"] as number) ?? 100;
  const embargoDateRaw = dimText(dim, { mdschema: "dc", element: "description", qualifier: "embargo" });
  if (!embargoDateRaw) return { type: "none", date: null };

  const embargoYear = parseInt(embargoDateRaw.split("-")[0]!, 10);
  const currentYear = new Date().getFullYear();
  const type: AccessInfo["embargoType"] = (embargoYear - currentYear > thresholdYears) ? "permanent" : "temporary";
  return { type, date: embargoDateRaw };
}

interface RedactionResult {
  isRedacted: boolean;
  note: string | null;
  replacesHandle: string | null;
}

function extractRedaction(
  dim: Record<string, unknown> | null,
  parsed: MetsDoc,
  config?: Record<string, unknown>
): RedactionResult {
  const provenanceSources = (config?.["provenanceSources"] as DimQuery[]) ?? [];
  const keywords = (config?.["keywords"] as string[]) ?? ["redact", "removed"];
  const bitstreamKeywords = (config?.["bitstreamKeywords"] as string[]) ?? ["redact"];
  const replacesField = config?.["replacesField"] as DimQuery | undefined;

  // Gather provenance notes
  const provenanceNotes: string[] = [];
  for (const src of provenanceSources) {
    provenanceNotes.push(...dimTexts(dim, src));
  }

  const note = provenanceNotes.find((p) => {
    const lower = p.toLowerCase();
    return keywords.some((kw) => lower.includes(kw));
  }) ?? null;

  const replacesHandle = replacesField ? dimText(dim, replacesField) : null;

  // Check bitstream filenames
  const bitstreams = extractBitstreams(parsed);
  const hasRedactedBitstream = bitstreams.some((b) =>
    bitstreamKeywords.some((kw) => b.filename.toLowerCase().includes(kw))
  );

  return {
    isRedacted: note !== null || replacesHandle !== null || hasRedactedBitstream,
    note,
    replacesHandle,
  };
}

// ---------------------------------------------------------------------------
// Discrepancy detection
// ---------------------------------------------------------------------------

function stringifyValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const sorted = [...value].map((v) => (typeof v === "string" ? v : JSON.stringify(v))).sort();
    return JSON.stringify(sorted);
  }
  return JSON.stringify(value);
}

function computeDiscrepancy(sources: SourceResult[]): boolean {
  const nonNullValues = sources
    .map((s) => stringifyValue(s.value))
    .filter((v): v is string => v !== null);
  if (nonNullValues.length < 2) return false;
  return nonNullValues.some((v) => v !== nonNullValues[0]);
}

// ---------------------------------------------------------------------------
// Main extraction: build ParsedItem from field definitions
// ---------------------------------------------------------------------------

export function extractParsedItem(parsed: MetsDoc): ParsedItem {
  const primarySchema = "MODS";
  const mods = findModsSection(parsed);
  const dim = findDimSection(parsed);
  const ctx: ExtractContext = { mods, dim, parsed };

  const values = new Map<string, unknown>();
  for (const def of fields) {
    if (def.hardcoded) {
      values.set(def.key, def.hardcoded);
      continue;
    }
    const primarySource = def.sources[primarySchema];
    let value: unknown = null;
    if (primarySource) {
      value = extractByStrategy(primarySource, ctx);
    }
    if (value === null || value === undefined) {
      for (const [schema, sourceDef] of Object.entries(def.sources)) {
        if (schema === primarySchema) continue;
        value = extractByStrategy(sourceDef, ctx);
        if (value !== null && value !== undefined) break;
      }
    }
    values.set(def.key, value);
  }

  // The rest of ParsedItem assembly stays the same
  const embargo = values.get("embargo") as EmbargoResult | null;
  const redaction = values.get("redaction") as RedactionResult | null;

  return {
    doi: (values.get("doi") as string) ?? null,
    title: (values.get("title") as string) ?? null,
    author: (values.get("author") as string) ?? null,
    committeeMembers: (values.get("committeeMembers") as string[]) ?? [],
    abstract: (values.get("abstract") as string) ?? null,
    keywords: (values.get("keywords") as string[]) ?? [],
    instanceHrid: (values.get("instanceHrid") as string) ?? null,
    datePublished: (values.get("datePublished") as string) ?? null,
    dateAddedToEcommons: (values.get("dateAddedToEcommons") as string) ?? null,
    access: {
      license: (values.get("license") as string) ?? null,
      embargoType: embargo?.type ?? "none",
      embargoDate: embargo?.date ?? null,
      isRedacted: redaction?.isRedacted ?? false,
      redactionNote: redaction?.note ?? null,
      replacesHandle: redaction?.replacesHandle ?? null,
    },
    community: (values.get("community") as string) ?? null,
    collection: (values.get("collection") as string) ?? null,
    bitstreams: (values.get("bitstreams") as Bitstream[]) ?? [],
    handleUrl: (values.get("handleUrl") as string) ?? null,
  };
}

// ---------------------------------------------------------------------------
// Extract all sources for comparison UI
// ---------------------------------------------------------------------------

interface XmlBlockResult {
  xml: string;
  startLine: number;
}

function lineAt(rawXml: string, charOffset: number): number {
  let count = 1;
  for (let i = 0; i < charOffset && i < rawXml.length; i++) {
    if (rawXml[i] === "\n") count++;
  }
  return count;
}

function getSourceBlock(rawXml: string, search: XmlSearchDef): XmlBlockResult {
  if (search.all) {
    return xmlBlockAll(rawXml, search.tag);
  }
  if (search.contexts) {
    return xmlBlockRange(rawXml, search.tag, search.contexts);
  }
  return xmlBlock(rawXml, search.tag, search.context);
}

export function extractAllSources(
  rawXml: string,
  parsed: MetsDoc
): FieldResult[] {
  const mods = findModsSection(parsed);
  const dim = findDimSection(parsed);
  const ctx: ExtractContext = { mods, dim, parsed };

  return fields.map((def) => {
    if (def.hardcoded) {
      return {
        key: def.key,
        label: def.label,
        type: def.type,
        sources: [{
          schema: "N/A",
          value: def.hardcoded,
          xpath: "",
          sourceXml: "",
          sourceStartLine: 0,
        }],
        hasDiscrepancy: false,
        display: def.display,
      };
    }

    const sources: SourceResult[] = [];

    for (const [schema, sourceDef] of Object.entries(def.sources)) {
      const value = extractByStrategy(sourceDef, ctx);
      const block = getSourceBlock(rawXml, sourceDef.xmlSearch);

      sources.push({
        schema,
        value,
        xpath: sourceDef.xpath,
        sourceXml: block.xml,
        sourceStartLine: block.startLine,
      });
    }

    return {
      key: def.key,
      label: def.label,
      type: def.type,
      sources,
      hasDiscrepancy: computeDiscrepancy(sources),
      display: def.display,
    };
  });
}

// ---------------------------------------------------------------------------
// XML block extraction helpers
// ---------------------------------------------------------------------------

function xmlBlock(rawXml: string, tagName: string, context?: string): XmlBlockResult {
  const openPattern = new RegExp(`<${escapeRegex(tagName)}[\\s>]`);
  const closeTag = `</${tagName}>`;
  let searchFrom = 0;

  while (searchFrom < rawXml.length) {
    const openMatch = openPattern.exec(rawXml.slice(searchFrom));
    if (!openMatch) return { xml: "", startLine: 0 };

    const blockStart = searchFrom + openMatch.index;
    const nextClose = rawXml.indexOf(closeTag, blockStart);
    const nextOpen = rawXml.indexOf(">", blockStart);

    let blockEnd: number;
    if (nextClose === -1) {
      const sc = rawXml.indexOf("/>", blockStart);
      if (sc === -1) return { xml: "", startLine: 0 };
      blockEnd = sc + 2;
    } else {
      blockEnd = nextClose + closeTag.length;
    }

    const slice = rawXml.slice(blockStart, blockEnd);
    if (!context || slice.includes(context)) {
      return { xml: slice.trim(), startLine: lineAt(rawXml, blockStart) };
    }

    searchFrom = blockStart + (nextOpen !== -1 ? nextOpen - blockStart + 1 : 1);
  }

  return { xml: "", startLine: 0 };
}

function xmlBlockAll(rawXml: string, tagName: string): XmlBlockResult {
  const openPattern = new RegExp(`<${escapeRegex(tagName)}[\\s>]`, "g");
  const closeTag = `</${tagName}>`;

  let firstStart = -1;
  let lastEnd = -1;

  let match: RegExpExecArray | null;
  while ((match = openPattern.exec(rawXml)) !== null) {
    const blockStart = match.index;
    if (firstStart === -1) firstStart = blockStart;
    const nextClose = rawXml.indexOf(closeTag, blockStart);
    if (nextClose === -1) {
      const sc = rawXml.indexOf("/>", blockStart);
      if (sc !== -1) lastEnd = sc + 2;
    } else {
      lastEnd = nextClose + closeTag.length;
    }
  }

  if (firstStart === -1 || lastEnd === -1) return { xml: "", startLine: 0 };
  return { xml: rawXml.slice(firstStart, lastEnd).trim(), startLine: lineAt(rawXml, firstStart) };
}

function xmlBlockRange(rawXml: string, tagName: string, contexts: string[]): XmlBlockResult {
  const openPattern = new RegExp(`<${escapeRegex(tagName)}[\\s>]`, "g");
  const closeTag = `</${tagName}>`;

  let firstStart = -1;
  let lastEnd = -1;

  let match: RegExpExecArray | null;
  while ((match = openPattern.exec(rawXml)) !== null) {
    const blockStart = match.index;
    const nextClose = rawXml.indexOf(closeTag, blockStart);
    let blockEnd: number;
    if (nextClose === -1) {
      const sc = rawXml.indexOf("/>", blockStart);
      if (sc === -1) continue;
      blockEnd = sc + 2;
    } else {
      blockEnd = nextClose + closeTag.length;
    }

    const slice = rawXml.slice(blockStart, blockEnd);
    if (contexts.some((ctx) => slice.includes(ctx))) {
      if (firstStart === -1) firstStart = blockStart;
      lastEnd = blockEnd;
    }
  }

  if (firstStart === -1 || lastEnd === -1) return { xml: "", startLine: 0 };
  return { xml: rawXml.slice(firstStart, lastEnd).trim(), startLine: lineAt(rawXml, firstStart) };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function extractMappings(
  _doc: Document,
  rawXml: string,
): { item: ParsedItem; fieldResults: FieldResult[] } {
  const parsed = parser.parse(rawXml) as MetsDoc;
  const item = extractParsedItem(parsed);
  const fieldResults = extractAllSources(rawXml, parsed);
  return { item, fieldResults };
}
