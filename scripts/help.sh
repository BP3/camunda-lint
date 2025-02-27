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

echo Usage: lint.sh COMMAND
echo
echo A CI/CD automation wrapper for linting a Camunda 8 Web Modeler project.
echo
echo Available Commands:
echo "  lint               Apply lint to BPMN + DMN files"
echo "  bpmnlint           Apply lint to just the BPMN files"
echo "  dmnlint            Apply lint to just the DMN files"
echo
echo The configuration options for the commands are defined in environment variables as this is
echo intended to run as part of a CI/CD pipeline.
echo See https://github.com/BP3/camunda-lint for more details.
