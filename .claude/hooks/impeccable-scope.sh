#!/bin/bash
# Tells an impeccable task how ponytail and impeccable share it. PostToolUse on the Skill tool covers the
# agent calling impeccable; UserPromptSubmit covers a typed /impeccable, which doesn't go through the Skill tool.
set -uo pipefail
e=$(cat)
event=$(jq -r '.hook_event_name // ""' <<<"$e" 2>/dev/null) || exit 0
case $event in
  PostToolUse) jq -e '.tool_input.skill // "" | test("^(impeccable:)?impeccable$")' <<<"$e" > /dev/null || exit 0 ;;
  UserPromptSubmit) jq -e '.prompt // "" | test("^\\s*/impeccable\\b")' <<<"$e" > /dev/null || exit 0 ;;
  *) exit 0 ;;
esac
jq -n --arg ev "$event" '{hookSpecificOutput: {hookEventName: $ev, additionalContext: "Impeccable task: DESIGN.md and impeccable'\''s craft floor (.claude/skills/impeccable/reference/craft-floor.md) set the bar for design completeness: states, motion, polish, browser surfaces. Ponytail still governs code structure only: no needless abstractions, dependencies or files."}}'
