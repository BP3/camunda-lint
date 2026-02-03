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

# Add the bp3 user and group - using 1001 because node's is already using 1000 - and install the Camunda lint global packages and create /app and set folder ownership
RUN npm install -g bpmnlint@11.6.0 \
                    dmnlint@0.2.0 \
                    bpmnlint-plugin-camunda-compat@2.44.0 \
    addgroup --gid 1001 bp3 && \
    adduser --uid 1001 --ingroup bp3 --home /home/bp3user --shell /bin/bash --disabled-password bp3user && \
    mkdir /app  && \
    chown -R bp3user:bp3 /usr/local/lib/node_modules && \
    chown -R bp3user:bp3 /usr/local/bin && \
    chown -R bp3user:bp3 /app

USER bp3user

COPY --chown=bp3user:bp3 --chmod=755 .npmrc /home/bp3user/.npmrc
COPY --chown=bp3user:bp3 --chmod=755 ["docker-entrypoint.sh", "package*.js*", ".npmrc", "camunda-lint-sbom.json", "/app/" ]
COPY --chown=bp3user:bp3 --chmod=755 scripts/ /app/scripts/
COPY --chown=bp3user:bp3 --chmod=755 bpmnlint-runner/ /app/bpmnlint-runner/
COPY --chown=bp3user:bp3 --chmod=755 dmnlint-runner/ /app/dmnlint-runner/

WORKDIR /app

# As this is now a node workspace, this installs all the dependencies for child folders also
# NOTE: can only install globally the @BP3/bpmnlint-plugin-bpmn-rules because it requires the steps above to be done
RUN --mount=type=secret,id=GH_TOKEN,uid=1001 \
    GITHUB_TOKEN=$(cat /run/secrets/GH_TOKEN | tr -d '\r\n') \
    npm install -g @BP3/bpmnlint-plugin-bpmn-rules && \
    npm install

VOLUME /local
WORKDIR /local

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["help"]
