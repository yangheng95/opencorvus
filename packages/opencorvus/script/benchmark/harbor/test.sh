#!/bin/sh
set -eu
python3 /tests/score_harbor.py
test -s /logs/verifier/reward.json
test -s /logs/verifier/official-score.json
