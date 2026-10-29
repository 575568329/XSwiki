# -*- coding: utf-8 -*-
"""闸①系统化核查：REDIRECT 桩全扫 + 别名/名称与白名单交叉"""
import json, os, sys
sys.stdout.reconfigure(encoding='utf-8')
DATA = r'D:\cursorObject\小说Wiki\plugin\data'
books = ['guimizhizhu','limingzhijian','dafengdagengren','doupocangqiong','fanrenxiuxianzhuan','xuanjianxianzu']
wl = set(json.load(open(os.path.join(DATA,'images.json'), encoding='utf-8')))
EXCLUDE = {'guhuojin','zhengqiyujixiezhishen','helabogen'}

# 白名单全表
print('=== 白名单 84 id ===')
print(sorted(wl))

all_chars = {}
for b in books:
    d = json.load(open(os.path.join(DATA, b + '.json'), encoding='utf-8'))
    chars = d['characters']
    if isinstance(chars, dict): chars = list(chars.values())
    for c in chars: c['_book'] = b
    all_chars[b] = chars

def in_pool(c, wl):
    cid = c.get('id')
    return (c.get('tier')==1 or (c.get('mentions',0) or 0)>=800) and cid not in wl and cid not in EXCLUDE

# 1) REDIRECT 桩全扫（全库，不只池内）
print('\n=== 全库 REDIRECT 桩 ===')
for b in books:
    for c in all_chars[b]:
        ol = (c.get('oneLiner') or '') + (c.get('identity') or '')
        if 'REDIRECT' in ol.upper():
            cid, name = c.get('id'), c.get('name')
            target = ol.split('REDIRECT')[1].strip()[:40]
            inpool = '池内' if in_pool(c, wl) else ('白名单' if cid in wl else '其他')
            print(f'{b} {inpool}: {cid} ({name}) -> {target}')

# 2) 池内人物 别名/名称 与 白名单人物 名称/别名 交叉（找池内=已画者的同体）
print('\n=== 池内 x 白名单 同体嫌疑（别名/名称交叉）===')
# 白名单名称/别名索引
wl_index = {}  # name/alias -> wl id
for b in books:
    for c in all_chars[b]:
        if c.get('id') in wl:
            nm = c.get('name')
            if nm: wl_index.setdefault(nm, c.get('id'))
            for a in (c.get('aliases') or []):
                if a: wl_index.setdefault(a.strip(), c.get('id'))
for b in books:
    for c in all_chars[b]:
        if not in_pool(c, wl): continue
        cid, name = c.get('id'), c.get('name')
        hits = set()
        if name and name in wl_index and wl_index[name] != cid: hits.add((name, wl_index[name]))
        for a in (c.get('aliases') or []):
            a = a.strip()
            base = a.split('（')[0].strip()
            if a in wl_index and wl_index[a] != cid: hits.add((a, wl_index[a]))
            if base and base in wl_index and wl_index[base] != cid: hits.add((base, wl_index[base]))
        if hits:
            print(f'{b} 池内 {cid}({name}) aliases={c.get("aliases")} -> 白名单命中: {hits}')

# 3) 池内别名互相交叉（池内同体嫌疑，含跨书）
print('\n=== 池内别名互撞 ===')
pool_flat = []
for b in books:
    for c in all_chars[b]:
        if in_pool(c, wl): pool_flat.append(c)
name2ids = {}
for c in pool_flat:
    for label in [c.get('name')] + list(c.get('aliases') or []):
        if not label: continue
        label = label.strip()
        base = label.split('（')[0].strip()
        for v in {label, base}:
            if v: name2ids.setdefault(v, set()).add((c['_book'], c.get('id'), c.get('name')))
for v, ids in sorted(name2ids.items()):
    if len(ids) > 1:
        print(f'"{v}" -> {sorted(ids)}')
