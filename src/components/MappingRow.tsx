import type { DisplayRow } from "../types";
import { XmlSnippet } from "./XmlSnippet";
import "./MappingRow.css";

interface MappingRowProps {
  row: DisplayRow;
  isExpanded: boolean;
  isHighlighted: boolean;
  onToggle: () => void;
}

function sourceLabel(source: string): string {
  if (source === "missing") return "missing";
  return source;
}

function sourceBadgeClass(source: string): string {
  if (source === "missing") return "source-badge missing";
  if (source === "MODS") return "source-badge mods";
  if (source === "DIM") return "source-badge dim";
  return "source-badge other";
}

export function MappingRow({ row, isExpanded, isHighlighted, onToggle }: MappingRowProps) {
  const isMissing = row.source === "missing";

  return (
    <>
      <tr
        className={`mapping-row ${isExpanded ? "expanded" : ""} ${isMissing ? "row-missing" : ""} ${isHighlighted ? "row-highlighted" : ""}`}
        onClick={onToggle}
      >
        <td className="mapping-row-toggle">{isExpanded ? "−" : "+"}</td>
        <td className="mapping-row-name">{row.name}</td>
        <td className="mapping-row-value">{row.value}</td>
        <td>
          <span className={sourceBadgeClass(row.source)}>
            {sourceLabel(row.source)}
          </span>
        </td>
      </tr>
      {isExpanded && (
        <tr className="mapping-row-expansion">
          <td colSpan={4}>
            <div className="mapping-row-expansion-content">
              <h4 className="expansion-heading">Extracted Data</h4>
              {row.nestedData ? (
                <table className="nested-table">
                  <thead>
                    <tr>
                      {row.nestedData.headers.map((h, i) => (
                        <th key={i}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {row.nestedData.rows.map((r, i) => (
                      <tr key={i}>
                        {r.map((cell, j) => (
                          <td key={j}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="expansion-value">{row.value}</div>
              )}

              <h4 className="expansion-heading">Raw XML</h4>
              <XmlSnippet xml={row.sourceXml} startLine={row.sourceStartLine} />

              <h4 className="expansion-heading">XPath</h4>
              <div className="mapping-row-xpath">
                <code>{row.xpath}</code>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
