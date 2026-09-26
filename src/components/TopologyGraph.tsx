import React, { useEffect, useRef } from "react";
import cytoscape from "cytoscape";

interface TopologyGraphProps {
  selectedTag?: string;
}

export const TopologyGraph: React.FC<TopologyGraphProps> = ({ selectedTag }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    cyRef.current = cytoscape({
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
          selector: ".highlighted",
          style: {
            "background-color": "#ef4444",
            "border-color": "#f87171",
            "border-width": 4,
          },
        },
      ],
      elements: [
        { data: { id: "PUMP-101A", label: "PUMP-101A" } },
        { data: { id: "FLOW-105", label: "FLOW-105" } },
        { data: { id: "TEMP-302", label: "TEMP-302" } },
        { data: { id: "VALVE-204", label: "VALVE-204" } },
        { data: { id: "ELEC-401", label: "ELEC-401" } },
        // Topological Plant Connections
        { data: { source: "ELEC-401", target: "PUMP-101A" } },
        { data: { source: "PUMP-101A", target: "FLOW-105" } },
        { data: { source: "FLOW-105", target: "TEMP-302" } },
        { data: { source: "TEMP-302", target: "VALVE-204" } },
      ],
      layout: {
        name: "grid",
        rows: 2,
      },
    });

    return () => {
      cyRef.current?.destroy();
    };
  }, []);

  useEffect(() => {
    if (!cyRef.current) return;
    cyRef.current.nodes().removeClass("highlighted");
    if (selectedTag) {
      const targetNode = cyRef.current.getElementById(selectedTag);
      if (targetNode) {
        targetNode.addClass("highlighted");
      }
    }
  }, [selectedTag]);

  return (
    <div className="w-full h-full bg-slate-950 rounded-lg border border-slate-800 p-2 relative">
      <div className="absolute top-3 left-3 text-xs font-mono text-slate-400 z-10">
        PLANT TOPOLOGY MAP
      </div>
      <div ref={containerRef} className="w-full h-64" />
    </div>
  );
};
