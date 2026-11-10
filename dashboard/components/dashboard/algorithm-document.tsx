"use client";

import "katex/dist/katex.min.css";
import { memo, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import katex from "katex";
import type { AlgorithmLine, Formulation } from "@/lib/algorithms/formulations";
import { alignAlgorithmLines } from "@/lib/algorithms/diff";

export interface AlgorithmDocumentProps {
  formulation: Formulation;
  version: string | null;
  provenance: string;
  showNotes: boolean;
  number?: number;
  comparison?: { formulation: Formulation; version: string | null };
}

const commonSymbols: Record<string, string> = {
  a: "Action",
  d: "Terminal-transition indicator",
  e: "Optimization epoch",
  i: "Index within a pair or batch",
  j: "Sample index",
  k: "Update index",
  r: "Reward",
  s: "State",
  t: "Time-step index",
};

type SymbolTip = {
  symbol: string;
  meaning: string;
  left: number;
  top: number;
  above: boolean;
};

function symbolAt(target: EventTarget | null): HTMLElement | null {
  return target instanceof Element
    ? target.closest<HTMLElement>(".algo-symbol")
    : null;
}

const MathLine = memo(function MathLine({
  tex,
  symbols,
}: {
  tex: string;
  symbols: Formulation["symbols"];
}) {
  const root = useRef<HTMLSpanElement>(null);
  const html = useMemo(
    () => katex.renderToString(tex, { throwOnError: true, strict: "ignore" }),
    [tex],
  );
  useEffect(() => {
    if (!root.current) return;
    const meanings = new Map<string, string>([
      ...Object.entries(commonSymbols),
      ...symbols.map(({ symbol, meaning }) => [symbol, meaning] as const),
    ]);
    const candidates = root.current?.querySelectorAll<HTMLElement>(
      ".katex-html .mord.mathnormal, .katex-html .mord.mathcal, .katex-html .mord.accent",
    );
    candidates?.forEach((node) => {
      if (
        node.classList.contains("mathnormal") &&
        node.closest(".mord.accent")
      ) {
        return;
      }
      const glyph = (node.textContent ?? "")
        .replace(/[\u200b-\u200d]/g, "")
        .trim();
      let symbol = glyph;
      if (node.classList.contains("mathcal")) {
        symbol = glyph === "D" ? "𝒟" : glyph === "E" ? "𝓔" : glyph;
      } else if (node.classList.contains("accent")) {
        symbol =
          glyph === "A"
            ? "Â"
            : glyph === "R"
              ? "R̂"
              : glyph === "ϕˉ"
                ? "φ̄"
                : glyph;
      } else if (glyph === "ϕ") {
        symbol = "φ";
      } else if (glyph === "ϵ") {
        symbol = "ε";
      }
      const meaning = meanings.get(symbol);
      if (!meaning) return;
      node.dataset.algoSymbol = symbol;
      node.dataset.algoMeaning = meaning;
      node.classList.add("algo-symbol");
    });
  }, [html, symbols]);
  return (
    <span
      ref={root}
      className="algo-math"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
});

function DocumentHeader({
  formulation,
  version,
  provenance,
  number,
  id,
  side,
}: Pick<
  AlgorithmDocumentProps,
  "formulation" | "version" | "provenance" | "number"
> & { id: string; side?: string }) {
  return (
    <header className="algo-document-header">
      {side && <p className="algo-comparison-side">{side}</p>}
      <p className="algo-paper-label">Algorithm · {formulation.family}</p>
      <h2 id={id}>
        Algorithm {number}: {formulation.title}
      </h2>
      <p className="algo-paper-version">{version ?? "Unversioned"}</p>
      <p className="algo-provenance">{provenance}</p>
    </header>
  );
}

function AlgorithmIO({
  label,
  tex,
  symbols,
  compareTex,
  side,
}: {
  label: "Input" | "Output";
  tex: string;
  symbols: Formulation["symbols"];
  compareTex?: string;
  side?: string;
}) {
  return (
    <div
      className={`algo-io algo-io-${label.toLowerCase()}`}
      data-diff={
        compareTex !== undefined && tex !== compareTex ? side : undefined
      }
    >
      <strong>{label}:</strong>
      <MathLine tex={tex} symbols={symbols} />
    </div>
  );
}

function AlgorithmStep({
  line,
  number,
  symbols,
  showNotes,
  side,
  changed,
}: {
  line?: AlgorithmLine;
  number?: number | null;
  symbols: Formulation["symbols"];
  showNotes: boolean;
  side?: string;
  changed?: boolean;
}) {
  return (
    <div
      className={`algo-step ${line?.kind === "comment" ? "algo-comment-line" : ""}`}
      data-depth={line?.depth}
      data-diff={changed ? side : undefined}
    >
      <span className="algo-line-number" aria-hidden="true">
        {changed ? (
          <span className="algo-diff-sign">{side === "left" ? "−" : "+"}</span>
        ) : null}
        {number}
      </span>
      <div className="algo-line-content">
        {line ? (
          <>
            <div className="algo-code">
              <MathLine tex={line.tex} symbols={symbols} />
            </div>
            {showNotes && line.note && (
              <p className="algo-step-note">{line.note}</p>
            )}
          </>
        ) : (
          <span
            className="algo-diff-placeholder"
            aria-label="No corresponding line"
          >
            —
          </span>
        )}
      </div>
    </div>
  );
}

function Notation({
  formulation,
  id,
  peer,
  side,
}: {
  formulation: Formulation;
  id: string;
  peer?: Formulation;
  side?: string;
}) {
  return (
    <section className="algo-notation" aria-labelledby={id}>
      <h3 id={id}>Notation</h3>
      <dl>
        {formulation.symbols.map((symbol) => (
          <div
            key={symbol.symbol}
            data-diff={
              peer &&
              !peer.symbols.some(
                (other) =>
                  other.symbol === symbol.symbol &&
                  other.meaning === symbol.meaning,
              )
                ? side
                : undefined
            }
          >
            <dt>{symbol.symbol}</dt>
            <dd>{symbol.meaning}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** Shared algorithm box. New algorithms supply data through Formulation only. */
export default function AlgorithmDocument({
  formulation,
  version,
  provenance,
  showNotes,
  number = 1,
  comparison,
}: AlgorithmDocumentProps) {
  const headingId = useId();
  const notationId = useId();
  const [tip, setTip] = useState<SymbolTip | null>(null);
  const peer = comparison?.formulation;
  const documents = [
    { formulation, version },
    ...(comparison ? [comparison] : []),
  ];
  const rows = peer
    ? alignAlgorithmLines(formulation.lines, peer.lines)
    : formulation.lines.map((_, index) => ({
        left: index,
        right: null,
        changed: false,
      }));
  const counters = [0, 0];

  function showTip(target: EventTarget | null) {
    const node = symbolAt(target);
    if (!node?.dataset.algoMeaning) return;
    const rect = node.getBoundingClientRect();
    const width = Math.min(320, window.innerWidth - 16);
    setTip({
      symbol: node.dataset.algoSymbol ?? "",
      meaning: node.dataset.algoMeaning,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
      top:
        rect.bottom + 88 < window.innerHeight ? rect.bottom + 8 : rect.top - 8,
      above: rect.bottom + 88 >= window.innerHeight,
    });
  }

  return (
    <article
      className={comparison ? "algo-comparison" : undefined}
      aria-labelledby={`${headingId}-0`}
      onPointerOver={(event) => showTip(event.target)}
      onPointerOut={(event) => {
        if (symbolAt(event.target) !== symbolAt(event.relatedTarget))
          setTip(null);
      }}
      onScrollCapture={() => setTip(null)}
    >
      <div className="algo-pair">
        {documents.map((doc, side) => (
          <DocumentHeader
            key={side}
            {...doc}
            provenance={provenance}
            number={number}
            id={`${headingId}-${side}`}
            side={
              comparison
                ? side === 0
                  ? "Current · − differences"
                  : "Comparison · + differences"
                : undefined
            }
          />
        ))}
      </div>
      <div className="algo-algorithm-box">
        <div className="algo-pair">
          {documents.map((doc, side) => (
            <AlgorithmIO
              key={side}
              label="Input"
              tex={doc.formulation.input}
              symbols={doc.formulation.symbols}
              compareTex={
                comparison ? documents[1 - side].formulation.input : undefined
              }
              side={side === 0 ? "left" : "right"}
            />
          ))}
        </div>
        <ol className="algo-pseudocode">
          {rows.map((row, index) => (
            <li
              key={index}
              className="algo-pair"
              data-depth={
                row.left === null
                  ? undefined
                  : formulation.lines[row.left].depth
              }
            >
              {documents.map((doc, side) => {
                const lineIndex = side === 0 ? row.left : row.right;
                const line =
                  lineIndex === null
                    ? undefined
                    : doc.formulation.lines[lineIndex];
                const lineNumber =
                  line && line.kind !== "comment" ? ++counters[side] : null;
                return (
                  <AlgorithmStep
                    key={side}
                    line={line}
                    number={lineNumber}
                    symbols={doc.formulation.symbols}
                    showNotes={showNotes}
                    side={side === 0 ? "left" : "right"}
                    changed={!!line && row.changed}
                  />
                );
              })}
            </li>
          ))}
        </ol>
        <div className="algo-pair">
          {documents.map((doc, side) => (
            <AlgorithmIO
              key={side}
              label="Output"
              tex={doc.formulation.output}
              symbols={doc.formulation.symbols}
              compareTex={
                comparison ? documents[1 - side].formulation.output : undefined
              }
              side={side === 0 ? "left" : "right"}
            />
          ))}
        </div>
      </div>
      <div className="algo-pair">
        {documents.map((doc, side) => (
          <Notation
            key={side}
            formulation={doc.formulation}
            id={`${notationId}-${side}`}
            peer={comparison ? documents[1 - side].formulation : undefined}
            side={side === 0 ? "left" : "right"}
          />
        ))}
      </div>
      {tip &&
        createPortal(
          <div
            className="algo-symbol-tip"
            role="tooltip"
            style={{
              left: tip.left,
              top: tip.top,
              transform: tip.above ? "translateY(-100%)" : undefined,
            }}
          >
            <strong>{tip.symbol}</strong>
            <span>{tip.meaning}</span>
          </div>,
          document.body,
        )}
    </article>
  );
}
