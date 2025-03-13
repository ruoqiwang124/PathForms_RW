"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import * as d3 from "d3";

/** 方向定义 */
type DirKey = "up" | "down" | "left" | "right";

const directions: Record<DirKey, {
  dx: number;
  dy: number;
  opposite: DirKey;
  symbol: string;
}> = {
  up:    { dx:  0, dy: -1, opposite: "down",  symbol: "a"  },
  down:  { dx:  0, dy:  1, opposite: "up",    symbol: "a-" },
  left:  { dx: -1, dy:  0, opposite: "right", symbol: "b-" },
  right: { dx:  1, dy:  0, opposite: "left",  symbol: "b"  },
};

/** 判断两个符号是否互为相反（a 与 a- / b 与 b-） */
function isOppositeSymbol(sym1: string, sym2: string) {
  return (
    (sym1 === "a" && sym2 === "a-") ||
    (sym1 === "a-" && sym2 === "a") ||
    (sym1 === "b" && sym2 === "b-") ||
    (sym1 === "b-" && sym2 === "b")
  );
}

/** 翻转单个符号（a <-> a-、b <-> b-） */
function flipSymbol(sym: string): string {
  switch (sym) {
    case "a":  return "a-";
    case "a-": return "a";
    case "b":  return "b-";
    case "b-": return "b";
    default:   return sym;
  }
}

/** 对符号串整体做翻转 (a -> a-, b -> b-)，即取逆 */
function flipPathString(pathStr: string): string {
  const parts = pathStr.match(/(a-|a|b-|b)/g) || [];
  return parts.map(flipSymbol).join("");
}

/** 
 * 相邻逆元消去 (a 与 a- / b 与 b-):
 * 遍历符号数组时，只要发现相邻互为相反，就抵消。
 */
function reduceSymbolArray(symbolArray: string[]): string[] {
  const stack: string[] = [];
  for (const sym of symbolArray) {
    if (stack.length > 0 && isOppositeSymbol(sym, stack[stack.length - 1])) {
      stack.pop(); // 抵消
    } else {
      stack.push(sym);
    }
  }
  return stack;
}

/** 节点数据结构 */
interface NodeSim {
  id: string;
  initX: number;
  initY: number;
  x: number;
  y: number;
  depth: number;
  step: number;
}

/** 边数据结构 */
interface LinkSim {
  id: string;
  source: NodeSim;
  target: NodeSim;
  direction: DirKey;
}

/** 已保存路径的数据结构 */
interface SavedPath {
  pathStr: string;   
  nodeIds: string[];
  edgeIds: string[];
}

/** 
 * 给定符号串，依照 nodeMap/linkMap 尝试逐步走完。
 * 如果某一步无法找到对应边/节点，则中断，返回已走的部分。
 */
function parsePathBySymbols(
  pathStr: string,
  nodeMap: Map<string, NodeSim>,
  linkMap: Map<string, LinkSim>
): { nodeIds: string[]; edgeIds: string[] } {
  const parts = pathStr.match(/(a-|a|b-|b)/g) || [];
  const nodeIds: string[] = [];
  const edgeIds: string[] = [];

  const origin = nodeMap.get("0,0");
  if (!origin) return { nodeIds, edgeIds };

  let current = origin;
  nodeIds.push(current.id);

  for (const sym of parts) {
    let dirKey: DirKey | null = null;
    if (sym === "a")  dirKey = "up";
    if (sym === "a-") dirKey = "down";
    if (sym === "b")  dirKey = "right";
    if (sym === "b-") dirKey = "left";
    if (!dirKey) continue;

    const { dx, dy } = directions[dirKey];
    const nx = current.initX + dx * current.step;
    const ny = current.initY + dy * current.step;
    const neighborId = `${nx},${ny}`;
    const edgeId = `${current.id}->${neighborId}`;

    if (nodeMap.has(neighborId) && linkMap.has(edgeId)) {
      nodeIds.push(neighborId);
      edgeIds.push(edgeId);
      current = nodeMap.get(neighborId)!;
    } else {
      // 中断
      break;
    }
  }

  return { nodeIds, edgeIds };
}

