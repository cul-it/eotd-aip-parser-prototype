import { useState } from "react";
import type { FieldResult } from "../types";
import { MappingRow } from "./MappingRow";
import "./MappingTable.css";

interface MappingTableProps {
  fieldResults: FieldResult[];
  hoveredField: string | null;
}

export function MappingTable({ fieldResults, hoveredField }: MappingTableProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const handleToggle = (index: number) => {
    setExpandedIndex((prev) => (prev === index ? null : index));
  };

  if (fieldResults.length === 0) {
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
            <th>Contained In</th>
          </tr>
        </thead>
        <tbody>
          {fieldResults.map((result, index) => (
            <MappingRow
              key={index}
              fieldResult={result}
              isExpanded={expandedIndex === index}
              isHighlighted={hoveredField === result.label}
              onToggle={() => handleToggle(index)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
