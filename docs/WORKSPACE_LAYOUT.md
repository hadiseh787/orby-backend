# Two-repository workspace

The frontend and backend are independent private Git repositories. The enclosing directory is a normal workspace folder, not a third repository.

For the original `frontend/` and `backend/` layout:

```powershell
mkdir agent-freelancer
cd agent-freelancer
git clone https://github.com/hadiseh787/agent-freelancer-frontend.git frontend
git clone https://github.com/hadiseh787/agent-freelancer-backend.git backend
Get-ChildItem -LiteralPath backend/workspace-template -Force | Copy-Item -Destination .
```

`workspace-template/` preserves the original root README, verification report, editor settings, ignore rules and four startup/shutdown wrappers. Copying its contents recreates the root files; it does not copy any Git metadata, private configuration or generated data. `start.cmd` starts the complete application through `backend/scripts/local.mjs`; `stop.cmd` stops it. The PowerShell wrappers provide the same entry points.

The handoff's 31 original files are versioned in `backend/docs/handoff/Agent-Freelancer-Handoff-v1`. They are not missing source files when the original workspace also has a separate `handoff/` copy.

For the simplest setup, cloning only the backend and running `npm run local` remains sufficient: its launcher fetches the pinned frontend into `.workspace/frontend`. No workspace templates need to be copied for that setup.

Check version-control status in each application directory:

```powershell
git -C frontend status
git -C backend status
```
