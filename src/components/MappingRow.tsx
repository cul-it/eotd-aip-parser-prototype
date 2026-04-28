import type { FieldResult, SourceResult, NestedTable } from "../types";
import { XmlSnippet } from "./XmlSnippet";
import "./MappingRow.css";

const SCHEMA_PRIORITY = ["MODS", "DIM", "METS"];

interface MappingRowProps {
  fieldResult: FieldResult;
  isExpanded: boolean;
  isHighlighted: boolean;
  onToggle: () => void;
}

function sourceBadgeClass(schema: string): string {
  if (schema === "MODS") return "source-badge mods";
  if (schema === "DIM") return "source-badge dim";
  return "source-badge other";
}

function formatValue(fieldResult: FieldResult, value: unknown): string {
  if (value === null || value === undefined) return "(missing)";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    if (value.length === 0) return "(missing)";
    return value.map((v) => (typeof v === "string" ? v : JSON.stringify(v))).join("; ");
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if ("type" in obj && "date" in obj) {
      if (obj.type === "permanent") return `Permanent (${obj.date})`;
      if (obj.type === "temporary") return `Temporary: lifts ${obj.date}`;
      return "(none)";
    }
    if ("isRedacted" in obj) {
      if (!obj.isRedacted) return "(none)";
      const parts: string[] = [];
      if (obj.note) parts.push(String(obj.note));
      if (obj.replacesHandle) parts.push(`Replaces: ${obj.replacesHandle}`);
      return parts.join(" | ") || "Yes";
    }
    return JSON.stringify(value);
  }
  return String(value);
}

function getDisplayValue(fieldResult: FieldResult): { value: string; source: SourceResult | null } {
  // Try schemas in priority order
  for (const schema of SCHEMA_PRIORITY) {
    const source = fieldResult.sources.find((s) => s.schema === schema);
    if (source && hasValue(fieldResult, source)) {
      return { value: formatValue(fieldResult, source.value), source };
    }
  }
  // Fallback to any source with a value
  for (const source of fieldResult.sources) {
    if (hasValue(fieldResult, source)) {
      return { value: formatValue(fieldResult, source.value), source };
    }
  }
  return { value: "(missing)", source: null };
}

function hasValue(fieldResult: FieldResult, source: SourceResult): boolean {
  const v = source.value;
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") {
    const obj = v as Record<string, unknown>;
    if ("type" in obj && "date" in obj) return obj.type !== "none";
    if ("isRedacted" in obj) return !!(obj as { isRedacted: boolean }).isRedacted;
  }
  return true;
}

function getNestedData(fieldResult: FieldResult, value: unknown): NestedTable | undefined {
  if (!fieldResult.display?.nested) return undefined;
  const headers = fieldResult.display.nested.headers;

  if (fieldResult.key === "committeeMembers") {
    const members = value as string[];
    if (!members || members.length === 0) return undefined;
    return {
      headers,
      rows: members.map((m) => {
        const isChair = m.endsWith("(chair)");
        const name = isChair ? m.replace(/ \(chair\)$/, "") : m;
        return [name, isChair ? "Chair" : "Member"];
      }),
    };
  }

  if (fieldResult.key === "keywords") {
    const kws = value as string[];
    if (!kws || kws.length === 0) return undefined;
    return { headers, rows: kws.map((k) => [k]) };
  }

  if (fieldResult.key === "bitstreams") {
    const bs = value as Array<{ use: string; filename: string; mimeType: string; size: number; checksum: string; checksumType: string }>;
    if (!bs || bs.length === 0) return undefined;
    return {
      headers,
      rows: bs.map((b) => [
        b.use,
        b.filename,
        b.mimeType,
        `${(b.size / 1024).toFixed(1)} KB`,
        `${b.checksumType}:${b.checksum}`,
      ]),
    };
  }

  if (Array.isArray(value) && value.length > 0) {
    return { headers, rows: value.map((v) => [typeof v === "string" ? v : JSON.stringify(v)]) };
  }

  return undefined;
}

export function MappingRow({ fieldResult, isExpanded, isHighlighted, onToggle }: MappingRowProps) {
  const { value, source } = getDisplayValue(fieldResult);
  const isMissing = source === null;
  const nonNullSources = fieldResult.sources.filter((s) => hasValue(fieldResult, s));

  return (
    <>
      <tr
        className={`mapping-row ${isExpanded ? "expanded" : ""} ${isMissing ? "row-missing" : ""} ${isHighlighted ? "row-highlighted" : ""}`}
        onClick={onToggle}
      >
        <td className="mapping-row-toggle">{isExpanded ? "\u2212" : "+"}</td>
        <td className="mapping-row-name">{fieldResult.label}</td>
        <td className="mapping-row-value">{value}</td>
        <td>
          <div className="contained-in-badges">
            {nonNullSources.map((s) => (
              <span key={s.schema} className={sourceBadgeClass(s.schema)}>
                {s.schema}
              </span>
            ))}
            {nonNullSources.length === 0 && (
              <span className="source-badge missing">missing</span>
            )}
            {fieldResult.hasDiscrepancy && (
              <span className="discrepancy-flag" title="Values differ across schemas">{"\u26A0"}</span>
            )}
          </div>
        </td>
      </tr>
      {isExpanded && (
        <tr className="mapping-row-expansion">
          <td colSpan={4}>
            <div className="mapping-row-expansion-content">
              <h4 className="expansion-heading">Sources Comparison</h4>
              <table className="comparison-table">
                <thead>
                  <tr>
                    <th>Schema</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {fieldResult.sources.map((s) => {
                    const displayVal = formatValue(fieldResult, s.value);
                    const nested = getNestedData(fieldResult, s.value);
                    return (
                      <tr key={s.schema}>
                        <td><span className={sourceBadgeClass(s.schema)}>{s.schema}</span></td>
                        <td>
                          {nested ? (
                            <table className="nested-table">
                              <thead>
                                <tr>
                                  {nested.headers.map((h, i) => (
                                    <th key={i}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {nested.rows.map((r, i) => (
                                  <tr key={i}>
                                    {r.map((cell, j) => (
                                      <td key={j}>{cell}</td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <span>{displayVal}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {fieldResult.sources.map((s) => (
                <div key={s.schema} className="source-xml-block">
                  <h4 className="expansion-heading">Raw XML {s.schema} <code className="expansion-xpath">{s.xpath}</code></h4>
                  <XmlSnippet xml={s.sourceXml} startLine={s.sourceStartLine} />
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
