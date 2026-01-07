watchexec -r \
  --ignore sync.sh \
  --ignore .venv \
  --ignore __pycache__ \
  --ignore .git \
  'rsync -az --delete ./ rpi:/home/river/riverhub/'
