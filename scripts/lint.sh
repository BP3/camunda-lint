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
. "${SCRIPT_DIR}"/logger.sh

# Run modes
mode_bpmn=0
mode_dmn=0
mode_sbom=0

# Verbose flag
verbose=0

if [ -n "${VERBOSE}" ]; then
  if [ "${VERBOSE}" != "false" ]; then
    verbose=1
  fi
fi

case "$1" in
    sbom)
      mode_sbom=1
        ;;
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

if [ $mode_sbom = 1 ]; then
  echo ""
  if [ ! "${SBOM_REPORT_PATH}" ]; then
    SBOM_REPORT_PATH="/local"
    if [ -n "${PROJECT_PATH}" ]; then
      SBOM_REPORT_PATH="${PROJECT_PATH}"
    fi
  fi
  if [ ! "${SBOM_REPORT_NAME}" ]; then
    SBOM_REPORT_NAME="camunda-lint-sbom"
  fi
  SBOM_REPORT_EXT="json"
  case "${SBOM_REPORT_FORMAT}" in
    XML)
      SBOM_REPORT_EXT="xml"
        ;;
    *)
      SBOM_REPORT_FORMAT="JSON"
      SBOM_REPORT_EXT="json"
        ;;
  esac

  log_info "Generating the SBOM..."
  log_info "---------------------------------------------------"
  log_info "Writing: ${SBOM_REPORT_PATH}/${SBOM_REPORT_NAME}.${SBOM_REPORT_EXT}"
  cyclonedx-npm /app/package.json -o "${SBOM_REPORT_PATH}/${SBOM_REPORT_NAME}.${SBOM_REPORT_EXT}" --of "${SBOM_REPORT_FORMAT}"
  echo ""
  log_info "Done!"
  echo ""
fi

if [ -n "${PROJECT_PATH}" ]; then
  BPMN_PATH="${PROJECT_PATH}"
  DMN_PATH="${PROJECT_PATH}"
fi

if [ $mode_bpmn = 1 ]; then
  echo ""
  # initialize the folder to run the linter if it has not been initialized for bpmnlint
  log_info "Initializing the BPMN rules for linting (if needed)"
  log_info "---------------------------------------------------"
  if [ ! -f "${BPMN_PATH}"/.bpmnlintrc ]; then
    (cd "${BPMN_PATH}"; bpmnlint --init)
  fi

  BPMN_LINTER_ARGS=""
  if [ $verbose = 1 ]; then
    BPMN_LINTER_ARGS="${BPMN_LINTER_ARGS} --verbose=true"
  else
    BPMN_LINTER_ARGS="${BPMN_LINTER_ARGS} --verbose=false"
  fi
  BPMN_LINTER_ARGS="${BPMN_LINTER_ARGS} --type=bpmn"
  BPMN_LINTER_ARGS="${BPMN_LINTER_ARGS} --runnerpath=/app/bpmnlint-runner"
  # BPMN_LINTER_ARGS="${BPMN_LINTER_ARGS} --config=${BPMN_PATH}/.bpmnlintrc"
  
  # retrieve and install any plugins that were provided as part of .bpmnlintrc and generates a .bpmnlintrcRevised under the runner path
  echo ""
  log_info "Installing the BPMN lint runner dependencies"
  log_info "---------------------------------------------------"
  node ${SCRIPT_DIR}/installPluginPackages.js ${BPMN_LINTER_ARGS} --config="${BPMN_PATH}"/.bpmnlintrc
  #--type=bpmn --config="${BPMN_PATH}"/.bpmnlintrc --runnerpath=/app/bpmnlint-runner
  echo ""
  log_info "Running the BPMN linter"
  log_info "---------------------------------------------------"
  # prepare params
  # use the revised file that should have been generated
  BPMN_LINTER_ARGS="${BPMN_LINTER_ARGS} --config=/app/bpmnlint-runner/.bpmnlintrcRevised"
  BPMN_LINTER_ARGS="${BPMN_LINTER_ARGS} --files=${BPMN_PATH}/**/*.bpmn"

  if [ -n "${BPMN_REPORT_FILEPATH}" ]; then
    BPMN_LINTER_ARGS="${BPMN_LINTER_ARGS} --output=${BPMN_REPORT_FILEPATH}"
  fi

  if [ -n "${REPORT_FORMAT}" ]; then
    BPMN_LINTER_ARGS="${BPMN_LINTER_ARGS} --format=${REPORT_FORMAT}"
  else
    BPMN_LINTER_ARGS="${BPMN_LINTER_ARGS} --format=json"
  fi

  if [ -n "${BPMN_RULES_PATH}" ]; then
    BPMN_LINTER_ARGS="${BPMN_LINTER_ARGS} --rulespath=${BPMN_RULES_PATH} --rulesseverity=warn"
  fi

  if [ -n "${CONSOLE_TABLE}" ]; then
    BPMN_LINTER_ARGS="${BPMN_LINTER_ARGS} --consoletable=${CONSOLE_TABLE}"
  fi

  log_debug "Running linter with params: ${BPMN_LINTER_ARGS}"

  # run the linter
  node ${SCRIPT_DIR}/runLinter.js ${BPMN_LINTER_ARGS}

  echo ""