/** 
 * 递归生成 Cayley Tree (最大深度=5)
 */
function buildCayleyTree(
  nodeMap: Map<string, NodeSim>,
  linkMap: Map<string, LinkSim>,
  x: number,
  y: number,
  depth: number,
  maxDepth: number,
  fromDir: DirKey | null,
  step: number
) {
  const nodeId = `${x},${y}`;
  if (!nodeMap.has(nodeId)) {
    nodeMap.set(nodeId, {
      id: nodeId,
      initX: x,
      initY: y,
      x: 0,
      y: 0,
      depth,
      step,
    });
  }
  const parent = nodeMap.get(nodeId)!;
  if (depth >= maxDepth) return;

  for (const [dirKey, info] of Object.entries(directions) as [DirKey, typeof directions["up"]][]) {
    if (fromDir && info.opposite === fromDir) continue;
    const nx = x + info.dx * step;
    const ny = y + info.dy * step;
    const childId = `${nx},${ny}`;

    if (!nodeMap.has(childId)) {
      nodeMap.set(childId, {
        id: childId,
        initX: nx,
        initY: ny,
        x: 0,
        y: 0,
        depth: depth + 1,
        step: step * 0.5,
      });
    }
    const child = nodeMap.get(childId)!;
    const edgeId = `${nodeId}->${childId}`;
    if (!linkMap.has(edgeId)) {
      linkMap.set(edgeId, {
        id: edgeId,
        source: parent,
        target: child,
        direction: dirKey,
      });
    }
    buildCayleyTree(nodeMap, linkMap, nx, ny, depth + 1, maxDepth, dirKey, step * 0.5);
  }
}

/** 
 * 随机生成一条长度≥3 的符号串，化简后等价于 singleBase ('a' or 'b')，
 * 并确保它可以在 Cayley Tree (深度5) 中完整走完不越界。
 */
function makeNonTrivialPath(
  singleBase: 'a' | 'b',
  nodeMap: Map<string, NodeSim>,
  linkMap: Map<string, LinkSim>
): string {
  const possibleSymbols = ["a", "a-", "b", "b-"];
  const maxAttempts = 100;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // 随机长度 [3..12]
    const length = 3 + Math.floor(Math.random() * 10);
    const arr: string[] = [];
    // 保证它至少出现一次 singleBase
    arr.push(singleBase);

    // 剩下 length-1 个符号随机
    for (let i = 1; i < length; i++) {
      const s = possibleSymbols[Math.floor(Math.random() * possibleSymbols.length)];
      arr.push(s);
    }

    // 做相邻逆元消去
    const reduced = reduceSymbolArray(arr);
    // 如果最终不是 singleBase，则跳过
    if (reduced.length !== 1 || reduced[0] !== singleBase) {
      continue;
    }

    // 确认能在 CayleyTree 中完全解析
    const rawStr = arr.join("");
    const { nodeIds } = parsePathBySymbols(rawStr, nodeMap, linkMap);
    // 如果能完全走完 => nodeIds.length == arr.length + 1
    if (nodeIds.length === arr.length + 1) {
      return rawStr;
    }
  }

  // 尝试多次不成功，使用固定后备
  if (singleBase === "a") {
    // "abb-" => 长度3 => 相邻消去 => a
    const fallback = "abb-";
    const { nodeIds } = parsePathBySymbols(fallback, nodeMap, linkMap);
    if (nodeIds.length === 4) {
      return fallback;
    } else {
      // 如果后备也不行...那就只能硬返回它
      return fallback;
    }
  } else {
    // "baa-" => 长度3 => 相邻消去 => b
    const fallback = "baa-";
    const { nodeIds } = parsePathBySymbols(fallback, nodeMap, linkMap);
    if (nodeIds.length === 4) {
      return fallback;
    } else {
      return fallback;
    }
  }
}

