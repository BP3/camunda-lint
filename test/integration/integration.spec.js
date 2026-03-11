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
    expect(resultContext.stdout).to.contain('Process has a empty name.');
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
    expect(resultContext.stdout).to.contain('Process has a empty name.');
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
  performContainerTest('bpmnlint', { timeout: 30000, hasOutput: true }, 'bpmnlint', [`--mount type=bind,src=${__dirname},dst=/project`, '-e PROJECT_PATH=/project'], (resultContext) => {
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
    [`--mount type=bind,src=${__dirname},dst=/project`, '-e PROJECT_PATH=/project', `-e BPMN_RULES_PATH=/project/bpmn-rules`],
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
  performContainerTest('dmnlint', { timeout: 30000, hasOutput: true }, 'dmnlint', [`--mount type=bind,src=${__dirname},dst=/project`, '-e PROJECT_PATH=/project'], (resultContext) => {
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
    [`--mount type=bind,src=${__dirname},dst=/project`, '-e PROJECT_PATH=/project', `-e DMN_RULES_PATH=/project/dmn-rules`],
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
  performContainerTest('lint', { timeout: 30000, hasOutput: true }, 'lint', [`--mount type=bind,src=${__dirname},dst=/project`, '-e PROJECT_PATH=/project'], (resultContext) => {
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
    [`--mount type=bind,src=${__dirname},dst=/project`, '-e PROJECT_PATH=/project', `-e BPMN_RULES_PATH=/project/bpmn-rules`],
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
    [`--mount type=bind,src=${__dirname},dst=/project`, '-e PROJECT_PATH=/project', `-e DMN_RULES_PATH=/project/dmn-rules`],
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
    [`--mount type=bind,src=${__dirname},dst=/project`, '-e PROJECT_PATH=/project', `-e BPMN_RULES_PATH=/project/bpmn-rules`, `-e DMN_RULES_PATH=/project/dmn-rules`],
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
});
