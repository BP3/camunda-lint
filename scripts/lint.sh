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
ADHOC_BPMN_RULES_PATH="/bpmn-rules"
ADHOC_DMN_RULES_PATH="/dmn-rules"
BPMNLINT_RUNNER_PATH="bpmnlint-runner"
DMNLINT_RUNNER_PATH="dmnlint-runner"
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

if [ $mode_bpmn = 1 ]; then
  echo ""
  # initialize the folder to run the linter if it has not been initialized for bpmnlint
  if [ ! -f .bpmnlintrc ]; then
    bpmnlint --init
  fi
  # retrieve and install any plugins that were provided as part of .bpmnlintrc and generates a .bpmnlintrcRevised
  node "${SCRIPT_DIR}"/installPluginPackages.js --type=bpmn --config=.bpmnlintrc
  # run the linter
  node "${SCRIPT_DIR}"/runLinter.js --files=*.bpmn --type=bpmn --config=.bpmnlintrc --output ./bpmnlint-report --format junit
  # TODO: --rulespath "${ADHOC_BPMN_RULES_PATH}" --rulesseverity warn 

  # # run bpmnlint for the current or a separate directory based on the PROJECT_DIR environment variable being set
  # if [ -z ${PROJECT_DIR+x} ]; then 
  #   find . -name "*.bpmn" -exec sh -c 'bpmnlint "$1"' shell {} \;
  # else
  #   find $PROJECT_DIR -name "*.bpmn" -exec sh -c 'bpmnlint "$1"' shell {} \;
  # fi
  echo ""
fi

if [ $mode_dmn = 1 ]; then
  echo ""
  # initialize the folder to run the linter if it has not been initialized for dmnlint
  if [ ! -f .dmnlintrc ]; then
    dmnlint --init
  fi
  # retrieve and install any plugins that were provided as part of .dmnlintrc
  node "${SCRIPT_DIR}"/installPluginPackages.js --type=dmn --config=.dmnlintrc
  # run the linter
  node "${SCRIPT_DIR}"/runLinter.js --files=*.dmn --type=dmn --config=.bpmnlintrc --output ./dmnlint-report --format junit
  # TODO: --rulespath "${ADHOC_DMN_RULES_PATH}" --rulesseverity warn 

  # # run dmnlint for the current or a separate directory based on the PROJECT_DIR environment variable being set
  # if [ -z ${PROJECT_DIR+x} ]; then 
  #   find . -name "*.dmn" -exec sh -c 'dmnlint "$1"' shell {} \;
  # else
  #   find $PROJECT_DIR -name "*.dmn" -exec sh -c 'dmnlint "$1"' shell {} \;
  # fi
  echo ""
fi
