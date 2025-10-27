import { useEffect, useMemo, useRef, useState } from "react";
import { OlaPdfViewer } from "ola-pdf";

//const SAMPLE_PDF =
//"https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf";
//"http://localhost:5173/test.pdf";
//"https://gcr5xq0t-5173.uks1.devtunnels.ms/test.pdf";

const heights = ["480px", "640px", "80vh"];

export default function App() {
  const [hideToolbar, setHideToolbar] = useState(true);
  const [heightIndex, setHeightIndex] = useState(1);
  const [pdfSrc, setPdfSrc] = useState("");
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const height = useMemo(() => heights[heightIndex] ?? "640px", [heightIndex]);

  useEffect(() => {
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [objectUrl]);

  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) {
      return;
    }

    const file = files[0];
    const nextUrl = URL.createObjectURL(file);
    setObjectUrl(nextUrl);
    setPdfSrc(nextUrl);
  };

  return (
    <div className="app">
      <header className="app__controls">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          style={{ cursor: "pointer" }}
        >
          Seleccionar PDF
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          style={{ display: "none" }}
          onChange={(event) => handleFileSelect(event.target.files)}
        />
      </header>
      <main className="app__viewer">
        {pdfSrc && (
          <OlaPdfViewer
            src={pdfSrc}
            height={height}
            hideToolbar={hideToolbar}
            style={{
              borderRadius: "12px",
              boxShadow: "0 12px 24px rgba(15, 23, 42, 0.18)",
            }}
          />
        )}
      </main>
    </div>
  );
}
