# -*- coding: utf-8 -*-
"""二期池核数：口径 = tier==1 或 mentions>=800，不在白名单，剔除已放弃/在途"""
import json, os, sys
sys.stdout.reconfigure(encoding='utf-8')

DATA = r'D:\cursorObject\小说Wiki\plugin\data'
books = ['guimizhizhu','limingzhijian','dafengdagengren','doupocangqiong','fanrenxiuxianzhuan','xuanjianxianzu']

wl = json.load(open(os.path.join(DATA,'images.json'), encoding='utf-8'))
wl_ids = set(wl) if isinstance(wl, list) else set(wl.get('images', wl).keys())
print('白名单数量:', len(wl_ids))

EXCLUDE = {'guhuojin','zhengqiyujixiezhishen','helabogen'}

pool = {}
per_book = {}
all_rows = []
for b in books:
    d = json.load(open(os.path.join(DATA, b + '.json'), encoding='utf-8'))
    chars = d['characters'] if isinstance(d, dict) and 'characters' in d else d
    if isinstance(chars, dict):
        chars = list(chars.values())
    n = 0
    tiers = {}
    for c in chars:
        cid = c.get('id') or c.get('characterId')
        tier = c.get('tier')
        men = c.get('mentions', 0) or 0
        name = c.get('name')
        tiers[tier] = tiers.get(tier, 0) + 1
        # 口径: tier==1 或 mentions>=800
        if (tier == 1 or men >= 800):
            in_wl = cid in wl_ids
            if in_wl:
                continue
            if cid in EXCLUDE:
                print(f'  [剔除] {b} {cid} {name} tier={tier} men={men}')
                continue
            per_book.setdefault(b, []).append((cid, name, tier, men))
            n += 1
            all_rows.append((b, cid, name, tier, men))
    print(f'{b}: characters总数={len(chars)} tier分布={dict(sorted(tiers.items(), key=lambda x: str(x[0])))} 池内={n}')

print()
total = 0
for b in ['guimizhizhu','limingzhijian','dafengdagengren','doupocangqiong','fanrenxiuxianzhuan','xuanjianxianzu']:
    lst = per_book.get(b, [])
    total += len(lst)
    print(f'{b}: {len(lst)}')
print('池子合计:', total)

# 诡秘明细（按 mentions 降序）——检查 C1=前28/C2=27 的切分
print()
print('=== 诡秘池明细（mentions 降序）===')
gm = sorted(per_book.get('guimizhizhu', []), key=lambda x: -(x[3] or 0))
for i, (cid, name, tier, men) in enumerate(gm, 1):
    mark = 'C1' if i <= 28 else 'C2'
    print(f'{i:3d} [{mark}] {cid:30s} {name:20s} tier={tier} mentions={men}')

for b in ['limingzhijian','dafengdagengren','doupocangqiong']:
    print(f'\n=== {b} 池明细 ===')
    for cid, name, tier, men in sorted(per_book.get(b, []), key=lambda x: -(x[3] or 0)):
        print(f'  {cid:30s} {name:20s} tier={tier} mentions={men}')
