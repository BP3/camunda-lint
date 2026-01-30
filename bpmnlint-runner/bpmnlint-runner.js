const { Linter } = require('bpmnlint');
const NodeResolver = require('bpmnlint/lib/resolver/node-resolver');
const BpmnModdle = require('bpmn-moddle');
const tinyglob = require('tiny-glob');
const fs = require('fs');
const path = require('path');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const junitReportBuilder = require('junit-report-builder');
const { execSync } = require('child_process');
const chalk = require('chalk');
const Table = require('cli-table3');

const defaultPackageJsonDependencies = {
  "bpmnlint": "^11.6.0",
  "bpmnlint-utils": "^1.1.1",
  "@BP3/bpmnlint-plugin-bpmn-rules": "^0.0.4"
};

// --- Define and parse command-line arguments using yargs ---
const argv = yargs(hideBin(process.argv))
  .usage('Usage: $0 <path-with-wildcards> [options]')
  .command('$0 <pattern>', 'Lint BPMN files matching the pattern', (yargs) => {
    yargs.positional('pattern', {
      describe: 'Pattern to match BPMN files (e.g., "/diagrams/*.bpmn")',
      type: 'string',
    });
  })
  .option('config', {
    alias: 'c',
    describe: 'Path to the .bpmnlintrc configuration file.\r\n(ex.: /project/config/.bpmnlintrc)',
    type: 'string',
    default: '.bpmnlintrc',
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
    choices: ['json', 'html', 'junit'], //'console', 
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
    alias: 't',
    type: 'boolean',
    description: 'Show results table on the console',
    default: true,
  })
  .demandCommand(1, 'You must provide a pattern for the files to lint.')
  .help()
  .argv;

// --- Create a local logger and use color coding ---
const logger = {
  log: (...args) => {
    if (argv.verbose) {
      console.log(chalk.gray('VERBOSE:'), ...args);
    }
  },
  info: (...args) => {
    console.log(chalk.blueBright.bold('INFO:'), ...args);
  },
  warn: (...args) => {
    console.warn(chalk.yellowBright.bold('WARN:'), ...args);
  },
  error: (...args) => {
    console.error(chalk.redBright.bold('ERROR:'), ...args);
  },
};

// --- Helper functions ---
function exitWithError(message) {
  logger.error(message);
  process.exit(1);
}

// --- Prepare the dynamic bpmnlint plugin by copying custom rules and installing their dependencies ---
function prepareDynamicPlugin(customRulesPath, installDeps) {
  if (!customRulesPath) {
      logger.log('Custom rules path not provided. Skipping dynamic plugin generation.');
      return;
  }

  const pluginPath = path.join(__dirname, 'bp3-dynamic-rules');
  const pluginRulesPath = path.join(pluginPath, 'rules');
  const pluginPackageJsonPath = path.join(pluginPath, 'package.json');
  //const pluginNodeModulesPath = path.join(pluginPath, 'node_modules');
  const sourceRulesPath = path.resolve(process.cwd(), customRulesPath);
  const sourcePackageJsonPath = path.join(sourceRulesPath, 'package.json');
  //prepare a couple of baseline dependencies
  let finalDeps = JSON.parse(JSON.stringify(defaultPackageJsonDependencies));
  
  // Remove older/existing artifacts
  cleanupDynamicPlugin(false);

  // Move any dependencies from the rules source to the plugin
  const pluginPackageJson = JSON.parse(fs.readFileSync(`${pluginPackageJsonPath}`, 'utf-8'));
  if (fs.existsSync(sourcePackageJsonPath)) {
    const sourcePackageJson = JSON.parse(fs.readFileSync(sourcePackageJsonPath, 'utf-8'));
    finalDeps = sourcePackageJson.dependencies || finalDeps;
  }
  pluginPackageJson.dependencies = finalDeps;
  fs.writeFileSync(pluginPackageJsonPath, JSON.stringify(pluginPackageJson, null, 2));

  // Copy rule files from source to the plugin
  logger.log(`Copying rules from ${sourceRulesPath} to ${pluginRulesPath}`);
  const sourceAllFiles = fs.readdirSync(sourceRulesPath, { recursive: true });
  const sourceRuleFiles = sourceAllFiles.filter(file => file.endsWith('.js') && !file.split(path.sep).includes('node_modules') && !file.split(path.sep).includes('.git'));

  sourceRuleFiles.forEach(file => {
    const sourceFile = path.join(sourceRulesPath, file);
    const destFile = path.join(pluginRulesPath, file);
    fs.mkdirSync(path.dirname(destFile), { recursive: true });
    fs.copyFileSync(sourceFile, destFile);
  });
  logger.log(`Copied ${sourceRuleFiles.length} rule file(s).`);

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
      throw new Error(
        `Custom rules require dependencies, but they are not installed. ` +
        `Please use the '-i' or '--install-custom-deps' flag.`
      );
    }
  }
}

