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

FROM node:22.14.0-alpine3.21

# Use arg to specify versions at build time with fallback default values
ARG BPMNLINT_VER=11.12.0 \
    BPMNLINT_UTILS_VER=1.1.1 \
    BPMN_MODDLE_VER=10.0.0 \
    ZEEBE_BPMN_MODDLE_VER=1.12.0 \
    DMNLINT_VER=0.2.0 \
    DMNLINT_UTILS_VER=0.1.0 \
    DMN_MODDLE_VER=12.0.1

# This creates /app and sets it as the working directory
WORKDIR /app

# Add the bp3 user and group - using 1001 because node's is already using 1000 - and install the Camunda lint global packages and create /app and set folder ownership
RUN addgroup --gid 1001 bp3 && \
    adduser --uid 1001 --ingroup bp3 --home /home/bp3user --shell /bin/bash --disabled-password bp3user && \
    chown -R bp3user:bp3 /usr/local/lib/node_modules && \
    chown -R bp3user:bp3 /usr/local/bin && \
    chown -R bp3user:bp3 /app

USER bp3user

COPY --chown=bp3user:bp3 --chmod=755 .npmrc /home/bp3user/.npmrc
COPY --chown=bp3user:bp3 --chmod=755 ["docker-entrypoint.sh", "l*.js", "package*.js*", ".npmrc", "camunda-lint-sbom.json", "/app/" ]
COPY --chown=bp3user:bp3 --chmod=755 bp3-dynamic-rules/ /app/bp3-dynamic-rules/

# As this is now a node workspace, this installs all the dependencies for child folders also
# NOTE: can only perform the installations for the @BP3/bpmnlint-plugin-bpmn-rules because it requires the steps above to be done
RUN --mount=type=secret,id=GH_TOKEN,uid=1001 \
    export GITHUB_TOKEN=$(cat /run/secrets/GH_TOKEN | tr -d '\r\n') && \
    npm install bpmnlint@${BPMNLINT_VER} \
                bpmnlint-utils@${BPMNLINT_UTILS_VER} \
                dmnlint@${DMNLINT_VER} \
                dmnlint-utils@${DMNLINT_UTILS_VER} \
                bpmn-moddle@${BPMN_MODDLE_VER} \
                zeebe-bpmn-moddle@${ZEEBE_BPMN_MODDLE_VER} \
                dmn-moddle@${DMN_MODDLE_VER} \
                @BP3/bpmnlint-plugin-bpmn-rules@latest && \
    npm install

WORKDIR /project

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["help"]
