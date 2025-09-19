//#! /usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const process = require('node:process');
const { execSync } = require('node:child_process');
const BPMN_PREFIX = 'bpmn';
const DMN_PREFIX = 'dmn';
const BPMNLINT_RUNNER = 'bpmnlint-runner';
const DMNLINT_RUNNER = 'dmnlint-runner';
const PACKAGE_JSON = 'package.json';
const defaultBpmnLintConfig = {
  "extends": ["bpmnlint:recommended"],
  "rules": {}
};
const defaultDmnLintConfig = {
  "extends": ["dmnlint:recommended"],
  "rules": {}
};

// Extract the details from a possible plugin name in the lintrc file to setup dependencies correctly
//
// BPMN
// ----
// FROM plugin:@bp3global/bpmn-rules@^0.0.5/recommended
//   TO {
//			configName: 'plugin:bp3global-bpmn-rules-0.0.5',
//			dependencyName: 'bpmnlint-plugin-bp3global-bpmn-rules-0.0.5',
//			dependencyValue: 'npm:@bp3global/bpmn-rules@^0.0.5'
//			npmReference: '@bp3global/bpmn-rules@^0.0.5'
//		}
//
// DMN
// ---
// FROM plugin:@bp3global/dmn-rules@^0.0.1/recommended
//   TO {
//			configName: 'plugin:bp3global-dmn-rules-0.0.5',
//			dependencyName: 'dmnlint-plugin-bp3global-dmn-rules-0.0.5',
//			dependencyValue: 'npm:@bp3global/dmn-rules@^0.0.5'
//			npmReference: '@bp3global/dmn-rules@^0.0.5'
//		}
//
function getPluginDetails(packageName, pluginPrefix) {
	let result = null;
	//
	// assuming the correctness of the lintrc file, the currPackageName should be something like "plugin:pluginName/ruleset" at this time
	//
	if (packageName != null && packageName.indexOf('plugin:') == 0) {
		//
		// transform the package name provided to be used as a dependency
		//
		// currConfigName
		// from: plugin:@bp3global/bpmn-rules@^0.0.5/all
		//  substring => plugin:@bp3global/bpmn-rules@^0.0.5
		//  replace => plugin:-bp3global-bpmn-rules--0.0.5
		//  replace => plugin:bp3global-bpmn-rules--0.0.5
		//  replace => plugin:bp3global-bpmn-rules-0.0.5
		//
		// dependencyName
		// from:plugin:bp3global-bpmn-rules-0.0.5
		//  replace => bp3global-bpmn-rules-0.0.5
		//  => bpmnlint-plugin-bp3global-bpmn-rules-0.0.5
		//
		// dependencyValue
		// from: plugin:@bp3global/bpmn-rules@^0.0.5/all
		//  substring => plugin:@bp3global/bpmn-rules@^0.0.5
		//  replace => npm:@bp3global/bpmn-rules@^0.0.5
		//
		const dependencyWithoutRuleSet = packageName.substring(0, packageName.lastIndexOf('/'));
		const ruleSet = packageName.substring(packageName.lastIndexOf('/'));
		//
		//prepare the revised config name for a new lintrc
		//
		const configName = dependencyWithoutRuleSet.replace(/@|\^|~|\.|\//igm, '-')
														.replace('--', '-')
														.replace('plugin:-', 'plugin:');
		//
		// prepare the output with:
		// - the config for a revised lintrc that will use aliases
		// - the package.json dependency name adapted to the alias
		// - the package.json dependency value to match the lintrc config
		// - the npm package name to present to the user
		//
		result = { 
			configName: `${configName}${ruleSet}`,
			dependencyName: `${pluginPrefix}lint-plugin-${configName.replace('plugin:', '')}`, 
			dependencyValue: dependencyWithoutRuleSet.replace('plugin:', 'npm:'),
			npmReference: dependencyWithoutRuleSet.replace('plugin:', '')
		};
	}
	return result;
}

// Prepare the config and dependencies for the bpmnlint runner
//
// 1) Parse the provided lintrc file
// 2) Prepare and write a revised lintrc and matching package.json dependencies
// 3) Prepare and write the bpmnlint-runner package.json
// 4) install the npm dependencies
//
function prepareLintRunner(filename, prefix, defaultLintConfig, lintRunner) {
  let revisedLintConfig = {
	extends: [],
	rules: {}
  };
  let additionalDependencies = [];
  let npmPackages = [];

  // read the provided config and collect the configs and dependencies
  //
  let lintConfig = JSON.parse(fs.readFileSync(filename));
  revisedLintConfig.rules = lintConfig.rules || {};
  if (lintConfig != null && lintConfig.extends != null)  {
    if (typeof lintConfig.extends == 'string') {
		// if it's just the one, push it
		//
		revisedLintConfig.extends.push(lintConfig.extends);
	} else if (lintConfig.extends.length > 0) {
      for (var idx = 0; idx < lintConfig.extends.length; ++idx) {
        const currentPluginDetails = getPluginDetails(lintConfig.extends[idx], prefix);
        // if it's a plugin, prepare the appropriate dependencies
        //
        if (currentPluginDetails != null) {
          revisedLintConfig.extends.push(currentPluginDetails.configName);
          additionalDependencies.push(currentPluginDetails);
          npmPackages.push(currentPluginDetails.npmReference);
        } else {
          // the assumption here is this is just the baseline bpmnlint ruleset
          //
          revisedLintConfig.extends.push(lintConfig.extends[idx]);
		}
      }
	} else {
      // always default to the bpmnlint recommended rules
      //
	  revisedLintConfig = defaultLintConfig;    
	}
  } else {
    // always default to the bpmnlint recommended rules
    //
	revisedLintConfig = defaultLintConfig;
  }
  // write the revised lintrc file
  //
  fs.writeFileSync(`${filename}Revised`, JSON.stringify(revisedLintConfig));

  // read the package json and write it
  //
  if (additionalDependencies != null && additionalDependencies.length > 0) {
	let packageJsonFilepath = path.join(process.cwd(), lintRunner, PACKAGE_JSON);
    let currentPackageJson = JSON.parse(fs.readFileSync(packageJsonFilepath));
	for (var idx = 0; idx < additionalDependencies.length; ++idx) {
	  currentPackageJson.dependencies[additionalDependencies[idx].dependencyName] = additionalDependencies[idx].dependencyValue;
	}
	fs.writeFileSync(packageJsonFilepath, JSON.stringify(currentPackageJson));
  }

  // install any required packages
  //

  // present the plugins getting installed for this
  //
  console.log(`Installing plugins referenced by ${filename}: [ ${npmPackages.join(', ')} ]`);
  try {
	// NOTE: not storing the result of this call nor handling the stdout nor stderr 
	// 		 because applying any handling to the "npm install" command won't do anything
	//execSync('npm install > /dev/null 2>&1 || (echo "Plugin installation failed" && exit 1)', {cwd: path.join(process.cwd(), lintRunner)});
	execSync('npm install', { cwd: path.join(process.cwd(), lintRunner), stdio: 'pipe' });
	console.info('Dependencies installed successfully.');
  } catch(err) {
    console.error('ERROR: ' + err);
	console.error('\nERROR: Plugin installation failed!\n');
  }
}

// Show the help text on how to use this utility
//
function showHelp() {
  console.error(`
    A utility that reads a lintrc file, generates/amends the package.json accordingly, and installs all the packages for the selected linter.

    Usage: node installPluginPackages.js --type=<bpmn|dmn> --config=<path to lintrc file>

    Required Arguments:
      --type=<bpmn|dmn>                Specifies the linter type to initialize.
      --config=<path to lintrc file>   Specifies the lintrc file path

    Examples:
      node installPluginPackages.js --type=bpmn --config=.bpmnlintrc
      node installPluginPackages.js --type=dmn --config=.dmnlintrc
  `);
  process.exit(1);
}

// Parse the command line arguments
//
function parseArgs() {
  const result = {};
  // process.argv contains: [0: node executable, 1: script path, 2+: arguments]
  const argumentsList = process.argv.slice(2);

  for (let idx = 0; idx < argumentsList.length; idx++) {
    const arg = argumentsList[idx];
    if (arg.startsWith('--')) {
      const [key, value] = arg.substring(2).split('=');
      // Handles --key=value
      if (value != null) {
        result[key] = value;
      // Handles any other flags without value (e.g.: --verbose)
      } else {
        result[key] = true;
      }
    }
  }
  return result;
}

// install plugins if lintrc provided or show some help
//
let args = parseArgs();

if (process.argv.length > 3
    && process.argv[2].toLowerCase() != 'help'
    && fs.existsSync(args["config"])
    ) {

  if (args != null && args["type"].toLowerCase() == BPMN_PREFIX) {
    prepareLintRunner(args["config"], BPMN_PREFIX, defaultBpmnLintConfig, BPMNLINT_RUNNER);
  } else if (args != null && args["type"].toLowerCase() == DMN_PREFIX) {
    prepareLintRunner(args["config"], DMN_PREFIX, defaultDmnLintConfig, DMNLINT_RUNNER);
  } else {
    showHelp();
  }

} else {
  // present any error first
  //
  if (process.argv.length <= 3) {
	console.error(`\n\n    ERROR: please provide a lintrc file\n`);
  } else if(process.argv[2].toLowerCase() != 'help' && !fs.existsSync(args["config"])) {
	console.error(`\n\n    ERROR: invalid path to lintrc file: ${args["config"]}\n`);
  }
  // if there wasn't an error, but just a help request
  //
  showHelp();
}
