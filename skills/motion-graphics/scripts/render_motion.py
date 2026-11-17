#!/usr/bin/env python3
"""모션그래픽 spec(JSON)을 혼자 열리는 HTML 한 파일로 굽는다.

사용법
    python3 render_motion.py <spec.json> [<출력.html>]   출력을 생략하면 같은 이름의 .html
    python3 render_motion.py --check                      설치 확인: 견본 spec을 구워 본다

spec에는 내용(상자, 화살표, 시나리오별 단계와 자막)만 쓴다(assets/motion-spec.json 견본).
재생기(assets/motion.html)는 굽는 순간에 이 스크립트가 붙인다.

종료 코드
    0  HTML을 만들었다
    1  굽지 못했다: Chrome 없음, 입력 오류(JSON 문법), 재생기 스크립트 오류
    2  spec이 규칙을 어겼다: 없는 상자 이름, 모르는 상태, 긴 글, 겹친 상자, 상자를 지나는 화살표,
       채우지 않은 자리. HTML을 만들지 않는다. spec을 고쳐 다시 굽는다

필요한 것: python3, Chrome(또는 Chromium·Edge). 글꼴은 Google Fonts에서 불러오고, 못 불러오면 기기 글꼴로 보인다.
Chrome이 기본 위치에 없으면 CHROME_PATH 환경 변수에 실행 파일 경로를 넣는다.
"""
import html
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from urllib.parse import unquote

ASSETS = Path(__file__).resolve().parent.parent / "assets"
CHROME_APPS = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "~/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
]
CHROME_COMMANDS = ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "microsoft-edge"]

STATES = {"idle", "run", "wait", "ok", "fail", "blocked", "warn", "skip"}
SIDES = {"top", "bottom", "left", "right"}
TONES = {"", "good", "warn", "bad"}
# 분량 기준. 넘으면 글을 줄이거나 시나리오·단계를 나눈다.
MAX_NODES, MAX_SCENARIOS, MAX_STEPS = 12, 5, 12
MAX_ID, MAX_SUB, MAX_TEXT, MAX_T, MAX_RESULT = 20, 26, 170, 8, 6
NODE_W, NODE_H, COL_W, ROW_H = 180, 48, 200, 110  # assets/motion.html의 상자 크기·격자와 같아야 한다


class RenderFailed(Exception):
    """굽지 못했다(종료 코드 1)."""


def find_chrome():
    custom = os.environ.get("CHROME_PATH")
    if custom:
        if Path(custom).expanduser().is_file():
            return str(Path(custom).expanduser())
        raise RenderFailed(f"CHROME_PATH가 가리키는 파일이 없다: {custom}")
    for app in CHROME_APPS:
        if Path(app).expanduser().is_file():
            return str(Path(app).expanduser())
    for command in CHROME_COMMANDS:
        found = shutil.which(command)
        if found:
            return found
    raise RenderFailed(
        "Chrome을 찾지 못했다. Google Chrome을 설치하거나, "
        "CHROME_PATH 환경 변수에 Chrome·Chromium·Edge 실행 파일 경로를 넣는다."
    )


class SpecProblems(Exception):
    """spec이 규칙을 어겼다(종료 코드 2). args[0]은 문제 목록."""


def unfilled_slots(value):
    """견본의 {{…}} 자리 중 채우지 않은 것."""
    return re.findall(r"\{\{[^{}\n]*\}\}", json.dumps(value, ensure_ascii=False))


