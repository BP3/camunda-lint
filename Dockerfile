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

# Install the Camunda lint packages
RUN npm install -g bpmnlint@11.4.2 dmnlint@0.2.0 @cyclonedx/cyclonedx-npm
# Add the bp3 user and group. Note: using 1001 because node's is already using 1000
RUN addgroup --gid 1001 bp3 && \
    adduser --uid 1001 --ingroup bp3 --home /home/bp3user --shell /bin/bash --disabled-password bp3user

WORKDIR /app

RUN chown -R bp3user:bp3 /usr/local/lib/node_modules && \
    chown -R bp3user:bp3 /app

USER bp3user

COPY --chown=bp3user:bp3 --chmod=755 ["docker-entrypoint.sh", "package*.js*", "./" ]
COPY --chown=bp3user:bp3 --chmod=755 scripts/ scripts/
# COPY --chown=bp3user:bp3 --chmod=755 bpmnlint-runner/ bpmnlint-runner/
# COPY --chown=bp3user:bp3 --chmod=755 dmnlint-runner/ dmnlint-runner/

# As this is now a node workspace, this installs all the dependencies for child folders also
RUN npm install

VOLUME /local
WORKDIR /local

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["help"]
