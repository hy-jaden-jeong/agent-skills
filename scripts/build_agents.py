#!/usr/bin/env python3
"""agents/roles/*.md 한 벌에서 agent별 subagent 정의를 만든다.

- Claude Code: agents/claude/<claude_name>.md (앞머리 name·description·model·effort)
- Codex:       agents/codex/<codex_name>.toml (name·description·model·model_reasoning_effort·developer_instructions)

본문과 description 안의 역할 이름(top-solver 등)은 그 agent의 에이전트 이름으로 바꾼다.

    python3 scripts/build_agents.py          # 만든다
    python3 scripts/build_agents.py --check  # 만든 파일이 원본과 맞는지만 본다(어긋나면 종료 코드 1)
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ROLES = ROOT / "agents" / "roles"
HOSTS = ("claude", "codex")
KEYS = ["role", "description"] + [f"{h}_{k}" for h in HOSTS for k in ("name", "model", "effort")]


def read_role(path):
    m = re.match(r"\A---\n(.*?)\n---\n(.*)\Z", path.read_text(encoding="utf-8"), re.S)
    if not m:
        sys.exit(f"{path}: 앞머리(---)가 없다")
    meta = {}
    for line in m.group(1).splitlines():
        key, _, value = line.partition(":")
        meta[key.strip()] = value.strip()
    missing = [k for k in KEYS if not meta.get(k)]
    if missing:
        sys.exit(f"{path}: 빠진 키 {', '.join(missing)}")
    if meta["role"] != path.stem:
        sys.exit(f"{path}: role({meta['role']})이 파일 이름과 다르다")
    return meta, m.group(2).strip() + "\n"


def rename(text, roles, host):
    for meta in roles:
        text = re.sub(rf"(?<![\w-]){re.escape(meta['role'])}(?![\w-])", meta[f"{host}_name"], text)
    return text


def claude_file(meta, body, roles):
    head = [
        "---",
        f"name: {meta['claude_name']}",
        f"description: {rename(meta['description'], roles, 'claude')}",
        f"model: {meta['claude_model']}",
        f"effort: {meta['claude_effort']}",
        "---",
        "",
        "",
    ]
    return "\n".join(head) + rename(body, roles, "claude")


def toml_basic(s):
    return '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'


def codex_file(meta, body, roles):
    instructions = rename(body, roles, "codex")
    if "'''" in instructions:
        sys.exit(f"{meta['role']}: 본문에 ''' 를 쓸 수 없다(TOML literal string)")
    return "\n".join([
        "# 생성 파일. agents/roles/%s.md 를 고치고 scripts/build_agents.py 를 돌린다." % meta["role"],
        f"name = {toml_basic(meta['codex_name'])}",
        f"description = {toml_basic(rename(meta['description'], roles, 'codex'))}",
        f"model = {toml_basic(meta['codex_model'])}",
        f"model_reasoning_effort = {toml_basic(meta['codex_effort'])}",
        "developer_instructions = '''",
        instructions.rstrip("\n"),
        "'''",
        "",
    ])


def main():
    check = "--check" in sys.argv[1:]
    sources = sorted(ROLES.glob("*.md"))
    parsed = [read_role(p) for p in sources]
    roles = [m for m, _ in parsed]
    wanted = {}
    for meta, body in parsed:
        wanted[ROOT / "agents" / "claude" / f"{meta['claude_name']}.md"] = claude_file(meta, body, roles)
        wanted[ROOT / "agents" / "codex" / f"{meta['codex_name']}.toml"] = codex_file(meta, body, roles)
    existing = set((ROOT / "agents" / "claude").glob("*.md")) | set((ROOT / "agents" / "codex").glob("*.toml"))
    stale = sorted(existing - set(wanted))
    bad = [p for p, text in wanted.items() if not p.exists() or p.read_text(encoding="utf-8") != text]
    if check:
        for p in bad + stale:
            print(f"어긋남: {p.relative_to(ROOT)}")
        sys.exit(1 if bad or stale else 0)
    for p, text in wanted.items():
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text, encoding="utf-8")
    for p in stale:
        p.unlink()
    print(f"{len(wanted)}개 파일을 만들었다" + (f", 옛 파일 {len(stale)}개를 지웠다" if stale else ""))


if __name__ == "__main__":
    main()
