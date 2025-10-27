import {
  ChangeEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import { PDFPageView, EventBus } from "pdfjs-dist/web/pdf_viewer";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import "pdfjs-dist/web/pdf_viewer.css";

export interface OlaPdfViewerProps {
  src: string;
}

type OptionalContentGroupSection = {
  title: string;
  groups: Array<{ id: string; label: string }>;
};

export function OlaPdfViewer({ src }: OlaPdfViewerProps) {
  const loadedSrc = useRef<string | null>(null);
  const pdfDocRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const optionalContentConfigRef = useRef<any>(null);
  const pageViewRef = useRef<PDFPageView | null>(null);
  const eventBusRef = useRef<EventBus | null>(null);
  const currentPageRef = useRef(1);
  const [groupSections, setGroupSections] = useState<OptionalContentGroupSection[]>([]);
  const [groupVisibility, setGroupVisibility] = useState<Record<string, boolean>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [isRendering, setIsRendering] = useState(false);
  const [pageInputValue, setPageInputValue] = useState("1");

  const renderPage = useCallback(
    async (pageNumber: number) => {
      const pdfDoc = pdfDocRef.current;
      const container = containerRef.current;
      const optionalContentConfig = optionalContentConfigRef.current;

      if (!pdfDoc || !container) {
        return;
      }

      if (!eventBusRef.current) {
        eventBusRef.current = new EventBus();
      }
      const eventBus = eventBusRef.current;

      const clampedPage = Math.max(1, Math.min(pageNumber, pdfDoc.numPages));

      if (pageViewRef.current) {
        try {
          pageViewRef.current.cancelRendering();
        } catch (error) {
          console.warn("Failed to cancel ongoing PDF rendering task", error);
        }
        pageViewRef.current.destroy();
        pageViewRef.current = null;
      }
      container.innerHTML = "";

      setIsRendering(true);
      try {
        const page = await pdfDoc.getPage(clampedPage);
        const scale = 1;
        const viewport = page.getViewport({ scale });
        const pageView = new PDFPageView({
          container,
          id: clampedPage,
          scale,
          defaultViewport: viewport,
          eventBus,
          textLayerMode: 2,
          optionalContentConfigPromise: optionalContentConfig
            ? Promise.resolve(optionalContentConfig)
            : undefined,
        });

        pageView.setPdfPage(page);
        pageViewRef.current = pageView;

        await pageView.draw();
        currentPageRef.current = clampedPage;
        setCurrentPage(clampedPage);
      } catch (error) {
        console.error("Failed to render PDF page", error);
      } finally {
        setIsRendering(false);
      }
    },
    []
  );

  const loadDocument = async () => {
    if (loadedSrc.current === src) {
      return;
    }

    const container = containerRef.current;
    if (!container) {
      throw new Error("Container element not found.");
    }
    /*const canvas = canvasRef.current;
    if (!canvas) {
      throw new Error("Canvas element not found.");
    }
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Unable to obtain 2D context for PDF rendering.");
    }*/

    try {
      const pdfDoc = await getDocument({ url: src }).promise;
      pdfDocRef.current = pdfDoc;
      setTotalPages(pdfDoc.numPages);
      currentPageRef.current = 1;
      setCurrentPage(1);

      const optionalContentConfig = await pdfDoc.getOptionalContentConfig();
      optionalContentConfigRef.current = optionalContentConfig;
      const order = optionalContentConfig.getOrder?.() ?? [];
      const sections: OptionalContentGroupSection[] = [];
      const visibility: Record<string, boolean> = {};

      if (Array.isArray(order)) {
        order.forEach((item: any, index: number) => {
          if (!item || typeof item !== "object" || !Array.isArray(item.order)) {
            return;
          }
          const sectionName =
            typeof item.name === "string" && item.name.length > 0
              ? item.name
              : `Group ${index + 1}`;
          const groups = item.order
            .map((groupId: unknown) => {
              if (typeof groupId !== "string") {
                return null;
              }
              const group = optionalContentConfig.getGroup(groupId);
              if (!group) {
                return null;
              }
              const label =
                typeof group.name === "string" && group.name.length > 0
                  ? group.name
                  : groupId;
              visibility[groupId] = group.visible !== false;
              return { id: groupId, label };
            })
            .filter(
              (
                group: { id: string; label: string } | null
              ): group is { id: string; label: string } => group !== null
            );

          if (groups.length > 0) {
            sections.push({ title: sectionName, groups });
          }
        });
      }

      setGroupSections(sections);
      setGroupVisibility(visibility);

      if (!eventBusRef.current) {
        eventBusRef.current = new EventBus();
      }

      await renderPage(1);
      loadedSrc.current = src;
    } catch (error) {
      console.error("Failed to load PDF document", error);
      loadedSrc.current = null;
      setGroupSections([]);
      setGroupVisibility({});
      setTotalPages(0);
      currentPageRef.current = 1;
      setCurrentPage(1);
    }
  };

  const handleGroupVisibilityChange = useCallback(
    (groupId: string, visible: boolean) => {
      setGroupVisibility((prev) => ({
        ...prev,
        [groupId]: visible,
      }));

      const optionalContentConfig = optionalContentConfigRef.current;
      if (!optionalContentConfig) {
        return;
      }

      optionalContentConfig.setVisibility(groupId, visible);
      void renderPage(currentPageRef.current);
    },
    [renderPage]
  );

  useEffect(() => {
    GlobalWorkerOptions.workerSrc = pdfjsWorker;
  }, []);

  useEffect(() => {
    console.log("Loading PDF document from src:", src);
    void loadDocument();
  }, [src]);

  useEffect(() => {
    setPageInputValue(currentPage.toString());
  }, [currentPage]);

  useEffect(() => {
    return () => {
      if (pageViewRef.current) {
        try {
          pageViewRef.current.cancelRendering();
        } catch (error) {
          console.warn("Failed to cancel PDF rendering during cleanup", error);
        }
        pageViewRef.current.destroy();
        pageViewRef.current = null;
      }
    };
  }, []);

  const goToPage = useCallback(
    (targetPage: number) => {
      const pdfDoc = pdfDocRef.current;
      if (!pdfDoc || isRendering) {
        return;
      }
      const total = pdfDoc.numPages;
      if (total <= 0) {
        return;
      }
      const clamped = Math.min(Math.max(targetPage, 1), total);
      if (clamped === currentPageRef.current) {
        return;
      }
      void renderPage(clamped);
    },
    [isRendering, renderPage]
  );

  const handlePreviousPage = useCallback(() => {
    goToPage(currentPageRef.current - 1);
  }, [goToPage]);

  const handleNextPage = useCallback(() => {
    goToPage(currentPageRef.current + 1);
  }, [goToPage]);

  const handlePageInputChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setPageInputValue(event.target.value);
  }, []);

  const handlePageInputBlur = useCallback(() => {
    setPageInputValue(currentPageRef.current.toString());
  }, []);

  const handlePageInputKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== "Enter") {
        return;
      }

      event.preventDefault();
      const nextValue = parseInt(event.currentTarget.value, 10);
      if (Number.isNaN(nextValue)) {
        setPageInputValue(currentPageRef.current.toString());
        return;
      }
      goToPage(nextValue);
    },
    [goToPage]
  );

  return (
    <div
      className="pdfViewer"
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
      }}
    >
      {groupSections.length > 0 && (
        <div
          style={{
            padding: "8px",
            borderBottom: "1px solid #e0e0e0",
            backgroundColor: "#f8f8f8",
            fontSize: "0.9rem",
          }}
        >
          {groupSections.map((section) => (
            <div key={section.title} style={{ marginBottom: "8px" }}>
              <div style={{ fontWeight: 600, marginBottom: "4px" }}>{section.title}</div>
              {section.groups.map((group) => (
                <label
                  key={group.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    marginBottom: "4px",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={groupVisibility[group.id] ?? true}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      handleGroupVisibilityChange(group.id, event.target.checked)
                    }
                  />
                  <span>{group.label}</span>
                </label>
              ))}
            </div>
          ))}
        </div>
      )}
      {totalPages > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px",
            borderBottom: "1px solid #e0e0e0",
            backgroundColor: "#fafafa",
            fontSize: "0.9rem",
          }}
        >
          <button
            type="button"
            onClick={handlePreviousPage}
            disabled={isRendering || currentPage <= 1}
            style={{ cursor: isRendering || currentPage <= 1 ? "not-allowed" : "pointer" }}
          >
            Anterior
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <input
              type="number"
              min={1}
              max={totalPages}
              value={pageInputValue}
              onChange={handlePageInputChange}
              onKeyDown={handlePageInputKeyDown}
              onBlur={handlePageInputBlur}
              style={{ width: "64px" }}
              aria-label="Current page"
            />
            <span style={{ whiteSpace: "nowrap" }}>
              / {totalPages}
            </span>
          </div>
          <button
            type="button"
            onClick={handleNextPage}
            disabled={isRendering || currentPage >= totalPages}
            style={{ cursor: isRendering || currentPage >= totalPages ? "not-allowed" : "pointer" }}
          >
            Siguiente
          </button>
        </div>
      )}
      <div
        className="pdfViewer"
        style={{
          width: "100%",
          height: "100%",
          flex: 1,
          backgroundColor: "white",
          position: "relative",
        }}
        ref={containerRef}
      >
        {/*<canvas ref={canvasRef} />*/}
      </div>
    </div>
  );
}

export default OlaPdfViewer;
