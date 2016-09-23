'use strict';

const chai = require('chai');
const expect = chai.expect;
const spawnSync = require('child_process').spawnSync;
const fs = require('fs');
const path = require('path');

const cu = require('../index.js');

const testDir = '/tmp/compilation-utils-tests';

/* eslint-disable no-unused-expressions */

describe('#runWithinEnvironment()', () => {
  beforeEach(() => {
    spawnSync('rm', ['-rf', testDir]);
    fs.mkdirSync(testDir);
  });
  afterEach(() => {
    spawnSync('rm', ['-rf', testDir]);
  });
  it('uses the proper working directory', () => {
    const res = cu.runWithinEnvironment(testDir, 'pwd', [], null);
    expect(res).to.be.eql(`${testDir}\n`);
  });
  it('successfully pass arguments', () => {
    const res = cu.runWithinEnvironment(testDir, 'ls', [testDir], null);
    expect(res).to.be.eql('');
  });
  it('successfully change the environment', () => {
    const res = cu.runWithinEnvironment(testDir, 'env', {env: {TEST: 1}});
    expect(res).to.be.include('TEST=1');
  });
  it('successfully change the logger', () => {
    let result = '';
    const write = (text) => result += text;
    const logger = {
      info: write, trace: write, trace2: write, trace3: write, trace4: write
    };
    cu.runWithinEnvironment(testDir, 'pwd', null, {logger});
    expect(result).to.contain('Executing: pwd');
    expect(result).to.contain('RESULT: {"code":0,"stderr":"","stdout":"/tmp/compilation-utils-tests\\n"}');
  });
  it('throws an error if the command fails', () => {
    expect(() => cu.runWithinEnvironment(testDir, 'false', null, null)).to.throw('Program exited with exit code 1');
  });
});

describe('#configure()', () => {
  function createConfigure(scriptName) {
    fs.writeFileSync(path.join(testDir, scriptName || 'configure'), '#!/bin/bash\necho $@', {mode: '0755'});
  }
  beforeEach(() => {
    spawnSync('rm', ['-rf', testDir]);
    fs.mkdirSync(testDir);
  });
  afterEach(() => {
    spawnSync('rm', ['-rf', testDir]);
  });
  it('uses the proper working directory', () => {
    createConfigure();
    const res = cu.configure(testDir, 'test', null);
    expect(res).to.be.eql('test\n');
  });
  it('changes logger and environment', () => {
    createConfigure();
    let result = '';
    const write = (text) => result += text;
    const logger = {
      info: write, trace: write, trace2: write, trace3: write, trace4: write
    };
    cu.configure(testDir, 'this_is_a_test', {logger, env: {test: 1}});
    expect(result).to.contain('ENVIRONMENT VARIABLES:\ntest=1');
    expect(result).to.contain('"stdout":"this_is_a_test\\n"');
  });
});

describe('#patch()', () => {
  beforeEach(() => {
    spawnSync('rm', ['-rf', testDir]);
    fs.mkdirSync(testDir);
    fs.writeFileSync(path.join(testDir, 'file1'), 'This is a test 1\n');
  });
  afterEach(() => {
    // spawnSync('rm', ['-rf', testDir]);
  });
  it('patches a file', () => {
    fs.writeFileSync(path.join(testDir, 'file1.patch'), '--- file1	2016-09-19 18:34:35.343692000 +0200\n' +
    '+++ file2	2016-09-19 18:34:42.759692000 +0200\n' +
    '@@ -1 +1 @@\n' +
    '-This is a test 1\n' +
    '+This is a test 1-modified\n');
    cu.patch(testDir, 'file1.patch', null);
    expect(fs.readFileSync(path.join(testDir, 'file1'), {encoding: 'utf-8'})).to.be.eql('This is a test 1-modified\n');
  });
  it('changes the patchLevel', () => {
    fs.writeFileSync(path.join(testDir, 'file1.patch'), '--- no-exists/file1	2016-09-19 18:34:35.343692000 +0200\n' +
    '+++ no-exists/file2	2016-09-19 18:34:42.759692000 +0200\n' +
    '@@ -1 +1 @@\n' +
    '-This is a test 1\n' +
    '+This is a test 1-modified\n');
    cu.patch(testDir, 'file1.patch', {patchLevel: 1});
    expect(fs.readFileSync(path.join(testDir, 'file1'), {encoding: 'utf-8'})).to.be.eql('This is a test 1-modified\n');
  });
});

describe('#make()', () => {
  beforeEach(() => {
    spawnSync('rm', ['-rf', testDir]);
    fs.mkdirSync(testDir);
    fs.writeFileSync(path.join(testDir, 'Makefile'),
    'MAKE_PID := $(shell echo $$PPID)\n' +
    'JOB_FLAG := $(filter --jobs%, $(subst --jobs ,--jobs,$(shell ps T | grep "^\\s*$(MAKE_PID).*$(MAKE)")))\n' +
    'JOBS     := $(subst --jobs=,,$(JOB_FLAG))\n' +
    'TEST_FLAG := $(filter test%, $(subst test ,test,$(shell ps T | grep "^\\s*$(MAKE_PID).*$(MAKE)")))\n' +
    'TEST_VALUE     := $(subst test=,,$(TEST_FLAG))\n' +
    'test:\n' +
    '	echo "test with $(JOBS) jobs, test flag: $(TEST_VALUE)"\n\n' +
    'install:\n' +
    '	echo "this is an installation"\n');
  });
  afterEach(() => {
    // spawnSync('rm', ['-rf', testDir]);
  });
  it('runs make command', () => {
    const res = cu.make(testDir, null, null);
    expect(res).to.match(/test with [0-9]+ jobs/);
  });
  it('pass arguments', () => {
    const res = cu.make(testDir, ['test=true'], null);
    expect(res).to.contain('true');
  });
  it('disables parallel build', () => {
    const res = cu.make(testDir, [], {supportsParallelBuild: false});
    expect(res).to.match(/test with\s+jobs/);
  });
  it('changes the maximum number of parallel jobs', () => {
    const res = cu.make(testDir, [], {maxParallelJobs: 1});
    expect(res).to.match(/test with 1 jobs/);
  });
});
