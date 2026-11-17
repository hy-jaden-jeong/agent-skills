# agent-skills

Claude Code에서 쓰는 개인 skill 모음.

## 설치

skill 폴더를 `~/.claude/skills/` 아래에 symbolic link로 건다. 레포를 `git pull` 하면 바로 반영된다.

```bash
git clone https://github.com/hy-jaden-jeong/agent-skills.git ~/agent-skills
ln -s ~/agent-skills/skills/<skill 이름> ~/.claude/skills/<skill 이름>
```

## skill 목록

| skill | 하는 일 |
| --- | --- |
| [onboarding](skills/onboarding/SKILL.md) | 문서·레포·시스템을 단계별 장표(PNG)·모션그래픽(HTML)·퀴즈로 가르친다. 장표는 내용에 맞는 모양(흐름, 주고받기, 사건 순서, 시간 막대, 양의 흐름)을 골라 그린다 |

## onboarding이 필요한 것

- python3, Google Chrome(또는 Chromium·Edge). Chrome이 기본 위치에 없으면 `CHROME_PATH`에 실행 파일 경로를 넣는다
- 인터넷: Mermaid를 CDN에서 불러온다
- 설치 확인: `python3 ~/.claude/skills/onboarding/scripts/render_slide.py --check`
