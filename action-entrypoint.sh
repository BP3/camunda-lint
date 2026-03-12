#!/bin/sh
# action-entrypoint.sh
set -e

# ----------------------------------------------------------
# Set the environment variables for the image
# ----------------------------------------------------------
export REPORT_FORMAT="$INPUT_REPORT_FORMAT"
export BPMN_REPORT_FILEPATH="$INPUT_BPMN_REPORT_FILEPATH"
export DMN_REPORT_FILEPATH="$INPUT_DMN_REPORT_FILEPATH"
if [ -n "$INPUT_BPMN_RULES_PATH" ]; then
  export BPMN_RULES_PATH="$INPUT_BPMN_RULES_PATH"
fi
if [ -n "$INPUT_DMN_RULES_PATH" ]; then
    export DMN_RULES_PATH="$INPUT_DMN_RULES_PATH"
fi

# ----------------------------------------------------------
# Run the tool
# ----------------------------------------------------------
# Because this is inside a github action, we can just do this
node /app/lint.js "$INPUT_COMMAND"

# ----------------------------------------------------------
# Handle the report files (Fix permissions)
# ----------------------------------------------------------
# This ensures the pipeline user can read/upload any report file in the next workflow steps.
echo "Updating file permissions for the generated report(s)..."
chown -R $(stat -c "%u:%g" "$GITHUB_WORKSPACE") "$GITHUB_WORKSPACE"

echo "Action completed with success!"
