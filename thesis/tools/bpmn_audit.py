#!/usr/bin/env python3
"""bpmn_audit.py — Post-generation layout validator.

Проверяет JSON-модель BPMN на корректность раскладки:
  1. Manhattan routing (соседние waypoints различаются по одной оси)
  2. Стрелки не проходят через элементы
  3. Параллельные message flows не накладываются
  4. Метки не на элементах
  5. Симметрия split-merge gateway (опционально)

Usage:
    python3 bpmn_audit.py model.json
"""

import json, sys
from pathlib import Path

# Импортируем точную функцию расчёта waypoints из генератора,
# чтобы audit и генератор считали одно и то же.
sys.path.insert(0, str(Path(__file__).parent))
from bpmn_json2xml import calc_seq_waypoints as _calc_seq_wps, pos as _pos, sz as _sz
try:
    from auto_router import route as _smart_route_audit, label_bounds as _smart_label_audit
except ImportError:
    _smart_route_audit = None
    _smart_label_audit = None

# ─── Default sizes ───────────────────────────────────────────────
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
TOLERANCE = 5  # px, порог для "касания"
MF_LANE = 60   # минимальная разница x для параллельных MF


def sz(el):
    return el.get("size", DEFAULT_SIZE.get(el["type"], DEFAULT_TASK_SIZE))


def bounds(el):
    x, y = el["pos"]
    w, h = sz(el)
    return (x, y, x + w, y + h)


def center(el):
    x1, y1, x2, y2 = bounds(el)
    return ((x1 + x2) / 2, (y1 + y2) / 2)


def segment_intersects_rect(p1, p2, rect, tol=1):
    """Проверяет, пересекает ли произвольный отрезок p1-p2 прямоугольник rect.
    Поддерживает диагональные сегменты (Cohen-Sutherland clipping)."""
    x1, y1 = p1
    x2, y2 = p2
    rx1, ry1, rx2, ry2 = rect
    rx1, ry1 = rx1 + tol, ry1 + tol
    rx2, ry2 = rx2 - tol, ry2 - tol
    if rx2 <= rx1 or ry2 <= ry1:
        return False

    # Cohen-Sutherland outcode
    INSIDE, LEFT, RIGHT, BOTTOM, TOP = 0, 1, 2, 4, 8

    def code(x, y):
        c = INSIDE
        if x < rx1: c |= LEFT
        elif x > rx2: c |= RIGHT
        if y < ry1: c |= BOTTOM
        elif y > ry2: c |= TOP
        return c

    c1, c2 = code(x1, y1), code(x2, y2)
    ax, ay, bx, by = x1, y1, x2, y2
    while True:
        if not (c1 | c2):
            return True          # оба внутри — пересекает
        if c1 & c2:
            return False         # обе точки в одной внешней полуплоскости
        c = c1 or c2
        if c & TOP:
            x = ax + (bx - ax) * (ry2 - ay) / (by - ay) if by != ay else ax
            y = ry2
        elif c & BOTTOM:
            x = ax + (bx - ax) * (ry1 - ay) / (by - ay) if by != ay else ax
            y = ry1
        elif c & RIGHT:
            y = ay + (by - ay) * (rx2 - ax) / (bx - ax) if bx != ax else ay
            x = rx2
        elif c & LEFT:
            y = ay + (by - ay) * (rx1 - ax) / (bx - ax) if bx != ax else ay
            x = rx1
        if c == c1:
            ax, ay = x, y
            c1 = code(ax, ay)
        else:
            bx, by = x, y
            c2 = code(bx, by)


def point_at_boundary(point, rect, tol=TOLERANCE):
    """Точка на границе прямоугольника (точка входа/выхода из элемента)."""
    x, y = point
    x1, y1, x2, y2 = rect
    on_vert = (abs(x - x1) <= tol or abs(x - x2) <= tol) and (y1 - tol <= y <= y2 + tol)
    on_horiz = (abs(y - y1) <= tol or abs(y - y2) <= tol) and (x1 - tol <= x <= x2 + tol)
    return on_vert or on_horiz


