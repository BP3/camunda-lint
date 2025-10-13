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
The SBOM generator for the Camunda 8 linter tool.

Required Parameters:

  SBOM_REPORT_PATH      Set the output path to store the SBOM file.


Optional Parameters:

  SBOM_REPORT_NAME      Set the output filename.
                        Defaults to "camunda-lint-sbom".

  SBOM_REPORT_FORMAT    Set the output file format.
                        Options are "XML" and "JSON".
                        Defaults to "JSON".

The parameters for the command are defined in environment variables
as this is intended to run as part of a CI/CD pipeline.
See https://github.com/BP3/camunda-lint for more details.
_EOF