// --- Cleans up the artifacts created by prepareDynamicPlugin ---
function cleanupDynamicPlugin(doResetPackageJson = false) {
  logger.log('Cleaning up dynamic plugin environment...');
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
    const pluginPackageJson = JSON.parse(fs.readFileSync(`${pluginPackageJsonPath}`, 'utf-8'));
    pluginPackageJson.dependencies = defaultPackageJsonDependencies;
    fs.writeFileSync(pluginPackageJsonPath, JSON.stringify(pluginPackageJson, null, 2));
  }
}

async function findFiles(pattern) {
  logger.log(`Searching for files matching: "${pattern}"`);
  const normalizedPattern = pattern.replace(/\\/gm,'/');
  const files = await tinyglob(normalizedPattern, { absolute: true, filesOnly: true, dot: true });

  if (files.length === 0) {
    logger.warn(`No files found matching the pattern: "${pattern}"`);
  } else {
    logger.log(`Found ${files.length} files to lint.`);
  }
  return files;
}

async function lintFiles(files, linter) {
  const allIssues = [];
  let totalErrors = 0;
  let totalWarnings = 0;

  const moddle = new BpmnModdle();

  for (const file of files) {
    logger.log(`Linting ${file}...`);
    const bpmnXML = fs.readFileSync(file, 'utf-8');
    try {
      logger.log('  - Parsing diagram...');
      const {
        rootElement,
        warnings: parseWarnings
      } = await moddle.fromXML(bpmnXML);

      if (parseWarnings && parseWarnings.length) {
        parseWarnings.forEach(warning => {
          logger.log(`    - [import-warning] (bpmn-moddle) ${warning.element ? warning.element.id : 'FileLevel'}: ${warning.message}`);
          allIssues.push({
            file,
            id: warning.element?.id || 'FileLevel', 
            message: warning.message,
            category: 'import-warning',
            rule: 'bpmn-moddle'
          });
          totalWarnings++;
        });
      }

      logger.log('  - Linting diagram...');
      const report = await linter.lint(rootElement);
      
      for (const [ruleName, issues] of Object.entries(report)) {
        issues.forEach(issue => {
          logger.log(`    - [${issue.category}] (${ruleName}) ${issue.id || 'N/A'}: ${issue.message}`);
          if (issue.category?.includes('error')) totalErrors++;
          else totalWarnings++;
          allIssues.push({ file, rule: ruleName, ...issue });
        });
      }
      if (Object.keys(report).length === 0) {
        logger.log('No issues found.');
      }
    } catch (lintError) {
      logger.error(`A critical error occurred while processing ${file}:`, lintError.message);
      allIssues.push({ 
      	file, 
      	id: 'Fatal', 
      	message: lintError.message, 
      	category: 'internal-error', 
      	rule: 'linter-internal' 
      });
      totalErrors++;
    }
  }

  return { allIssues, totalErrors, totalWarnings };
}

