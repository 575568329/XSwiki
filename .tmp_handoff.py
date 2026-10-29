# -*- coding: utf-8 -*-
# 提取指定会话的骨架信息用于恢复上下文。
# 安全规则：不输出任何长文本正文（小说原文/长工具结果），只输出角色、工具名、
# 文件路径、短指令预览（<=100字符，超长截断）。
import sqlite3, os, json, sys

sys.stdout.reconfigure(encoding="utf-8")

SID = "session_ca6f589f74f0f6cbba76dba8ff6b1432"
db = os.path.expanduser("~/.zcode/cli/db/db.sqlite")
con = sqlite3.connect(db)
cur = con.cursor()

def preview(s, n=100):
    s = " ".join(str(s).split())
    return s[:n] + ("…" if len(s) > n else "")

cur.execute(
    "select id, time_created, data from message where session_id=? order by sequence",
    (SID,),
)
messages = cur.fetchall()
print(f"== {len(messages)} messages ==")

for mid, ts, mdata in messages:
    try:
        m = json.loads(mdata)
    except Exception:
        m = {}
    role = m.get("role") or m.get("type") or "?"
    print(f"\n--- [{role}] {mid[-8:]} t={ts}")
    cur.execute(
        "select data from part where message_id=? order by sequence", (mid,)
    )
    for (pdata,) in cur.fetchall():
        try:
            p = json.loads(pdata)
        except Exception:
            continue
        t = p.get("type")
        if t == "text":
            txt = p.get("text", "")
            # 只打短预览，长正文一律截断
            print(f"  text: {preview(txt)}")
        elif t == "tool_use" or t == "tool":
            name = p.get("tool") or p.get("name") or "?"
            inp = p.get("input") or p.get("state", {}).get("input", {}) if isinstance(p.get("state"), dict) else p.get("input") or {}
            if not isinstance(inp, dict):
                inp = {}
            keys = {}
            for k in ("file_path", "path", "command", "url", "pattern", "description", "skill", "query", "prompt"):
                if k in inp:
                    v = inp[k]
                    if k in ("command", "prompt", "query"):
                        keys[k] = preview(v, 80)
                    else:
                        keys[k] = preview(v, 120)
            print(f"  tool[{name}]: {keys}")
        elif t == "tool_result":
            print("  tool_result: <skipped>")
        else:
            print(f"  part[{t}]")
con.close()