def audit(model):
    issues = []

    # Build element index
    el_by_id = {}
    pool_of = {}
    for pool in model["pools"]:
        for el in pool["elements"]:
            el_by_id[el["id"]] = el
            pool_of[el["id"]] = pool["id"]

    # Collect all flows with their waypoints
    all_edges = []  # list of (id, from_id, to_id, waypoints, is_mf)

    # Collect obstacles (bounds всех элементов) для auto_router
    _obs = {eid: bounds(el) for eid, el in el_by_id.items()}

    for pool in model["pools"]:
        for flow in pool.get("flows", []):
            src = el_by_id[flow["from"]]
            tgt = el_by_id[flow["to"]]
            # Та же логика что и в генераторе:
            if "waypoints" in flow:
                wps = flow["waypoints"]
            elif _smart_route_audit and not flow.get("exit") and not flow.get("entry"):
                wps = _smart_route_audit(src, tgt, _obs, is_message_flow=False)
            else:
                wps = _calc_seq_wps(src, tgt, flow)
            all_edges.append((flow["id"], flow["from"], flow["to"], wps, False))

    # pool_gaps для MF
    _pool_rects = sorted((p["bounds"] for p in model["pools"] if p.get("bounds")),
                         key=lambda r: r[1])
    _pool_gaps = []
    for i in range(len(_pool_rects) - 1):
        tb = _pool_rects[i][1] + _pool_rects[i][3]
        nt = _pool_rects[i+1][1]
        if nt > tb:
            _pool_gaps.append((tb + nt) / 2)

    for mf in model.get("messageFlows", []):
        if "waypoints" in mf:
            all_edges.append((mf["id"], mf["from"], mf["to"], mf["waypoints"], True))
        elif _smart_route_audit:
            wps = _smart_route_audit(el_by_id[mf["from"]], el_by_id[mf["to"]], _obs,
                                      is_message_flow=True, pool_gaps=_pool_gaps)
            all_edges.append((mf["id"], mf["from"], mf["to"], wps, True))
        else:
            issues.append(("WARN", f"Message flow '{mf['id']}' без явных waypoints"))

    # ─── Check 0: Waypoint endpoints на границе элемента ─────────
    # Для прямоугольных элементов проверяем по bbox, для событий (круглых)
    # — по окружности: точка должна быть близко к radius от центра.
    def _is_circular(el_type):
        return el_type in ("startEvent", "endEvent",
                           "intermediateCatchEvent", "intermediateThrowEvent",
                           "boundaryEvent")

    def which_border(point, rect, tol=2):
        x, y = point
        x1, y1, x2, y2 = rect
        on_top = abs(y - y1) <= tol and x1 - tol <= x <= x2 + tol
        on_bottom = abs(y - y2) <= tol and x1 - tol <= x <= x2 + tol
        on_left = abs(x - x1) <= tol and y1 - tol <= y <= y2 + tol
        on_right = abs(x - x2) <= tol and y1 - tol <= y <= y2 + tol
        if on_top:  return "top"
        if on_bottom: return "bottom"
        if on_left: return "left"
        if on_right: return "right"
        if x1 < x < x2 and y1 < y < y2:
            return "inside"
        return "outside"

    def _endpoint_issue(point, el, rect):
        """Возвращает описание проблемы или None если endpoint корректен.
        Для круглых событий: точка должна быть в кольце [r - tol_in, r + tol_out],
        где r — радиус. Для прямоугольных элементов — на bbox-границе."""
        x, y = point
        x1, y1, x2, y2 = rect
        cx, cy = (x1 + x2) / 2, (y1 + y2) / 2
        if _is_circular(el.get("type", "")):
            r = min(x2 - x1, y2 - y1) / 2
            import math
            dist = math.hypot(x - cx, y - cy)
            if dist < r - 4:
                return "inside"
            if dist > r + 6:
                return "outside-far"
            return None  # на окружности (с допуском)
        side = which_border(point, rect)
        if side == "inside":
            return "inside"
        return None

    for edge_id, src_id, tgt_id, wps, is_mf in all_edges:
        if len(wps) < 2:
            continue
        src_el = el_by_id.get(src_id)
        if src_el is not None:
            sb = bounds(src_el)
            prob = _endpoint_issue(wps[0], src_el, sb)
            if prob == "inside":
                issues.append(
                    ("WARN", f"[Waypoint-start] {edge_id}: первая точка {wps[0]} "
                             f"внутри source '{src_id}' (должна быть на границе)")
                )
        tgt_el = el_by_id.get(tgt_id)
        if tgt_el is not None:
            tb = bounds(tgt_el)
            prob = _endpoint_issue(wps[-1], tgt_el, tb)
            if prob == "inside":
                issues.append(
                    ("WARN", f"[Waypoint-end] {edge_id}: последняя точка {wps[-1]} "
                             f"внутри target '{tgt_id}' (должна упираться в границу, "
                             f"для круглых событий — в окружность)")
                )

    # ─── Check 0d: Gateway с name — исходящая вертикальная стрелка не должна
    # выходить через bottom center если label располагается снизу (default).
    # Генератор теперь адаптивно двигает label на свободную сторону,
    # поэтому перед проверкой смотрим фактически занятые стороны.
    _sides_of_el = {eid: set() for eid in el_by_id}
    for edge_id, src_id, tgt_id, wps, is_mf in all_edges:
        if len(wps) < 2:
            continue
        src_el = el_by_id.get(src_id)
        tgt_el = el_by_id.get(tgt_id)
        if src_el:
            sb = bounds(src_el)
            s = which_border(wps[0], sb)
            if s in ("top", "bottom", "left", "right"):
                _sides_of_el[src_id].add(s)
        if tgt_el:
            tb = bounds(tgt_el)
            s = which_border(wps[-1], tb)
            if s in ("top", "bottom", "left", "right"):
                _sides_of_el[tgt_id].add(s)

    def _inferred_label_side(el):
        explicit = el.get("labelSide")
        if explicit:
            return explicit
        used = _sides_of_el.get(el["id"], set())
        for candidate in ("bottom", "top", "right", "left"):
            if candidate not in used:
                return candidate
        return "bottom"

    for edge_id, src_id, tgt_id, wps, is_mf in all_edges:
        if is_mf or len(wps) < 2:
            continue
        src_el = el_by_id.get(src_id)
        if src_el is None:
            continue
        if src_el["type"] not in ("exclusiveGateway", "eventBasedGateway"):
            continue
        if not src_el.get("name"):
            continue
        label_side = _inferred_label_side(src_el)
        sb = bounds(src_el)
        center_x = (sb[0] + sb[2]) / 2
        p0 = wps[0]
        # Коллизия label↔стрелка только если стрелка выходит с той же стороны
        # где располагается label. Для bottom-label: exit через bottom center вниз.
        if label_side == "bottom" and abs(p0[0] - center_x) <= 3 and abs(p0[1] - sb[3]) <= 3:
            if len(wps) > 1 and wps[1][1] > p0[1] + 5:
                issues.append(
                    ("WARN", f"[Gateway-label-collision] {edge_id} выходит из "
                             f"bottom-center '{src_id}' вниз, где располагается label.")
                )

    # Check 1 (Manhattan routing) отключён: диагональные стрелки разрешены.
    # Главное — не пересекать элементы и не накладываться друг на друга.

    # ─── Check 2: Edge не пересекает bounds элементов ────────────
    for edge_id, src_id, tgt_id, wps, is_mf in all_edges:
        src_el = el_by_id.get(src_id)
        tgt_el = el_by_id.get(tgt_id)
        exclude_ids = {src_id, tgt_id}

        for other_id, other_el in el_by_id.items():
            if other_id in exclude_ids:
                continue
            other_bounds = bounds(other_el)
            for i in range(len(wps) - 1):
                if segment_intersects_rect(wps[i], wps[i + 1], other_bounds):
                    issues.append(
                        ("FAIL", f"[Overlap] {edge_id} пересекает элемент '{other_id}' "
                                 f"сегмент {wps[i]} → {wps[i+1]}")
                    )

    # ─── Check 3: Message flows не накладываются по x ────────────
    mf_list = [(eid, wps) for eid, s, t, wps, is_mf in all_edges if is_mf]
    for i, (id1, wps1) in enumerate(mf_list):
        for j, (id2, wps2) in enumerate(mf_list):
            if i >= j:
                continue
            # Проверить вертикальные сегменты на одинаковой x
            verts1 = [(wps1[k], wps1[k + 1]) for k in range(len(wps1) - 1)
                      if abs(wps1[k][0] - wps1[k + 1][0]) <= 1]
            verts2 = [(wps2[k], wps2[k + 1]) for k in range(len(wps2) - 1)
                      if abs(wps2[k][0] - wps2[k + 1][0]) <= 1]
            for v1 in verts1:
                for v2 in verts2:
                    if abs(v1[0][0] - v2[0][0]) <= TOLERANCE:
                        # Same x line — check y overlap
                        y1_min, y1_max = min(v1[0][1], v1[1][1]), max(v1[0][1], v1[1][1])
                        y2_min, y2_max = min(v2[0][1], v2[1][1]), max(v2[0][1], v2[1][1])
                        if y1_max > y2_min + TOLERANCE and y2_max > y1_min + TOLERANCE:
                            issues.append(
                                ("WARN", f"[MF overlap] {id1} и {id2} накладываются "
                                         f"по вертикали x={v1[0][0]}")
                            )

    # ─── Check 4: Аннотации не на элементах и не на стрелках ─────
    def _adjusted_ann_size(ann):
        """То же auto-adjust по word-wrap что и в генераторе."""
        aw, ah = ann.get("size", [160, 40])
        text = ann.get("text", "")
        if text:
            char_w = 7
            content_w = max(aw - 20, 40)
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
        return aw, ah

    all_annotations = []
    for pool in model["pools"]:
        for ann in pool.get("annotations", []):
            ax, ay = ann["pos"]
            aw, ah = _adjusted_ann_size(ann)
            ann_bounds = (ax, ay, ax + aw, ay + ah)
            all_annotations.append((ann["id"], ann_bounds))
            # 4a: annotation vs element bounds
            for eid, el in el_by_id.items():
                eb = bounds(el)
                if not (ann_bounds[2] < eb[0] + TOLERANCE or ann_bounds[0] > eb[2] - TOLERANCE or
                        ann_bounds[3] < eb[1] + TOLERANCE or ann_bounds[1] > eb[3] - TOLERANCE):
                    issues.append(
                        ("FAIL", f"[Annotation] '{ann['id']}' накладывается на элемент '{eid}'")
                    )
            # 4b: annotation vs edge segments (без учёта соб. target-association)
            target_id = ann.get("target")
            for edge_id, src_id, tgt_id, wps, is_mf in all_edges:
                if src_id == target_id or tgt_id == target_id:
                    continue
                for k in range(len(wps) - 1):
                    if segment_intersects_rect(wps[k], wps[k+1], ann_bounds, tol=0):
                        issues.append(
                            ("WARN", f"[Annotation-edge] '{ann['id']}' пересекает стрелку {edge_id}")
                        )
                        break
            # 4d: прямая association от annotation до target не проходит через другие элементы
            if target_id and target_id in el_by_id:
                tgt_el = el_by_id[target_id]
                tx1, ty1, tx2, ty2 = bounds(tgt_el)
                ann_cx = (ann_bounds[0] + ann_bounds[2]) / 2
                ann_cy = (ann_bounds[1] + ann_bounds[3]) / 2
                tgt_cx = (tx1 + tx2) / 2
                tgt_cy = (ty1 + ty2) / 2
                # прямая из (ann_cx, ann_cy) в (tgt_cx, tgt_cy) — проверяем
                # пересекает ли она другие элементы (пропуская сам target)
                for other_id, other_el in el_by_id.items():
                    if other_id == target_id:
                        continue
                    ob = bounds(other_el)
                    # простая проверка: параметрическое пересечение линии с rect (Liang-Barsky)
                    dx, dy = tgt_cx - ann_cx, tgt_cy - ann_cy
                    if dx == 0 and dy == 0:
                        continue
                    # Clip line vs rect
                    t_min, t_max = 0.0, 1.0
                    for p, q in ((-dx, ann_cx - ob[0]), (dx, ob[2] - ann_cx),
                                 (-dy, ann_cy - ob[1]), (dy, ob[3] - ann_cy)):
                        if p == 0:
                            if q < 0:
                                t_min, t_max = 1, 0
                                break
                            continue
                        t = q / p
                        if p < 0:
                            t_min = max(t_min, t)
                        else:
                            t_max = min(t_max, t)
                    if t_min < t_max:
                        issues.append(
                            ("WARN", f"[Annotation-assoc] ассоциация '{ann['id']}' → '{target_id}' "
                                     f"проходит через '{other_id}'")
                        )

    # ─── Check 4c: Текстовые метки flows не попадают на чужие элементы ─
    # bpmn.io ставит метку в ГЕОМЕТРИЧЕСКИЙ ЦЕНТР bbox всех waypoints
    def bbox_centroid(wps):
        if not wps:
            return None
        xs = [w[0] for w in wps]
        ys = [w[1] for w in wps]
        return ((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2)

    longest_segment_midpoint = bbox_centroid  # alias для совместимости

    # Подготовить полный dict obstacles для label_bounds (элементы + аннотации)
    _label_obstacles = dict(_obs)
    for ann_id, ann_rect in all_annotations:
        _label_obstacles[ann_id] = ann_rect

    def _real_label_rect(wps, name, exclude_ids=()):
        """Вернуть реальное label_rect, которое использует генератор
        (с учётом shift-to-opposite-side при коллизии)."""
        if _smart_label_audit:
            r = _smart_label_audit(wps, name, all_obstacles=_label_obstacles,
                                   exclude_ids=exclude_ids)
            if r:
                x, y, w, h = r
                return (x, y, x + w, y + h)
        mid = bbox_centroid(wps)
        if mid is None:
            return None
        label_w = len(name) * 8
        label_h = 18
        return (mid[0] - label_w/2, mid[1] - label_h/2,
                mid[0] + label_w/2, mid[1] + label_h/2)

    for pool in model["pools"]:
        for flow in pool.get("flows", []):
            if not flow.get("name"):
                continue
            wps = flow.get("waypoints")
            if not wps:
                # Для flows без явных waypoints — использовать ту же логику,
                # что и генератор: auto_router если нет exit/entry, иначе calc_seq_waypoints.
                src = el_by_id.get(flow["from"])
                tgt = el_by_id.get(flow["to"])
                if src and tgt:
                    if not flow.get("exit") and not flow.get("entry") and _smart_route_audit:
                        wps = _smart_route_audit(src, tgt, _obs, is_message_flow=False)
                    else:
                        wps = _calc_seq_wps(src, tgt, flow)
                else:
                    continue
            lb = _real_label_rect(wps, flow["name"],
                                   exclude_ids=(flow["from"], flow["to"]))
            if lb is None:
                continue
            for eid, el in el_by_id.items():
                if eid in (flow["from"], flow["to"]):
                    continue
                eb = bounds(el)
                if not (lb[2] < eb[0] or lb[0] > eb[2] or lb[3] < eb[1] or lb[1] > eb[3]):
                    issues.append(
                        ("WARN", f"[Flow-label] метка '{flow['name']}' (flow {flow['id']}) "
                                 f"попадает на элемент '{eid}'")
                    )
            # vs annotations
            for ann_id, ann_bounds in all_annotations:
                if not (lb[2] < ann_bounds[0] or lb[0] > ann_bounds[2] or
                        lb[3] < ann_bounds[1] or lb[1] > ann_bounds[3]):
                    issues.append(
                        ("WARN", f"[Flow-label] метка '{flow['name']}' (flow {flow['id']}) "
                                 f"попадает на аннотацию '{ann_id}'")
                    )

    for mf in model.get("messageFlows", []):
        if not mf.get("name") or "waypoints" not in mf:
            continue
        lb = _real_label_rect(mf["waypoints"], mf["name"],
                               exclude_ids=(mf["from"], mf["to"]))
        if lb is None:
            continue
        # vs bounds элементов
        for eid, el in el_by_id.items():
            if eid in (mf["from"], mf["to"]):
                continue
            eb = bounds(el)
            if not (lb[2] < eb[0] or lb[0] > eb[2] or lb[3] < eb[1] or lb[1] > eb[3]):
                issues.append(
                    ("WARN", f"[MF-label] метка '{mf['name']}' (MF {mf['id']}) "
                             f"попадает на элемент '{eid}'")
                )
        # vs annotations
        for ann_id, ann_bounds in all_annotations:
            if not (lb[2] < ann_bounds[0] or lb[0] > ann_bounds[2] or
                    lb[3] < ann_bounds[1] or lb[1] > ann_bounds[3]):
                issues.append(
                    ("WARN", f"[MF-label] метка '{mf['name']}' (MF {mf['id']}) "
                             f"попадает на аннотацию '{ann_id}'")
                )

    # ─── Check 5: Parallel MF between same pool pair ────────────
    pair_to_mfs = {}
    for mf in model.get("messageFlows", []):
        src_pool = pool_of.get(mf["from"])
        tgt_pool = pool_of.get(mf["to"])
        if src_pool and tgt_pool:
            key = tuple(sorted([src_pool, tgt_pool]))
            pair_to_mfs.setdefault(key, []).append(mf)

    for key, mfs in pair_to_mfs.items():
        if len(mfs) < 2:
            continue
        # check MF_LANE separation
        x_positions = []
        for mf in mfs:
            wps = mf.get("waypoints", [])
            if wps:
                # find main vertical segment (between pools)
                for i in range(len(wps) - 1):
                    if abs(wps[i][0] - wps[i + 1][0]) <= 1:  # vertical
                        x_positions.append((mf["id"], wps[i][0]))
                        break
        x_positions.sort(key=lambda p: p[1])
        for i in range(len(x_positions) - 1):
            id1, x1 = x_positions[i]
            id2, x2 = x_positions[i + 1]
            if x2 - x1 < MF_LANE:
                issues.append(
                    ("WARN", f"[MF bundling] {id1} (x={x1}) и {id2} (x={x2}) "
                             f"разделены менее чем на {MF_LANE}px")
                )

    # ─── Check 6: MF/Association waypoints не на границе пула ─────
    # Горизонтальные сегменты и waypoints не должны лежать на y = top/bottom пула,
    # иначе визуально сливаются с линией границы. Допустимая зона — середина gap.
    pool_edges = []  # список y-координат top/bottom всех пулов
    for pool in model["pools"]:
        if pool.get("bounds"):
            py = pool["bounds"][1]
            ph = pool["bounds"][3]
            pool_edges.append((pool["id"], "top", py))
            pool_edges.append((pool["id"], "bottom", py + ph))

    for mf in model.get("messageFlows", []):
        wps = mf.get("waypoints")
        if not wps:
            continue
        for i, (x, y) in enumerate(wps):
            for pid, side, edge_y in pool_edges:
                if abs(y - edge_y) <= 5:
                    issues.append(
                        ("WARN", f"[Pool-edge] {mf['id']} waypoint #{i} y={y} "
                                 f"лежит на {side}-границе пула '{pid}' (y={edge_y}). "
                                 f"Сместите в середину gap между пулами.")
                    )
                    break

    # ─── Check 7: Элементы не перекрываются между собой ────────────
    # Если bbox двух элементов пересекается, в рендере один накладывается
    # на другой — визуально «каша». Проверяем все пары внутри одного пула
    # (в разных пулах перекрытие невозможно, т.к. пулы не перекрываются).
    for pool in model["pools"]:
        elems = pool["elements"]
        for i in range(len(elems)):
            for j in range(i + 1, len(elems)):
                a, b = elems[i], elems[j]
                ax1, ay1, ax2, ay2 = bounds(a)
                bx1, by1, bx2, by2 = bounds(b)
                # strict overlap (не касание): пересечение > 2px по обеим осям
                ox = min(ax2, bx2) - max(ax1, bx1)
                oy = min(ay2, by2) - max(ay1, by1)
                if ox > 2 and oy > 2:
                    issues.append(
                        ("FAIL", f"[Element-overlap] '{a['id']}' и '{b['id']}' "
                                 f"перекрываются bbox'ами в пуле '{pool['id']}' "
                                 f"(overlap {ox:.0f}×{oy:.0f}px). Разнесите по координатам.")
                    )

    # ─── Check 8: Сегменты стрелок не совпадают с границей чужого элемента ─
    # Случай: horizontal сегмент y=N проходит точно по bottom/top чужого элемента.
    # Формально не пересечение, но визуально линия сливается с границей bbox.
    for edge_id, src_id, tgt_id, wps, is_mf in all_edges:
        if len(wps) < 2:
            continue
        exclude = {src_id, tgt_id}
        for i in range(len(wps) - 1):
            p1, p2 = wps[i], wps[i + 1]
            # Только ortho-сегменты: horizontal или vertical
            is_h = abs(p1[1] - p2[1]) <= 1
            is_v = abs(p1[0] - p2[0]) <= 1
            if not (is_h or is_v):
                continue
            for eid, el in el_by_id.items():
                if eid in exclude:
                    continue
                ex1, ey1, ex2, ey2 = bounds(el)
                if is_h:
                    y = p1[1]
                    seg_xmin, seg_xmax = min(p1[0], p2[0]), max(p1[0], p2[0])
                    # перекрытие по x с bbox и y совпадает с top/bottom
                    if seg_xmax > ex1 + 2 and seg_xmin < ex2 - 2:
                        for edge_y, edge_name in ((ey1, "top"), (ey2, "bottom")):
                            if abs(y - edge_y) <= 2:
                                issues.append(
                                    ("WARN", f"[Edge-on-boundary] {edge_id} сегмент "
                                             f"{p1}→{p2} совпадает с {edge_name}-границей "
                                             f"элемента '{eid}' (y={edge_y}). Сдвиньте "
                                             f"сегмент минимум на 4-5px от границы.")
                                )
                elif is_v:
                    x = p1[0]
                    seg_ymin, seg_ymax = min(p1[1], p2[1]), max(p1[1], p2[1])
                    if seg_ymax > ey1 + 2 and seg_ymin < ey2 - 2:
                        for edge_x, edge_name in ((ex1, "left"), (ex2, "right")):
                            if abs(x - edge_x) <= 2:
                                issues.append(
                                    ("WARN", f"[Edge-on-boundary] {edge_id} сегмент "
                                             f"{p1}→{p2} совпадает с {edge_name}-границей "
                                             f"элемента '{eid}' (x={edge_x}). Сдвиньте "
                                             f"сегмент минимум на 4-5px от границы.")
                                )

    return issues


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 bpmn_audit.py model.json")
        sys.exit(1)

    path = Path(sys.argv[1])
    model = json.loads(path.read_text(encoding="utf-8"))

    print(f"═══ Layout Audit: {path.name} ═══")
    issues = audit(model)

    if not issues:
        print("  ✓ Все проверки layout пройдены")
        sys.exit(0)

    fails = sum(1 for lvl, _ in issues if lvl == "FAIL")
    warns = sum(1 for lvl, _ in issues if lvl == "WARN")

    for lvl, msg in issues:
        marker = "✗" if lvl == "FAIL" else "⚠"
        print(f"  {marker} [{lvl}] {msg}")

    print(f"\nИтого: FAIL={fails} WARN={warns}")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
