export interface Bitstream {
  filename: string;
  mimeType: string;
  size: number;
  checksum: string;
  checksumType: string;
  use: string; // "ORIGINAL" | "LICENSE" | etc.
}

export interface AccessInfo {
  license: string | null;
  embargoType: "none" | "temporary" | "permanent";
  embargoDate: string | null;
  isRedacted: boolean;
  redactionNote: string | null;
  replacesHandle: string | null;
}

export interface ParsedItem {
  doi: string | null;
  title: string | null;
  author: string | null;
  committeeMembers: string[];
  abstract: string | null;
  keywords: string[];
  instanceHrid: string | null;
  datePublished: string | null;
  dateAddedToEcommons: string | null;
  access: AccessInfo;
  community: string | null;
  collection: string | null;
  bitstreams: Bitstream[];
  handleUrl: string | null;
}

export interface NestedTable {
  headers: string[];
  rows: string[][];
}

export interface DisplayRow {
  name: string;
  value: string;
  source: string; // "MODS" | "DIM" | "METS" | "PREMIS" | "missing"
  xpath: string;
  sourceXml: string;
  sourceStartLine: number; // 1-based line number in the original file
  nestedData?: NestedTable;
}
