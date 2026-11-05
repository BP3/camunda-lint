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
const { performContainerTest } = require('../helper.js');

function performBpmnChecks(resultContext) {
  it('BPMN: should have lint results with 1 file and no errors and 2 warnings', function () {
    expect(resultContext.stdout).to.contain('LINT RESULTS | Files: 1 | Errors: 0 | Warnings: 2');
  });

  it('BPMN: should have warnings about bpmn diagram: event with default id', function () {
    expect(resultContext.stdout).to.contain('Event has a default id.');
  });

  it('BPMN: should have warnings about bpmn diagram: process has an empty name', function () {
    expect(resultContext.stdout).to.contain('Process has an empty name.');
  });
}

function performBpmnChecksWithCustomRule(resultContext) {
  it('BPMN: should have lint results with 1 file and no errors and 3 warnings', function () {
    expect(resultContext.stdout).to.contain('LINT RESULTS | Files: 1 | Errors: 0 | Warnings: 3');
  });

  it('BPMN: should have warnings about bpmn diagram: event with default id', function () {
    expect(resultContext.stdout).to.contain('Event has a default id.');
  });

  it('BPMN: should have warnings about bpmn diagram: process has an empty name', function () {
    expect(resultContext.stdout).to.contain('Process has an empty name.');
  });

  it('BPMN: should have warnings about bpmn diagram: the activity is a manual task', function () {
    expect(resultContext.stdout).to.contain('is a manual task');
  });
}

function performDmnChecks(resultContext) {
  it('DMN: should have lint results with 1 file and no errors nor warnings', function () {
    expect(resultContext.stdout).to.contain('LINT RESULTS | Files: 1 | Errors: 0 | Warnings: 0');
  });
}

function performDmnChecksWithCustomRule(resultContext) {
  it('DMN: should have lint results with 1 file and no errors and 1 warning', function () {
    expect(resultContext.stdout).to.contain('LINT RESULTS | Files: 1 | Errors: 0 | Warnings: 1');
  });

  it('DMN: should have warnings about dmn diagram: the decision table has a default id', function () {
    expect(resultContext.stdout).to.contain('has a default id');
  });
}

