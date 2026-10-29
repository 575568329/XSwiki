# -*- coding: utf-8 -*-
"""闸②系统化核查：扫描池内 神祇/非人 形态风险，对照计划点名的 12+1 清单"""
import json, os, sys
sys.stdout.reconfigure(encoding='utf-8')
DATA = r'D:\cursorObject\小说Wiki\plugin\data'
books = ['guimizhizhu','limingzhijian','dafengdagengren','doupocangqiong','fanrenxiuxianzhuan','xuanjianxianzu']
wl = set(json.load(open(os.path.join(DATA,'images.json'), encoding='utf-8')))
EXCLUDE = {'guhuojin','zhengqiyujixiezhishen','helabogen'}
PLAN_NAMED = {'duoluomushen','yuanshiyueliang','yuwangmushu','hundunzhizi','yuanchushangdi','yuangutaiyangshen','wuluoliusi','fuleigela','salingeer','aoermier','angeerweide','ajialitu','jiuweitianhu'}

def in_pool(c):
    cid = c.get('id')
    return (c.get('tier')==1 or (c.get('mentions',0) or 0)>=800) and cid not in wl and cid not in EXCLUDE

kw = ['神','祂','兽','龙','天使','古神','邪神','恶魔','魔树','母树','月亮','上帝','母神','魔兽','妖','狐']
for b in books:
    d = json.load(open(os.path.join(DATA, b + '.json'), encoding='utf-8'))
    chars = d['characters']
    if isinstance(chars, dict): chars = list(chars.values())
    for c in chars:
        if not in_pool(c): continue
        fac = c.get('faction') or ''
        ol = (c.get('oneLiner') or '') + fac + (c.get('identity') or '')
        hit_fac = any(k in fac for k in ['神','天使','古神','魔兽','妖'])
        hit_kw = any(k in ol for k in ['祂','古神','邪神','真神','天使之王','恶灵'])
        if hit_fac or hit_kw or c['id'] in PLAN_NAMED:
            mark = '★计划已列' if c['id'] in PLAN_NAMED else '◆计划遗漏'
            print(f"{b} {mark} | {c['id']} ({c.get('name')}) faction={fac!r} | {ol[:60]}")
