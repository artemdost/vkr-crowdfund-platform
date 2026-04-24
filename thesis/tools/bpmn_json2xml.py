#!/usr/bin/env python3
"""bpmn_json2xml.py — JSON → BPMN 2.0 XML converter + validation checklist.

Usage:
    python3 bpmn_json2xml.py input.json [output.bpmn]

If output is omitted, writes to input stem + ".bpmn".
"""

import json, sys
from pathlib import Path
from collections import Counter
from xml.sax.saxutils import escape as xml_esc

# Подгружаем auto_router для умного расчёта waypoints и label bounds.
try:
    from auto_router import (
        label_bounds as _smart_label_bounds,
        route as _smart_route,
    )
except ImportError:
    _smart_label_bounds = None
    _smart_route = None

# ─── Default sizes by element type ──────────────────────────────
DEFAULT_SIZE = {
    "startEvent": [36, 36],
    "endEvent": [36, 36],
    "intermediateCatchEvent": [36, 36],
    "intermediateThrowEvent": [36, 36],
    "boundaryEvent": [36, 36],
    "exclusiveGateway": [50, 50],
    "eventBasedGateway": [50, 50],
    "parallelGateway": [50, 50],
    "inclusiveGateway": [50, 50],
}
DEFAULT_TASK_SIZE = [140, 80]

BPMN_TAG = {
    "startEvent": "bpmn:startEvent",
    "endEvent": "bpmn:endEvent",
    "userTask": "bpmn:userTask",
    "serviceTask": "bpmn:serviceTask",
    "manualTask": "bpmn:manualTask",
    "sendTask": "bpmn:sendTask",
    "receiveTask": "bpmn:receiveTask",
    "scriptTask": "bpmn:scriptTask",
    "businessRuleTask": "bpmn:businessRuleTask",
    "exclusiveGateway": "bpmn:exclusiveGateway",
    "eventBasedGateway": "bpmn:eventBasedGateway",
    "parallelGateway": "bpmn:parallelGateway",
    "inclusiveGateway": "bpmn:inclusiveGateway",
    "intermediateCatchEvent": "bpmn:intermediateCatchEvent",
    "intermediateThrowEvent": "bpmn:intermediateThrowEvent",
    "boundaryEvent": "bpmn:boundaryEvent",
}

EVENT_TYPES = {"startEvent", "endEvent", "intermediateCatchEvent",
               "intermediateThrowEvent", "boundaryEvent"}
TASK_TYPES = {"userTask", "serviceTask", "manualTask", "sendTask",
              "receiveTask", "scriptTask", "businessRuleTask"}
GATEWAY_TYPES = {"exclusiveGateway", "eventBasedGateway",
                 "parallelGateway", "inclusiveGateway"}


def sz(el):
    return el.get("size", DEFAULT_SIZE.get(el["type"], DEFAULT_TASK_SIZE))


def pos(el):
    return el["pos"]


def center(el):
    x, y = pos(el)
    w, h = sz(el)
    return [x + w / 2, y + h / 2]


# ─── Build index ────────────────────────────────────────────────
def build_index(model):
    """Return (el_by_id, pool_of, incoming, outgoing) lookups."""
    el_by_id = {}
    pool_of = {}
    incoming = {}  # el_id → [flow_ids]
    outgoing = {}  # el_id → [flow_ids]

    for pool in model["pools"]:
        for el in pool["elements"]:
            eid = el["id"]
            el_by_id[eid] = el
            pool_of[eid] = pool["id"]
            incoming[eid] = []
            outgoing[eid] = []
        for flow in pool.get("flows", []):
            outgoing.setdefault(flow["from"], []).append(flow["id"])
            incoming.setdefault(flow["to"], []).append(flow["id"])

    return el_by_id, pool_of, incoming, outgoing


