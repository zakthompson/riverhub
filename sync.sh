watchexec -r \
  --ignore sync.sh \
  --ignore .venv \
  --ignore __pycache__ \
  --ignore .git \
  'rsync -az --delete \
    --filter="protect backend/venv/" \
    --filter="protect backend/.env" \
    --filter="protect frontend/node_modules/" \
    --filter="protect frontend/dist/" \
    --filter="protect frontend/.vite/" \
    --filter="protect frontend/.env" \
    --exclude=node_modules/ \
    --exclude=venv/ \
    --exclude=dist/ \
    --exclude=.vite/ \
    --exclude="*.log" \
    --exclude=__pycache__/ \
    ./ rpi:/home/river/riverhub/'
