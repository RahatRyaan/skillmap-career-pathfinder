import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Background, Controls, MarkerType, ReactFlow, type Edge, type Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useSettings } from '@/hooks/useSettings';
import { analysisApi, profileApi } from '@/lib/endpoints';
import { PageHeader } from '@/components/layout/AppShell';
import { Card, CardHeader, EmptyState } from '@/components/ui/Card';
import { Badge, ErrorState, SkeletonCards } from '@/components/ui/States';
import { GAP_LABEL_COPY } from '@/lib/utils';

const STATUS_COLOR: Record<string, string> = {
  strong: '#16a34a',
  developing: '#d97706',
  gap: '#ea580c',
  critical: '#dc2626',
};

type GraphNode = {
  id: string;
  label: string;
  category: string;
  currentLevel: number;
  requiredLevel: number;
  gap: number;
  importance: string;
  isCore: boolean;
  status: string;
  reason: string;
};

export default function SkillMapPage() {
  const { lowDataMode } = useSettings();
  const profile = useQuery({ queryKey: ['profile'], queryFn: () => profileApi.get() });
  const careerId = profile.data?.targetCareerId ?? null;

  const map = useQuery({
    queryKey: ['skill-map', careerId],
    queryFn: () => analysisApi.skillMap(careerId!),
    enabled: Boolean(careerId),
  });

  const { nodes, edges } = useMemo(() => {
    if (!map.data) return { nodes: [] as Node[], edges: [] as Edge[] };

    // A simple layered layout: prerequisite roots on the left, dependents to
    // the right. Good enough to read, and it costs nothing.
    const depth = new Map<string, number>();
    const computeDepth = (id: string, seen = new Set<string>()): number => {
      if (depth.has(id)) return depth.get(id)!;
      if (seen.has(id)) return 0;
      seen.add(id);
      const incoming = map.data.edges.filter((e) => e.target === id);
      const value =
        incoming.length === 0
          ? 0
          : Math.max(...incoming.map((e) => computeDepth(e.source, seen))) + 1;
      depth.set(id, value);
      return value;
    };
    for (const node of map.data.nodes) computeDepth(node.id);

    const columns = new Map<number, GraphNode[]>();
    for (const node of map.data.nodes) {
      const d = depth.get(node.id) ?? 0;
      columns.set(d, [...(columns.get(d) ?? []), node]);
    }

    const flowNodes: Node[] = [];
    for (const [d, group] of columns) {
      group.forEach((node, i) => {
        flowNodes.push({
          id: node.id,
          position: { x: d * 230, y: i * 90 },
          data: { label: node.label, status: node.status, node },
          style: {
            background: lowDataMode ? undefined : `${STATUS_COLOR[node.status]}18`,
            border: `2px solid ${STATUS_COLOR[node.status] ?? '#94a3b8'}`,
            borderRadius: 10,
            padding: '8px 14px',
            fontSize: 13,
            fontWeight: 500,
            color: 'rgb(var(--text))',
            width: 190,
          },
        });
      });
    }

    const flowEdges: Edge[] = map.data.edges.map((edge) => ({
      id: `${edge.source}-${edge.target}`,
      source: edge.source,
      target: edge.target,
      type: 'smoothstep',
      markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14 },
      style: { stroke: '#94a3b8', strokeWidth: 1.5 },
    }));

    return { nodes: flowNodes, edges: flowEdges };
  }, [map.data, lowDataMode]);

  if (!careerId) {
    return (
      <div>
        <PageHeader title="Skill map" />
        <Card>
          <EmptyState
            title="No target career yet"
            body="The skill map shows the requirements of one career and where you stand against each."
            action={
              <Link to="/app/careers" className="text-brand underline">
                Choose a career
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

  if (map.isLoading) {
    return (
      <div>
        <PageHeader title="Skill map" />
        <SkeletonCards count={2} />
      </div>
    );
  }

  if (map.isError || !map.data) {
    return (
      <div>
        <PageHeader title="Skill map" />
        <ErrorState
          message="We could not build your skill map."
          onRetry={() => void map.refetch()}
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Skill map"
        description={`${map.data.careerName}, and where you stand against each requirement.`}
        action={
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge color="strong">Green: you have it</Badge>
            <Badge color="developing">Amber: partial</Badge>
            <Badge color="gap">Orange: gap</Badge>
            <Badge color="critical">Red: critical gap</Badge>
          </div>
        }
      />

      {lowDataMode ? (
        <Card>
          <CardHeader
            title="Low-data mode is on"
            description="The graph is replaced with a list to save data on slow connections."
          />
          <ul className="space-y-2">
            {map.data.nodes.map((node) => (
              <li
                key={node.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-[rgb(var(--border))] p-3"
              >
                <div>
                  <p className="text-sm font-medium">{node.label}</p>
                  <p className="text-xs text-muted">{node.reason}</p>
                </div>
                <Badge
                  color={
                    node.status === 'strong'
                      ? 'strong'
                      : node.status === 'critical'
                        ? 'critical'
                        : node.status === 'gap'
                          ? 'gap'
                          : 'developing'
                  }
                >
                  {GAP_LABEL_COPY[node.status]?.label ?? node.status}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <>
          <Card className="overflow-hidden p-0">
            <div
              style={{ height: '65vh', minHeight: 420 }}
              role="img"
              aria-label="Skill map graph. A text list of the same information follows below."
            >
              <ReactFlow
                nodes={nodes}
                edges={edges}
                fitView
                proOptions={{ hideAttribution: true }}
                nodesDraggable={false}
              >
                <Background gap={20} size={1} />
                <Controls showInteractive={false} />
              </ReactFlow>
            </div>
          </Card>

          <Card className="mt-6">
            <CardHeader
              title="Every node"
              description="The same information as the graph, in a form that works without it."
            />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Skills in your map with level and status</caption>
                <thead>
                  <tr className="border-b border-[rgb(var(--border))] text-left">
                    <th scope="col" className="py-2 pr-4 font-medium">
                      Skill
                    </th>
                    <th scope="col" className="py-2 pr-4 font-medium">
                      Yours
                    </th>
                    <th scope="col" className="py-2 pr-4 font-medium">
                      Required
                    </th>
                    <th scope="col" className="py-2 font-medium">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {map.data.nodes.map((node) => (
                    <tr
                      key={node.id}
                      className="border-b border-[rgb(var(--border))] last:border-0"
                    >
                      <th scope="row" className="py-2.5 pr-4 text-left font-normal">
                        {node.label}
                        {node.isCore ? <span className="ml-2 text-xs text-muted">core</span> : null}
                      </th>
                      <td className="py-2.5 pr-4">{node.currentLevel}</td>
                      <td className="py-2.5 pr-4">{node.requiredLevel}</td>
                      <td className="py-2.5">
                        <Badge
                          color={
                            node.status === 'strong'
                              ? 'strong'
                              : node.status === 'critical'
                                ? 'critical'
                                : node.status === 'gap'
                                  ? 'gap'
                                  : 'developing'
                          }
                        >
                          {GAP_LABEL_COPY[node.status]?.label ?? node.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      <p className="mt-6 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-raised))] p-4 text-xs text-muted">
        {map.data.disclaimer} Turn on low-data mode in settings to replace the graph with a list.
      </p>
    </div>
  );
}