# ─── Validation Checklist ───────────────────────────────────────
def validate(model, el_by_id, pool_of, incoming, outgoing):
    results = []

    def ok(msg):
        results.append(("PASS", msg))

    def fail(msg):
        results.append(("FAIL", msg))

    def warn(msg):
        results.append(("WARN", msg))

    # 1. Unique element IDs
    all_ids = [el["id"] for p in model["pools"] for el in p["elements"]]
    dupes = [x for x, c in Counter(all_ids).items() if c > 1]
    if dupes:
        fail(f"[1] Дубликаты ID элементов: {dupes}")
    else:
        ok("[1] ID элементов уникальны")

    # 2. Sequence flow endpoints in same pool
    sf_ok = True
    for pool in model["pools"]:
        pids = {el["id"] for el in pool["elements"]}
        for f in pool.get("flows", []):
            if f["from"] not in pids:
                fail(f"[2] Flow '{f['id']}': source '{f['from']}' ∉ pool '{pool['id']}'")
                sf_ok = False
            if f["to"] not in pids:
                fail(f"[2] Flow '{f['id']}': target '{f['to']}' ∉ pool '{pool['id']}'")
                sf_ok = False
    if sf_ok:
        ok("[2] Sequence flow source/target в одном пуле")

    # 3. Message flow endpoints in DIFFERENT pools
    mf_ok = True
    for mf in model.get("messageFlows", []):
        sp = pool_of.get(mf["from"])
        tp = pool_of.get(mf["to"])
        if mf["from"] not in el_by_id:
            fail(f"[3] MessageFlow '{mf['id']}': source '{mf['from']}' не найден")
            mf_ok = False
        if mf["to"] not in el_by_id:
            fail(f"[3] MessageFlow '{mf['id']}': target '{mf['to']}' не найден")
            mf_ok = False
        if sp and tp and sp == tp:
            fail(f"[3] MessageFlow '{mf['id']}': оба конца в пуле '{sp}'")
            mf_ok = False
    if mf_ok:
        ok("[3] Message flows между разными пулами")

    # 4. StartEvent has outgoing
    for pool in model["pools"]:
        for el in pool["elements"]:
            if el["type"] == "startEvent" and not outgoing.get(el["id"]):
                warn(f"[4] StartEvent '{el['id']}' без исходящего потока")
    if not any("[4]" in r[1] for r in results):
        ok("[4] Все startEvent имеют outgoing")

    # 5. EndEvent has incoming
    for pool in model["pools"]:
        for el in pool["elements"]:
            if el["type"] == "endEvent" and not incoming.get(el["id"]):
                warn(f"[5] EndEvent '{el['id']}' без входящего потока")
    if not any("[5]" in r[1] for r in results):
        ok("[5] Все endEvent имеют incoming")

    # 6. Gateways: split (≥2 out) OR merge (≥2 in) — at least one role
    gw_ok = True
    for pool in model["pools"]:
        for el in pool["elements"]:
            if el["type"] in GATEWAY_TYPES:
                out_cnt = len(outgoing.get(el["id"], []))
                in_cnt = len(incoming.get(el["id"], []))
                if out_cnt < 2 and in_cnt < 2:
                    fail(f"[6] Gateway '{el['id']}' ни split (≥2 out), ни merge (≥2 in): in={in_cnt} out={out_cnt}")
                    gw_ok = False
    if gw_ok:
        ok("[6] Шлюзы корректны (split ≥2 out или merge ≥2 in)")

    # 7. Gateways have ≥1 incoming
    gwi_ok = True
    for pool in model["pools"]:
        for el in pool["elements"]:
            if el["type"] in GATEWAY_TYPES:
                cnt = len(incoming.get(el["id"], []))
                if cnt < 1:
                    fail(f"[7] Gateway '{el['id']}' имеет 0 incoming")
                    gwi_ok = False
    if gwi_ok:
        ok("[7] Шлюзы имеют ≥1 входящий поток")

    # 8. Split-gateway outgoing flows have condition labels
    #    (merge/parallel/event-based gateways exempt — у них нет условий на ветках)
    exempt_gw_types = {"eventBasedGateway", "parallelGateway"}
    exempt_ids = {el["id"] for p in model["pools"] for el in p["elements"]
                  if el["type"] in exempt_gw_types}
    for pool in model["pools"]:
        gw_ids = {el["id"] for el in pool["elements"] if el["type"] in GATEWAY_TYPES}
        for f in pool.get("flows", []):
            if f["from"] in gw_ids and f["from"] not in exempt_ids:
                out_cnt = len(outgoing.get(f["from"], []))
                if out_cnt >= 2 and not f.get("name"):
                    warn(f"[8] Flow '{f['id']}' из split-шлюза '{f['from']}' без подписи условия")
    if not any("[8]" in r[1] for r in results):
        ok("[8] Потоки из split-шлюзов имеют подписи условий")

    # 9. Elements inside pool bounds
    for pool in model["pools"]:
        px, py, pw, ph = pool["bounds"]
        for el in pool["elements"]:
            ex, ey = pos(el)
            ew, eh = sz(el)
            if ex < px or ey < py or (ex + ew) > (px + pw) or (ey + eh) > (py + ph):
                warn(f"[9] Элемент '{el['id']}' выходит за границы пула '{pool['id']}'")
    if not any("[9]" in r[1] for r in results):
        ok("[9] Все элементы в пределах своих пулов")

    # 10. Annotation targets exist
    ann_ok = True
    for pool in model["pools"]:
        for ann in pool.get("annotations", []):
            if ann["target"] not in el_by_id:
                fail(f"[10] Аннотация '{ann['id']}': target '{ann['target']}' не найден")
                ann_ok = False
    if ann_ok:
        ok("[10] Цели аннотаций существуют")

    # 11. Pools don't overlap
    pools = model["pools"]
    overlap = False
    for i in range(len(pools)):
        for j in range(i + 1, len(pools)):
            ax, ay, aw, ah = pools[i]["bounds"]
            bx, by, bw, bh = pools[j]["bounds"]
            if ax < bx + bw and ax + aw > bx and ay < by + bh and ay + ah > by:
                fail(f"[11] Пулы '{pools[i]['id']}' и '{pools[j]['id']}' перекрываются")
                overlap = True
    if not overlap:
        ok("[11] Пулы не перекрываются")

    # 12. No duplicate flows (same from→to)
    seen = set()
    dup_flow = False
    for pool in model["pools"]:
        for f in pool.get("flows", []):
            key = (f["from"], f["to"])
            if key in seen:
                warn(f"[12] Дублирующий поток {f['from']}→{f['to']}")
                dup_flow = True
            seen.add(key)
    if not dup_flow:
        ok("[12] Нет дублирующих sequence flows")

    # 13. Every process has at least one start and one end event
    for pool in model["pools"]:
        types = [el["type"] for el in pool["elements"]]
        if "startEvent" not in types:
            warn(f"[13] Пул '{pool['id']}' без startEvent")
        if "endEvent" not in types:
            warn(f"[13] Пул '{pool['id']}' без endEvent")
    if not any("[13]" in r[1] for r in results):
        ok("[13] Все процессы имеют start и end events")

    # 14. Message flows don't connect gateways
    for mf in model.get("messageFlows", []):
        for ref in [mf["from"], mf["to"]]:
            el = el_by_id.get(ref)
            if el and el["type"] in GATEWAY_TYPES:
                fail(f"[14] MessageFlow '{mf['id']}' подключён к шлюзу '{ref}'")
    if not any("[14]" in r[1] for r in results):
        ok("[14] Message flows не подключены к шлюзам")

    # 15. Task/event naming
    unnamed = []
    for pool in model["pools"]:
        for el in pool["elements"]:
            if el["type"] in TASK_TYPES and not el.get("name"):
                unnamed.append(el["id"])
    if unnamed:
        warn(f"[15] Задачи без имени: {unnamed}")
    else:
        ok("[15] Все задачи имеют имена")

    # 16. Token flow: reachability from startEvent, reachability to endEvent
    for pool in model["pools"]:
        elements = {el["id"]: el for el in pool["elements"]}
        starts = [eid for eid, el in elements.items() if el["type"] == "startEvent"]
        ends = [eid for eid, el in elements.items() if el["type"] == "endEvent"]

        # Build adjacency (forward and backward)
        fwd = {eid: [] for eid in elements}
        bwd = {eid: [] for eid in elements}
        for f in pool.get("flows", []):
            if f["from"] in elements and f["to"] in elements:
                fwd[f["from"]].append(f["to"])
                bwd[f["to"]].append(f["from"])
        # Boundary events: implicit edge from attached task
        for eid, el in elements.items():
            if el.get("attachedToRef") and el["attachedToRef"] in elements:
                fwd[el["attachedToRef"]].append(eid)
                bwd[eid].append(el["attachedToRef"])

        # BFS forward from all start events
        reachable_from_start = set()
        queue = list(starts)
        reachable_from_start.update(queue)
        while queue:
            cur = queue.pop(0)
            for nxt in fwd[cur]:
                if nxt not in reachable_from_start:
                    reachable_from_start.add(nxt)
                    queue.append(nxt)

        # BFS backward from all end events
        can_reach_end = set()
        queue = list(ends)
        can_reach_end.update(queue)
        while queue:
            cur = queue.pop(0)
            for prev in bwd[cur]:
                if prev not in can_reach_end:
                    can_reach_end.add(prev)
                    queue.append(prev)

        # Check: every non-start element reachable from start
        unreachable = [eid for eid in elements
                       if eid not in reachable_from_start and elements[eid]["type"] != "startEvent"]
        if unreachable:
            fail(f"[16] Пул '{pool['id']}': недостижимы от startEvent: {unreachable}")

        # Check: every non-end element can reach an end
        dead_ends = [eid for eid in elements
                     if eid not in can_reach_end and elements[eid]["type"] != "endEvent"]
        if dead_ends:
            fail(f"[16] Пул '{pool['id']}': тупик (не ведут к endEvent): {dead_ends}")

    if not any("[16]" in r[1] for r in results):
        ok("[16] Токен: все элементы достижимы от start и ведут к end")

    # 17. Tasks have both incoming AND outgoing (no dangling tokens)
    for pool in model["pools"]:
        for el in pool["elements"]:
            if el["type"] in TASK_TYPES:
                eid = el["id"]
                if not incoming.get(eid):
                    warn(f"[17] Задача '{eid}' без incoming sequence flow (токен не придёт)")
                if not outgoing.get(eid):
                    warn(f"[17] Задача '{eid}' без outgoing sequence flow (токен застрянет)")
    if not any("[17]" in r[1] for r in results):
        ok("[17] Все задачи имеют входящий и исходящий потоки")

    # 18. Элементы внутри пула не перекрываются bbox'ами.
    overlap_ok = True
    for pool in model["pools"]:
        elems = pool["elements"]
        for i in range(len(elems)):
            ax, ay = pos(elems[i])
            aw, ah = sz(elems[i])
            ax1, ay1, ax2, ay2 = ax, ay, ax + aw, ay + ah
            for j in range(i + 1, len(elems)):
                bx, by = pos(elems[j])
                bw, bh = sz(elems[j])
                bx1, by1, bx2, by2 = bx, by, bx + bw, by + bh
                ox = min(ax2, bx2) - max(ax1, bx1)
                oy = min(ay2, by2) - max(ay1, by1)
                if ox > 2 and oy > 2:
                    fail(f"[18] Элементы '{elems[i]['id']}' и '{elems[j]['id']}' "
                         f"перекрываются в пуле '{pool['id']}' "
                         f"(overlap {ox:.0f}×{oy:.0f}px)")
                    overlap_ok = False
    if overlap_ok:
        ok("[18] Элементы в пулах не перекрываются bbox'ами")

    return results


