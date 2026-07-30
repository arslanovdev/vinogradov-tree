import type { Tree, Side } from '../gedcom/types';
import { colorOf } from './derive';

export interface PlacedNode { id: string; gen: number; slot: number; x: number; y: number; isSibling?: boolean; }
export interface Link { d: string; color: string; sib: boolean; gen: number; }
export interface RelInfo { side: Side; depth: number; }

export interface Layout {
  nodeById: Record<string, PlacedNode>;
  rel: Record<string, RelInfo>;
  sideById: Record<string, Side>;
  siblingIds: Set<string>;
  links: Link[];
  WW: number; WH: number; maxGen: number; generations: number;
  COL: number; CW: number; CH: number; PAD: number;
}

const COL = 300, ROWGAP = 142, PAD = 90, CW = 222, CH = 104;

function relations(tree: Tree): Record<string, RelInfo> {
  const { indi, fam } = tree;
  const rel: Record<string, RelInfo> = {};
  const walk = (id: string, side: Side, depth: number) => {
    const p = indi[id]; if (!p) return;
    rel[id] = { side, depth };
    const f = p.famc ? fam[p.famc] : null;
    if (f) { if (f.husb) walk(f.husb, side, depth + 1); if (f.wife) walk(f.wife, side, depth + 1); }
  };
  const root = indi['@I1@'];
  const f1 = root?.famc ? fam[root.famc] : null;
  if (f1) { if (f1.husb) walk(f1.husb, 'paternal', 1); if (f1.wife) walk(f1.wife, 'maternal', 1); }
  return rel;
}

export function buildLayout(tree: Tree, showSiblings = true): Layout {
  const { indi, fam } = tree;
  const rel = relations(tree);
  const nodeById: Record<string, PlacedNode> = {};
  let leaf = 0, maxGen = 0;

  const place = (id: string, gen: number): number => {
    if (nodeById[id]) return nodeById[id].slot;
    const p = indi[id];
    const node: PlacedNode = { id, gen, slot: 0, x: 0, y: 0 };
    nodeById[id] = node;
    if (gen > maxGen) maxGen = gen;
    const f = p?.famc ? fam[p.famc] : null;
    const ps: string[] = [];
    if (f) { if (f.husb && indi[f.husb]) ps.push(f.husb); if (f.wife && indi[f.wife]) ps.push(f.wife); }
    if (ps.length === 0) node.slot = leaf++;
    else { const ss = ps.map((pid) => place(pid, gen + 1)); node.slot = ss.reduce((a, b) => a + b, 0) / ss.length; }
    return node.slot;
  };
  place('@I1@', 0);

  const sideById: Record<string, Side> = {};
  Object.keys(rel).forEach((id) => (sideById[id] = rel[id].side));
  sideById['@I1@'] = 'self';
  const siblingIds = new Set<string>();
  const desiredSlot = new Map<string, number>();
  Object.values(nodeById).forEach((node) => desiredSlot.set(node.id, node.slot));

  if (showSiblings) {
    Object.values(fam).forEach((family) => {
      const directChild = family.chil.find((id) => nodeById[id]); if (!directChild) return;
      const anchor = nodeById[directChild];
      const side = sideById[directChild] || 'self';
      let ordinal = 0;
      family.chil.forEach((id) => {
        if (id === directChild || !indi[id] || nodeById[id]) return;
        ordinal += 1;
        const slot = anchor.slot + ordinal * 0.75;
        nodeById[id] = { id, gen: anchor.gen, slot, x: 0, y: 0, isSibling: true };
        desiredSlot.set(id, slot);
        siblingIds.add(id);
        sideById[id] = side;
      });
    });
  }
  Object.values(fam).forEach((f) => {
    const s = (f.husb && sideById[f.husb]) || (f.wife && sideById[f.wife]) || null;
    if (s) { if (f.husb && !sideById[f.husb]) sideById[f.husb] = s; if (f.wife && !sideById[f.wife]) sideById[f.wife] = s; }
  });

  const bySideAndGeneration = new Map<string, PlacedNode[]>();
  Object.values(nodeById).forEach((node) => {
    const side = sideById[node.id] || 'self';
    if (side === 'self') return;
    const key = `${side}:${node.gen}`;
    const group = bySideAndGeneration.get(key) || [];
    group.push(node);
    bySideAndGeneration.set(key, group);
  });
  bySideAndGeneration.forEach((group) => {
    group.sort((a, b) => (desiredSlot.get(a.id)! - desiredSlot.get(b.id)!) || Number(!!a.isSibling) - Number(!!b.isSibling));
    let previous = Number.NEGATIVE_INFINITY;
    group.forEach((node) => {
      node.slot = Math.max(desiredSlot.get(node.id)!, previous + 0.78);
      previous = node.slot;
    });
  });

  const paternal = Object.values(nodeById).filter((node) => sideById[node.id] === 'paternal');
  const maternal = Object.values(nodeById).filter((node) => sideById[node.id] === 'maternal');
  if (paternal.length && maternal.length) {
    const paternalMax = Math.max(...paternal.map((node) => node.slot));
    const maternalMin = Math.min(...maternal.map((node) => node.slot));
    const shift = paternalMax + 1.2 - maternalMin;
    maternal.forEach((node) => { node.slot += shift; });
    nodeById['@I1@'].slot = (Math.min(...paternal.map((node) => node.slot)) + Math.max(...maternal.map((node) => node.slot))) / 2;
  }

  const slots = Object.values(nodeById).map((n) => n.slot);
  const minS = Math.min(...slots), maxS = Math.max(...slots);
  Object.values(nodeById).forEach((n) => { n.x = n.gen * COL + PAD; n.y = (n.slot - minS) * ROWGAP + PAD; });

  const WW = maxGen * COL + CW + PAD * 2;
  const WH = (maxS - minS) * ROWGAP + CH + PAD * 2;

  const links: Link[] = [];
  const path = (x1: number, y1: number, x2: number, y2: number) => {
    const mx = (x1 + x2) / 2;
    return `M${x1.toFixed(1)},${y1.toFixed(1)} C${mx.toFixed(1)},${y1.toFixed(1)} ${mx.toFixed(1)},${y2.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`;
  };
  Object.values(fam).forEach((f) => {
    const parents = [f.husb, f.wife].filter((pid): pid is string => !!pid && !!nodeById[pid]);
    const children = f.chil.filter((cid) => nodeById[cid]);
    if (!parents.length || !children.length) return;
    const side: Side = (children.map((c) => rel[c]).find(Boolean) || ({} as RelInfo)).side || sideById[parents[0]] || 'self';
    const color = colorOf(side);
    const Jx = nodeById[parents[0]].x - 30;
    const Jy = parents.reduce((a, pid) => a + nodeById[pid].y + CH / 2, 0) / parents.length;
    const gen = nodeById[children[0]].gen;
    parents.forEach((pid) => { const pn = nodeById[pid]; links.push({ d: path(Jx, Jy, pn.x, pn.y + CH / 2), color, sib: false, gen }); });
    children.forEach((cid) => { const cn = nodeById[cid]; links.push({ d: path(cn.x + CW, cn.y + CH / 2, Jx, Jy), color, sib: !!cn.isSibling, gen }); });
  });

  return { nodeById, rel, sideById, siblingIds, links, WW, WH, maxGen, generations: maxGen + 1, COL, CW, CH, PAD };
}
