import { useRef, useState } from "react";
import type { DragEvent } from "react";
import "./FileUpload.css";

interface FileUploadProps {
  onFileLoaded: (xmlString: string, filename: string) => void;
}

export function FileUpload({ onFileLoaded }: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const readFile = (file: File) => {
    if (!file.name.endsWith(".xml")) {
      alert("Please upload an XML file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text === "string") {
        onFileLoaded(text, file.name);
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) readFile(file);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) readFile(file);
  };

  return (
    <div
      className={`file-upload ${isDragOver ? "drag-over" : ""}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={handleClick}
    >
      <p>Drag and drop a DSpace AIP XML file here, or click to browse for one</p>
      <button type="button" className="file-upload-button">
        Choose File
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".xml"
        onChange={handleInputChange}
      />
    </div>
  );
}
