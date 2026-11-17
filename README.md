# agent-skills

일할 때 쓰는 개인 skill 모음. [Agent Skills](https://agentskills.io) 형식(`SKILL.md`)이라 Claude Code와 Codex에서 같이 쓴다.

## skill 목록

| skill | 하는 일 |
| --- | --- |
| [diagram-slides](skills/diagram-slides/SKILL.md) | 설명을 16:9 다크 모드 장표(PNG)로 굽는다. 그림 하나와 설명 패널(핵심·용어·읽는 법)을 담고, 내용에 맞는 모양(흐름, 묶음, 대응, 주고받기, 사건 순서, 시간 막대, 양의 흐름)을 골라 그린다 |
| [motion-graphics](skills/motion-graphics/SKILL.md) | 같은 그림 위에서 상태가 차례로 바뀌는 내용(job이 도는 순서, 실패가 퍼지는 범위)을 재생할 수 있는 HTML 한 파일로 굽는다. 단계마다 자막이 나온다 |
| [onboarding](skills/onboarding/SKILL.md) | 문서·레포·시스템을 단계별 장표·모션그래픽·퀴즈로 가르친다. 그림은 위 두 skill에 맡긴다 |

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

## 필요한 것

- python3, Google Chrome(또는 Chromium·Edge). Chrome이 기본 위치에 없으면 `CHROME_PATH`에 실행 파일 경로를 넣는다
- 인터넷: 장표는 Mermaid를 CDN에서 불러온다
- 설치 확인

  ```bash
  python3 ~/agent-skills/skills/diagram-slides/scripts/render_slide.py --check
  ```

  ```bash
  python3 ~/agent-skills/skills/motion-graphics/scripts/render_motion.py --check
  ```

## 이 레포를 고칠 때

agent가 지킬 규칙은 [AGENTS.md](AGENTS.md)에 있다. Claude Code는 `CLAUDE.md`가 `AGENTS.md`를 불러와 같은 규칙을 읽는다.