# ─── Waypoint Calculation ───────────────────────────────────────
def calc_seq_waypoints(src, tgt, flow):
    """Calculate sequence flow waypoints (orthogonal, 90° turns only)."""
    if "waypoints" in flow:
        return flow["waypoints"]

    src_is_boundary = src.get("attachedToRef") is not None
    default_exit = "bottom" if src_is_boundary else "right"
    exit_side = flow.get("exit", default_exit)
    entry_side = flow.get("entry")
    if entry_side is None:
        if src_is_boundary:
            entry_side = "left"
        else:
            entry_side = {"right": "left", "left": "right",
                          "bottom": "top", "top": "bottom"}[exit_side]

    sx, sy = pos(src)
    sw, sh = sz(src)
    tx, ty = pos(tgt)
    tw, th = sz(tgt)

    exits = {
        "right":  [sx + sw, sy + sh / 2],
        "bottom": [sx + sw / 2, sy + sh],
        "left":   [sx, sy + sh / 2],
        "top":    [sx + sw / 2, sy],
    }
    entries = {
        "left":   [tx, ty + th / 2],
        "top":    [tx + tw / 2, ty],
        "right":  [tx + tw, ty + th / 2],
        "bottom": [tx + tw / 2, ty + th],
    }
    p1 = exits[exit_side]
    p2 = entries[entry_side]

    EPS = 2  # pixel tolerance for "aligned"
    horiz = {"right", "left"}
    vert = {"top", "bottom"}

    # Same-axis exits: straight line if aligned, Z-shape if not
    if exit_side in horiz and entry_side in horiz:
        if abs(p1[1] - p2[1]) <= EPS:
            return [p1, p2]
        mid_x = (p1[0] + p2[0]) / 2
        return [p1, [mid_x, p1[1]], [mid_x, p2[1]], p2]

    if exit_side in vert and entry_side in vert:
        if abs(p1[0] - p2[0]) <= EPS:
            return [p1, p2]
        mid_y = (p1[1] + p2[1]) / 2
        return [p1, [p1[0], mid_y], [p2[0], mid_y], p2]

    # Cross-axis: L-shape (one 90° turn)
    if exit_side in horiz:
        return [p1, [p2[0], p1[1]], p2]
    else:
        return [p1, [p1[0], p2[1]], p2]


