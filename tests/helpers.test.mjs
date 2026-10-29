// helpers.js 纯函数单测（前端主题映射/分类规则——直接 import 源码，无 Vue 依赖）
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import {
  FAC_HUE, elemAccent, facHue, facHueByName, roleOf, realmCls, relType, fmtNum,
} from '../plugin-src/src/helpers.js';

test('relType：亲缘/师徒/婚姻/敌对/同伴/其他', () => {
  for (const r of ['哥哥', '妹妹', '父亲', '母亲', '族亲'])
    assert.equal(relType(r)[0], 'kinship', r);
  for (const r of ['导师（历史系教授）', '师父', '徒弟'])
    assert.equal(relType(r)[0], 'master', r);
  assert.equal(relType('妻子')[0], 'marriage');
  for (const r of ['死敌（“错误”天使）', '敌对', '仇人'])
    assert.equal(relType(r)[0], 'foe', r);
  for (const r of ['塔罗会成员“正义”', '廷根同事·塔罗会成员“星星”', '挚友（合租搭档）', '信仰对象“愚者”先生'])
    assert.equal(relType(r)[0], 'ally', r);
  assert.deepEqual(relType(''), ['other', '其他']);
});

test('realmCls：诡秘序列 0-9 五档映射', () => {
  assert.equal(realmCls({ cultivation: '序列0 愚者' }), 'rv-immortal');
  assert.equal(realmCls({ cultivation: '序列1 时之虫' }), 'rv-zhenren');
  assert.equal(realmCls({ cultivation: '序列4 无暗者' }), 'rv-zifu');
  assert.equal(realmCls({ cultivation: '序列6 安魂师' }), 'rv-foundation');
  assert.equal(realmCls({ cultivation: '序列9 占卜家' }), 'rv-mortal');
});

test('realmCls：玄鉴境界关键词映射（向后兼容）', () => {
  assert.equal(realmCls({ cultivation: '紫府中期【明阳】' }), 'rv-zifu');
  assert.equal(realmCls({ cultivation: '筑基初期' }), 'rv-foundation');
  assert.equal(realmCls({ cultivation: '道胎·仙位' }), 'rv-immortal');
  assert.equal(realmCls({ cultivation: '' }), 'rv-none');
});

test('roleOf：戏份分层阈值', () => {
  assert.deepEqual(roleOf({ tier: 1 }), ['core', '核心']);
  assert.deepEqual(roleOf({ tier: 2, mentions: 800 }), ['core', '核心']);
  assert.deepEqual(roleOf({ tier: 2, mentions: 500 }), ['support', '重要']);
  assert.deepEqual(roleOf({ tier: 3, mentions: 50 }), ['episodic', '出场过']);
  assert.deepEqual(roleOf({ tier: 3, mentions: 5 }), ['mention', '仅提及']);
});

test('fmtNum：万位缩写', () => {
  assert.equal(fmtNum(999), '999');
  assert.equal(fmtNum(15000), '1.5万');
  assert.equal(fmtNum(0), '0');
});

test('facHue：双书势力色表命中（含“道统/朝廷”后缀剥离的旧逻辑）', () => {
  assert.equal(facHueByName('李家'), FAC_HUE['李家']);
  assert.equal(facHueByName('明阳道统'), FAC_HUE['明阳道统']);
  assert.equal(facHueByName('塔罗会'), '#8b74c9');
  assert.equal(facHueByName('黑夜女神教会'), '#3d4d6b');
  assert.equal(facHueByName('不存在的势力'), '#b08d3f', '未命中走默认金');
});

test('elemAccent：意象命中（诡秘/玄鉴共用）', () => {
  assert.equal(elemAccent({ aliases: ['愚者'], cultivation: '序列0 愚者' }).g, '诡');
  assert.equal(elemAccent({ cultivation: '序列0 黑夜', identity: '黑夜女神' }).g, '夜');
  assert.equal(elemAccent({ cultivation: '紫府', identity: '铜镜器灵' }).g, '鉴');
  assert.ok(elemAccent({ name: '路人甲' }).c.length === 7, 'fallback 返回色值');
});
