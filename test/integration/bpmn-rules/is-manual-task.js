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
 * Rule that reports whether there are manual tasks in the process.
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
