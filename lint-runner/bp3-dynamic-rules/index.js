const fs = require('fs');
const path = require('path');
//NOTE: not using the start of string ^ wildcard because in case there's a @publisherName
const rulePrefix = `bp3-dynamic-rules`;

function prepareExport() {
  const rulesPath = './rules';
  const defaultRuleSeverity = 'warn';
  const rulesDir = path.join(__dirname, 'rules');
  const exportResult = {
    rules: {},
    configs: {
      all: {
        rules: {},
      },
      recommended: {
        rules: {},
      },
    },
  };

  if (fs.existsSync(rulesDir)) {
    const files = fs.readdirSync(rulesDir, { recursive: true });

    files
      .filter((file) => file.endsWith('.js'))
      .forEach((file) => {
        const ruleName = path.basename(file, '.js');
        const prefixedRuleName = `${rulePrefix}${rulePrefix && '/'}${ruleName}`;

        exportResult.rules[ruleName] = `${rulesPath}/${ruleName}`.replace(/\/\//g, '/');
        exportResult.configs.all.rules[prefixedRuleName] = defaultRuleSeverity;
        exportResult.configs.recommended.rules[prefixedRuleName] = defaultRuleSeverity;
      });
  }
  return exportResult;
}

module.exports = prepareExport();
