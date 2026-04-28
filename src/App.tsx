import { useRef, useState, useMemo } from "react";
import "./App.css";
import { FileUpload } from "./components/FileUpload";
import { MappingTable } from "./components/MappingTable";
import { FullXmlView } from "./components/FullXmlView";
import { extractMappings } from "./extract";
import type { FieldResult } from "./types";

function App() {
  const [fieldResults, setFieldResults] = useState<FieldResult[]>([]);
  const [rawXml, setRawXml] = useState("");
  const [filename, setFilename] = useState("");
  const [hasFile, setHasFile] = useState(false);
  const [hoveredField, setHoveredField] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileLoaded = (xmlString: string, name: string) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, "application/xml");

    const parserError = doc.querySelector("parsererror");
    if (parserError) {
      alert("Invalid XML file. Please check the file and try again.");
      return;
    }

    const extracted = extractMappings(doc, xmlString);
    setFieldResults(extracted.fieldResults);
    setRawXml(xmlString);
    setFilename(name);
    setHasFile(true);
  };

  const handleLoadDifferentFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".xml")) {
      alert("Please upload an XML file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result;
      if (typeof text === "string") {
        handleFileLoaded(text, file.name);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // Build DisplayRow-compatible data for FullXmlView from fieldResults
  // Emit one entry per source so every schema's XML block gets highlighted
  const displayRowsForXmlView = useMemo(() => {
    return fieldResults.flatMap((fr) =>
      fr.sources
        .filter((s) => s.sourceXml)
        .map((s) => ({
          name: fr.label,
          value: "",
          source: s.schema,
          xpath: s.xpath,
          sourceXml: s.sourceXml,
          sourceStartLine: s.sourceStartLine,
        }))
    );
  }, [fieldResults]);

  if (!hasFile) {
    return (
      <div className="app">
        <div className="app-header">
          <h1>EoTD AIP Parser Prototype</h1>
        </div>
        <FileUpload onFileLoaded={handleFileLoaded} />
      </div>
    );
  }

  return (
    <div className="app">
      <div className="app-header">
        <div className="app-header-row">
          <h1>EoTD AIP Parser Prototype</h1>
          <div className="app-header-actions">
            <button className="load-different-file" onClick={handleLoadDifferentFile}>
              Load Different File
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xml"
              style={{ display: "none" }}
              onChange={handleFileInputChange}
            />
          </div>
        </div>
      </div>
      <div className="schema-legend">
        <span className="schema-legend-label">Schemas:</span>
        <span className="source-badge mods">MODS</span>
        <a className="schema-legend-link" href="https://www.loc.gov/standards/mods/" target="_blank" rel="noopener noreferrer">Metadata Object Description Schema</a>
        <span className="source-badge dim">DIM</span>
        <a className="schema-legend-link" href="https://wiki.lyrasis.org/display/DSDOC7x/Metadata+and+Bitstream+Format+Registries" target="_blank" rel="noopener noreferrer">DSpace Intermediate Metadata (Dublin Core)</a>
        <span className="source-badge other">METS</span>
        <a className="schema-legend-link" href="https://www.loc.gov/standards/mets/" target="_blank" rel="noopener noreferrer">Metadata Encoding &amp; Transmission Standard</a>
        {fieldResults.some((fr) => fr.hasDiscrepancy) && (
          <>
            <span className="discrepancy-flag">&#x26A0;</span>
            <span className="schema-legend-desc">Values differ across schemas</span>
          </>
        )}
      </div>
      <MappingTable
        fieldResults={fieldResults}
        hoveredField={hoveredField}
      />
      <FullXmlView
        rawXml={rawXml}
        rows={displayRowsForXmlView}
        filename={filename}
        onHoverField={setHoveredField}
      />
    </div>
  );
}

export default App;
