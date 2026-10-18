import React, { useEffect, useRef } from "react";
import cytoscape from "cytoscape";
import { TAG_CATALOG, TOPOLOGY } from "../plant";

interface TopologyGraphProps {
  selectedTag?: string;
  // Highest impact score among active alarms, keyed by tag
  tagImpact: Map<string, number>;
  onSelectTag: (tag: string | undefined) => void;
}

const CRITICAL_IMPACT = 0.8;

export const TopologyGraph: React.FC<TopologyGraphProps> = ({ selectedTag, tagImpact, onSelectTag }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  // Read through a ref so the graph isn't rebuilt when the callback identity changes
  const onSelectRef = useRef(onSelectTag);
  onSelectRef.current = onSelectTag;

  useEffect(() => {
    if (!containerRef.current) return;

    const cy = cytoscape({
      container: containerRef.current,
      style: [
        {
          selector: "node",
          style: {
            label: "data(label)",
            "background-color": "#334155",
            color: "#f8fafc",
            "font-size": "11px",
            "text-valign": "bottom",
            "text-margin-y": 5,
            width: 28,
            height: 28,
            "border-width": 2,
            "border-color": "#64748b",
          },
        },
        {
          selector: "edge",
          style: {
            width: 2,
            "line-color": "#475569",
            "target-arrow-color": "#475569",
            "target-arrow-shape": "triangle",
            "curve-style": "bezier",
          },
        },
        {
          selector: ".warning",
          style: { "background-color": "#d97706", "border-color": "#fbbf24" },
        },
        {
          selector: ".critical",
          style: { "background-color": "#dc2626", "border-color": "#f87171" },
        },
        {
          selector: ".highlighted",
          style: { "border-color": "#38bdf8", "border-width": 5, width: 34, height: 34 },
        },
      ],
      elements: [
        ...TAG_CATALOG.map(({ tag }) => ({ data: { id: tag, label: tag } })),
        ...TOPOLOGY.map(([source, target]) => ({ data: { source, target } })),
      ],
      layout: {
        name: "breadthfirst",
        directed: true,
        spacingFactor: 1.1,
        padding: 24,
      },
      userZoomingEnabled: false,
      boxSelectionEnabled: false,
    });

    cy.on("tap", "node", (evt) => onSelectRef.current(evt.target.id()));
    cy.on("tap", (evt) => {
      if (evt.target === cy) onSelectRef.current(undefined);
    });

    const onResize = () => cy.fit(undefined, 24);
    window.addEventListener("resize", onResize);
    cyRef.current = cy;

    return () => {
      window.removeEventListener("resize", onResize);
      cy.destroy();
      cyRef.current = null;
    };
  }, []);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.nodes().forEach((node) => {
      const impact = tagImpact.get(node.id());
      node.toggleClass("critical", impact !== undefined && impact > CRITICAL_IMPACT);
      node.toggleClass("warning", impact !== undefined && impact <= CRITICAL_IMPACT);
    });
  }, [tagImpact]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.nodes().removeClass("highlighted");
    if (!selectedTag) return;
    // getElementById returns an (always truthy) collection, so check its size
    const targetNode = cy.getElementById(selectedTag);
    if (targetNode.nonempty()) targetNode.addClass("highlighted");
  }, [selectedTag]);

  return (
    <div className="w-full bg-slate-950 rounded-lg border border-slate-800 p-2 relative">
      <div className="absolute top-3 left-3 text-xs font-mono text-slate-400 z-10">PLANT TOPOLOGY MAP</div>
      <div className="absolute top-3 right-3 z-10 flex gap-3 text-[10px] text-slate-400">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-600" /> Impact &gt; 0.8
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-amber-600" /> Active
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-slate-600" /> Normal
        </span>
      </div>
      <div ref={containerRef} className="w-full h-72" />
    </div>
  );
};
