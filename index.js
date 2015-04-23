'use strict';
var pm2 = require('pm2'),
	logSymbols = require('log-symbols'),
	inquirer = require('inquirer'),
	YOU_DONE = require('./you-done'),
	FILTER_PROCESS = require('./filter-process'),
	STATES = {
		'online': 'success',
		'stopped': 'warning',
		'stopping': 'info',
		'launching': 'info',
		'errored': 'error'
	};

require('shelljs/global');

function youDone() {
	inquirer.prompt(YOU_DONE, function(answer) {
		if (answer.done) {
			process.exit(0);
		} else {
			chooseProcess();
		}
	});
}

function onError(err) {
	console.error(err.message);
	process.exit(1);
}

function chooseProcess(filter) {
	pm2.list(function(err, ret) {
		if (err) onError(err);

		if (filter) {
			chooseFromList({
				filter: filter
			});
		} else {
			inquirer.prompt(FILTER_PROCESS, chooseFromList);
		}

		function chooseFromList(answer) {
			var filters = answer.filter;
			if (!Array.isArray(answer.filter)) {
				filters = answer.filter.split(' ');
			}

			inquirer.prompt([{
				type: "list",
				name: "process",
				message: "Choose a process?",
				choices: ret.map(function(proc) {
					return {
						value: proc.name,
						name: logSymbols[STATES[proc.pm2_env.status]] + ' ' + proc.name
					};
				}).filter(function(choice) {
					return filters.reduce(function(prev, curr) {
						if (!prev) return false;
						return choice.value.indexOf(curr) >= 0;
					}, true);
				}).concat([
					new inquirer.Separator(), {
						value: 'all',
						name: 'all'
					}
				])
			}, {
				type: "expand",
				name: "task",
				message: "Choose a task?",
				choices: [{
					key: 'r',
					value: 'restart',
					name: 'Restart'
				}, {
					key: 's',
					value: 'stop',
					name: 'Stop'
				}, {
					key: 'l',
					value: 'logs',
					name: 'Logs'
				}]
			}], function(answers) {
				if (answers.task === 'logs') {
					exec('pm2 logs ' + answers.process);
				} else {
					pm2[answers.task](answers.process, function(err, data) {
						if (err) onError(err);
						console.log(answers.process, answers.task, data.success ? logSymbols.success : logSymbols.error);

						youDone();
					});
				}
			});
		}
	});
}

module.exports = function(filter) {
	pm2.connect(function() {
		chooseProcess(filter);
	});
};