fi

if [ $mode_dmn = 1 ]; then
  echo ""
  # initialize the folder to run the linter if it has not been initialized for dmnlint
  log_info "Initializing the DMN rules for linting (if needed)"
  log_info "---------------------------------------------------"
  if [ ! -f "${DMN_PATH}"/.dmnlintrc ]; then
    (cd "${DMN_PATH}"; dmnlint --init)
  fi

  DMN_LINTER_ARGS=""
  if [ $verbose = 1 ]; then
    DMN_LINTER_ARGS="${DMN_LINTER_ARGS} --verbose=true"
  else
    DMN_LINTER_ARGS="${DMN_LINTER_ARGS} --verbose=false"
  fi
  DMN_LINTER_ARGS="${DMN_LINTER_ARGS} --type=dmn"
  DMN_LINTER_ARGS="${DMN_LINTER_ARGS} --runnerpath=/app/dmnlint-runner"
  # DMN_LINTER_ARGS="${DMN_LINTER_ARGS} --config=${DMN_PATH}/.dmnlintrc"

  # retrieve and install any plugins that were provided as part of .dmnlintrc and generates a .dmnlintrcRevised under the runner path
  echo ""
  log_info "Installing the DMN lint runner dependencies"
  log_info "---------------------------------------------------"
  node ${SCRIPT_DIR}/installPluginPackages.js ${DMN_LINTER_ARGS} --config=${DMN_PATH}/.dmnlintrc
  # --type=dmn --config="${DMN_PATH}"/.dmnlintrc --runnerpath=/app/dmnlint-runner
  echo ""
  log_info "Running the DMN linter"
  log_info "---------------------------------------------------"

  # prepare params
  # use the revised file that should have been generated
  DMN_LINTER_ARGS="${DMN_LINTER_ARGS} --config=/app/dmnlint-runner/.dmnlintrcRevised"
  DMN_LINTER_ARGS="${DMN_LINTER_ARGS} --files=${DMN_PATH}/**/*.dmn"

  if [ -n "${DMN_REPORT_FILEPATH}" ]; then
    DMN_LINTER_ARGS="${DMN_LINTER_ARGS} --output=${DMN_REPORT_FILEPATH}"
  fi

  if [ -n "${REPORT_FORMAT}" ]; then
    DMN_LINTER_ARGS="${DMN_LINTER_ARGS} --format=${REPORT_FORMAT}"
  else
    DMN_LINTER_ARGS="${DMN_LINTER_ARGS} --format=json"
  fi

  if [ -n "${DMN_RULES_PATH}" ]; then
    DMN_LINTER_ARGS="${DMN_LINTER_ARGS} --rulespath=${DMN_RULES_PATH} --rulesseverity=warn"
  fi

  if [ -n "${CONSOLE_TABLE}" ]; then
    DMN_LINTER_ARGS="${DMN_LINTER_ARGS} --consoletable=${CONSOLE_TABLE}"
  fi

  log_debug "Running linter with params: ${DMN_LINTER_ARGS}"

  # run the linter
  node ${SCRIPT_DIR}/runLinter.js ${DMN_LINTER_ARGS}
  
  echo ""
fi
