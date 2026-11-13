#!/bin/sh
# Stand-in for an agent CLI during end-to-end tests. It receives the real command line
# HelmADE would have run, then behaves like a minimal agent REPL:
#   !<command>   runs <command> in a shell (how the test makes the "agent" act)
#   anything else is echoed back as received input
cli="$1"
has_protocol=no
resumed=no
for arg in "$@"; do
  case "$arg" in
    *"Protocolo de equipa HelmADE"*) has_protocol=yes ;;
    --continue|resume|--resume) resumed=yes ;;
  esac
done
echo "FAKE_AGENT_READY cli=$cli key=$HELM_AGENT_KEY protocol=$has_protocol resumed=$resumed port=$PORT cwd=$(pwd)"
while IFS= read -r line; do
  case "$line" in
    '!'*) sh -c "${line#!}" ;;
    *) echo "FAKE_AGENT_GOT: $line" ;;
  esac
done
