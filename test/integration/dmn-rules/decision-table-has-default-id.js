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
    if (is(node, 'dmn:DecisionTable') && (new RegExp('^DecisionTable_\\d\\w{6}$', 'i')).test(node.id)) {
      reporter.report(node.id, `${node.id}: The decision table ${node.name} has a default id.`);
    }
  }
  return {
    check: check,
  };
};