/** 节点组件 */
function Vertex(props: {
  id: string;
  x: number;
  y: number;
  isHighlighted: boolean;
  isShined: boolean;
  inProgress: boolean;
  savedPathIndex: number | null;
  onHover: (id: string, hover: boolean) => void;
  onClick: (id: string) => void;
}) {
  const {
    id, x, y,
    isHighlighted, isShined, inProgress, savedPathIndex,
    onHover, onClick
  } = props;

  const [hovered, setHovered] = useState(false);

  const handleMouseEnter = () => {
    setHovered(true);
    onHover(id, true);
  };
  const handleMouseLeave = () => {
    setHovered(false);
    onHover(id, false);
  };
  const handleClick = () => onClick(id);

  let fillColor = "lightblue";
  let dashStyle: React.CSSProperties = {};

  if (inProgress) {
    fillColor = "black";
    dashStyle = { strokeDasharray: "2,2", animation: "dash 1s linear infinite" };
  } else if (savedPathIndex !== null) {
    const colorPalette = ["red", "blue", "green", "orange", "purple", "tomato"];
    fillColor = colorPalette[savedPathIndex % colorPalette.length];
    dashStyle = { strokeDasharray: "2,2", animation: "dash 1s linear infinite" };
  }

  if (hovered) {
    fillColor = "orange";
  } else if (isShined) {
    fillColor = "gold";
  } else if (isHighlighted) {
    fillColor = "#007acc";
  }

  return (
    <circle
      cx={x}
      cy={y}
      r={0.7}
      fill={fillColor}
      style={{ cursor: "pointer", ...dashStyle }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    />
  );
}

/** 边组件 */
function Edge(props: {
  direction: DirKey;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  isHighlighted: boolean;
  inProgress: boolean;
  savedPathIndex: number | null;
  onHover?: (hovered: boolean) => void;
}) {
  const {
    direction,
    sourceX, sourceY,
    targetX, targetY,
    isHighlighted, inProgress,
    savedPathIndex, onHover
  } = props;

  let strokeColor = "#999";
  let dashStyle: React.CSSProperties = {};

  if (inProgress) {
    strokeColor = "black";
    dashStyle = { strokeDasharray: "2,2", animation: "dash 1s linear infinite" };
  } else if (savedPathIndex !== null) {
    const colorPalette = ["red", "blue", "green", "orange", "purple", "tomato"];
    strokeColor = colorPalette[savedPathIndex % colorPalette.length];
    dashStyle = { strokeDasharray: "2,2", animation: "dash 1s linear infinite" };
  } else {
    if (direction === "up" || direction === "down") strokeColor = "pink";
    else strokeColor = "yellow";
  }

  if (isHighlighted) {
    strokeColor = "orange";
  }

  const handleMouseEnter = () => onHover?.(true);
  const handleMouseLeave = () => onHover?.(false);

  return (
    <line
      x1={sourceX}
      y1={sourceY}
      x2={targetX}
      y2={targetY}
      stroke={strokeColor}
      strokeWidth={0.5}
      style={dashStyle}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    />
  );
}

export default function CayleyTree() {
  /** 
   * 1) 避免在顶层访问 window，先给 size 一个安全初值 (0,0)。 
   * 2) 再用 useEffect 在客户端获取并更新实际尺寸。
   */
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    function handleResize() {
      setSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }
    // 首次执行
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // 是否在关卡模式
  const [isLevel1, setIsLevel1] = useState(false);

  const [nodes, setNodes] = useState<NodeSim[]>([]);
  const [links, setLinks] = useState<LinkSim[]>([]);
  const nodeMapRef = useRef(new Map<string, NodeSim>());
  const linkMapRef = useRef(new Map<string, LinkSim>());

  // Hover/click
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [shinedId, setShinedId] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<NodeSim | null>(null);

  // 正在手动画的 path
  const [pathNodes, setPathNodes] = useState<string[]>([]);
  const [pathEdges, setPathEdges] = useState<string[]>([]);
  const [pathSymbols, setPathSymbols] = useState<string[]>([]);

  // Saved paths
  const [savedPaths, setSavedPaths] = useState<SavedPath[]>([]);
  const [highlightedNodesMap, setHighlightedNodesMap] = useState<Record<string, number>>({});
  const [highlightedEdgesMap, setHighlightedEdgesMap] = useState<Record<string, number>>({});

  const [selectedPathIndex, setSelectedPathIndex] = useState<number | null>(null);

  // Concatenate
  const [concatPath1Index, setConcatPath1Index] = useState<number | null>(null);
  const [concatPath2Index, setConcatPath2Index] = useState<number | null>(null);

  // d3 zoom
  const svgRef = useRef<SVGSVGElement | null>(null);
  const gRef = useRef<SVGGElement | null>(null);

  /** fitToScreen 回调 */
  const fitToScreen = useCallback(() => {
    if (!gRef.current || nodes.length === 0) return;
    const sel = d3.select(gRef.current);
    sel.attr("transform", null);

    const bbox = gRef.current.getBBox();
    const { x, y, width, height } = bbox;
    if (width === 0 || height === 0) return;

    const margin = 20;
    const w = size.width;
    const h = size.height;
    if (w === 0 || h === 0) return;

    const scale = Math.min(w/(width+2*margin), h/(height+2*margin));
    const tx = w/2 - scale*(x+width/2);
    const ty = h/2 - scale*(y+height/2);

    sel.attr("transform", `translate(${tx}, ${ty}) scale(${scale})`);
  }, [nodes, size]);

  /**
   * 2) 当我们拿到实际的 size 时，再构建 Cayley Tree
   */
  useEffect(() => {
    if (size.width === 0 || size.height === 0) {
      // 说明还没拿到浏览器尺寸，此时先不生成
      return;
    }

    const nodeMap = new Map<string, NodeSim>();
    const linkMap = new Map<string, LinkSim>();

    buildCayleyTree(nodeMap, linkMap, 0, 0, 0, 5, null, 50);

    // 中心点
    const cx = size.width / 2;
    const cy = size.height / 2;
    for (const nd of nodeMap.values()) {
      nd.x = nd.initX + cx;
      nd.y = nd.initY + cy;
    }
    nodeMapRef.current = nodeMap;
    linkMapRef.current = linkMap;

    setNodes([...nodeMap.values()]);
    setLinks([...linkMap.values()]);

    // 默认选中原点
    const origin = nodeMap.get("0,0") || null;
    setSelectedNode(origin);
    setPathNodes(origin ? [origin.id] : []);
    setPathEdges([]);
    setPathSymbols([]);
  }, [size]);

  /** 
   * 3) d3-zoom 
   * 当 nodes/links 准备好后，启用 zoom & 自适应。
   */
  useEffect(() => {
    if (!svgRef.current || !gRef.current) return;
    if (nodes.length === 0 || links.length === 0) return;

    const svgSel = d3.select(svgRef.current);
    const gSel = d3.select(gRef.current);

    const zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 10])
      .on("zoom", (evt) => {
        gSel.attr("transform", evt.transform);
      });
    svgSel.call(zoomBehavior);

    fitToScreen();
  }, [nodes, links, fitToScreen]);

  //----------------------------
  // hover/click
  //----------------------------
  const handleHover = (id: string, hover: boolean) => {
    setHighlightedId(hover ? id : null);
  };
  const handleClick = (id: string) => {
    setShinedId(prev => (prev === id ? null : id));
    setSelectedNode(nodeMapRef.current.get(id) || null);
  };

  //----------------------------
  // 手动走路径
  //----------------------------
  const handleDirection = (dirKey: DirKey) => {
    if (!selectedNode) return;
    const sym = directions[dirKey].symbol;

    // 如果与最后一个符号互为相反 => 回退
    if (pathSymbols.length > 0) {
      const last = pathSymbols[pathSymbols.length - 1];
      if (isOppositeSymbol(sym, last)) {
        setPathSymbols(p => p.slice(0, -1));
        setPathEdges(p => p.slice(0, -1));
        setPathNodes(p => {
          const newArr = p.slice(0, -1);
          const backId = newArr[newArr.length - 1];
          setSelectedNode(nodeMapRef.current.get(backId) || null);
          return newArr;
        });
        return;
      }
    }

    const { initX, initY, step } = selectedNode;
    const { dx, dy } = directions[dirKey];
    const nx = initX + dx * step;
    const ny = initY + dy * step;
    const nid = `${nx},${ny}`;
    const eid = `${selectedNode.id}->${nid}`;

    // 不越界则前进
    if (nodeMapRef.current.has(nid) && linkMapRef.current.has(eid)) {
      setPathNodes(p => [...p, nid]);
      setPathEdges(p => [...p, eid]);
      setPathSymbols(p => [...p, sym]);
      setSelectedNode(nodeMapRef.current.get(nid) || null);
    }
  };

  //----------------------------
  // Save path
  //----------------------------
  const handleSavePath = () => {
    const pathStr = pathSymbols.join("");
    if (!pathStr) {
      alert("当前没有可保存的手动路径");
      return;
    }
    const newPath: SavedPath = {
      pathStr,
      nodeIds: [...pathNodes],
      edgeIds: [...pathEdges],
    };
    const updated = [...savedPaths, newPath];
    setSavedPaths(updated);
    buildHighlightMaps(updated);

    // 返回原点
    const origin = nodeMapRef.current.get("0,0") || null;
    setSelectedNode(origin);
    setPathNodes(origin ? [origin.id] : []);
    setPathEdges([]);
    setPathSymbols([]);
  };

  //----------------------------
  // Inverse 选中
  //----------------------------
  const handleInverseSelected = () => {
    if (selectedPathIndex == null) {
      alert("请先选中要取逆的路径");
      return;
    }
    if (selectedPathIndex < 0 || selectedPathIndex >= savedPaths.length) {
      alert("非法索引");
      return;
    }
    const newArr = [...savedPaths];
    const tgt = newArr[selectedPathIndex];
    const flipped = flipPathString(tgt.pathStr);
    const { nodeIds, edgeIds } = parsePathBySymbols(flipped, nodeMapRef.current, linkMapRef.current);
    tgt.pathStr = flipped;
    tgt.nodeIds = nodeIds;
    tgt.edgeIds = edgeIds;

    setSavedPaths(newArr);
    buildHighlightMaps(newArr);
  };

  //----------------------------
  // Remove 选中
  //----------------------------
  const handleRemoveSelectedPath = () => {
    if (selectedPathIndex == null) {
      alert("先选中要删除的路径");
      return;
    }
    if (selectedPathIndex < 0 || selectedPathIndex >= savedPaths.length) {
      alert("非法索引");
      return;
    }
    const newArr = [...savedPaths];
    newArr.splice(selectedPathIndex, 1);
    setSavedPaths(newArr);
    buildHighlightMaps(newArr);
  };

  //----------------------------
  // Concatenate (不删 path2)
  //----------------------------
  const handleConcatenate = () => {
    if (
      concatPath1Index == null ||
      concatPath2Index == null ||
      concatPath1Index < 0 ||
      concatPath2Index < 0 ||
      concatPath1Index >= savedPaths.length ||
      concatPath2Index >= savedPaths.length
    ) {
      alert("请选择要 Concatenate 的 path1 和 path2");
      return;
    }
    if (concatPath1Index === concatPath2Index) {
      alert("不能选择同一条路径");
      return;
    }

    const newPaths = [...savedPaths];
    const p1 = newPaths[concatPath1Index];
    const p2 = newPaths[concatPath2Index];

    const arr1 = p1.pathStr.match(/(a-|a|b-|b)/g) || [];
    const arr2 = p2.pathStr.match(/(a-|a|b-|b)/g) || [];

    const r1 = reduceSymbolArray(arr1);
    const r2 = reduceSymbolArray(arr2);
    const combined = [...r1, ...r2];
    const finalSymbols = reduceSymbolArray(combined);
    const finalStr = finalSymbols.join("");

    const { nodeIds, edgeIds } = parsePathBySymbols(finalStr, nodeMapRef.current, linkMapRef.current);

    p1.pathStr = finalStr;
    p1.nodeIds = nodeIds;
    p1.edgeIds = edgeIds;

    // 不删除 p2
    setSavedPaths(newPaths);
    buildHighlightMaps(newPaths);

    alert(`Concatenate 完成，新的 path1: ${finalStr}\n保留 path2 不变`);
  };

  //----------------------------
  // Clear all
  //----------------------------
  const handleClearAllPaths = () => {
    setSavedPaths([]);
    buildHighlightMaps([]);
  };

  //----------------------------
  // 自动画 (0,0)->selectedNode
  //----------------------------
  const handleDrawPath = () => {
    if (!selectedNode) {
      alert("先选中一个节点");
      return;
    }
    if (selectedNode.id === "0,0") {
      alert("目标是原点，无需自动画");
      return;
    }

    // BFS
    const adjList = buildAdjList();
    const start = "0,0";
    const end = selectedNode.id;
    const queue = [start];
    const visited = new Set([start]);
    const prevMap = new Map<string, [string, DirKey]>();

    let found = false;
    while (queue.length) {
      const cur = queue.shift()!;
      if (cur === end) {
        found = true; break;
      }
      const neighbors = adjList[cur] || [];
      for (const { neighborId, direction } of neighbors) {
        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          queue.push(neighborId);
          prevMap.set(neighborId, [cur, direction]);
        }
      }
    }
    if (!found) {
      alert("无法到达");
      return;
    }

    const syms: string[] = [];
    const nids: string[] = [];
    const eids: string[] = [];

    let curId = end;
    nids.push(curId);
    while (curId !== start) {
      const [pId, dir] = prevMap.get(curId)!;
      syms.push(directions[dir].symbol);
      eids.push(`${pId}->${curId}`);
      curId = pId;
      nids.push(curId);
    }
    syms.reverse();
    eids.reverse();
    nids.reverse();

    const pathStr = syms.join("");
    const newPath: SavedPath = {
      pathStr,
      nodeIds: nids,
      edgeIds: eids
    };
    const updated = [...savedPaths, newPath];
    setSavedPaths(updated);
    buildHighlightMaps(updated);
  };

  function buildAdjList(): Record<string, { neighborId: string; direction: DirKey }[]> {
    const adj: Record<string, { neighborId: string; direction: DirKey }[]> = {};
    for (const lk of linkMapRef.current.values()) {
      const sId = lk.source.id;
      const tId = lk.target.id;
      const d = lk.direction;
      if (!adj[sId]) adj[sId] = [];
      adj[sId].push({ neighborId: tId, direction: d });

      const opp = directions[d].opposite;
      if (!adj[tId]) adj[tId] = [];
      adj[tId].push({ neighborId: sId, direction: opp });
    }
    return adj;
  }

  //----------------------------
  // 进入 Level1：生成2条化简=a / b 的非平凡path
  //----------------------------
  const handleEnterLevel1 = () => {
    setIsLevel1(true);

    // 清空当前
    const newPaths: SavedPath[] = [];

    // 生成等价于 a 的路径 (长度≥3)
    const rawA = makeNonTrivialPath("a", nodeMapRef.current, linkMapRef.current);
    const parseA = parsePathBySymbols(rawA, nodeMapRef.current, linkMapRef.current);
    newPaths.push({
      pathStr: rawA,
      nodeIds: parseA.nodeIds,
      edgeIds: parseA.edgeIds
    });

    // 生成等价于 b 的路径 (长度≥3)
    const rawB = makeNonTrivialPath("b", nodeMapRef.current, linkMapRef.current);
    const parseB = parsePathBySymbols(rawB, nodeMapRef.current, linkMapRef.current);
    newPaths.push({
      pathStr: rawB,
      nodeIds: parseB.nodeIds,
      edgeIds: parseB.edgeIds
    });

    setSavedPaths(newPaths);
    buildHighlightMaps(newPaths);
    alert(`已进入Level1!\n生成的2条路径:\n1) ${rawA}\n2) ${rawB}\n都可在深度5的树中完整解析，且相邻消去后是 a / b.\n请用inverse或concatenate化简它们。`);
  };

  //----------------------------
  // 退出 Level1
  //----------------------------
  const handleExitLevel1 = () => {
    setIsLevel1(false);
    setSavedPaths([]);
    buildHighlightMaps([]);
    alert("已退出Level1，并清空了关卡路径");
  };

  //----------------------------
  // 检查是否胜利
  //----------------------------
  const handleCheckWin = () => {
    if (!isLevel1) {
      alert("不在关卡模式。");
      return;
    }
    if (savedPaths.length !== 2) {
      alert("路径数量不是2，还无法判定胜负");
      return;
    }
    // 要求: 2条路径都是 single symbol 'a' / 'b'
    const bases = savedPaths.map(p => p.pathStr).sort();
    if (bases[0] === "a" && bases[1] === "b") {
      alert("恭喜你，成功把它们化简到 a 和 b！");
    } else {
      alert(`尚未化简到 a 和 b，请继续努力！\n当前: ${bases[0]}, ${bases[1]}`);
    }
  };

  //----------------------------
  // 高亮
  //----------------------------
  function buildHighlightMaps(paths: SavedPath[]) {
    const nMap: Record<string, number> = {};
    const eMap: Record<string, number> = {};

    paths.forEach((p, i) => {
      p.nodeIds.forEach(nd => {
        if (nMap[nd] === undefined) nMap[nd] = i;
      });
      p.edgeIds.forEach(ed => {
        if (eMap[ed] === undefined) eMap[ed] = i;
      });
    });
    setHighlightedNodesMap(nMap);
    setHighlightedEdgesMap(eMap);
  }

  return (
    <div style={{ width: "100vw", height: "100vh", margin: 0, padding: 0 }}>
      <style jsx global>{`
        @keyframes dash {
          to { stroke-dashoffset: -10; }
        }
      `}</style>

      <div style={{ position: "absolute", top: 10, left: 10, zIndex: 999, background: "#eee", padding: "10px" }}>

        {/* Level1 模式 */}
        <div>
          <button onClick={handleEnterLevel1} disabled={isLevel1}>Enter Level1</button>
          <button onClick={handleExitLevel1} disabled={!isLevel1} style={{ marginLeft: 6 }}>Exit Level1</button>
          <button onClick={handleCheckWin} disabled={!isLevel1} style={{ marginLeft: 6 }}>Check Win</button>
        </div>

        <hr style={{ margin: "8px 0" }} />

        {/* 手动按钮 */}
        <div>
          <button onClick={() => handleDirection("up")}>Up(a)</button>
          <button onClick={() => handleDirection("down")}>Down(a-)</button>
          <button onClick={() => handleDirection("left")}>Left(b-)</button>
          <button onClick={() => handleDirection("right")}>Right(b)</button>
        </div>
        <div style={{ marginTop: 6 }}>
          <strong>Current manual path</strong>: {pathSymbols.join("")}
        </div>
        <div style={{ marginTop: 6 }}>
          <button onClick={handleSavePath}>Save manual path</button>
        </div>

        <hr style={{ margin: "8px 0" }} />

        <div>
          <button onClick={handleDrawPath}>Draw path from (0,0) to current node</button>
        </div>

        {/* 已保存路径 */}
        <div style={{ marginTop: 10 }}>
          <strong>Saved paths (select to inverse / remove)</strong>:
          <ul style={{ margin: 0, paddingLeft: "1.2em" }}>
            {savedPaths.map((p, i) => (
              <li key={i}>
                <label style={{ cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="savedPath"
                    checked={selectedPathIndex === i}
                    onChange={() => setSelectedPathIndex(i)}
                    style={{ marginRight: 6 }}
                  />
                  Path{i + 1}: {p.pathStr}
                </label>
              </li>
            ))}
          </ul>
          <button style={{ marginTop: 6, marginRight: 6 }} onClick={handleInverseSelected}>
            Inverse selected path
          </button>
          <button style={{ marginTop: 6 }} onClick={handleRemoveSelectedPath}>
            Remove selected path
          </button>
        </div>

        <hr style={{ margin: "8px 0" }} />

        {/* Concatenate (不会删除 path2) */}
        <div style={{ marginTop: 10 }}>
          <strong>Concatenate</strong>:
          <div style={{ marginTop: 6 }}>
            <label>Choose Path1:</label>
            <select
              value={concatPath1Index ?? ""}
              onChange={e => setConcatPath1Index(Number(e.target.value))}
              style={{ marginLeft: 6, marginRight: 10 }}
            >
              <option value="">(none)</option>
              {savedPaths.map((_, i) => <option key={i} value={i}>Path{i + 1}</option>)}
            </select>

            <label>Choose Path2:</label>
            <select
              value={concatPath2Index ?? ""}
              onChange={e => setConcatPath2Index(Number(e.target.value))}
              style={{ marginLeft: 6 }}
            >
              <option value="">(none)</option>
              {savedPaths.map((_, i) => <option key={i} value={i}>Path{i + 1}</option>)}
            </select>
          </div>
          <button style={{ marginTop: 6 }} onClick={handleConcatenate}>
            Concatenate (keep path2)
          </button>
        </div>

        <hr style={{ margin: "8px 0" }} />

        <div>
          <button onClick={handleClearAllPaths}>Clear all saved paths</button>
        </div>
      </div>

      <svg
        ref={svgRef}
        width={size.width}
        height={size.height}
        style={{ display: "block", background: "#fff" }}
      >
        <g ref={gRef}>
          {/* 边 */}
          {links.map(lk => {
            const eId = lk.id;
            const inProgress = pathEdges.includes(eId);
            const spIndex = highlightedEdgesMap[eId] ?? null;
            return (
              <Edge
                key={eId}
                direction={lk.direction}
                sourceX={lk.source.x}
                sourceY={lk.source.y}
                targetX={lk.target.x}
                targetY={lk.target.y}
                isHighlighted={highlightedId === eId}
                inProgress={inProgress}
                savedPathIndex={spIndex}
                onHover={(hv) => handleHover(eId, hv)}
              />
            );
          })}

          {/* 节点 */}
          {nodes.map(nd => {
            const nId = nd.id;
            const inProgress = pathNodes.includes(nId);
            const spIndex = highlightedNodesMap[nId] ?? null;
            return (
              <Vertex
                key={nId}
                id={nId}
                x={nd.x}
                y={nd.y}
                isHighlighted={highlightedId === nId}
                isShined={shinedId === nId}
                inProgress={inProgress}
                savedPathIndex={spIndex}
                onHover={handleHover}
                onClick={handleClick}
              />
            );
          })}
        </g>
      </svg>
    </div>
  );
}
