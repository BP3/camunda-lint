/*================================================================================
 =
 = Licensed Materials - Property of BP3 Global
 =
 =  bpmnlint-plugin-bpmn-rules
 =
 = Copyright © BP3 Global Inc. 2026. All Rights Reserved.
 = This software is subject to copyright protection under
 = the laws of the United States, United Kingdom and other countries.
 =
 =================================================================================*/

const { expect } = require('chai');
const { execSync } = require('child_process');
const process = require('process');

// helper function to determine if a variable is null or an empty string
function isStringNullOrEmpty(strValue) {
  return strValue == null || strValue.trim() == '';
}

// determine the running image name from the environment variables
const imageName = isStringNullOrEmpty(process.env.IMAGE_NAME) ? 'ghcr.io/bp3/camunda-lint' : process.env.IMAGE_NAME;
const branchName = isStringNullOrEmpty(process.env.BRANCH_NAME) ? 'main' : process.env.BRANCH_NAME;
const TEST_IMAGE = `${imageName}:${branchName}`;

/**
 * Runs the docker container with the given arguments.
 * @param {string} command - The command to pass to the container
 * @param {Array} argumentList - The arguments to pass to the docker run command
 * @returns {string} - The stdout output
 */
function runContainer(command, argumentList) {
  let result = null;
  try {
    // stdin: ignore
    // stdout: pipe => to capture it
    // stderr: inherit => stderr so debugging logs show up in your console if it crashes
    result = execSync(`docker run -it --rm ${argumentList != null && argumentList.length > 0 ? argumentList.join(` `) : ``} ${IMAGE_NAME} ${command}`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit'],
    });
  } catch (error) {
    // Enrich the error message for better debugging
    throw new Error(`Docker command failed [${args}]: ${error.message}`);
  }
  return result;
}

/**
 * A generic wrapper for Docker Container tests.
 *
 * @param {Object} testOptions - Configuration options
 * @param {number} [testOptions.timeout=30000] - Mocha timeout in ms
 * @param {boolean} [testOptions.hasOutput=true] - If true, performs the "output not empty" check
 * @param {boolean} [testOptions.hasError=false] - If true, performs the "error not empty" check
 * @param {string} containerCommand - The command to run inside the container
 * @param {Array} containerArguments - The arguments to pass to the docker run command
 * @param {Function} [customTestsCallback] - A callback to define specific 'it' blocks.
 *                                           Receives the 'output' context object.
 */
function performContainerTest(testName, testOptions = {}, containerCommand, containerArguments, customTestsCallback) {
  const timeout = testOptions['timeout'] || 30000;
  const hasOutput = testOptions['hasOutput'] != null ? testOptions['hasOutput'] : true;
  const hasError = testOptions['hasError'] != null || false;

  describe(testName || `Command: ${containerCommand}`, function () {
    // Set the timeout to allow the docker command to take longer when needed
    this.timeout(timeout);

    // Use a context object to store results and pass it to the callback.
    const result = {
      stdout: null,
      error: null,
    };

    // 3. The universal 'before' hook
    before(function () {
      try {
        const commandLine = `docker run -i --rm ${containerArguments != null && containerArguments.length > 0 ? containerArguments.join(` `) : ``} ${TEST_IMAGE} ${containerCommand}`;
        // Execute and capture stdout
        result.stdout = execSync(commandLine, {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'inherit'], // pipe stdout, print stderr for debugging
        });
      } catch (err) {
        result.error = err;
        // If the command crashes, we fail immediately unless we expected a failure
        throw new Error(`Docker execution failed: ${err.message}`);
      }
    });

    // Validate output and errors
    if (hasOutput) {
      it('Should execute and return output', function () {
        expect(result.stdout).to.not.be.null;
        expect(result.stdout).to.not.be.empty;
      });
    }
    if (hasError) {
      it('Should execute and return error', function () {
        expect(result.error).to.not.be.null;
        expect(result.error).to.not.be.empty;
      });
    }

    // Call custom assertions if provided
    if (customTestsCallback) {
      customTestsCallback(result);
    }
  });
}

module.exports = {
  TEST_IMAGE,
  isStringNullOrEmpty,
  runContainer,
  performContainerTest,
};
