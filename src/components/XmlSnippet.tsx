import { useEffect, useState } from "react";
import { codeToHtml } from "shiki";
import "./XmlSnippet.css";

interface XmlSnippetProps {
  xml: string;
  startLine?: number;
}

/** Re-indent XML snippet with consistent 2-space indentation based on nesting depth. */
function reindent(text: string): string {
  const lines = text.split("\n");
  let depth = 0;
  const result: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.length === 0) {
      result.push("");
      continue;
    }

    // Closing tag or self-closing that starts with </
    const isClosing = line.startsWith("</");
    // Line is purely a closing tag
    const isOnlyClosing = /^<\/[^>]+>\s*$/.test(line);
    // Line has a closing tag at the end (e.g., <tag>content</tag>)
    const hasInlineClose = /<\/[^>]+>\s*$/.test(line) && !isOnlyClosing;
    // Self-closing tag
    const isSelfClosing = /\/>\s*$/.test(line);

    if (isClosing) {
      depth = Math.max(0, depth - 1);
    }

    result.push("  ".repeat(depth) + line);

    if (!isClosing && !isSelfClosing && !hasInlineClose) {
      // Opening tag that isn't self-closing and doesn't close inline — increase depth
      if (line.startsWith("<") && !line.startsWith("<?")) {
        depth++;
      }
    }
  }

  return result.join("\n");
}

export function XmlSnippet({ xml, startLine = 1 }: XmlSnippetProps) {
  const [html, setHtml] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const dedented = reindent(xml);

  useEffect(() => {
    let cancelled = false;

    codeToHtml(dedented, {
      lang: "xml",
      theme: "github-light",
    }).then((result) => {
      if (!cancelled) {
        setHtml(result);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [dedented]);

  if (loading) {
    return <div className="xml-snippet-loading">Loading highlight...</div>;
  }

  // Shiki wraps each line in <span class="line">. We inject line numbers
  // by setting a CSS counter start value via a custom property.
  const style = { "--line-start": startLine } as React.CSSProperties;

  return (
    <div
      className="xml-snippet line-numbers"
      style={style}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