def calc_msg_waypoints(src, tgt, mf):
    """Calculate message flow waypoints (orthogonal, 90° turns only)."""
    if "waypoints" in mf:
        return mf["waypoints"]
    sc = center(src)
    tc = center(tgt)
    sx, sy = pos(src)
    sw, sh = sz(src)
    tx, ty = pos(tgt)
    tw, th = sz(tgt)

    if sc[1] < tc[1]:  # source above target
        p1 = [sc[0], sy + sh]
        p2 = [tc[0], ty]
    else:  # source below target
        p1 = [sc[0], sy]
        p2 = [tc[0], ty + th]

    if abs(p1[0] - p2[0]) < 2:
        return [p1, p2]  # aligned — straight vertical line

    # Z-shape: vertical → horizontal → vertical
    mid_y = (p1[1] + p2[1]) / 2
    return [p1, [p1[0], mid_y], [p2[0], mid_y], p2]


# ─── XML Generation ────────────────────────────────────────────
def gen_xml(model, el_by_id, pool_of, incoming_map, outgoing_map):
    lines = []
    w = lines.append  # shorthand
    esc = xml_esc

    def_id = f"Definitions_{model['id']}"
    collab_id = f"Collaboration_{model['id']}"

    w('<?xml version="1.0" encoding="UTF-8"?>')
    w(f'<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"')
    w(f'                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"')
    w(f'                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"')
    w(f'                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"')
    w(f'                  id="{def_id}"')
    w(f'                  targetNamespace="http://bpmn.io/schema/bpmn"')
    w(f'                  exporter="bpmn_json2xml" exporterVersion="1.0">')
    w('')

    # ── Collaboration ──
    w(f'  <bpmn:collaboration id="{collab_id}">')
    for pool in model["pools"]:
        w(f'    <bpmn:participant id="{pool["id"]}" name="{esc(pool["name"])}" processRef="{pool["processId"]}"/>')
    for mf in model.get("messageFlows", []):
        name_attr = f' name="{esc(mf["name"])}"' if mf.get("name") else ""
        w(f'    <bpmn:messageFlow id="{mf["id"]}"{name_attr} sourceRef="{mf["from"]}" targetRef="{mf["to"]}"/>')
    w(f'  </bpmn:collaboration>')
    w('')

    # ── Signals ──
    for sig in model.get("signals", []):
        w(f'  <bpmn:signal id="{sig["id"]}" name="{esc(sig["name"])}"/>')
    if model.get("signals"):
        w('')

    # ── Processes ──
    for pool in model["pools"]:
        pid = pool["processId"]
        w(f'  <bpmn:process id="{pid}" isExecutable="false">')

        for el in pool["elements"]:
            eid = el["id"]
            etype = el["type"]
            tag = BPMN_TAG[etype]
            name_attr = f' name="{esc(el["name"])}"' if el.get("name") else ""

            # Extra attributes for boundary events
            extra_attrs = ""
            if el.get("attachedToRef"):
                extra_attrs += f' attachedToRef="{el["attachedToRef"]}"'
                extra_attrs += f' cancelActivity="true"'

            inc = incoming_map.get(eid, [])
            out = outgoing_map.get(eid, [])
            has_inner = bool(inc or out or el.get("trigger"))

            if has_inner:
                w(f'    <{tag} id="{eid}"{name_attr}{extra_attrs}>')
                for fid in inc:
                    w(f'      <bpmn:incoming>{fid}</bpmn:incoming>')
                for fid in out:
                    w(f'      <bpmn:outgoing>{fid}</bpmn:outgoing>')
                if el.get("trigger") == "message":
                    w(f'      <bpmn:messageEventDefinition id="MED_{eid}"/>')
                if el.get("trigger") == "timer":
                    w(f'      <bpmn:timerEventDefinition id="TED_{eid}"/>')
                if el.get("trigger") == "signal":
                    sig_ref = el.get("signalRef", "")
                    w(f'      <bpmn:signalEventDefinition id="SED_{eid}" signalRef="{sig_ref}"/>')
                w(f'    </{tag}>')
            else:
                w(f'    <{tag} id="{eid}"{name_attr}{extra_attrs}/>')

        # Sequence flows
        for f in pool.get("flows", []):
            name_attr = f' name="{esc(f["name"])}"' if f.get("name") else ""
            w(f'    <bpmn:sequenceFlow id="{f["id"]}"{name_attr} sourceRef="{f["from"]}" targetRef="{f["to"]}"/>')

        # Annotations + associations
        for ann in pool.get("annotations", []):
            w(f'    <bpmn:textAnnotation id="{ann["id"]}">')
            w(f'      <bpmn:text>{esc(ann["text"])}</bpmn:text>')
            w(f'    </bpmn:textAnnotation>')
            assoc_id = f'Association_{ann["id"]}'
            w(f'    <bpmn:association id="{assoc_id}" sourceRef="{ann["id"]}" targetRef="{ann["target"]}"/>')

        w(f'  </bpmn:process>')
        w('')

    # ── BPMN Diagram ──
    diag_id = f"BPMNDiagram_{model['id']}"
    plane_id = f"BPMNPlane_{model['id']}"
    w(f'  <bpmndi:BPMNDiagram id="{diag_id}">')
    w(f'    <bpmndi:BPMNPlane id="{plane_id}" bpmnElement="{collab_id}">')

    # Собрать obstacles для label placement (bounds всех элементов + аннотаций)
    _all_obs = {}
    for _p in model["pools"]:
        for _e in _p["elements"]:
            _x, _y = pos(_e)
            _sw, _sh = sz(_e)
            _all_obs[_e["id"]] = (_x, _y, _x + _sw, _y + _sh)
        for _ann in _p.get("annotations", []):
            _ax, _ay = _ann["pos"]
            _aw, _ah = _ann.get("size", [160, 40])
            _all_obs[_ann["id"]] = (_ax, _ay, _ax + _aw, _ay + _ah)

    # Рассчитать pool_gaps — свободные горизонтальные каналы между пулами (для MF)
    _pool_rects = []
    for _p in model["pools"]:
        b = _p.get("bounds")
        if b:
            _pool_rects.append(b)
    _pool_rects.sort(key=lambda r: r[1])
    _pool_gaps = []
    for i in range(len(_pool_rects) - 1):
        top_bottom = _pool_rects[i][1] + _pool_rects[i][3]
        next_top = _pool_rects[i+1][1]
        if next_top > top_bottom:
            _pool_gaps.append((top_bottom + next_top) / 2)

    # Pre-pass: для каждого элемента определить какие стороны заняты стрелками.
    # Это нужно для адаптивного размещения внешних label (event/gateway).
    _used_sides = {eid: set() for eid in el_by_id}

    def _side_of_point(el, point):
        x, y = point
        ex, ey = pos(el)
        ew, eh = sz(el)
        t = 3
        if abs(y - ey) <= t and ex - t <= x <= ex + ew + t: return "top"
        if abs(y - (ey + eh)) <= t and ex - t <= x <= ex + ew + t: return "bottom"
        if abs(x - ex) <= t and ey - t <= y <= ey + eh + t: return "left"
        if abs(x - (ex + ew)) <= t and ey - t <= y <= ey + eh + t: return "right"
        return None

    def _wps_of(f, src, tgt, is_mf=False):
        if "waypoints" in f:
            return f["waypoints"]
        if _smart_route and not f.get("exit") and not f.get("entry"):
            return _smart_route(src, tgt, _all_obs,
                                is_message_flow=is_mf, pool_gaps=_pool_gaps)
        if is_mf:
            return calc_msg_waypoints(src, tgt, f)
        return calc_seq_waypoints(src, tgt, f)

    def _mark_segment(el, p0, p1, used):
        """Помечаем side где стрелка касается элемента + side куда уходит
        следующий waypoint (чтобы учесть коллизию с label-зоной)."""
        s = _side_of_point(el, p0)
        if s: used.add(s)
        ex, ey = pos(el)
        ew, eh = sz(el)
        tol = 5
        if p1[1] > ey + eh + tol: used.add("bottom")
        elif p1[1] < ey - tol:    used.add("top")
        if p1[0] > ex + ew + tol: used.add("right")
        elif p1[0] < ex - tol:    used.add("left")

    for _p in model["pools"]:
        for _f in _p.get("flows", []):
            _src = el_by_id[_f["from"]]
            _tgt = el_by_id[_f["to"]]
            _wps = _wps_of(_f, _src, _tgt, is_mf=False)
            if _wps and len(_wps) >= 2:
                _mark_segment(_src, _wps[0], _wps[1], _used_sides[_f["from"]])
                _mark_segment(_tgt, _wps[-1], _wps[-2], _used_sides[_f["to"]])
    for _mf in model.get("messageFlows", []):
        _src = el_by_id.get(_mf["from"])
        _tgt = el_by_id.get(_mf["to"])
        if _src and _tgt:
            _wps = _wps_of(_mf, _src, _tgt, is_mf=True)
            if _wps and len(_wps) >= 2:
                _mark_segment(_src, _wps[0], _wps[1], _used_sides[_mf["from"]])
                _mark_segment(_tgt, _wps[-1], _wps[-2], _used_sides[_mf["to"]])

    def _label_placement(el):
        """Возвращает (side, lx, ly, lw, lh) для внешнего label.
        Для многострочных меток высота увеличивается по оценке числа линий."""
        side = el.get("labelSide")
        if not side:
            used = _used_sides.get(el["id"], set())
            for candidate in ("bottom", "top", "right", "left"):
                if candidate not in used:
                    side = candidate
                    break
            else:
                side = "bottom"
        ex, ey = pos(el)
        ew, eh = sz(el)
        name = el.get("name", "")
        char_w = 7
        text_px = len(name) * char_w
        line_w_cap = max(ew + 40, 100)  # ширина одной строки при wrap
        if side in ("top", "bottom"):
            lw = min(text_px, line_w_cap) if text_px else ew + 20
            lw = max(lw, ew + 20)
            # Wrap по словам: если следующее слово не влезает в текущую строку,
            # начинается новая. Даёт точнее чем ceil(text_px / lw).
            words = name.split()
            n_lines = 1
            current = 0
            for word in words:
                word_w = (len(word) + 1) * char_w
                if current > 0 and current + word_w > lw:
                    n_lines += 1
                    current = word_w
                else:
                    current += word_w
        else:
            lw = text_px or ew + 20
            n_lines = 1
        lh = max(14, n_lines * 14)
        margin = 6  # зазор между label и границей элемента
        if side == "bottom":
            lx = ex + ew / 2 - lw / 2
            ly = ey + eh + margin
        elif side == "top":
            lx = ex + ew / 2 - lw / 2
            ly = ey - lh - margin
        elif side == "right":
            lx = ex + ew + margin
            ly = ey + eh / 2 - lh / 2
        else:  # left
            lx = ex - lw - margin
            ly = ey + eh / 2 - lh / 2
        return (side, lx, ly, lw, lh)

    # Pool shapes
    for pool in model["pools"]:
        bx, by, bw, bh = pool["bounds"]
        w(f'      <bpmndi:BPMNShape id="{pool["id"]}_di" bpmnElement="{pool["id"]}" isHorizontal="true">')
        w(f'        <dc:Bounds x="{bx}" y="{by}" width="{bw}" height="{bh}"/>')
        w(f'      </bpmndi:BPMNShape>')

    # Element shapes
    for pool in model["pools"]:
        w(f'      <!-- {pool["name"]} -->')
        for el in pool["elements"]:
            eid = el["id"]
            ex, ey = pos(el)
            ew, eh = sz(el)
            is_gw = el["type"] in GATEWAY_TYPES
            # isMarkerVisible применяется только к XOR/OR/complex gateway.
            # У parallel и eventBased маркер рисуется по типу элемента.
            marker = ' isMarkerVisible="true"' if el["type"] in ("exclusiveGateway", "inclusiveGateway") else ""
            w(f'      <bpmndi:BPMNShape id="{eid}_di" bpmnElement="{eid}"{marker}>')
            w(f'        <dc:Bounds x="{ex}" y="{ey}" width="{ew}" height="{eh}"/>')
            if el.get("name") and (el["type"] in EVENT_TYPES or is_gw):
                _side, lx, ly, lw, lh = _label_placement(el)
                w(f'        <bpmndi:BPMNLabel>')
                w(f'          <dc:Bounds x="{lx:.0f}" y="{ly:.0f}" width="{lw:.0f}" height="{lh}"/>')
                w(f'        </bpmndi:BPMNLabel>')
            w(f'      </bpmndi:BPMNShape>')

        # Annotation shapes
        for ann in pool.get("annotations", []):
            ax, ay = ann["pos"]
            aw, ah = ann["size"]
            # Auto-adjust height: при slишком низком bounds скобка "[" рисуется
            # на всю высоту bounds и поджимает текст. Считаем требуемую высоту
            # по word-wrap и берём максимум от заданного.
            text = ann.get("text", "")
            if text:
                char_w = 7
                content_w = max(aw - 20, 40)  # учесть внутренний padding
                words = text.split()
                n_lines = 1
                current = 0
                for word in words:
                    word_w = (len(word) + 1) * char_w
                    if current > 0 and current + word_w > content_w:
                        n_lines += 1
                        current = word_w
                    else:
                        current += word_w
                required_h = n_lines * 14 + 10
                if ah < required_h:
                    ah = required_h
            w(f'      <bpmndi:BPMNShape id="{ann["id"]}_di" bpmnElement="{ann["id"]}">')
            w(f'        <dc:Bounds x="{ax}" y="{ay}" width="{aw}" height="{ah}"/>')
            w(f'      </bpmndi:BPMNShape>')

    # Snap endpoint к границе элемента по направлению от соседнего waypoint.
    # Лечит случай «стрелка проходит сквозь центр события» даже если в JSON
    # пользователь указал waypoint в центре.
    import math as _math
    _CIRCULAR = {"startEvent", "endEvent", "intermediateCatchEvent",
                 "intermediateThrowEvent", "boundaryEvent"}

    def _snap_to_boundary(endpoint, neighbor, el):
        ex, ey = pos(el)
        ew, eh = sz(el)
        cx, cy = ex + ew / 2, ey + eh / 2
        nx, ny = neighbor
        dx, dy = endpoint[0] - nx, endpoint[1] - ny
        # если endpoint совпадает с neighbor — направление из центра
        if abs(dx) < 0.5 and abs(dy) < 0.5:
            dx, dy = endpoint[0] - cx, endpoint[1] - cy
            if abs(dx) < 0.5 and abs(dy) < 0.5:
                return endpoint
        if el.get("type") in _CIRCULAR:
            r = min(ew, eh) / 2
            vx, vy = endpoint[0] - cx, endpoint[1] - cy
            d = _math.hypot(vx, vy)
            if d < 1:
                return [cx + r, cy]
            if r - 2 <= d <= r + 4:
                return endpoint
            return [cx + vx / d * r, cy + vy / d * r]
        # прямоугольник: пересечение прямой (neighbor→endpoint) с bbox
        x1, y1, x2, y2 = ex, ey, ex + ew, ey + eh
        # если endpoint уже снаружи или на границе — оставляем; если внутри — снапим
        inside = x1 <= endpoint[0] <= x2 and y1 <= endpoint[1] <= y2
        on_edge = (abs(endpoint[0] - x1) < 2 or abs(endpoint[0] - x2) < 2
                   or abs(endpoint[1] - y1) < 2 or abs(endpoint[1] - y2) < 2)
        if not inside or on_edge:
            return endpoint
        # параметрически ищем t ∈ (0, 1], в котором линия выходит из bbox
        def _line_rect_exit(ax, ay, bx, by):
            t_vals = [1.0]
            if bx != ax:
                for xb in (x1, x2):
                    t = (xb - ax) / (bx - ax)
                    if 0 < t <= 1:
                        yt = ay + (by - ay) * t
                        if y1 - 0.5 <= yt <= y2 + 0.5:
                            t_vals.append(t)
            if by != ay:
                for yb in (y1, y2):
                    t = (yb - ay) / (by - ay)
                    if 0 < t <= 1:
                        xt = ax + (bx - ax) * t
                        if x1 - 0.5 <= xt <= x2 + 0.5:
                            t_vals.append(t)
            return min(t_vals)
        t = _line_rect_exit(nx, ny, endpoint[0], endpoint[1])
        return [nx + (endpoint[0] - nx) * t, ny + (endpoint[1] - ny) * t]

    def _normalize_endpoints(wps, src_el, tgt_el):
        if len(wps) < 2:
            return wps
        wps = [list(p) for p in wps]
        wps[0] = _snap_to_boundary(wps[0], wps[1], src_el)
        wps[-1] = _snap_to_boundary(wps[-1], wps[-2], tgt_el)
        return wps

    # Sequence flow edges
    for pool in model["pools"]:
        for f in pool.get("flows", []):
            src_el = el_by_id[f["from"]]
            tgt_el = el_by_id[f["to"]]
            if "waypoints" in f:
                wps = f["waypoints"]
            elif _smart_route and not f.get("exit") and not f.get("entry"):
                wps = _smart_route(src_el, tgt_el, _all_obs,
                                   is_message_flow=False)
            else:
                wps = calc_seq_waypoints(src_el, tgt_el, f)
            wps = _normalize_endpoints(wps, src_el, tgt_el)
            w(f'      <bpmndi:BPMNEdge id="{f["id"]}_di" bpmnElement="{f["id"]}">')
            for wp in wps:
                w(f'        <di:waypoint x="{int(wp[0])}" y="{int(wp[1])}"/>')
            if f.get("name") and _smart_label_bounds is not None:
                lb = _smart_label_bounds(wps, f["name"], _all_obs,
                                         exclude_ids=(f["from"], f["to"]))
                if lb:
                    lx, ly, lw, lh = lb
                    w(f'        <bpmndi:BPMNLabel>')
                    w(f'          <dc:Bounds x="{lx}" y="{ly}" width="{lw}" height="{lh}"/>')
                    w(f'        </bpmndi:BPMNLabel>')
            w(f'      </bpmndi:BPMNEdge>')

        # Association edges: от границы аннотации к границе target,
        # а не центр-центр (визуально выглядит странно).
        for ann in pool.get("annotations", []):
            assoc_id = f'Association_{ann["id"]}'
            ax, ay = ann["pos"]
            aw, ah = ann["size"]
            a_rect = (ax, ay, ax + aw, ay + ah)
            tgt_el = el_by_id[ann["target"]]
            tx, ty = pos(tgt_el)
            tw, th = sz(tgt_el)
            t_rect = (tx, ty, tx + tw, ty + th)

            ann_cx = (a_rect[0] + a_rect[2]) / 2
            ann_cy = (a_rect[1] + a_rect[3]) / 2
            tgt_cx = (t_rect[0] + t_rect[2]) / 2
            tgt_cy = (t_rect[1] + t_rect[3]) / 2

            # Определяем стороны по relative position
            if a_rect[3] <= t_rect[1]:         # annotation выше target
                a_side_y, t_side_y = a_rect[3], t_rect[1]
                x_overlap_lo = max(a_rect[0], t_rect[0])
                x_overlap_hi = min(a_rect[2], t_rect[2])
                x = (x_overlap_lo + x_overlap_hi) / 2 if x_overlap_hi > x_overlap_lo else (ann_cx + tgt_cx) / 2
                p1 = (x, a_side_y)
                p2 = (x, t_side_y)
            elif a_rect[1] >= t_rect[3]:       # annotation ниже target
                a_side_y, t_side_y = a_rect[1], t_rect[3]
                x_overlap_lo = max(a_rect[0], t_rect[0])
                x_overlap_hi = min(a_rect[2], t_rect[2])
                x = (x_overlap_lo + x_overlap_hi) / 2 if x_overlap_hi > x_overlap_lo else (ann_cx + tgt_cx) / 2
                p1 = (x, a_side_y)
                p2 = (x, t_side_y)
            elif a_rect[2] <= t_rect[0]:       # annotation слева от target
                y_overlap_lo = max(a_rect[1], t_rect[1])
                y_overlap_hi = min(a_rect[3], t_rect[3])
                y = (y_overlap_lo + y_overlap_hi) / 2 if y_overlap_hi > y_overlap_lo else (ann_cy + tgt_cy) / 2
                p1 = (a_rect[2], y)
                p2 = (t_rect[0], y)
            elif a_rect[0] >= t_rect[2]:       # annotation справа от target
                y_overlap_lo = max(a_rect[1], t_rect[1])
                y_overlap_hi = min(a_rect[3], t_rect[3])
                y = (y_overlap_lo + y_overlap_hi) / 2 if y_overlap_hi > y_overlap_lo else (ann_cy + tgt_cy) / 2
                p1 = (a_rect[0], y)
                p2 = (t_rect[2], y)
            else:
                # Overlap — fallback на центры
                p1 = (ann_cx, ann_cy)
                p2 = (tgt_cx, tgt_cy)

            w(f'      <bpmndi:BPMNEdge id="{assoc_id}_di" bpmnElement="{assoc_id}">')
            w(f'        <di:waypoint x="{int(p1[0])}" y="{int(p1[1])}"/>')
            w(f'        <di:waypoint x="{int(p2[0])}" y="{int(p2[1])}"/>')
            w(f'      </bpmndi:BPMNEdge>')

    # Message flow edges
    for mf in model.get("messageFlows", []):
        src_el = el_by_id[mf["from"]]
        tgt_el = el_by_id[mf["to"]]
        if "waypoints" in mf:
            wps = mf["waypoints"]
        elif _smart_route:
            wps = _smart_route(src_el, tgt_el, _all_obs,
                               is_message_flow=True, pool_gaps=_pool_gaps)
        else:
            wps = calc_msg_waypoints(src_el, tgt_el, mf)
        wps = _normalize_endpoints(wps, src_el, tgt_el)
        w(f'      <bpmndi:BPMNEdge id="{mf["id"]}_di" bpmnElement="{mf["id"]}">')
        for wp in wps:
            w(f'        <di:waypoint x="{int(wp[0])}" y="{int(wp[1])}"/>')
        if mf.get("name"):
            # Умный label placement: сверху от длинного сегмента, с проверкой obstacles
            if _smart_label_bounds is not None:
                lb = _smart_label_bounds(wps, mf["name"], _all_obs,
                                         exclude_ids=(mf["from"], mf["to"]))
            else:
                lb = None
            if lb:
                lx, ly, lw, lh = lb
            else:
                # Fallback: label near midpoint of longest segment
                best_len, best_mid = 0, None
                for i in range(len(wps) - 1):
                    p1, p2 = wps[i], wps[i+1]
                    length = abs(p1[0] - p2[0]) + abs(p1[1] - p2[1])
                    if length > best_len:
                        best_len = length
                        best_mid = ((p1[0]+p2[0])/2, (p1[1]+p2[1])/2)
                lx = int(best_mid[0] - len(mf["name"]) * 3.5)
                ly = int(best_mid[1] - 18)
                lw = len(mf["name"]) * 7
                lh = 14
            w(f'        <bpmndi:BPMNLabel>')
            w(f'          <dc:Bounds x="{lx}" y="{ly}" width="{lw}" height="{lh}"/>')
            w(f'        </bpmndi:BPMNLabel>')
        w(f'      </bpmndi:BPMNEdge>')

    w(f'    </bpmndi:BPMNPlane>')
    w(f'  </bpmndi:BPMNDiagram>')
    w(f'</bpmn:definitions>')

    return "\n".join(lines) + "\n"


