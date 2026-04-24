#!/usr/bin/env python3
"""auto_router.py — Автоматический orthogonal routing для BPMN waypoints.

Ключевые функции:
  - infer_sides(src, tgt): определить оптимальные exit/entry стороны по геометрии
  - route(src, tgt, obstacles, hint): построить Manhattan-путь с обходом препятствий
  - label_bounds(waypoints, name, obstacles): найти свободную позицию метки

Используется из bpmn_json2xml.py когда явные waypoints не заданы.
"""

TOL = 2
LABEL_H = 14
LABEL_CHAR_W = 7   # примерная ширина символа в Times New Roman 10pt

_DEFAULT_SIZE_BY_TYPE = {
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
_DEFAULT_TASK_SIZE = [140, 80]


def _default_size(el):
    t = el.get("type", "")
    return _DEFAULT_SIZE_BY_TYPE.get(t, _DEFAULT_TASK_SIZE)


def _bounds(el):
    x, y = el["pos"]
    sz = el.get("size", _default_size(el))
    return (x, y, x + sz[0], y + sz[1])


def _center(rect):
    return ((rect[0] + rect[2]) / 2, (rect[1] + rect[3]) / 2)


def _side_point(rect, side):
    """Точка на указанной стороне элемента (центр стороны)."""
    x1, y1, x2, y2 = rect
    cx, cy = (x1 + x2) / 2, (y1 + y2) / 2
    return {
        "top":    (cx, y1),
        "bottom": (cx, y2),
        "left":   (x1, cy),
        "right":  (x2, cy),
    }[side]


def _rect_overlaps_seg(rect, p1, p2, tol=TOL):
    """Проверить пересечение произвольного отрезка (в т.ч. диагонального) с прямоугольником.
    Использует Cohen-Sutherland clipping."""
    rx1, ry1, rx2, ry2 = rect
    rx1, ry1, rx2, ry2 = rx1 + tol, ry1 + tol, rx2 - tol, ry2 - tol
    if rx2 <= rx1 or ry2 <= ry1:
        return False
    INSIDE, LEFT, RIGHT, BOTTOM, TOP_ = 0, 1, 2, 4, 8

    def code(x, y):
        c = INSIDE
        if x < rx1: c |= LEFT
        elif x > rx2: c |= RIGHT
        if y < ry1: c |= BOTTOM
        elif y > ry2: c |= TOP_
        return c

    ax, ay = p1
    bx, by = p2
    c1, c2 = code(ax, ay), code(bx, by)
    while True:
        if not (c1 | c2):
            return True
        if c1 & c2:
            return False
        c = c1 or c2
        if c & TOP_:
            x = ax + (bx - ax) * (ry2 - ay) / (by - ay) if by != ay else ax
            y = ry2
        elif c & BOTTOM:
            x = ax + (bx - ax) * (ry1 - ay) / (by - ay) if by != ay else ax
            y = ry1
        elif c & RIGHT:
            y = ay + (by - ay) * (rx2 - ax) / (bx - ax) if bx != ax else ay
            x = rx2
        else:  # LEFT
            y = ay + (by - ay) * (rx1 - ax) / (bx - ax) if bx != ax else ay
            x = rx1
        if c == c1:
            ax, ay = x, y
            c1 = code(ax, ay)
        else:
            bx, by = x, y
            c2 = code(bx, by)


def _path_clear(waypoints, obstacles, exclude_ids=()):
    """Проверить, что ни один segment не пересекает obstacles."""
    for i in range(len(waypoints) - 1):
        for eid, rect in obstacles.items():
            if eid in exclude_ids:
                continue
            if _rect_overlaps_seg(rect, waypoints[i], waypoints[i+1]):
                return False
    return True


# ─────────────────────────────────────────────────────────────────
# Определение exit/entry сторон по геометрии
# ─────────────────────────────────────────────────────────────────

def infer_sides(src_rect, tgt_rect):
    """Возвращает (exit_side, entry_side) по relative position target.
    Приоритет оси выхода определяется большей дельтой (|dy| vs |dx|):
    если target сильно ниже/выше — стрелка должна выходить снизу/сверху,
    даже при наличии horizontal separation."""
    sx1, sy1, sx2, sy2 = src_rect
    tx1, ty1, tx2, ty2 = tgt_rect
    scx, scy = _center(src_rect)
    tcx, tcy = _center(tgt_rect)

    dx = tcx - scx
    dy = tcy - scy

    right_of = tx1 >= sx2 - TOL
    left_of  = tx2 <= sx1 + TOL
    below    = ty1 >= sy2 - TOL
    above    = ty2 <= sy1 + TOL

    # Если target значительно дальше по вертикали, чем по горизонтали,
    # exit должен быть снизу/сверху (логичное направление).
    if abs(dy) > abs(dx):
        if below:
            if right_of: return ("bottom", "left")
            if left_of:  return ("bottom", "right")
            return ("bottom", "top")
        if above:
            if right_of: return ("top", "left")
            if left_of:  return ("top", "right")
            return ("top", "bottom")

    # Горизонтальное доминирует — обычная логика (right/left exit).
    if right_of:
        if below: return ("right", "top")
        if above: return ("right", "bottom")
        return ("right", "left")
    if left_of:
        if below: return ("left", "top")
        if above: return ("left", "bottom")
        return ("left", "right")

    # Полный vertical separation без horizontal separation — exit top/bottom.
    if below: return ("bottom", "top")
    if above: return ("top", "bottom")

    # Overlapping — fallback по dx/dy sign.
    if abs(dx) >= abs(dy):
        return ("right", "left") if dx > 0 else ("left", "right")
    return ("bottom", "top") if dy > 0 else ("top", "bottom")


# ─────────────────────────────────────────────────────────────────
# Построение Manhattan waypoints
# ─────────────────────────────────────────────────────────────────

def _l_variants(p1, p2, exit_side, entry_side):
    """Возвращает список всех разумных Manhattan-путей между p1 и p2.
    Порядок — от простейшего к обходным."""
    HORIZ = {"left", "right"}
    VERT = {"top", "bottom"}
    variants = []

    if exit_side in HORIZ and entry_side in HORIZ:
        if abs(p1[1] - p2[1]) <= TOL:
            return [[p1, p2]]
        mid_x = (p1[0] + p2[0]) / 2
        variants.append([p1, (mid_x, p1[1]), (mid_x, p2[1]), p2])
        # U-shape обход сверху/снизу
        return variants

    if exit_side in VERT and entry_side in VERT:
        if abs(p1[0] - p2[0]) <= TOL:
            return [[p1, p2]]
        mid_y = (p1[1] + p2[1]) / 2
        variants.append([p1, (p1[0], mid_y), (p2[0], mid_y), p2])
        return variants

    # cross-axis (horiz↔vert) — ДВЕ возможные L-shape
    if exit_side in HORIZ and entry_side in VERT:
        # Вариант 1: горизонталь сначала → corner (p2.x, p1.y)
        variants.append([p1, (p2[0], p1[1]), p2])
        # Вариант 2: наоборот — идти вертикально до target y, потом горизонтально
        # (требует intermediate: p1 → (p1.x, p2.y) → (p2.x, p2.y)=p2)
        variants.append([p1, (p1[0], p2[1]), p2])
    else:  # exit vert, entry horiz
        variants.append([p1, (p1[0], p2[1]), p2])
        variants.append([p1, (p2[0], p1[1]), p2])
    return variants


def _l_shape(p1, p2, exit_side, entry_side):
    return _l_variants(p1, p2, exit_side, entry_side)[0]


def _route_with_channel(p1, p2, exit_side, entry_side, channel_y=None, channel_x=None):
    """Построить путь с использованием указанного канала (горизонт/вертикаль)."""
    HORIZ = {"left", "right"}
    VERT = {"top", "bottom"}

    # vert→vert через channel_y (длинный горизонтальный канал)
    if exit_side in VERT and entry_side in VERT and channel_y is not None:
        return [p1, (p1[0], channel_y), (p2[0], channel_y), p2]
    # horiz→horiz через channel_x
    if exit_side in HORIZ and entry_side in HORIZ and channel_x is not None:
        return [p1, (channel_x, p1[1]), (channel_x, p2[1]), p2]
    return _l_shape(p1, p2, exit_side, entry_side)


def route(src_el, tgt_el, all_obstacles, hint=None, is_message_flow=False, pool_gaps=None):
    """Главная функция: возвращает список waypoints.

    Args:
        src_el, tgt_el: dict с полями 'id', 'pos', 'size'.
        all_obstacles: dict {id: rect} всех элементов диаграммы.
        hint: dict с необязательными 'exit'/'entry' для переопределения инференса.
        is_message_flow: True если MF (идёт между пулами → использовать channel в зазоре).
        pool_gaps: список y-координат свободных горизонтальных каналов (между пулами).

    Returns:
        Список [(x, y), ...] waypoints.
    """
    src_rect = _bounds(src_el)
    tgt_rect = _bounds(tgt_el)
    exclude = (src_el["id"], tgt_el["id"])

    # 1. Определить стороны
    exit_side, entry_side = infer_sides(src_rect, tgt_rect)
    if hint and hint.get("exit"):
        exit_side = hint["exit"]
    if hint and hint.get("entry"):
        entry_side = hint["entry"]

    p1 = _side_point(src_rect, exit_side)
    p2 = _side_point(tgt_rect, entry_side)

    # 2. Построить список кандидатов от простейших к обходным
    candidates = []
    candidates.extend(_l_variants(p1, p2, exit_side, entry_side))

    # Если MF — попробовать через pool_gaps
    if is_message_flow and pool_gaps:
        for gap_y in pool_gaps:
            if min(p1[1], p2[1]) <= gap_y <= max(p1[1], p2[1]):
                c = _route_with_channel(p1, p2, exit_side, entry_side, channel_y=gap_y)
                candidates.append(c)

    # Обходные Z-пути с разными каналами (по ±100px от естественного)
    dy = p2[1] - p1[1]
    dx = p2[0] - p1[0]
    for offset in (60, 90, 120, 150, -60, -90, -120, -150):
        # Горизонтальный канал чуть выше/ниже естественного
        channel_y = p1[1] + (dy * 0.5) + offset
        candidates.append([p1, (p1[0], channel_y), (p2[0], channel_y), p2])
        # Вертикальный канал
        channel_x = p1[0] + (dx * 0.5) + offset
        candidates.append([p1, (channel_x, p1[1]), (channel_x, p2[1]), p2])

    # 3. Отфильтровать кандидатов по Manhattan + perpendicular entry
    HORIZ = {"left", "right"}
    VERT = {"top", "bottom"}

    def _valid_manhattan(path):
        # Manhattan больше не обязателен: диагональные сегменты допустимы.
        # Оставляем функцию для совместимости (всегда True).
        return True

    def _perp_entry_ok(path):
        if len(path) < 2:
            return True
        a, b = path[-2], path[-1]
        is_vert = abs(a[0] - b[0]) <= TOL
        is_horiz = abs(a[1] - b[1]) <= TOL
        if entry_side in VERT:
            return is_vert
        if entry_side in HORIZ:
            return is_horiz
        return True

    def _perp_exit_ok(path):
        if len(path) < 2:
            return True
        a, b = path[0], path[1]
        is_vert = abs(a[0] - b[0]) <= TOL
        is_horiz = abs(a[1] - b[1]) <= TOL
        if exit_side in VERT:
            return is_vert
        if exit_side in HORIZ:
            return is_horiz
        return True

    # Ужесточённый порядок: сначала все требования + чистый путь
    for path in candidates:
        if not _valid_manhattan(path):
            continue
        if not _perp_entry_ok(path) or not _perp_exit_ok(path):
            continue
        if _path_clear(path, all_obstacles, exclude_ids=exclude):
            return [list(pt) for pt in path]

    # Попробовать ещё с Z-shape через offset с гарантией perp_entry/exit
    for offset in (60, 90, 120, 150, 200, 250, -60, -90, -120, -150):
        # Два варианта Z-shape: horizontal mid / vertical mid
        mid_y = p2[1] + offset if entry_side == "top" else p1[1] + offset
        z1 = [p1, (p1[0], mid_y), (p2[0], mid_y), p2]
        mid_x = p2[0] + offset if entry_side == "left" else p1[0] + offset
        z2 = [p1, (mid_x, p1[1]), (mid_x, p2[1]), p2]
        for path in (z1, z2):
            if not _valid_manhattan(path):
                continue
            if not _perp_entry_ok(path) or not _perp_exit_ok(path):
                continue
            if _path_clear(path, all_obstacles, exclude_ids=exclude):
                return [list(pt) for pt in path]

    # 4. Fallback: первый вариант (хоть чистый но могут быть warnings)
    for path in candidates:
        if _valid_manhattan(path):
            return [list(pt) for pt in path]
    return [list(pt) for pt in candidates[0]]


# ─────────────────────────────────────────────────────────────────
# Позиция метки
# ─────────────────────────────────────────────────────────────────

def _longest_segment_mid(waypoints):
    """Возвращает (середина, is_horizontal) для самого длинного сегмента."""
    best_len = 0
    best_mid = None
    best_horiz = True
    for i in range(len(waypoints) - 1):
        p1, p2 = waypoints[i], waypoints[i+1]
        dx = abs(p1[0] - p2[0])
        dy = abs(p1[1] - p2[1])
        length = dx + dy
        if length > best_len:
            best_len = length
            best_mid = ((p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2)
            best_horiz = dx > dy
    return best_mid, best_horiz


def label_bounds(waypoints, name, all_obstacles=None, exclude_ids=()):
    """Найти позицию метки flow/MF на самом длинном сегменте с offset.

    Возвращает (x, y, width, height) — координаты верхнего левого угла + размеры.
    """
    if not name or len(waypoints) < 2:
        return None
    mid, horiz = _longest_segment_mid(waypoints)
    if mid is None:
        return None
    w = len(name) * LABEL_CHAR_W
    h = LABEL_H
    # Для горизонтального сегмента — метка СВЕРХУ от линии
    # Для вертикального — СПРАВА
    LABEL_OFF = 8  # зазор от линии, чтобы descender'ы не накладывались
    if horiz:
        x = mid[0] - w / 2
        y = mid[1] - h - LABEL_OFF
    else:
        x = mid[0] + LABEL_OFF
        y = mid[1] - h / 2

    # Проверить, что метка не в bounds чужих элементов
    if all_obstacles:
        label_rect = (x, y, x + w, y + h)
        for eid, rect in all_obstacles.items():
            if eid in exclude_ids:
                continue
            if not (label_rect[2] < rect[0] or label_rect[0] > rect[2] or
                    label_rect[3] < rect[1] or label_rect[1] > rect[3]):
                # Попробовать сместить в противоположную сторону
                if horiz:
                    y = mid[1] + LABEL_OFF
                else:
                    x = mid[0] - w - LABEL_OFF
                break

    return (int(x), int(y), int(w), int(h))


if __name__ == "__main__":
    # Простой тест
    src = {"id": "s", "pos": [100, 100], "size": [100, 80]}
    tgt = {"id": "t", "pos": [400, 100], "size": [100, 80]}
    obs = {"s": _bounds(src), "t": _bounds(tgt)}
    print("Simple right→left:", route(src, tgt, obs))

    src2 = {"id": "s2", "pos": [100, 100], "size": [50, 50]}
    tgt2 = {"id": "t2", "pos": [400, 300], "size": [140, 80]}
    obs2 = {"s2": _bounds(src2), "t2": _bounds(tgt2)}
    print("Gateway→Task down-right:", route(src2, tgt2, obs2))
