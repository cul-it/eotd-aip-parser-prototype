import { useRef, useState } from "react";
import "./App.css";
import { FileUpload } from "./components/FileUpload";
import { MappingTable } from "./components/MappingTable";
// import { ExportButton } from "./components/ExportButton";
import { FullXmlView } from "./components/FullXmlView";
import { extractMappings } from "./extract";
import type { DisplayRow } from "./types";

function App() {
  const [rows, setRows] = useState<DisplayRow[]>([]);
  // const [item, setItem] = useState<ParsedItem | null>(null);
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
    // setItem(extracted.item);
    setRows(extracted.rows);
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
    // Reset so the same file can be re-selected
    e.target.value = "";
  };

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
          <h1>EoTD AIP Prototype Parser</h1>
          <div className="app-header-actions">
            {/* <ExportButton item={item} /> */}
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
      <MappingTable rows={rows} hoveredField={hoveredField} />
      <FullXmlView rawXml={rawXml} rows={rows} filename={filename} onHoverField={setHoveredField} />
    </div>
  );
}

export default App;
