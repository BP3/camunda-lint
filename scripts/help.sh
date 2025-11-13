#!/bin/sh

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

cat <<_EOF
A CI/CD automation wrapper for linting a Camunda 8 Web Modeler project.

Usage: [COMMAND]

Available Commands:
  lint               Apply lint to BPMN + DMN file
  bpmnlint           Apply lint to just the BPMN files
  dmnlint            Apply lint to just the DMN files

The configuration options for the commands are defined in environment variables
as this is intended to run as part of a CI/CD pipeline.
See https://github.com/BP3/camunda-lint for more details.
_EOF