# ─── Main ───────────────────────────────────────────────────────
def main():
    if len(sys.argv) < 2:
        print("Usage: python3 bpmn_json2xml.py input.json [output.bpmn]")
        sys.exit(1)

    src = Path(sys.argv[1])
    dst = Path(sys.argv[2]) if len(sys.argv) > 2 else src.with_suffix(".bpmn")

    model = json.loads(src.read_text(encoding="utf-8"))
    el_by_id, pool_of, inc, out = build_index(model)

    # Validate
    print(f"═══ Чеклист BPMN: {src.name} ═══")
    results = validate(model, el_by_id, pool_of, inc, out)
    fails = warns = 0
    for status, msg in results:
        icon = {"PASS": "✓", "FAIL": "✗", "WARN": "⚠"}[status]
        print(f"  {icon} {msg}")
        if status == "FAIL":
            fails += 1
        elif status == "WARN":
            warns += 1
    print(f"\nИтого: {len(results)} проверок | FAIL={fails} WARN={warns}")

    if fails > 0:
        print(f"\n✗ Есть критические ошибки. XML НЕ генерируется.")
        sys.exit(1)

    # Generate XML
    xml = gen_xml(model, el_by_id, pool_of, inc, out)
    dst.write_text(xml, encoding="utf-8")
    print(f"\n✓ Сгенерирован: {dst}  ({len(xml)} bytes)")


if __name__ == "__main__":
    main()
