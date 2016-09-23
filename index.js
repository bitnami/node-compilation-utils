'use strict';

const path = require('path');
const _ = require('nami-utils/lodash-extra');
const nos = require('nami-utils').os;
const nfile = require('nami-utils').file;
const u = require('common-utils');

/**
 * @namespace compilationUtils
 */

function _findConfigureScript(dir) {
  const wellKnownScripts = ['configure', 'config'];
  const configureScript = _.find(wellKnownScripts, script => nfile.exists(path.join(dir, script)));
  if (_.isEmpty(configureScript)) {
    throw new Error(`Cannot find any of ${wellKnownScripts.join(', ')} under ${dir}`);
  }
  return path.join(dir, configureScript);
}

/**
 * Run a command using an specific environment logging the result.
 * @memberof compilationUtils
 * @param {string} cwd - Working directory
 * @param {string} cmd - Command to run
 * @param {string|array} [args] - Arguments of the command
 * @param {Object} [options]
 * @param {string} [options.env={}] Key-value with the environment variables to set
 * @param {string} [options.logger=null] {@linkcode Logger} to use to print result
 * @throws {Error} If command returns an error code different than 0
 */
function runWithinEnvironment(cwd, cmd, args, options) {
  if (_.isUndefined(options) && _.isReallyObject(args)) {
    options = args;
    args = [];
  }
  options = _.opts(options, {cwd, env: {}, logger: null});
  if (_.isNull(args) || _.isUndefined(args)) args = [];

  return u.logExec(cmd, args, options);
}

/**
 * Run the 'configure' script if present
 * @memberof compilationUtils
 * @param {string} cwd - Working directory
 * @param {string|array} [args] - Arguments of the command
 * @param {Object} [options]
 * @param {string} [options.env={}] Key-value with the environment variables to set
 * @param {string} [options.logger=null] {@linkcode Logger} to use to print result
 * @throws {Error} If the configure script is not found or it returns an error
 */
function configure(cwd, args, options) {
  if (_.isUndefined(options) && _.isReallyObject(args)) {
    options = args;
    args = [];
  }
  const configureScript = _findConfigureScript(cwd);
  return runWithinEnvironment(cwd, configureScript, args, options);
}

/**
 * Apply a patch.
 * @memberof compilationUtils
 * @param {string} cwd - Working directory
 * @param {string} patchFile - Patch file to apply
 * @param {Object} [options]
 * @param {string} [options.patchLevel=0] - Strip number leading components from file names
 * @param {string} [options.env={}] Key-value with the environment variables to set
 * @param {string} [options.logger=null] {@linkcode Logger} to use to print result
 * @throws {Error} If command returns an error code different than 0
 */
function patch(cwd, patchFile, options) {
  options = _.opts(options, {patchLevel: 0});
  return runWithinEnvironment(cwd, 'patch', [`-p${options.patchLevel}`, '-i', patchFile], options);
}


const _machineInformation = _.memoize(function() {
  const info = {cores: 2};
  if (nos.isPlatform('linux')) {
    let cores = 0;
    nfile.eachLine('/proc/cpuinfo', function(line) {
      if (line.match(/^processor\s+:/)) cores += 1;
    });
    info.cores = Math.max(cores, info.cores);
  }
  return info;
});

/**
 * Run a command using an specific environment logging the result.
 * @memberof compilationUtils
 * @param {string} cwd - Working directory
 * @param {string|array} [args] - Arguments of the command
 * @param {Object} [options]
 * @param {string} [options.supportsParallelBuild=true] - The objective supports to run several jobs in parallel
 * @param {string} [options.maxParallelJobs=Infinity] - Maximum number of jobs that the command can use.
 *  It is resolved to the number of cores +1 in Linux systems and 2 in other case.
 * @param {string} [options.env={}] Key-value with the environment variables to set
 * @param {string} [options.logger=null] {@linkcode Logger} to use to print result
 * @throws {Error} If command returns an error code different than 0
 */
function make(cwd, args, options) {
  if (_.isUndefined(options) && _.isReallyObject(args)) {
    options = args;
    args = [];
  }
  options = _.opts(options, {supportsParallelBuild: true, maxParallelJobs: Infinity});

  let makeArgs = [];
  if (options.supportsParallelBuild) {
    makeArgs.push(`--jobs=${Math.min(_machineInformation().cores + 1, options.maxParallelJobs)}`);
  }
  if (arguments.length > 0) {
    makeArgs = makeArgs.concat(_.toArray(args));
  }
  return runWithinEnvironment(cwd, 'make', makeArgs, options);
}


module.exports = {
  runWithinEnvironment,
  configure,
  patch,
  make
};