def validate(spec, allow_slots=False):
    """Chrome을 띄우지 않고 알 수 있는 문제를 모은다."""
    p = []
    if not isinstance(spec, dict):
        return ["spec 맨 바깥은 객체({ … })여야 한다."]
    for key in ("title", "heading", "lead"):
        if not isinstance(spec.get(key), str) or not spec[key].strip():
            p.append(f'"{key}"가 비었다.')
    nodes = spec.get("nodes") or []
    if not 2 <= len(nodes) <= MAX_NODES:
        p.append(f"상자(nodes)는 2~{MAX_NODES}개여야 한다(지금 {len(nodes)}개). 넘으면 묶어서 줄이거나 모션그래픽을 나눈다.")
    ids = []
    for n in nodes:
        nid = n.get("id")
        if not isinstance(nid, str) or not nid:
            p.append("id가 없는 상자가 있다.")
            continue
        if nid in ids:
            p.append(f"상자 id가 겹친다: {nid}")
        ids.append(nid)
        if not isinstance(n.get("col"), (int, float)) or not isinstance(n.get("row"), (int, float)):
            p.append(f"상자 {nid}에 col·row(숫자)가 없다.")
        elif n["col"] < 0 or n["row"] < 0:
            p.append(f"상자 {nid}의 col·row는 0 이상이어야 한다.")
        if len(n.get("label") or nid) > MAX_ID:
            p.append(f"상자 이름이 {MAX_ID}자를 넘는다: {nid}")
        if len(n.get("sub") or "") > MAX_SUB:
            p.append(f"상자 {nid}의 sub가 {MAX_SUB}자를 넘는다.")
        for fact in n.get("facts") or []:
            if not (isinstance(fact, list) and len(fact) == 2):
                p.append(f'상자 {nid}의 facts는 ["이름", "값"] 짝의 목록이어야 한다.')
                break
    placed = [n for n in nodes if isinstance(n.get("col"), (int, float)) and isinstance(n.get("row"), (int, float))]
    for i, a in enumerate(placed):
        for b in placed[i + 1:]:
            if abs(a["col"] - b["col"]) * COL_W < NODE_W + 10 and abs(a["row"] - b["row"]) * ROW_H < NODE_H + 30:
                p.append(f"상자 {a.get('id')}와 {b.get('id')}가 겹친다. col·row를 띄운다.")
    known = set(ids)

    def check_nodes(names, where):
        for name in names:
            if name not in known:
                p.append(f"{where}에 없는 상자 이름: {name}")

    for e in spec.get("edges") or []:
        check_nodes([e.get("from"), e.get("to")], "edges")
        for side in ("from_side", "to_side"):
            if e.get(side) and e[side] not in SIDES:
                p.append(f'edges의 {side}는 top·bottom·left·right 중 하나다: {e[side]}')
        if "via" in e and not (isinstance(e["via"], list) and len(e["via"]) == 2):
            p.append(f'edges의 via는 [col, row]다: {e.get("from")} → {e.get("to")}')

    def check_groups(groups, where):
        for g in groups or []:
            if g.get("nodes") != "*":
                check_nodes(g.get("nodes") or [], f"{where} groups")
                if not g.get("nodes"):
                    p.append(f"{where} groups에 nodes가 빈 묶음이 있다.")

    check_groups(spec.get("groups"), "맨 위")
    for state in (spec.get("state_labels") or {}):
        if state not in STATES:
            p.append(f"state_labels에 모르는 상태: {state}")
    scenarios = spec.get("scenarios") or []
    if not 1 <= len(scenarios) <= MAX_SCENARIOS:
        p.append(f"시나리오는 1~{MAX_SCENARIOS}개여야 한다(지금 {len(scenarios)}개).")
    tags = {e.get("tag") for e in spec.get("edges") or [] if e.get("tag")}
    for si, sc in enumerate(scenarios, 1):
        where = f"시나리오 {si}"
        if not sc.get("name"):
            p.append(f"{where}에 name이 없다.")
        check_groups(sc.get("groups"), where)
        for tag in sc.get("loose") or []:
            if tag not in tags:
                p.append(f"{where}의 loose에 없는 edge tag: {tag}")
        steps = sc.get("steps") or []
        if not 2 <= len(steps) <= MAX_STEPS:
            p.append(f"{where}의 단계는 2~{MAX_STEPS}개여야 한다(지금 {len(steps)}개). 넘으면 시나리오를 나눈다.")
        for i, s in enumerate(steps, 1):
            text = s.get("text")
            if not isinstance(text, str) or not text.strip():
                p.append(f"{where} {i}단계에 자막(text)이 없다.")
            elif len(text) > MAX_TEXT:
                p.append(f"{where} {i}단계 자막이 {MAX_TEXT}자를 넘는다({len(text)}자). 글을 줄이거나 단계를 나눈다.")
            if len(s.get("t") or "") > MAX_T:
                p.append(f"{where} {i}단계의 t가 {MAX_T}자를 넘는다.")
            for name, value in (s.get("set") or {}).items():
                if name not in known:
                    p.append(f"{where} {i}단계 set에 없는 상자 이름: {name}")
                state = value[0] if isinstance(value, list) and value else value
                if state not in STATES:
                    p.append(f"{where} {i}단계 set에 모르는 상태: {name}={state}")
        result = sc.get("result") or []
        if len(result) > MAX_RESULT:
            p.append(f"{where}의 result는 {MAX_RESULT}줄까지다.")
        for row in result:
            if not (isinstance(row, list) and 2 <= len(row) <= 3) or (len(row) == 3 and row[2] not in TONES):
                p.append(f'{where}의 result 줄은 ["이름", "값", "good|warn|bad"]다: {row}')
    if not allow_slots:
        p += [f"채우지 않은 자리가 남았다: {slot}" for slot in unfilled_slots(spec)[:5]]
    return p


