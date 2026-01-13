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

ARG BPMNLINT_VERSION=11.6.0 \
    DMNLINT_VERSION=0.2.0 \
    CAMUNDA_COMPAT_VERSION=2.44.0

# Add the bp3 user and group - using 1001 because node's is already using 1000 - and install the Camunda lint global packages and create /app and set folder ownership
RUN addgroup --gid 1001 bp3 && \
    adduser --uid 1001 --ingroup bp3 --home /home/bp3user --shell /bin/bash --disabled-password bp3user && \
    npm install -g bpmnlint@${BPMNLINT_VERSION} \
                    dmnlint@${DMNLINT_VERSION} \
                    bpmnlint-plugin-camunda-compat@${CAMUNDA_COMPAT_VERSION} \
                    @cyclonedx/cyclonedx-npm \
                    @bp3global/bpmnlint-plugin-bpmn-rules && \
    mkdir /app  && \
    chown -R bp3user:bp3 /usr/local/lib/node_modules && \
    chown -R bp3user:bp3 /app

USER bp3user

COPY --chown=bp3user:bp3 --chmod=755 ["docker-entrypoint.sh", "package*.js*", "/app/" ]
COPY --chown=bp3user:bp3 --chmod=755 scripts/ /app/scripts/
COPY --chown=bp3user:bp3 --chmod=755 bpmnlint-runner/ /app/bpmnlint-runner/
COPY --chown=bp3user:bp3 --chmod=755 dmnlint-runner/ /app/dmnlint-runner/

# As this is now a node workspace, this installs all the dependencies for child folders also
WORKDIR /app
RUN npm install

VOLUME /local
WORKDIR /local

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["help"]