describe('Integration Tests', function () {
  // *****************************************************************
  // SBOM
  // *****************************************************************
  performContainerTest('SBOM', { timeout: 30000, hasOutput: true }, 'sbom', null, (resultContext) => {
    it('Output should be valid JSON', function () {
      expect(() => JSON.parse(resultContext.stdout)).to.not.throw();
    });

    it('Should contain a valid BOM format', function () {
      const sbom = JSON.parse(resultContext.stdout);
      // Using Chai's flexible checking
      expect(sbom).to.satisfy((sbomObject) => {
        return sbomObject.bomFormat === 'CycloneDX' || sbomObject.spdxVersion;
      }, 'Must be CycloneDX or SPDX');
    });

    it('Should have a components array', function () {
      const sbom = JSON.parse(resultContext.stdout);
      // Handle potential difference in property names
      const list = sbom.components || sbom.packages;
      expect(list).to.be.an('array').that.is.not.empty;
    });
  });

  // *****************************************************************
  // Help
  // *****************************************************************
  performContainerTest('HELP', { timeout: 5000, hasOutput: true }, 'help', null, (resultContext) => {
    it('should display the usage guide', function () {
      expect(resultContext.stdout).to.include('Usage:');
      expect(resultContext.stdout).to.include('Available Commands:');
    });
  });

  // *****************************************************************
  // bpmnlint
  // *****************************************************************
  performContainerTest('bpmnlint', { timeout: 30000, hasOutput: true }, 'bpmnlint', [`--mount type=bind,src=${__dirname},dst=/project`], (resultContext) => {
    it('should run without errors', function () {
      expect(resultContext.error).to.be.null;
    });

    performBpmnChecks(resultContext);
  });

  // *****************************************************************
  // bpmnlint + custom rules
  // *****************************************************************
  performContainerTest(
    'bpmnlint with custom rules',
    { timeout: 30000, hasOutput: true },
    'bpmnlint',
    [`--mount type=bind,src=${__dirname},dst=/project`, `-e BPMN_RULES_PATH=/project/bpmn-rules`],
    (resultContext) => {
      it('should run without errors', function () {
        expect(resultContext.error).to.be.null;
      });

      performBpmnChecksWithCustomRule(resultContext);
    }
  );

  // *****************************************************************
  // dmnlint
  // *****************************************************************
  performContainerTest('dmnlint', { timeout: 30000, hasOutput: true }, 'dmnlint', [`--mount type=bind,src=${__dirname},dst=/project`], (resultContext) => {
    it('should run without errors', function () {
      expect(resultContext.error).to.be.null;
    });

    performDmnChecks(resultContext);
  });

  // *****************************************************************
  // dmnlint + custom rules
  // *****************************************************************
  performContainerTest(
    'dmnlint with custom rules',
    { timeout: 30000, hasOutput: true },
    'dmnlint',
    [`--mount type=bind,src=${__dirname},dst=/project`, `-e DMN_RULES_PATH=/project/dmn-rules`],
    (resultContext) => {
      it('should run without errors', function () {
        expect(resultContext.error).to.be.null;
      });

      performDmnChecksWithCustomRule(resultContext);
    }
  );

  // *****************************************************************
  // lint
  // *****************************************************************
  performContainerTest('lint', { timeout: 30000, hasOutput: true }, 'lint', [`--mount type=bind,src=${__dirname},dst=/project`], (resultContext) => {
    it('should run without errors', function () {
      expect(resultContext.error).to.be.null;
    });

    //BPMN
    performBpmnChecks(resultContext);

    //DMN
    performDmnChecks(resultContext);
  });

  // *****************************************************************
  // lint + bpmn custom rules
  // *****************************************************************
  performContainerTest(
    'lint with custom bpmn rules',
    { timeout: 30000, hasOutput: true },
    'lint',
    [`--mount type=bind,src=${__dirname},dst=/project`, `-e BPMN_RULES_PATH=/project/bpmn-rules`],
    (resultContext) => {
      it('should run without errors', function () {
        expect(resultContext.error).to.be.null;
      });

      //BPMN
      performBpmnChecksWithCustomRule(resultContext);

      //DMN
      performDmnChecks(resultContext);
    }
  );

  // *****************************************************************
  // lint + dmn custom rules
  // *****************************************************************
  performContainerTest(
    'lint with custom dmn rules',
    { timeout: 30000, hasOutput: true },
    'lint',
    [`--mount type=bind,src=${__dirname},dst=/project`, `-e DMN_RULES_PATH=/project/dmn-rules`],
    (resultContext) => {
      it('should run without errors', function () {
        expect(resultContext.error).to.be.null;
      });

      //BPMN
      performBpmnChecks(resultContext);

      //DMN
      performDmnChecksWithCustomRule(resultContext);
    }
  );

  // *****************************************************************
  // lint + bpmn custom rules + dmn custom rules
  // *****************************************************************
  performContainerTest(
    'lint with custom bpmn and dmn rules',
    { timeout: 30000, hasOutput: true },
    'lint',
    [`--mount type=bind,src=${__dirname},dst=/project`, `-e BPMN_RULES_PATH=/project/bpmn-rules`, `-e DMN_RULES_PATH=/project/dmn-rules`],
    (resultContext) => {
      it('should run without errors', function () {
        expect(resultContext.error).to.be.null;
      });

      //BPMN
      performBpmnChecksWithCustomRule(resultContext);

      //DMN
      performDmnChecksWithCustomRule(resultContext);
    }
  );

  // *****************************************************************
  // bpmnlint without network access + plugins bundled in the image
  // (no npm install should run, so this must not wait on the registry)
  // *****************************************************************
  performContainerTest(
    'bpmnlint offline with bundled plugins',
    { timeout: 30000, hasOutput: true },
    'bpmnlint',
    [
      `--network none`,
      `--mount type=bind,src=${__dirname}/plugins/bundled,dst=/project`,
      `--mount type=bind,src=${__dirname}/models,dst=/project/models,readonly`,
      `-e BPMN_REPORT_FILEPATH=/tmp/bpmn-lint-report`,
    ],
    (resultContext) => {
      it('should run without errors', function () {
        expect(resultContext.error).to.be.null;
      });

      it('should find all the plugins already installed', function () {
        expect(resultContext.stdout).to.contain('[ bpmnlint-plugin-camunda-compat, @BP3/bpmnlint-plugin-bpmn-rules, bpmnlint-plugin-bp3-dynamic-rules ]');
        expect(resultContext.stdout).to.contain('All plugins are already installed.');
        expect(resultContext.stdout).to.not.contain('Installing plugins:');
      });

      it('BPMN: should have lint results with 1 file and no errors', function () {
        expect(resultContext.stdout).to.contain('LINT RESULTS | Files: 1 | Errors: 0 |');
      });
    }
  );

  // *****************************************************************
  // bpmnlint without network access + a plugin that isn't bundled
  // (the installation fails, so the run must stop with a clear error)
  // *****************************************************************
  performContainerTest(
    'bpmnlint offline with a missing plugin',
    { timeout: 60000, hasOutput: true, expectFailure: true },
    'bpmnlint',
    [
      `--network none`,
      `--mount type=bind,src=${__dirname}/plugins/missing,dst=/project`,
      `--mount type=bind,src=${__dirname}/models,dst=/project/models,readonly`,
      `-e BPMN_REPORT_FILEPATH=/tmp/bpmn-lint-report`,
      `-e npm_config_fetch_retries=0`,
    ],
    (resultContext) => {
      it('should exit with an error', function () {
        expect(resultContext.status).to.not.equal(0);
      });

      it('should name the plugin that could not be installed', function () {
        expect(resultContext.stdout).to.contain('Installing plugins: [ bpmnlint-plugin-does-not-exist ]');
        expect(resultContext.stderr).to.contain('Could not install: [ bpmnlint-plugin-does-not-exist ]');
        expect(resultContext.stderr).to.contain('npm error');
      });

      it('should not run the linter', function () {
        expect(resultContext.stdout).to.not.contain('LINT RESULTS');
      });
    }
  );
});
