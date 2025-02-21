FROM node:22.14-alpine

# Upgrade the underlying OS for the alpine distro
RUN apk update && \
	apk upgrade && \
	apk add bash

# Install the bpmnlint package
RUN npm install -g bpmnlint
RUN npm install -g dmnlint

ENV CAMUNDA_DIR=/local

# Add the bp3 user and group. Note: using 1001 because node's is already using 1000
RUN addgroup --gid 1001 bp3 && \
    adduser --uid 1001 --ingroup bp3 --home /home/bp3user --shell /bin/bash --disabled-password bp3user

