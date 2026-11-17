# AGENTS.md

이 레포에서 일하는 agent(Claude Code, Codex 등)가 지킬 규칙이다.

## 구조

- skill 하나는 `skills/<이름>/` 폴더 하나다. `SKILL.md`(앞머리에 `name`, `description`)가 있고, 필요하면 `assets/`(견본), `scripts/`(굽는 스크립트), `references/`(긴 설명)를 둔다.
- `name`은 폴더 이름과 같게 쓴다. `description`에는 무엇을 하는지와 언제 쓰는지(요청 예시 포함), 다른 skill과 나누는 경계를 쓴다.
- skill끼리는 이름과 `<skills 폴더>/<이름>/` 경로로만 가리킨다. `<skills 폴더>`는 skill 폴더들이 나란히 설치되는 곳이다(`~/.claude/skills`, `~/.agents/skills`).
- 스크립트는 자기 skill 폴더 안의 것만 import한다. 다른 skill의 스크립트를 import하지 않는다. skill 하나만 설치해도 그 skill의 스크립트가 돌아야 한다.
- 특정 agent에만 있는 도구(AskUserQuestion, Artifact 등)는 "있으면 쓰고, 없으면 이렇게"로 쓴다.

## 공개 레포

이 레포는 public이다.

- 회사 이름, 내부 table·job·서비스 이름, 내부 경로·URL, 개인 정보를 쓰지 않는다. 예시는 일반 도메인(주문, 결제, 정산, 검색)으로 쓰고, 지어낸 값이면 "(가상)"으로 표시한다.
- secret(token, key, password)을 넣지 않는다.
- commit 이메일은 GitHub noreply 주소를 쓴다.

## 글

- 문장은 한국어로 쓰고, 기술 용어는 영어 그대로 쓴다(job, table, view, schema). 번역(작업, 표)이나 음차(잡, 테이블)로 바꾸지 않는다.
- 번역투 문장("~에 해당한다", "~를 가진다", "~에 의해 ~된다")을 쓰지 않는다.
- SKILL.md는 agent가 따라 할 지시문이다. 이유가 필요한 규칙에는 이유를 한 줄 붙인다.

## 고친 뒤 확인

장표·모션그래픽 skill을 고쳤으면 두 확인을 돌려 둘 다 종료 코드 0인지 본다.

```bash
python3 skills/diagram-slides/scripts/render_slide.py --check
python3 skills/motion-graphics/scripts/render_motion.py --check
```

Claude 데스크톱 앱에서는 Write·Edit 도구로 `.html`을 쓰면 Browser pane이 열린다. 그 앱에서는 `.html` 파일을 Bash(heredoc, `sed`, `python3`)로 고친다.
