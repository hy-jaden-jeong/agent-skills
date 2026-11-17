# agent-skills

일할 때 쓰는 개인 skill 모음. [Agent Skills](https://agentskills.io) 형식(`SKILL.md`)이라 Claude Code와 Codex에서 같이 쓴다.

## skill 목록

| skill | 하는 일 |
| --- | --- |
| [diagram-slides](skills/diagram-slides/SKILL.md) | 설명을 16:9 다크 모드 장표(PNG)로 굽는다. 그림 하나와 설명 패널(핵심·용어·읽는 법)을 담고, 내용에 맞는 모양(흐름, 묶음, 대응, 주고받기, 사건 순서, 시간 막대, 양의 흐름)을 골라 그린다 |
| [motion-graphics](skills/motion-graphics/SKILL.md) | 같은 그림 위에서 상태가 차례로 바뀌는 내용(데이터 한 건이 갈래가 있는 흐름을 거쳐 가는 차례)을 재생할 수 있는 HTML 한 파일로 굽는다. 기본은 정상 흐름이다. 단계마다 자막이 나온다 |
| [onboarding](skills/onboarding/SKILL.md) | 문서·레포·시스템을 단계별 장표·모션그래픽·퀴즈로 가르친다. 그림은 위 두 skill에 맡긴다 |
| [spec-driven](skills/spec-driven/SKILL.md) | 인터뷰로 spec을 확정하고 그 spec을 기준으로 구현하고 검증한다. 문제 맞추기 → 설계 → 인터뷰 → spec 확정 → slice 나누기 → 구현 → 검증. 결정마다 추천을 붙여 묻고 필요한 만큼 가르친다. 설계까지만 하거나 중간 단계부터 시작할 수 있다 |

`onboarding`은 `diagram-slides`와 `motion-graphics`를 같은 skills 폴더에서 찾는다. 셋을 함께 설치한다.

## 설치

skill 폴더를 agent의 skills 폴더 아래에 symbolic link로 건다. 레포를 `git pull` 하면 바로 반영된다.

```bash
git clone https://github.com/hy-jaden-jeong/agent-skills.git ~/agent-skills
```

Claude Code (`~/.claude/skills`):

```bash
mkdir -p ~/.claude/skills && for s in ~/agent-skills/skills/*/; do ln -sfn "${s%/}" ~/.claude/skills/"$(basename "$s")"; done
```

Codex (`~/.agents/skills`):

```bash
mkdir -p ~/.agents/skills && for s in ~/agent-skills/skills/*/; do ln -sfn "${s%/}" ~/.agents/skills/"$(basename "$s")"; done
```

Claude Code subagent 정의 (`~/.claude/agents`). `spec-driven`이 Fable이 아닌 세션에서 후보 설계를 맡길 때 쓴다. 없어도 skill은 돈다.

```bash
mkdir -p ~/.claude/agents && ln -sfn ~/agent-skills/agents/fable-solver.md ~/.claude/agents/fable-solver.md
```

## 필요한 것

- python3, Google Chrome(또는 Chromium·Edge). Chrome이 기본 위치에 없으면 `CHROME_PATH`에 실행 파일 경로를 넣는다
- 인터넷: 장표는 Mermaid를 CDN에서 불러온다
- `spec-driven`은 스크립트가 없어 따로 필요한 것이 없다
- 장표·모션그래픽 설치 확인

  ```bash
  python3 ~/agent-skills/skills/diagram-slides/scripts/render_slide.py --check
  ```

  ```bash
  python3 ~/agent-skills/skills/motion-graphics/scripts/render_motion.py --check
  ```

## 이 레포를 고칠 때

agent가 지킬 규칙은 [AGENTS.md](AGENTS.md)에 있다. Claude Code는 `CLAUDE.md`가 `AGENTS.md`를 불러와 같은 규칙을 읽는다.

## 참고한 것

`spec-driven`은 두 공개 skill 모음에서 생각을 빌려 하나의 흐름으로 묶었다. 글은 새로 썼다.

- [mattpocock/skills](https://github.com/mattpocock/skills): design tree와 frontier를 round로 묻는 인터뷰(grilling), 사실은 agent가 찾고 결정은 사용자가 내린다는 구분, 용어 맞추기(domain-modeling), 후보를 여러 개 만드는 Design It Twice와 깊은 module(codebase-design), spec 형식(to-spec), 세로로 자른 slice와 넓히고 줄이는 차례(to-tickets), 실패하는 test 먼저(tdd), spec과 규칙 두 방향 review(code-review), agent가 읽는 글 쓰는 법(writing-for-agents)
- [pstack](https://github.com/cursor/plugins/tree/main/pstack): shape를 고르는 기준(architect), 진 후보에서 좋은 부분을 가져오는 방식(arena), 논쟁 대신 prototype, 가장 작은 설명부터 쌓는 가르치기(teach), 계획은 설계가 확정된 뒤에(multi-phase plan), 진짜를 돌려 증명하기(prove-it-works), 확인할 수 있는 단위로 차례 짓기(sequence-verifiable-units), 돌려서 증명된 발견만 남기는 검증(interrogate)
