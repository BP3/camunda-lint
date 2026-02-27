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

describe('Integration Tests', function () {
  // SBOM
  performContainerTest('SBOM', { timeout: 30000, hasOutput: true }, 'sbom', null, (resultContext) => {
    it('Should output valid JSON', function () {
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
});
