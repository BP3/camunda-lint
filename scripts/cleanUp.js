//#! /usr/bin/env node
const fs = require('fs');
const outputFilepath = 'package.json';
const packageLockFilepath = 'package-lock.json';
const nodeModulesPath = 'node_modules';

//clean up
if (fs.existsSync(outputFilepath)) {
  fs.unlinkSync(outputFilepath);
}
if (fs.existsSync(packageLockFilepath)) {
  fs.unlinkSync(packageLockFilepath);
}
if (fs.existsSync(nodeModulesPath)) {
  fs.rmSync(nodeModulesPath, { recursive: true, force: true });
}
