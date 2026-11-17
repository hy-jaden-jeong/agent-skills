# agent-skills

일할 때 쓰는 개인 skill 모음. [Agent Skills](https://agentskills.io) 형식(`SKILL.md`)이라 Claude Code와 Codex에서 같이 쓴다.

## skill 목록

| skill | 하는 일 |
| --- | --- |
| [diagram-slides](skills/diagram-slides/SKILL.md) | 설명을 16:9 다크 모드 장표(PNG)로 굽는다. 그림 하나와 설명 패널(핵심·용어·읽는 법)을 담고, 내용에 맞는 모양(흐름, 묶음, 대응, 주고받기, 사건 순서, 시간 막대, 양의 흐름)을 골라 그린다 |
| [motion-graphics](skills/motion-graphics/SKILL.md) | 같은 그림 위에서 상태가 차례로 바뀌는 내용(데이터 한 건이 갈래가 있는 흐름을 거쳐 가는 차례)을 재생할 수 있는 HTML 한 파일로 굽는다. 기본은 정상 흐름이다. 단계마다 자막이 나온다 |
| [teach-me](skills/teach-me/SKILL.md) | 문서·레포·시스템을 단계별 장표·모션그래픽·퀴즈로 가르친다. 그림은 위 두 skill에 맡긴다 |
| [grill-me](skills/grill-me/SKILL.md) | 계획·결정·아이디어를 끝까지 인터뷰한다. 정할 것을 모두 찾아 추천과 함께 묻고, 필요한 만큼 가르치고, 결정 목록을 확정받는다. 코드가 없는 주제는 파일 없이 끝내고, 만들 일이면 문제 맞추기 → 설계 → 인터뷰 → 확정으로 spec 한 파일을 확정한다 |
| [build-to-spec](skills/build-to-spec/SKILL.md) | 확정된 spec대로 만들고 증명한다. slice 나누기 → 구현(실패하는 test 먼저, 기존 출력은 golden master로 지킴) → 세 방향 검증. spec 파일이 진행 상태라 끊긴 구현을 이어 간다 |
| [debate-with-fable](skills/debate-with-fable/SKILL.md) | 메인은 작업 모델(Opus)로 두고, 설계·접근법을 찾을 문제·되돌리기 비싼 결정·두 번 실패한 문제에서만 판단 모델(Fable)과 각자 안을 내고 견줘 결론 하나를 들고 온다 |

함께 설치할 것이 있다. skill은 다른 skill을 같은 skills 폴더에서 찾는다.

- `teach-me`는 `diagram-slides`와 `motion-graphics`를 쓴다.
- `build-to-spec`은 spec이 없으면 `grill-me`로 spec부터 확정하고, 사용자에게 묻는 법과 spec 형식을 `grill-me`에서 읽는다. 둘을 함께 설치한다. 일하는 차례는 `grill-me`(spec 확정) → `build-to-spec`(만들고 증명)이다.
- `grill-me`는 `debate-with-fable`이 있으면 설계 후보를 그 skill의 토론으로 만든다.
- `debate-with-fable`은 사용자에게 묻는 법을 `grill-me`에서 읽는다.

## 설치

skill 폴더를 agent의 skills 폴더 아래에 symbolic link로 건다. 레포를 `git pull` 하면 바로 반영된다.

`spec-driven`은 `build-to-spec`으로 이름이 바뀌었다(spec 확정은 `grill-me`로 옮김). 예전에 설치했으면 옛 link를 지우고 아래 설치를 다시 돌린다: `rm -f ~/.claude/skills/spec-driven ~/.agents/skills/spec-driven`

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

Claude Code subagent 정의 (`~/.claude/agents`). skill들이 이 이름으로 subagent를 부른다. 없으면 skill이 model과 effort를 직접 정해 부른다.

| 에이전트 | 모델 | 맡는 일 |
| --- | --- | --- |
| `fable-solver` | Fable, effort `high` | `debate-with-fable`의 토론 상대, 통째로 맡길 어려운 조각 |
| `opus-worker` | Opus, effort `high` | 판단이 필요한 구현·분석·조사·검토 |
| `sonnet-worker` | Sonnet, effort `medium` | 그리기, 정해진 대로 고치기, 단순 검색 |

```bash
mkdir -p ~/.claude/agents && for a in ~/agent-skills/agents/*.md; do ln -sfn "$a" ~/.claude/agents/"$(basename "$a")"; done
```

## 필요한 것

- python3, Google Chrome(또는 Chromium·Edge). Chrome이 기본 위치에 없으면 `CHROME_PATH`에 실행 파일 경로를 넣는다
- 인터넷: 장표는 Mermaid를 CDN에서 불러온다
- `grill-me`, `build-to-spec`, `debate-with-fable`은 스크립트가 없어 따로 필요한 것이 없다
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

`grill-me`와 `build-to-spec`은 두 공개 skill 모음에서 생각을 빌렸다. 글은 새로 썼다.

- [mattpocock/skills](https://github.com/mattpocock/skills): design tree와 frontier를 round로 묻는 인터뷰(grilling), 사실은 agent가 찾고 결정은 사용자가 내린다는 구분, 용어 맞추기(domain-modeling), 후보를 여러 개 만드는 Design It Twice와 깊은 module(codebase-design), spec 형식(to-spec), 세로로 자른 slice와 넓히고 줄이는 차례(to-tickets), 실패하는 test 먼저(tdd), spec과 규칙 두 방향 review(code-review), agent가 읽는 글 쓰는 법(writing-for-agents)
- [pstack](https://github.com/cursor/plugins/tree/main/pstack): shape를 고르는 기준(architect), 진 후보에서 좋은 부분을 가져오는 방식(arena), 논쟁 대신 prototype, 가장 작은 설명부터 쌓는 가르치기(teach), 계획은 설계가 확정된 뒤에(multi-phase plan), 진짜를 돌려 증명하기(prove-it-works), 확인할 수 있는 단위로 차례 짓기(sequence-verifiable-units), 돌려서 증명된 발견만 남기는 검증(interrogate)
