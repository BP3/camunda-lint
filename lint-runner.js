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

const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const tinyglob = require('tiny-glob');
const fs = require('fs');
const path = require('path');
const junitReportBuilder = require('junit-report-builder');
const { execSync } = require('child_process');
const chalk = require('chalk');
const { logger } = require('./logger');

const { Linter: BpmnLinter } = require('bpmnlint');
const BpmnNodeResolver = require('bpmnlint/lib/resolver/node-resolver');
const BpmnModdle = require('bpmn-moddle');
const { Linter: DmnLinter } = require('dmnlint');
const DmnNodeResolver = require('dmnlint/lib/resolver/node-resolver');
const DmnModdle = require('dmn-moddle');

// --- Define and parse command-line arguments using yargs ---
const argv = yargs(hideBin(process.argv))
  .usage('Usage: $0 <pattern> [options]')
  .command('$0 <pattern>', 'Lint files (BPMN/DMN) matching the pattern', (yargs) => {
    yargs.positional('pattern', {
      describe: 'Pattern to match files (e.g., "/diagrams/*.bpmn" or "/diagrams/*.dmn")',
      type: 'string',
    });
  })
  .option('type', {
    alias: 't',
    describe: 'Type of linter to use',
    choices: ['bpmn', 'dmn'],
    demandOption: true,
  })
  .option('config', {
    alias: 'c',
    describe: 'Path to the lintrc configuration file.\r\n(ex.: /project/config/.bpmnlintrc or /project/config/.dmnlintrc)',
    type: 'string',
  })
  .option('output', {
    alias: 'o',
    describe: 'Path for the output report file. The file extension will be added automatically.\r\n(ex.: /project/output/myReport)',
    type: 'string',
    default: 'lint-report',
  })
  .option('format', {
    alias: 'f',
    describe: 'Format for the report',
    choices: ['json', 'html', 'junit'],
    default: 'json',
  })
  .option('custom-rules-path', {
    alias: 'r',
    describe: 'Path to a directory containing custom rule files.\r\n(ex.: /project/my-custom-rules)',
    type: 'string',
  })
  .option('custom-rules-severity', {
    alias: 's',
    describe: 'Severity for the dynamically loaded custom rules.',
    choices: ['off', 'warn', 'error'],
    default: 'warn',
  })
  .option('install-custom-deps', {
    alias: 'i',
    type: 'boolean',
    default: false,
    describe: 'If a custom rules directory has a package.json, automatically run "npm install". Use with caution in untrusted environments.',
  })
  .option('verbose', {
    alias: 'v',
    type: 'boolean',
    description: 'Enable detailed logging for each step',
    default: false,
  })
  .option('show-console-table', {
    alias: 'table',
    type: 'boolean',
    description: 'Show results table on the console',
    default: true,
  })
  .demandCommand(1, 'You must provide a pattern for the files to lint.')
  .help().argv;

// Map of linter types to their configurations
const LINTER_CONFIGS = {
  bpmn: {
    name: 'bpmnlint',
    getLinter: (finalConfig) =>
      new BpmnLinter({
        config: finalConfig,
        resolver: new BpmnNodeResolver(),
      }),
    getModdle: () => new BpmnModdle(),
    getModdleName: () => 'bpmn-moddle',
    reportTitle: 'BPMN Lint Report',
    defaultConfig: {
      extends: ['bpmnlint:recommended', 'plugin:bp3-dynamic-rules/all'],
      rules: {},
    },
    // prettier-ignore
    defaultDependencies: {
      "bpmnlint": "^11.6.0",
      "bpmnlint-utils": "^1.1.1"
    },
  },
  dmn: {
    name: 'dmnlint',
    getLinter: (finalConfig) =>
      new DmnLinter({
        config: finalConfig,
        resolver: new DmnNodeResolver(),
      }),
    getModdle: () => new DmnModdle(),
    getModdleName: () => 'dmn-moddle',
    reportTitle: 'DMN Lint Report',
    defaultConfig: {
      extends: ['dmnlint:recommended', 'plugin:bp3-dynamic-rules/all'],
      rules: {},
    },
    // prettier-ignore
    defaultDependencies: {
      "dmnlint": "*",
      "dmnlint-utils": "*",
    },
  },
};

