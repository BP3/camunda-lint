//#! /usr/bin/env node
const fs = require('fs');
const { execSync } = require("child_process");
let packageJson = {"dependencies":{}};
const currentPluginList = [];
const outputFilepath = 'package.json';

// Format the name for use with npm in the package.json file
//
// FROM __bp3global__bpmn-rules__0.0.1 OR __bp3global__bpmn-rules__^0.0.1
//   TO npm:@bp3global/bpmn-rules@^0.0.1
// OR
// FROM __bp3global__bpmn-rules__~0.0.1
//   TO npm:@bp3global/bpmn-rules@~0.0.1
// OR
// FROM __bp3global__bpmn-rules
//   TO npm:@bp3global/bpmn-rules
//
function getNpmPackageName(packageName) {
	let result = '';
	if (packageName != null) {
		result = packageName;
		if (result.indexOf('__') == 0) {
			result = result.replace('__', '@').replace('__', '/');
		} else {
			//WARNING: this is exclusive to the camunda plugin naming scheme
			result = 'bpmnlint-plugin-' + result;
		}

	}
	return result.replace('__~', '@~').replace(/__\^?/im, '@^');
}

// Convert a possible plugin in the lintrc file into a project dependency
//
// 1) FROM plugin:__bp3global__bpmn-rules/recommended 
//      TO __bp3global__bpmn-rules
//
// 2) SET ALIAS "bpmnlint-plugin-__bp3global__bpmn-rules" == "npm:@bp3global/bpmn-rules"
//
function addPluginDependency(packageName) {
	//assuming the correctness of the lintrc file, the currPackageName should be something like "plugin:pluginName/ruleset" at this time
	if (packageName != null && packageName.indexOf('plugin:') == 0) {
		// transform the package name provided to be used as a dependency
		let currPackageName = packageName.substring(0, packageName.lastIndexOf('/')).replace('plugin:', '');
		// get the reference name
		let npmReference = getNpmPackageName(currPackageName);
		// record this for later use
		currentPluginList.push(npmReference);
		packageJson.dependencies["bpmnlint-plugin-" + currPackageName] = 'npm:' + npmReference;
	}
}

// Parse a lintrc file and prepare a set of dependencies
//
function digestLintrc(filename) {
	let lintConfig = JSON.parse(fs.readFileSync(filename));
	if (lintConfig != null && lintConfig.extends != null && lintConfig.extends.length > 0) {
		for (var idx = 0; idx < lintConfig.extends.length; ++idx) {
			addPluginDependency(lintConfig.extends[idx]);
		}
	}
}

// Show the help text on how to use this utility
//
function showHelp() {
	console.log(
		'A utility that reads a lintrc file, generates/amends the package.json accordingly, and installs all the packages'
		+ '\n'
		+ '\nUsage: node installPluginPackages.js <path to lintrc file>'
		+ '\n'
	);
}

// install plugins if lintrc provided or show some help
//
if (process.argv.length > 2
	&& process.argv[2].toLowerCase() != 'help'
	&& fs.existsSync(process.argv[2])) {

	// read the existing packages.json if it exists
	try {
		if (fs.existsSync(outputFilepath)) {
			packageJson = JSON.parse(fs.readFileSync(outputFilepath));
		}
	} catch (err) {
		//TODO: should log the error?
		// set a default value
		packageJson = {"dependencies":{}};
	}

	// add the dependencies from the lintrc file
	//console.log(`Retrieving plugins referenced by ${process.argv[2]}`);
	digestLintrc(process.argv[2]);

	//if there are depedencies, then output the package.json file
	if (Object.keys(packageJson.dependencies) != null && currentPluginList != null && currentPluginList.length > 0) {
		// present the plugins getting installed for this 
		console.log(`Installing plugins referenced by ${process.argv[2]}: [ ${currentPluginList.join(', ')} ]`);

		// create/overwrite a the package.json file with the updated dependencies
		fs.writeFileSync(outputFilepath, JSON.stringify(packageJson, undefined, 2));

		// install the required packages
		try {
			// NOTE: not storing the result of this call nor handling the stdout nor stderr 
			// 		 because applying any handling to the "npm install" command won't do anything
			execSync('npm install > /dev/null 2>&1 || (echo "Plugin installation failed" && exit 1)');
		} catch(err) {
			console.error('ERROR: ' + err);
			console.error('\nERROR: Plugin installation failed!\n');
		}
	}
} else {
	// present any error first
	if (process.argv.length <= 2) {
		console.error(`\nError: please provide a lintrc file\n`);
	} else if(process.argv[2].toLowerCase() != 'help' && !fs.existsSync(process.argv[2])) {
		console.error(`\nError: invalid path to lintrc file: ${process.argv[2]}\n`);
	}
	// if there wasn't an error, but just a help request
	showHelp();
}
