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

FROM node:22.14-alpine

# Upgrade the underlying OS for the alpine distro
RUN set -eux; \
	apk update; \
	apk upgrade --no-interactive; \
	apk add jq

# Install the Camunda lint packages
RUN npm install -g bpmnlint dmnlint

# Add the bp3 user and group. Note: using 1001 because node's is already using 1000
RUN addgroup --gid 1001 bp3 && \
    adduser --uid 1001 --ingroup bp3 --home /home/bp3user --shell /bin/bash --disabled-password bp3user

ENV SCRIPT_DIR=/app/acripts

WORKDIR /app
#COPY --chmod=755 docker-entrypoint.sh .
COPY --chown=bp3user:bp3 --chmod=755 scripts/*.sh scripts/

RUN chown -R bp3user:bp3 /usr/local/lib/node_modules

USER bp3user

VOLUME /local
WORKDIR /local

ENTRYPOINT [ "/app/docker-entrypoint.sh" ]
CMD [ "help" ]