// --- Helper functions ---
function exitWithError(message) {
  logger.error(message);
  process.exit(1);
}

// --- Prepare the dynamic plugin by copying custom rules and installing their dependencies ---
function prepareDynamicPlugin(customRulesPath, installDeps, linterType) {
  if (!customRulesPath) {
    logger.debug('Custom rules path not provided. Skipping dynamic plugin generation.');
    return;
  }

  const pluginPath = path.join(__dirname, 'bp3-dynamic-rules');
  const pluginRulesPath = path.join(pluginPath, 'rules');
  const pluginPackageJsonPath = path.join(pluginPath, 'package.json');
  const sourceRulesPath = path.resolve(process.cwd(), customRulesPath);
  const sourcePackageJsonPath = path.join(sourceRulesPath, 'package.json');

  const linterConfig = LINTER_CONFIGS[linterType];
  let finalDeps = JSON.parse(JSON.stringify(linterConfig.defaultDependencies));

  // Remove older/existing artifacts
  cleanupDynamicPlugin(false, linterType);

  // Move any dependencies from the rules source to the plugin
  const pluginPackageJson = JSON.parse(fs.readFileSync(pluginPackageJsonPath, 'utf-8'));
  if (fs.existsSync(sourcePackageJsonPath)) {
    const sourcePackageJson = JSON.parse(fs.readFileSync(sourcePackageJsonPath, 'utf-8'));
    finalDeps = sourcePackageJson.dependencies || finalDeps;
  }
  pluginPackageJson.dependencies = finalDeps;
  fs.writeFileSync(pluginPackageJsonPath, JSON.stringify(pluginPackageJson, null, 2));

  // Copy rule files from source to the plugin
  logger.debug(`Copying rules from ${sourceRulesPath} to ${pluginRulesPath}`);
  const sourceAllFiles = fs.readdirSync(sourceRulesPath, { recursive: true });
  const sourceRuleFiles = sourceAllFiles.filter((file) => file.endsWith('.js') && !file.split(path.sep).includes('node_modules') && !file.split(path.sep).includes('.git'));

  sourceRuleFiles.forEach((file) => {
    const sourceFile = path.join(sourceRulesPath, file);
    const destFile = path.join(pluginRulesPath, file);
    fs.mkdirSync(path.dirname(destFile), { recursive: true });
    fs.copyFileSync(sourceFile, destFile);
  });
  logger.debug(`Copied ${sourceRuleFiles.length} rule file(s).`);

  // Install dependencies if needed
  if (Object.keys(finalDeps).length > 0) {
    if (installDeps) {
      logger.info('Installing dependencies for dynamic plugin...');
      try {
        execSync('npm install', { cwd: pluginPath, stdio: 'pipe' });
        logger.info('Dependencies installed successfully.');
      } catch (error) {
        throw new Error(`Failed to run 'npm install' in dynamic rules plugin directory: ${error.stderr.toString()}`);
      }
    } else {
      throw new Error(`Custom rules require dependencies, but they are not installed. ` + `Please use the '-i' or '--install-custom-deps' flag.`);
    }
  }
}

// --- Cleans up the artifacts created by prepareDynamicPlugin ---
function cleanupDynamicPlugin(doResetPackageJson = false, linterType = 'bpmn') {
  logger.debug('Cleaning up dynamic plugin environment...');
  const pluginPath = path.join(__dirname, 'bp3-dynamic-rules');
  const pluginRulesPath = path.join(pluginPath, 'rules');
  const pluginNodeModulesPath = path.join(pluginPath, 'node_modules');

  if (fs.existsSync(pluginRulesPath)) {
    fs.rmSync(pluginRulesPath, { recursive: true, force: true });
  }
  if (fs.existsSync(pluginNodeModulesPath)) {
    fs.rmSync(pluginNodeModulesPath, { recursive: true, force: true });
  }
  fs.mkdirSync(pluginRulesPath);

  if (doResetPackageJson) {
    // Restore original package.json
    const pluginPackageJsonPath = path.join(pluginPath, 'package.json');
    const pluginPackageJson = JSON.parse(fs.readFileSync(pluginPackageJsonPath, 'utf-8'));
    const linterConfig = LINTER_CONFIGS[linterType];
    pluginPackageJson.dependencies = linterConfig.defaultDependencies;
    fs.writeFileSync(pluginPackageJsonPath, JSON.stringify(pluginPackageJson, null, 2));
  }
}

