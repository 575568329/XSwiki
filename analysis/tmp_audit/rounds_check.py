# -*- coding: utf-8 -*-
"""产能核数：从台账明细表解析过审轮次，对照计划'均轮次≈2'"""
import re, sys
sys.stdout.reconfigure(encoding='utf-8')
txt = open(r'D:\cursorObject\小说Wiki\analysis\立绘成品\成果台账.md', encoding='utf-8').read()

rows = re.findall(r'^\|\s*([a-z0-9]+)\s*\|\s*([^|]+?)\s*\|[^|]*\|[^|]*\|\s*([^|]*?)\s*\|$', txt, re.M)
rounds = []
manual = 0
for cid, name, r in rows:
    r = r.strip()
    m = re.match(r'^(\d+)', r)
    if m:
        rounds.append(int(m.group(1)))
    elif '人工收货' in r:
        manual += 1
print(f'解析到明细行: {len(rounds)+manual}')
print(f'带轮次数字: {len(rounds)}, 人工收货行: {manual}')
print(f'均值轮次: {sum(rounds)/len(rounds):.2f}')
print(f'分布: ' + str({k: rounds.count(k) for k in sorted(set(rounds))}))
ge4 = sum(1 for x in rounds if x >= 4)
print(f'>=4轮占比: {ge4}/{len(rounds)} = {ge4/len(rounds)*100:.0f}%')
print(f'一次过占比: {rounds.count(1)}/{len(rounds)} = {rounds.count(1)/len(rounds)*100:.0f}%')

# B9 诡秘子集（最难书，二期主力）: 台账中 B9 行明细
b9_ids = ['aerjieweierxun','luosaiergusitafu','ameng','andesenhude','bansenmoleidi','meilishamoleidi','foersiwoer','xiudiercha','aimulinhuaite','aosaikusi','lunnademiqieer','paliesisuoluoyaside','dailikeboge','azikeaigesi','yinsizangeweier','lieaodeluo','meigaoousi','amannixisi','zhenshizaowuzhu','oumibeila','aodailihuoer','dengenshimisi']
b9 = dict(zip([r[0] for r in rows], [r[2].strip() for r in rows]))
b9r = []
for i in b9_ids:
    v = b9.get(i, '')
    m = re.match(r'^(\d+)', v)
    if m: b9r.append(int(m.group(1)))
print(f'\nB9 诡秘可计轮次: n={len(b9r)}, 均值={sum(b9r)/len(b9r):.2f}, 分布={ {k: b9r.count(k) for k in sorted(set(b9r))} }')
