---
name: deploy
description: Push current branch to git, then SSH into Tencent Cloud and restart docker-compose. Confirms with user before any push or SSH.
argument-hint: "[commit-message]"
model: sonnet
allowed-tools:
  - Bash
  - Read
---

# Deploy to Tencent Prod

Deploys the current branch to the Tencent Cloud Ubuntu host running this app under docker-compose.

## ⚠️ Confirmation required

This skill PUSHES code AND restarts production. Confirm with user before each network step.

## Step 1 — Check git state

```bash
git status --short
git log -1 --oneline
```

If working tree is dirty:
- If user provided `$1` (commit message): `git add -A && git commit -m "$1"`
- Otherwise: STOP and ask user how to handle uncommitted changes.

## Step 2 — Push (ASK FIRST)

Ask: "Push current branch to origin? (y/n)"

On confirm:
```bash
git push
```

## Step 3 — SSH and pull (ASK FIRST)

Ask: "SSH to tencent-prod and restart docker-compose? (y/n)"

On confirm:
```bash
ssh tencent-prod "cd /root/clean-industry-ai-assistant && git pull && docker compose restart && sleep 5 && docker compose ps"
```

Expected: container shows `Up`. Anything `Restarting` or `Exit` = fail.

## Step 4 — Health check

```bash
ssh tencent-prod "curl -s http://localhost:5000/ -o /dev/null -w '%{http_code}'"
ssh tencent-prod "docker compose logs --tail=30 web"
```

Expected: HTTP 200 + no traceback in logs.

## Step 5 — Report

```
[deploy] OK
- branch: main
- commit: <sha> <message>
- container: up
- health: 200
- logs: clean
```

Any failure → report the failed step + relevant log excerpt + STOP.