async function findFiles(pattern) {
  logger.debug(`Searching for files matching: "${pattern}"`);
  const normalizedPattern = pattern.replace(/\\/gm, '/');
  const files = await tinyglob(normalizedPattern, { absolute: true, filesOnly: true, dot: true });

  if (files.length === 0) {
    logger.warn(`No files found matching the pattern: "${pattern}"`);
  } else {
    logger.debug(`Found ${files.length} files to lint.`);
  }
  return files;
}

async function lintFiles(files, linter, linterType) {
  const allIssues = [];
  let totalErrors = 0;
  let totalWarnings = 0;

  const linterConfig = LINTER_CONFIGS[linterType];
  const moddle = linterConfig.getModdle();
  const moddleName = linterConfig.getModdleName();

  for (const file of files) {
    const fileName = path.basename(file);
    try {
      logger.debug(`- Parsing diagram: ${fileName}`);
      const xmlContent = fs.readFileSync(file, 'utf-8');

      const { rootElement, warnings: parseWarnings } = await moddle.fromXML(xmlContent);

      if (parseWarnings && parseWarnings.length) {
        parseWarnings.forEach((warning) => {
          logger.debug(`    - [import-warning] (${moddleName}) ${warning.element ? warning.element.id : 'FileLevel'}: ${warning.message}`);
          allIssues.push({
            file: fileName,
            id: warning.element?.id || 'FileLevel',
            message: warning.message,
            category: 'import-warning',
            rule: moddleName,
          });
          totalWarnings++;
        });
        if (Object.keys(report).length === 0) {
          logger.debug('  No issues found.');
        }
      }

      logger.info(` - Linting diagram: ${fileName}...`);
      const report = await linter.lint(rootElement);

      Object.entries(report).forEach(([ruleName, issues]) => {
        issues.forEach((issue) => {
          logger.debug(`- [${issue.category}] (${ruleName}) ${issue.id || 'N/A'}: ${issue.message}`);
          if (issue.category?.toLowerCase().includes('error')) totalErrors++;
          else totalWarnings++;

          allIssues.push({ file: fileName, rule: ruleName, ...issue });
        });
      });
    } catch (lintError) {
      logger.error(`A critical error occurred while processing [${fileName}]:`, lintError.message);
      allIssues.push({
        file: fileName,
        id: 'Fatal',
        message: lintError.message,
        category: 'internal-error',
        rule: 'linter-internal',
      });
      totalErrors++;
    }
  }

  return { allIssues, totalErrors, totalWarnings };
}

