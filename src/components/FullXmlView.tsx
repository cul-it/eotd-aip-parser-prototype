import { useCallback, useEffect, useRef, useState } from "react";
import { codeToHtml } from "shiki";
import type { ShikiTransformer } from "shiki";
import type { DisplayRow } from "../types";
import "./FullXmlView.css";

interface FullXmlViewProps {
  rawXml: string;
  rows: DisplayRow[];
  filename: string;
  onHoverField: (field: string | null) => void;
}

interface LineRange {
  start: number;
  end: number;
  source: string;
  name: string;
}

function computeLineRanges(rows: DisplayRow[]): LineRange[] {
  const ranges: LineRange[] = [];
  for (const row of rows) {
    if (row.sourceStartLine <= 0 || !row.sourceXml || row.source === "missing") {
      continue;
    }
    const lineCount = row.sourceXml.split("\n").length;
    ranges.push({
      start: row.sourceStartLine,
      end: row.sourceStartLine + lineCount - 1,
      source: row.source,
      name: row.name,
    });
  }
  return ranges;
}

function sourceClass(source: string): string {
  if (source === "MODS") return "hl-mods";
  if (source === "DIM") return "hl-dim";
  return "hl-other";
}

export function FullXmlView({ rawXml, rows, filename, onHoverField }: FullXmlViewProps) {
  const [expanded, setExpanded] = useState(false);
  const [html, setHtml] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const prevXmlRef = useRef(rawXml);

  // Reset cached HTML when file changes
  if (prevXmlRef.current !== rawXml) {
    prevXmlRef.current = rawXml;
    setHtml("");
  }

  const ranges = computeLineRanges(rows);

  useEffect(() => {
    if (!expanded) return;
    if (html) return;

    setLoading(true);
    let cancelled = false;

    const highlightTransformer: ShikiTransformer = {
      line(node, line) {
        for (const range of ranges) {
          if (line >= range.start && line <= range.end) {
            const classes = node.properties["class"] ?? "";
            node.properties["class"] =
              `${classes} highlighted ${sourceClass(range.source)}`.trim();
            node.properties["data-field"] = range.name;
            break;
          }
        }
      },
    };

    codeToHtml(rawXml, {
      lang: "xml",
      theme: "github-light",
      transformers: [highlightTransformer],
    }).then((result) => {
      if (!cancelled) {
        setHtml(result);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [expanded, html, rawXml, ranges]);

  const handleMouseOver = useCallback(
    (e: React.MouseEvent) => {
      const target = (e.target as HTMLElement).closest("[data-field]");
      if (target) {
        onHoverField(target.getAttribute("data-field"));
      }
    },
    [onHoverField]
  );

  const handleMouseOut = useCallback(
    (e: React.MouseEvent) => {
      const target = (e.target as HTMLElement).closest("[data-field]");
      if (target) {
        const related = (e.relatedTarget as HTMLElement | null)?.closest(
          "[data-field]"
        );
        if (!related || related.getAttribute("data-field") !== target.getAttribute("data-field")) {
          onHoverField(null);
        }
      }
    },
    [onHoverField]
  );

  return (
    <div className="full-xml-view">
      <button
        className="full-xml-toggle"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? "−" : "+"} Original XML Source{filename ? `: ${filename}` : ""}
      </button>
      {expanded && (
        <div className="full-xml-content">
          {loading ? (
            <div className="full-xml-loading">Loading highlight...</div>
          ) : (
            <div
              className="full-xml-code line-numbers"
              style={{ "--line-start": 1 } as React.CSSProperties}
              dangerouslySetInnerHTML={{ __html: html }}
              onMouseOver={handleMouseOver}
              onMouseOut={handleMouseOut}
            />
          )}
        </div>
      )}
    </div>
  );
}
