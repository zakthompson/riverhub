#!/bin/bash
#
# Sync local changes to Raspberry Pi in real-time
#
# This script watches for file changes and syncs them to the Pi
# for remote development with real hardware.
#
# Usage:
#   ./sync.sh
#
# On the Pi, run: ./dev.sh
#

watchexec -r \
  --ignore sync.sh \
  --ignore .venv \
  --ignore __pycache__ \
  --ignore .git \
  'rsync -az --delete \
    --filter="protect backend/node_modules/" \
    --filter="protect backend/dist/" \
    --filter="protect backend/.env" \
    --filter="protect backend/lib/rfid/venv/" \
    --filter="protect backend/lib/rfid/__pycache__/" \
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
    --exclude=.DS_Store \
    ./ rpi:/home/river/riverhub/'