function generateReport({ allIssues, totalErrors, totalWarnings }, lintedFiles, format, outputPath, showConsoleTable, linterType) {
  let reportDetails = '';

  const theme = {
    error: chalk.red(' ❌ Error'),
    warning: chalk.yellow(' ⚠️ Warning'),
  };

  if (showConsoleTable && allIssues.length > 0) {
    allIssues.forEach((issue) => {
      const isError = issue.category?.toLowerCase().includes('error') || issue.severity === 'error';
      const label = isError ? theme.error : theme.warning;
      const file = path.basename(issue.file);
      const output = isError ? totalErrors > 0 : totalErrors === 0;

      if (output) {
        reportDetails += `${label} ${chalk.cyan(file)} › ${issue.id || 'N/A'}: ${issue.message} ${chalk.gray(`(${issue.rule})`)}\n`;
      }
    });
  }

  // Footer Summary
  logger.log(chalk.gray('-'.repeat(60)));
  logger.log(`${chalk.bold('LINT RESULTS')} | Files: ${lintedFiles.length} | Errors: ${chalk.red.bold(totalErrors)} | Warnings: ${chalk.yellow.bold(totalWarnings)}`);

  const extension = format === 'junit' ? 'xml' : format;
  const finalOutputPath = path.resolve(process.cwd(), `${outputPath}.${extension}`);
  let reportContent;

  try {
    // Ensure the output directory exists
    const outputDir = path.dirname(finalOutputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const linterConfig = LINTER_CONFIGS[linterType];
    const reportTitle = linterConfig.reportTitle;

    switch (format) {
      case 'json':
        reportContent = JSON.stringify(
          {
            summary: { totalFiles: lintedFiles.length, totalErrors, totalWarnings },
            issues: allIssues,
          },
          null,
          2
        );
        fs.writeFileSync(finalOutputPath, reportContent);
        break;

      case 'html':
        reportContent = `
          <html>
            <head>
              <title>${reportTitle}</title>
              <style>
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 2em; background-color: #f9f9f9; color: #333; }
                h1, h2 { color: #111; border-bottom: 1px solid #ddd; padding-bottom: 10px; }
                .summary { background-color: #fff; padding: 1em 1.5em; border-radius: 8px; margin-bottom: 2em; border: 1px solid #ddd; }
                table { width: 100%; border-collapse: collapse; background-color: #fff; border-radius: 8px; overflow: hidden; border: 1px solid #ddd; }
                th, td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #eee; }
                th { background-color: #f2f2f2; font-weight: 600; }
                tbody tr:nth-child(even) { background-color: #f9f9f9; }
                tbody tr:hover { background-color: #f1f1f1; }
                .severity-error { color: #c00; font-weight: bold; }
                .severity-warning { color: #d97400; font-weight: bold; }
                .icon { margin-right: 8px; font-size: 1.2em; vertical-align: middle; }
                .file-path { font-family: monospace; font-size: 0.9em; color: #555; }
              </style>
            </head>
            <body>
              <h1>${reportTitle}</h1>
              <div class="summary">
                <h2>Summary</h2>
                <p><strong>Total Files Linted:</strong> ${lintedFiles.length}</p>
                <p><strong>Total Errors:</strong> ${totalErrors}</p>
                <p><strong>Total Warnings:</strong> ${totalWarnings}</p>
              </div>
              <h2>All Issues (${allIssues.length})</h2>
              ${
                allIssues.length > 0
                  ? `
                <table>
                  <thead>
                    <tr>
                      <th>Severity</th>
                      <th>File</th>
                      <th>Element ID</th>
                      <th>Rule</th>
                      <th>Message</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${allIssues
                      .map((issue) => {
                        let severity = issue.category || 'unknown';
                        let icon = '';
                        let severityClass = '';
                        if (severity.toLowerCase().includes('error')) {
                          icon = '<span class="icon">❌</span>';
                          severityClass = 'severity-error';
                          severity = 'Error';
                        } else if (severity.toLowerCase().includes('warn')) {
                          icon = '<span class="icon">⚠️</span>';
                          severityClass = 'severity-warning';
                          severity = 'Warning';
                        }
                        return `
                            <tr>
                              <td class="${severityClass}">${icon}${severity}</td>
                              <td class="file-path">${issue.file}</td>
                              <td>${issue.id || 'N/A'}</td>
                              <td>${issue.rule}</td>
                              <td>${issue.message}</td>
                            </tr>
                          `;
                      })
                      .join('')}
                  </tbody>
                </table>
              `
                  : '<p>No issues found.</p>'
              }
            </body>
          </html>
        `;
        fs.writeFileSync(finalOutputPath, reportContent);
        break;

      case 'junit':
        const builder = junitReportBuilder.newBuilder();
        const suite = builder.testSuite().name(`${linterType}-lint-report`).time(0);

        lintedFiles.forEach((file) => {
          const issuesForFile = allIssues.filter((issue) => issue.file === file);
          const testCase = suite.testCase().className(file).name(`${linterType.toUpperCase()} Linting`);

          if (issuesForFile.length > 0) {
            const failureMessages = issuesForFile.map((issue) => `[${issue.category}] (${issue.rule}) ${issue.id || 'N/A'}: ${issue.message}`).join('\n');
            testCase.failure(failureMessages);
          }
        });

        builder.writeTo(finalOutputPath);
        break;
    }

    logger.info(`${format.toUpperCase()} report saved to: ${finalOutputPath}`);
  } catch (error) {
    exitWithError(`Error writing report to ${finalOutputPath}: ${error.message}`);
  }
  return reportDetails;
}

// --- Main Execution Logic ---
async function main() {
  const linterType = argv.type;
  const configDefault = linterType === 'bpmn' ? '.bpmnlintrc' : '.dmnlintrc';
  const configPath = argv.config || configDefault;
  const { pattern, output: outputPath, format, customRulesPath, customRulesSeverity, installCustomDeps, showConsoleTable } = argv;

  logger.debug(
    `Lint runner arguments parsed: 
${JSON.stringify(
  {
    type: linterType,
    files: pattern,
    config: configPath,
    output: outputPath,
    format: format,
    customRulesPath: customRulesPath,
    customRulesSeverity: customRulesSeverity,
    installCustomDeps: installCustomDeps,
    showConsoleTable: showConsoleTable,
  },
  null,
  2
)}`
  );

  let dynamicPluginWasPrepared = false;

  try {
    // Validate linter type
    if (!Object.keys(LINTER_CONFIGS).includes(linterType)) {
      throw new Error(`Invalid linter type: ${linterType}. Must be one of: ${Object.keys(LINTER_CONFIGS).join(', ')}`);
    }

    const linterConfig = LINTER_CONFIGS[linterType];

    // Prepare the dynamic plugin if a path is provided
    if (customRulesPath) {
      prepareDynamicPlugin(customRulesPath, installCustomDeps, linterType);
      dynamicPluginWasPrepared = true;
    }

    // Load Configuration
    let finalConfig = JSON.parse(JSON.stringify(linterConfig.defaultConfig));
    try {
      const configFilePath = path.resolve(process.cwd(), configPath);
      logger.debug(`Loading configuration from: ${configFilePath}`);
      const configFileContent = fs.readFileSync(configFilePath, 'utf-8');
      finalConfig = JSON.parse(configFileContent);
    } catch (error) {
      exitWithError(`Could not load or parse the configuration file at "${configPath}": ${error.message}`);
    }

    // Override severities for custom rules if specified
    if (customRulesPath) {
      // make sure that the dynamic plugin is added to the config when loading the linter
      if (finalConfig?.extends?.indexOf('plugin:bp3-dynamic-rules') < 0) {
        finalConfig.extends.push('plugin:bp3-dynamic-rules/all');
      }
      // make sure that each rule has a default severity if one was provided
      if (customRulesSeverity) {
        for (const rule in finalConfig.rules) {
          if (rule.startsWith('dynamic-rules/')) {
            finalConfig.rules[rule] = customRulesSeverity;
          }
        }
      }
    }

    // Load the appropriate linter and resolver
    // const Linter = linterConfig.Linter();
    // const NodeResolver = linterConfig.NodeResolver();

    logger.debug(`Initializing Linter for ${linterType} with config=${JSON.stringify(finalConfig, null, 2)}`);
    // const linter = new Linter({
    //   config: finalConfig,
    //   resolver: new NodeResolver(),
    // });
    const linter = linterConfig.getLinter(finalConfig);

    // Enumerate Files
    logger.debug(`Searching for files using the pattern "${pattern}"`);
    const files = await findFiles(pattern);
    logger.debug(`Files found: [${files.join(', ')}]`);
    if (files.length === 0) {
      logger.warn('No files found to lint.');
      return;
    }

    // Lint Files
    const lintResults = await lintFiles(files, linter, linterType);

    // Generate Report
    const reportList = generateReport(lintResults, files, format, outputPath, showConsoleTable, linterType);

    // Final decision on exit code
    if (lintResults.totalErrors > 0) {
      throw new Error(`Found ${lintResults.totalErrors} error(s):\n${reportList}`);
    } else {
      logger.info(`LINT REPORT (Warnings):\n${reportList}`);
    }
  } catch (err) {
    exitWithError(err.message);
  } finally {
    // Always clean up if we prepared the plugin
    if (dynamicPluginWasPrepared) {
      cleanupDynamicPlugin(true, linterType);
    }
  }
}

main().catch((err) => {
  exitWithError(`An unexpected top-level error occurred: ${err.message}`);
});
