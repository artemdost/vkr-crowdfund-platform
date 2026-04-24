#!/usr/bin/env python3
"""bpmn_bpmn2json.py — Reverse: BPMN XML → JSON model (подхват ручных правок)."""

import sys, json, re
from pathlib import Path
import xml.etree.ElementTree as ET

NS = {
    'bpmn': 'http://www.omg.org/spec/BPMN/20100524/MODEL',
    'bpmndi': 'http://www.omg.org/spec/BPMN/20100524/DI',
    'dc': 'http://www.omg.org/spec/DD/20100524/DC',
    'di': 'http://www.omg.org/spec/DD/20100524/DI',
}

TYPE_MAP = {
    'startEvent': 'startEvent',
    'endEvent': 'endEvent',
    'intermediateCatchEvent': 'intermediateCatchEvent',
    'boundaryEvent': 'boundaryEvent',
    'userTask': 'userTask',
    'serviceTask': 'serviceTask',
    'manualTask': 'manualTask',
    'exclusiveGateway': 'exclusiveGateway',
    'eventBasedGateway': 'eventBasedGateway',
}


def parse(bpmn_path):
    tree = ET.parse(bpmn_path)
    root = tree.getroot()

    # Collect DI shapes and edges
    shapes = {}  # id -> (x, y, w, h)
    edges = {}   # flow_id -> waypoints
    for shape in root.iter('{%s}BPMNShape' % NS['bpmndi']):
        elem_id = shape.get('bpmnElement')
        b = shape.find('{%s}Bounds' % NS['dc'])
        if b is not None:
            shapes[elem_id] = (float(b.get('x')), float(b.get('y')),
                               float(b.get('width')), float(b.get('height')))
    for edge in root.iter('{%s}BPMNEdge' % NS['bpmndi']):
        flow_id = edge.get('bpmnElement')
        wps = [(float(w.get('x')), float(w.get('y')))
               for w in edge.findall('{%s}waypoint' % NS['di'])]
        edges[flow_id] = wps

    # Collect collaboration
    collab = root.find('{%s}collaboration' % NS['bpmn'])
    participants = []  # list of dicts
    message_flows = []
    for p in collab.findall('{%s}participant' % NS['bpmn']):
        participants.append({
            'id': p.get('id'),
            'name': p.get('name'),
            'processRef': p.get('processRef'),
        })
    for mf in collab.findall('{%s}messageFlow' % NS['bpmn']):
        mf_data = {
            'id': mf.get('id'),
            'from': mf.get('sourceRef'),
            'to': mf.get('targetRef'),
        }
        if mf.get('name'):
            mf_data['name'] = mf.get('name')
        if mf.get('id') in edges:
            mf_data['waypoints'] = [[int(round(x)), int(round(y))]
                                     for x, y in edges[mf.get('id')]]
        message_flows.append(mf_data)

    # Build pools
    pools = []
    for p in participants:
        bounds_rect = shapes.get(p['id'], (0, 0, 1000, 200))
        pool = {
            'id': p['id'],
            'name': p['name'],
            'processId': p['processRef'],
            'bounds': [int(round(bounds_rect[0])), int(round(bounds_rect[1])),
                       int(round(bounds_rect[2])), int(round(bounds_rect[3]))],
            'elements': [],
            'flows': [],
            'annotations': []
        }
        # Find process
        for proc in root.iter('{%s}process' % NS['bpmn']):
            if proc.get('id') == p['processRef']:
                # Elements
                for child in proc:
                    tag = child.tag.split('}')[-1]
                    if tag in TYPE_MAP:
                        el = {'id': child.get('id'), 'type': TYPE_MAP[tag]}
                        if child.get('name'):
                            el['name'] = child.get('name')
                        # position and size
                        if child.get('id') in shapes:
                            x, y, w, h = shapes[child.get('id')]
                            el['pos'] = [int(round(x)), int(round(y))]
                            el['size'] = [int(round(w)), int(round(h))]
                        # trigger detection
                        for eventDef in child:
                            edtag = eventDef.tag.split('}')[-1]
                            if 'messageEventDefinition' in edtag:
                                el['trigger'] = 'message'
                            elif 'timerEventDefinition' in edtag:
                                el['trigger'] = 'timer'
                            elif 'signalEventDefinition' in edtag:
                                el['trigger'] = 'signal'
                        pool['elements'].append(el)
                    elif tag == 'sequenceFlow':
                        fl = {
                            'id': child.get('id'),
                            'from': child.get('sourceRef'),
                            'to': child.get('targetRef'),
                        }
                        if child.get('name'):
                            fl['name'] = child.get('name')
                        if child.get('id') in edges:
                            fl['waypoints'] = [[int(round(x)), int(round(y))]
                                                for x, y in edges[child.get('id')]]
                        pool['flows'].append(fl)
                    elif tag == 'textAnnotation':
                        text = child.find('{%s}text' % NS['bpmn'])
                        ann = {
                            'id': child.get('id'),
                            'text': text.text if text is not None else '',
                        }
                        if child.get('id') in shapes:
                            x, y, w, h = shapes[child.get('id')]
                            ann['pos'] = [int(round(x)), int(round(y))]
                            ann['size'] = [int(round(w)), int(round(h))]
                        pool['annotations'].append(ann)
        pools.append(pool)

    # Get model id/name
    defs = root
    model_id = defs.get('id', 'MODEL').replace('Definitions_', '')
    model = {
        'id': model_id,
        'name': f'Reimported from {bpmn_path}',
        'pools': pools,
        'messageFlows': message_flows,
    }
    return model


if __name__ == '__main__':
    bpmn_path = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else bpmn_path.replace('.bpmn', '.json')
    model = parse(bpmn_path)
    Path(out).write_text(json.dumps(model, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'✓ Reimported: {out}')
    n_pools = len(model['pools'])
    n_elems = sum(len(p['elements']) for p in model['pools'])
    n_flows = sum(len(p['flows']) for p in model['pools'])
    n_mfs = len(model['messageFlows'])
    print(f'  pools={n_pools}, elements={n_elems}, flows={n_flows}, messageFlows={n_mfs}')
