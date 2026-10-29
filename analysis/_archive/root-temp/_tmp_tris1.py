import json,sys
with open(r"plugin\data\guimizhizhu.json",encoding="utf-8") as f:
    data=json.load(f)
print(type(data))
if isinstance(data,dict): print(list(data.keys())[:30])
