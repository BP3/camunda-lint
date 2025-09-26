#!/bin/sh -e

############################################################################
#
# Licensed Materials - Property of BP3
#
# Camunda Lint (camunda-lint)
#
# Copyright © BP3 Global Inc. 2025. All Rights Reserved.
# This software is subject to copyright protection under
# the laws of the United States and other countries.
#
############################################################################

SCRIPT_DIR="$( cd "$( dirname "$0" )" && pwd )"
#. "${SCRIPT_DIR}"/functions.sh

mode_bpmn=0
mode_dmn=0

case "$1" in
    lint)
      mode_bpmn=1
      mode_dmn=1
        ;;
    bpmnlint)
      mode_bpmn=1
        ;;
    dmnlint)
      mode_dmn=1
        ;;
    help)
      "${SCRIPT_DIR}"/help.sh
        ;;
    *)
      if [ "$1" != "" ]; then
        echo "Mode not recognised: '$1'"
      fi
      "${SCRIPT_DIR}"/help.sh
      exit 1
        ;;
esac

if [ -n "${PROJECT_PATH}" ]; then
  BPMN_PATH = "${PROJECT_PATH}"
  DMN_PATH = "${PROJECT_PATH}"
fi

if [ $mode_bpmn = 1 ]; then
  echo ""
  # initialize the folder to run the linter if it has not been initialized for bpmnlint
  echo "Initializing the BPMN rules for linting (if needed)"
  echo "---------------------------------------------------"
  if [ ! -f "${BPMN_PATH}"/.bpmnlintrc ]; then
    (cd "${BPMN_PATH}"; bpmnlint --init)
  fi

  BPMN_LINTER_ARGS=""
  BPMN_LINTER_ARGS="${BPMN_LINTER_ARGS} --type=bpmn"
  BPMN_LINTER_ARGS="${BPMN_LINTER_ARGS} --config=${BPMN_PATH}/.bpmnlintrc"
  BPMN_LINTER_ARGS="${BPMN_LINTER_ARGS} --runnerpath=/app/bpmnlint-runner"

  # retrieve and install any plugins that were provided as part of .bpmnlintrc and generates a .bpmnlintrcRevised
  echo ""
  echo "Installing the BPMN lint runner dependencies"
  echo "---------------------------------------------------"
  node ${SCRIPT_DIR}/installPluginPackages.js ${BPMN_LINTER_ARGS}
  #--type=bpmn --config="${BPMN_PATH}"/.bpmnlintrc --runnerpath=/app/bpmnlint-runner
  echo ""
  echo "Running the BPMN linter"
  echo "---------------------------------------------------"
  # prepare params
  BPMN_LINTER_ARGS="${BPMN_LINTER_ARGS} --files=${BPMN_PATH}/**/*.bpmn"

  if [ -n "${BPMN_REPORT_FILEPATH}" ]; then
    BPMN_LINTER_ARGS="${BPMN_LINTER_ARGS} --output=${BPMN_REPORT_FILEPATH}"
  fi

  if [ -n "${REPORT_FORMAT}" ]; then
    BPMN_LINTER_ARGS="${BPMN_LINTER_ARGS} --format=${REPORT_FORMAT}"
  else
    BPMN_LINTER_ARGS="${BPMN_LINTER_ARGS} --format=console"
  fi

  if [ -n "${BPMN_RULES_PATH}" ]; then
    BPMN_LINTER_ARGS="${BPMN_LINTER_ARGS} --rulespath=${BPMN_RULES_PATH} --rulesseverity=warn"
  fi

  if [[ "${VERBOSE}" == "true" ]]; then
    BPMN_LINTER_ARGS="${BPMN_LINTER_ARGS} --verbose"
  fi

  # run the linter
  node ${SCRIPT_DIR}/runLinter.js ${BPMN_LINTER_ARGS}

  echo ""
fi

if [ $mode_dmn = 1 ]; then
  echo ""
  # initialize the folder to run the linter if it has not been initialized for dmnlint
  echo "Initializing the DMN rules for linting (if needed)"
  echo "---------------------------------------------------"
  if [ ! -f "${DMN_PATH}"/.dmnlintrc ]; then
    (cd "${DMN_PATH}"; dmnlint --init)
  fi

  DMN_LINTER_ARGS=""
  DMN_LINTER_ARGS="${DMN_LINTER_ARGS} --type=dmn"
  DMN_LINTER_ARGS="${DMN_LINTER_ARGS} --config=${DMN_PATH}/.dmnlintrc"
  DMN_LINTER_ARGS="${DMN_LINTER_ARGS} --runnerpath=/app/dmnlint-runner"

  # retrieve and install any plugins that were provided as part of .dmnlintrc
  echo ""
  echo "Installing the DMN lint runner dependencies"
  echo "---------------------------------------------------"
  node "${SCRIPT_DIR}/installPluginPackages.js ${DMN_LINTER_ARGS}"
  # --type=dmn --config="${DMN_PATH}"/.dmnlintrc --runnerpath=/app/dmnlint-runner
  echo ""
  echo "Running the DMN linter"
  echo "---------------------------------------------------"

  # prepare params
  DMN_LINTER_ARGS="${DMN_LINTER_ARGS} --files=${DMN_PATH}/**/*.dmn"

  if [ -n "${DMN_REPORT_FILEPATH}" ]; then
    DMN_LINTER_ARGS="${DMN_LINTER_ARGS} --output=${DMN_REPORT_FILEPATH}"
  fi

  if [ -n "${REPORT_FORMAT}" ]; then
    DMN_LINTER_ARGS="${DMN_LINTER_ARGS} --format=${REPORT_FORMAT}"
  else
    DMN_LINTER_ARGS="${DMN_LINTER_ARGS} --format=console"
  fi

  if [ -n "${DMN_RULES_PATH}" ]; then
    DMN_LINTER_ARGS="${DMN_LINTER_ARGS} --rulespath=${DMN_RULES_PATH} --rulesseverity=warn"
  fi

  if [[ "${VERBOSE}" == "true" ]]; then
    DMN_LINTER_ARGS="${DMN_LINTER_ARGS} --verbose"
  fi

  # run the linter
  node ${SCRIPT_DIR}/runLinter.js ${DMN_LINTER_ARGS}
  
  echo ""
fi
