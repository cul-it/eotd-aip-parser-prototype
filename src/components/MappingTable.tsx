import { useState } from "react";
import type { DisplayRow } from "../types";
import { MappingRow } from "./MappingRow";
import "./MappingTable.css";

interface MappingTableProps {
  rows: DisplayRow[];
  hoveredField: string | null;
}

export function MappingTable({ rows, hoveredField }: MappingTableProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const handleToggle = (index: number) => {
    setExpandedIndex((prev) => (prev === index ? null : index));
  };

  if (rows.length === 0) {
    return (
      <p className="mapping-table-empty">No mappings found in this file.</p>
    );
  }

  return (
    <div className="mapping-table-wrapper">
      <table className="mapping-table">
        <thead>
          <tr>
            <th></th>
            <th>Field</th>
            <th>Value</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <MappingRow
              key={index}
              row={row}
              isExpanded={expandedIndex === index}
              isHighlighted={hoveredField === row.name}
              onToggle={() => handleToggle(index)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