def build_page(spec):
    template = (ASSETS / "motion.html").read_text(encoding="utf-8")
    data = json.dumps(spec, ensure_ascii=False).replace("</", "<\\/")
    if "/*__SPEC__*/null" not in template or "__TITLE__" not in template:
        raise RenderFailed("assets/motion.html에 spec을 넣을 자리가 없다. 재생기 파일이 깨졌다.")
    # 치환 문자열 안의 역슬래시가 해석되지 않게 함수로 넣는다
    page = template.replace("__TITLE__", html.escape(spec["title"]))
    return page.replace("/*__SPEC__*/null", data)


def run_check(chrome, page_file, profile):
    command = [
        chrome, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--use-mock-keychain",
        "--no-default-browser-check", f"--user-data-dir={profile}", "--window-size=1440,1000",
        "--virtual-time-budget=20000", "--dump-dom", page_file.as_uri() + "#check",
    ]
    try:
        dom = subprocess.run(command, capture_output=True, text=True, timeout=120).stdout
    except subprocess.TimeoutExpired:
        raise RenderFailed("Chrome이 120초 안에 끝나지 않았다.")
    except OSError as e:
        raise RenderFailed(f"Chrome을 실행하지 못했다: {e}")
    found = re.search(r"MOTION-REPORT:([^<\"]*)", dom)
    if not found:
        raise RenderFailed("Chrome이 모션그래픽을 끝까지 돌리지 못했다. 재생기 스크립트가 멈췄는지 확인한다.")
    return json.loads(unquote(found.group(1)))


def render(source, output, allow_slots=False):
    """source(spec JSON)를 output(HTML)으로 굽는다. 실패하면 RenderFailed, 규칙 위반이면 SpecProblems."""
    source, output = Path(source).resolve(), Path(output).resolve()
    if not source.is_file():
        raise RenderFailed(f"spec 파일이 없다: {source}")
    try:
        spec = json.loads(source.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        raise RenderFailed(f"spec이 JSON으로 읽히지 않는다: {e}")
    problems = validate(spec, allow_slots)
    if not problems:
        page = build_page(spec)
        chrome = find_chrome()
        with tempfile.TemporaryDirectory(prefix="render-motion-") as work:
            page_file = Path(work) / "motion.html"
            page_file.write_text(page, encoding="utf-8")
            report = run_check(chrome, page_file, Path(work) / "chrome-profile")
        if report["failure"]:
            raise RenderFailed(report["failure"])
        problems = report["problems"]
    if problems:
        if output.exists():
            output.unlink()  # 예전에 구운 HTML이 지금 내용인 것처럼 남지 않게 한다
        raise SpecProblems(problems)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(page, encoding="utf-8")


def render_and_report(source, output, allow_slots=False):
    try:
        render(source, output, allow_slots)
    except SpecProblems as e:
        print(f"spec이 규칙을 어겨 HTML을 만들지 않았다: {source}", file=sys.stderr)
        for problem in e.args[0]:
            print(f"  - {problem}", file=sys.stderr)
        print("spec을 고친 뒤 다시 굽는다. 긴 글은 줄이고, 많은 단계는 시나리오를 나눈다.", file=sys.stderr)
        return 2
    except RenderFailed as e:
        print(f"굽지 못했다: {e}", file=sys.stderr)
        return 1
    print(f"구웠다: {output} (상자 이름·화살표·자동 재생 검사 통과)")
    return 0


def check():
    """설치 확인. 견본 spec을 구워 보고, 열어 볼 수 있게 HTML 위치를 알려 준다."""
    out_dir = Path(tempfile.mkdtemp(prefix="motion-graphics-check-"))
    code = render_and_report(ASSETS / "motion-spec.json", out_dir / "motion-spec.html", allow_slots=True)
    if code:
        print("설치 확인 실패. 위 메시지를 보고 고친 뒤 다시 실행한다.", file=sys.stderr)
        return 1
    print("설치 확인 완료: 견본 모션그래픽을 구웠다. 모양은 위 HTML을 브라우저로 열어 본다.")
    return 0


def main(argv):
    if argv == ["--check"]:
        return check()
    if not 1 <= len(argv) <= 2 or argv[0].startswith("-"):
        print(__doc__.strip(), file=sys.stderr)
        return 1
    source = Path(argv[0])
    output = Path(argv[1]) if len(argv) == 2 else source.with_suffix(".html")
    return render_and_report(source, output)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