function generateReport({ allIssues, totalErrors, totalWarnings }, lintedFiles, format, outputPath, showConsoleTable) {
  console.log('--- Linting Summary ---');
  console.log(`Total Files Linted: ${lintedFiles.length}`);
  console.log(`Total Errors: ${chalk.red.bold(totalErrors)}`);
  console.log(`Total Warnings: ${chalk.yellow.bold(totalWarnings)}`);
  console.log('-----------------------');

  if (showConsoleTable/*format === 'console'*/) {
    if (allIssues.length > 0) {
      // Create a new table
      // const table = new Table({
      //   head: [
      //     chalk.cyan('Severity'),
      //     chalk.cyan('File'),
      //     chalk.cyan('Element ID'),
      //     chalk.cyan('Rule'),
      //     chalk.cyan('Message')
      //   ],
      //   // Set column widths and enable word wrapping
      //   colWidths: [20, 40, 25, 20, 60],
      //   wordWrap: true,
      //   // Style the table for a cleaner look
      //   style: {
      //       head: [], // remove colors from head, chalk is doing it
      //       border: ['grey']
      //   }
      // });

      // // Sort issues by severity (errors first)
      // allIssues.sort((a, b) => {
      //     const severityA = a.category?.includes('error') ? 0 : 1;
      //     const severityB = b.category?.includes('error') ? 0 : 1;
      //     return severityA - severityB;
      // });

      // // Populate the table with issue data
      // allIssues.forEach(issue => {
      //   const severity = issue.category || 'unknown';
      //   let severityStyled = severity;

      //   if (severity.toLowerCase().includes('error')) {
      //     severityStyled = chalk.red(`❌  Error`);
      //   } else if (severity.toLowerCase().includes('warn')) {
      //     severityStyled = chalk.yellow(`⚠️  Warning`);
      //   }

      //   table.push([
      //     severityStyled,
      //     // Truncate file path from the beginning if it's too long
      //     '...' + issue.file.slice(-34),
      //     issue.id || 'N/A',
      //     issue.rule,
      //     issue.message
      //   ]);
      // });

      // // Print the table to the console
      // console.log(table.toString());
      allIssues.forEach(issue => {
        const severity = issue.category || 'unknown';
        let severityStyled = severity;

        if (severity.toLowerCase().includes('error')) {
          severityStyled = chalk.red(`❌  Error`);
        } else if (severity.toLowerCase().includes('warn')) {
          severityStyled = chalk.yellow(`⚠️  Warning`);
        } else if (severity.toLowerCase().includes('info')) {
          severityStyled = chalk.blueBright(`ℹ️  Info`);
        }
        console.log(`${severityStyled}, ${issue.file}, ${issue.id || 'N/A'}, ${issue.rule}, ${issue.message}`);
      });
    }
    //return;
  }

  const extension = format === 'junit' ? 'xml' : format;
  const finalOutputPath = path.resolve(process.cwd(), `${outputPath}.${extension}`);
  let reportContent;

  try {
    // Ensure the output directory exists
    const outputDir = path.dirname(finalOutputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    switch (format) {
      case 'json':
        reportContent = JSON.stringify({
          summary: { totalFiles: lintedFiles.length, totalErrors, totalWarnings },
          issues: allIssues,
        }, null, 2);
        fs.writeFileSync(finalOutputPath, reportContent);
        break;

      case 'html':
        reportContent = `
          <html>
            <head>
              <title>BPMN Lint Report</title>
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
                .icon {
            /* Vertically align icon with text */
            vertical-align: middle; 
            /* Define a standard size */
            width: 1.2em;
            height: 1.2em;
        }
        .icon-error {
            /* Color for the error icon */
            stroke: #d9534f; /* A nice red color */
        }
        .icon-warning {
            /* Color for the warning icon */
            stroke: #f0ad4e; /* A nice orange/yellow color */
        }
                .icon { margin-right: 8px; font-size: 1.2em; vertical-align: middle; }
                .file-path { font-family: monospace; font-size: 0.9em; color: #555; }
              </style>
            </head>
            <body>
              <h1>BPMN Lint Report</h1>
              <div class="summary">
                <h2>Summary</h2>
                <p><strong>Total Files Linted:</strong> ${lintedFiles.length}</p>
                <p><strong>Total Errors:</strong> ${totalErrors}</p>
                <p><strong>Total Warnings:</strong> ${totalWarnings}</p>
              </div>
              <h2>All Issues (${allIssues.length})</h2>
              ${allIssues.length > 0 ? `
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
                    ${allIssues.map(issue => {
                        let severity = issue.category || 'unknown';
                        let icon = '';
                        let severityClass = '';
                        if (severity.toLowerCase().includes('error')) {
                            icon = '<span class="icon">❌</span>';
                            severityClass = 'severity-error';
                            severity = "Error";
                        } else if (severity.toLowerCase().includes('warn')) {
                            icon = '<span class="icon">⚠️</span>';
                            severityClass = 'severity-warning';
                            severity = "Warning";
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
                    }).join('')}
                  </tbody>
                </table>
              ` : '<p>No issues found.</p>'}
            </body>
          </html>
        `;
        fs.writeFileSync(finalOutputPath, reportContent);
        break;

      case 'junit':
        const builder = junitReportBuilder.newBuilder();
        const suite = builder.testSuite().name('bpmnlint-report').time(0);
        
        lintedFiles.forEach(file => {
            const issuesForFile = allIssues.filter(issue => issue.file === file);
            const testCase = suite.testCase().className(file).name('BPMN Linting');

            if (issuesForFile.length > 0) {
                const failureMessages = issuesForFile.map(issue => 
                  `[${issue.category}] (${issue.rule}) ${issue.id || 'N/A'}: ${issue.message}`
                ).join('\n');
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
}

// --- Main Execution Logic ---
async function main() {
  const { pattern, config: configPath, output: outputPath, format, customRulesPath, customRulesSeverity, installCustomDeps, showConsoleTable } = argv;
  logger.log(`Lint runner arguments parsed: ${JSON.stringify({
    files: pattern,
    config: configPath,
    output: outputPath,
    format: format,
    customRulesPath: customRulesPath,
    customRulesSeverity: customRulesSeverity,
    installCustomDeps: installCustomDeps,
    showConsoleTable: showConsoleTable
  })

  })}`);

  let dynamicPluginWasPrepared = false;

  try {
    // Prepare the dynamic plugin if a path is provided
    if (customRulesPath) {
        prepareDynamicPlugin(customRulesPath, installCustomDeps);
        dynamicPluginWasPrepared = true;
    }

    // Load Configuration: default to load the bpmnlinter rules and the dynamic rules plugin
    let linterConfig = {
        "extends": ["bpmnlint:recommended", "plugin:bp3-dynamic-rules/all"],
        "rules": {
      }
    };
    try {
      const configFilePath = path.resolve(process.cwd(), configPath);
      logger.log(`Loading configuration from: ${configFilePath}`);
      const configFileContent = fs.readFileSync(configFilePath, 'utf-8');
      linterConfig = JSON.parse(configFileContent);
    } catch (error) {
      exitWithError(`Could not load or parse the configuration file at "${configPath}": ${error.message}`);
    }

    // Override severities for custom rules if specified
    if (customRulesPath) {
      //make sure that the dynamic plugin is added to the config when loading the linter
      if (linterConfig?.extends?.indexOf('plugin:bp3-dynamic-rules') < 0) {
        linterConfig.extends.push("plugin:bp3-dynamic-rules/all");
      }
      //make sure that each rule has a default severity if one was provided
      if (customRulesSeverity) {
        for (const rule in linterConfig.rules) {
          if (rule.startsWith('dynamic-rules/')) {
            linterConfig.rules[rule] = customRulesSeverity;
          }
        }
      }
    }

    const linter = new Linter({
      config: linterConfig,
      resolver: new NodeResolver()
    });

    // Enumerate Files
    logger.log(`Searching for files using the pattern "${pattern}"`);
    const files = await findFiles(pattern);
    logger.log(`Files found: [${files.join(', ')}]`);
    if (files.length === 0) {
      //throw new Error('No files found to lint.');
      logger.warn('No files found to lint.');
      return;
    }

    // Lint Files
    const lintResults = await lintFiles(files, linter);

    // Generate Report
    generateReport(lintResults, files, format, outputPath, showConsoleTable);

    // Final decision on exit code
    if (lintResults.totalErrors > 0) {
      throw new Error(`Found ${lintResults.totalErrors} error(s).`);
    } else {
      logger.info('Linting complete. No errors found.');
    }
  } catch (err) {
    exitWithError(err.message);
  } finally {
    // Always clean up if we prepared the plugin
    if (dynamicPluginWasPrepared) {
      cleanupDynamicPlugin(true);
    }
  }
}

main().catch(err => {
  exitWithError(`An unexpected top-level error occurred: ${err.message}`);
});
