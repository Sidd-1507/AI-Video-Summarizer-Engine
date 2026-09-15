import { useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  BackgroundVariant,
} from 'reactflow';
import dagre from '@dagrejs/dagre';
import 'reactflow/dist/style.css';
import type { Topic } from '../../types/api';

// ── Layout using dagre ────────────────────────────────────────────────────────
const NODE_WIDTH  = 200;
const NODE_HEIGHT = 56;
const POINT_WIDTH = 180;
const POINT_HEIGHT = 44;

function layoutGraph(nodes: Node[], edges: Edge[]) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', ranksep: 80, nodesep: 28 });

  nodes.forEach((n) => {
    g.setNode(n.id, {
      width:  n.data?.width  ?? NODE_WIDTH,
      height: n.data?.height ?? NODE_HEIGHT,
    });
  });
  edges.forEach((e) => g.setEdge(e.source, e.target));

  dagre.layout(g);

  return nodes.map((n) => {
    const pos = g.node(n.id);
    return {
      ...n,
      position: {
        x: pos.x - (n.data?.width ?? NODE_WIDTH) / 2,
        y: pos.y - (n.data?.height ?? NODE_HEIGHT) / 2,
      },
    };
  });
}

// ── Custom node types ─────────────────────────────────────────────────────────
function RootNode({ data }: { data: { label: string } }) {
  return (
    <div className="px-4 py-2 rounded-lg bg-ink-900 text-white text-[13px] font-semibold shadow-2 max-w-[200px] text-center leading-snug">
      {data.label}
    </div>
  );
}

function TopicNode({ data }: { data: { label: string; priority: number } }) {
  return (
    <div className="px-4 py-2.5 rounded-md bg-paper border border-ink-100 text-ink-900 text-[12px] font-semibold max-w-[200px] text-center leading-snug">
      {data.label}
    </div>
  );
}

function PointNode({ data }: { data: { label: string } }) {
  return (
    <div className="px-3 py-2 rounded-sm bg-paper border border-ink-200 text-ink-700 text-[11.5px] max-w-[180px] leading-snug">
      {data.label}
    </div>
  );
}

const NODE_TYPES = {
  root:   RootNode,
  topic:  TopicNode,
  point:  PointNode,
};

// ── Main component ────────────────────────────────────────────────────────────
interface MindMapProps {
  title:  string;
  topics: Topic[];
}

export function MindMap({ title, topics }: MindMapProps) {
  const { initialNodes, initialEdges } = useMemo(() => {
    const rawNodes: Node[] = [];
    const rawEdges: Edge[] = [];

    // Root
    rawNodes.push({
      id:   'root',
      type: 'root',
      data: { label: title, width: NODE_WIDTH, height: NODE_HEIGHT },
      position: { x: 0, y: 0 },
    });

    topics.forEach((topic, ti) => {
      const topicId = `topic-${ti}`;
      rawNodes.push({
        id:   topicId,
        type: 'topic',
        data: { label: topic.title, priority: topic.priority, width: NODE_WIDTH, height: NODE_HEIGHT },
        position: { x: 0, y: 0 },
      });
      rawEdges.push({
        id:           `root-${topicId}`,
        source:       'root',
        target:       topicId,
        type:         'smoothstep',
        style:        { stroke: '#E3E4E9', strokeWidth: 1.5 },
        animated:     false,
      });

      // Revision points
      topic.revisionPoints?.slice(0, 4).forEach((pt, pi) => {
        const ptId = `point-${ti}-${pi}`;
        rawNodes.push({
          id:   ptId,
          type: 'point',
          data: { label: pt, width: POINT_WIDTH, height: POINT_HEIGHT },
          position: { x: 0, y: 0 },
        });
        rawEdges.push({
          id:     `${topicId}-${ptId}`,
          source: topicId,
          target: ptId,
          type:   'smoothstep',
          style:  { stroke: '#9497A6', strokeWidth: 1, opacity: 0.5 },
        });
      });
    });

    const laid = layoutGraph(rawNodes, rawEdges);
    return { initialNodes: laid, initialEdges: rawEdges };
  }, [title, topics]);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  return (
    <div className="flex-1 h-full" style={{ background: '#FBFBFC' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.3}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color="#E3E4E9"
        />
        <Controls
          showInteractive={false}
          className="border border-ink-100 rounded-md overflow-hidden shadow-1"
        />
      </ReactFlow>
    </div>
  );
}
