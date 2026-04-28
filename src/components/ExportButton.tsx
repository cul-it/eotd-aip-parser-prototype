import { useState, useRef, useEffect } from "react";
import type { ParsedItem } from "../types";
import { toJson } from "../export";
import "./ExportButton.css";

interface ExportButtonProps {
  item: ParsedItem | null;
}

function download(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExportButton({ item }: ExportButtonProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleExportJson = () => {
    if (item) {
      download(toJson(item), "parsed-item.json", "application/json");
    }
    setOpen(false);
  };

  return (
    <div className="export-dropdown" ref={ref}>
      <button className="export-button" onClick={() => setOpen(!open)}>
        Export
      </button>
      {open && (
        <div className="export-dropdown-menu">
          <button className="export-dropdown-item" onClick={handleExportJson}>
            JSON
          </button>
        </div>
      )}
    </div>
  );
}
