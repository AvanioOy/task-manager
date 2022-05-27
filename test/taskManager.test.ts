process.env.NODE_ENV = 'test';
import {expect} from 'chai';
import 'mocha';
import {TaskManager} from '../src';
import {Task1, TaskStep1} from './task/task1';

describe('task manager', () => {
	it('should create task manager', async () => {
		const initialData = {value: 'demo', roll: 0};
		const taskStep1 = new TaskStep1(initialData);
		const task = new Task1({type: 'task1', steps: [taskStep1]});
		const mgr = new TaskManager();
		mgr.addTask(task);
		let exportData = mgr.toJSON();
		expect(exportData).to.be.eql([{type: 'task1', steps: [{...initialData, status: 'pending'}], uuid: exportData[0].uuid}]);
		expect(await taskStep1.wait()).to.be.eql({data: 'demo world!'});
		exportData = mgr.toJSON();
		expect(exportData).to.be.eql([{type: 'task1', steps: [{...initialData, status: 'success', roll: 1}], uuid: exportData[0].uuid}]);
		await task.rollback();
		exportData = mgr.toJSON();
		expect(exportData).to.be.eql([{type: 'task1', steps: [{...initialData, status: 'init'}], uuid: exportData[0].uuid}]);
	});
});
