/*================================================================================
 =
 = Licensed Materials - Property of BP3 Global
 =
 =  bpmn-rules
 =
 = Copyright © BP3 Global. 2025. All Rights Reserved.
 = This software is subject to copyright protection under
 = the laws of the United States, United Kingdom and other countries.
 =
 =================================================================================*/

const { is } = require('bpmnlint-utils');

/**
 * This rule is an implementation example and only meant to support the integration tests
 */
module.exports = function () {
  function check(node, reporter) {
    if (is(node, 'bpmn:ManualTask')) {
      reporter.report(node.id, `The activity ${node.id} with the label ${node.name} is a manual task.`);
    }
  }
  return {
    check: check,
  };
};
