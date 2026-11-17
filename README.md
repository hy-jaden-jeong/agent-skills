# agent-skills

일할 때 쓰는 개인 skill 모음. [Agent Skills](https://agentskills.io) 형식(`SKILL.md`)이라 Claude Code와 Codex에서 같이 쓴다.

## skill 목록

| skill | 하는 일 |
| --- | --- |
| [diagram-slides](skills/diagram-slides/SKILL.md) | 설명을 16:9 다크 모드 장표(PNG)로 굽는다. 그림 하나와 설명 패널(핵심·용어·읽는 법)을 담고, 내용에 맞는 모양(흐름, 묶음, 대응, 주고받기, 사건 순서, 시간 막대, 양의 흐름)을 골라 그린다 |
| [motion-graphics](skills/motion-graphics/SKILL.md) | 같은 그림 위에서 상태가 차례로 바뀌는 내용(데이터 한 건이 갈래가 있는 흐름을 거쳐 가는 차례)을 재생할 수 있는 HTML 한 파일로 굽는다. 기본은 정상 흐름이다. 단계마다 자막이 나온다 |
| [onboarding](skills/onboarding/SKILL.md) | 문서·레포·시스템을 단계별 장표·모션그래픽·퀴즈로 가르친다. 그림은 위 두 skill에 맡긴다 |
| [guided-design](skills/guided-design/SKILL.md) | 어려운 설계를 사용자와 함께 끝낸다. 문제를 맞추고, 서로 다른 후보 설계를 견주고, 결정마다 필요한 만큼 가르친 뒤 확정을 받아 설계 문서 한 파일로 남긴다. 후보 설계는 쓸 수 있는 가장 강한 모델(Claude Code에서는 Fable)이 맡는다 |

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

Claude Code subagent 정의 (`~/.claude/agents`). `guided-design`이 Fable이 아닌 세션에서 후보 설계를 맡길 때 쓴다. 없어도 skill은 돈다.

```bash
mkdir -p ~/.claude/agents && ln -sfn ~/agent-skills/agents/fable-solver.md ~/.claude/agents/fable-solver.md
```

## 필요한 것

- python3, Google Chrome(또는 Chromium·Edge). Chrome이 기본 위치에 없으면 `CHROME_PATH`에 실행 파일 경로를 넣는다
- 인터넷: 장표는 Mermaid를 CDN에서 불러온다
- `guided-design`은 스크립트가 없어 따로 필요한 것이 없다
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

`guided-design`은 두 공개 skill 모음에서 생각을 빌렸다. 글은 새로 썼다.

- [mattpocock/skills](https://github.com/mattpocock/skills): design tree와 frontier를 round로 묻는 방식(grilling), 사실은 agent가 찾고 결정은 사용자가 내린다는 구분, 후보를 여러 개 만드는 Design It Twice, 짧은 결정 기록(ADR), agent가 읽는 글 쓰는 법
- [pstack](https://github.com/cursor/plugins/tree/main/pstack): 서로 다른 shape를 견줘 고르는 기준(architect), 진 후보에서 좋은 부분을 가져오는 방식(arena), 논쟁 대신 prototype, 가장 작은 설명부터 쌓는 가르치기(teach), 설계가 확정된 뒤에 계획 쓰기
