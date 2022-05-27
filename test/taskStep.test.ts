process.env.NODE_ENV = 'test';
import {expect} from 'chai';
import 'mocha';
import {TaskStep1} from './task/task1';

describe('task step', () => {
	it('should run one step', async () => {
		const taskStep1 = new TaskStep1({value: 'demo', roll: 0});
		const taskStepPromise = taskStep1.wait();
		expect(taskStep1.toJSON()).to.be.eql({key: 'step1', status: 'init', value: 'demo', roll: 0});
		taskStep1.status('pending'); // we can only run pending task step
		expect(taskStep1.toJSON()).to.be.eql({key: 'step1', status: 'pending', value: 'demo', roll: 0});
		const data = await taskStep1.action();
		expect(taskStep1.toJSON()).to.be.eql({key: 'step1', status: 'success', value: 'demo', roll: 1});
		expect(data).to.be.eql({data: 'demo world!'});
		await taskStep1.cancel();
		expect(taskStep1.toJSON()).to.be.eql({key: 'step1', status: 'init', value: 'demo', roll: 0});
		expect(await taskStepPromise).to.be.eql({data: 'demo world!'});
	});
	it('should run one step and wait after done', async () => {
		const taskStep1 = new TaskStep1({value: 'demo', roll: 0});
		expect(taskStep1.toJSON()).to.be.eql({key: 'step1', status: 'init', value: 'demo', roll: 0});
		taskStep1.status('pending'); // we can only run pending task step
		expect(taskStep1.toJSON()).to.be.eql({key: 'step1', status: 'pending', value: 'demo', roll: 0});
		const data = await taskStep1.action();
		expect(taskStep1.toJSON()).to.be.eql({key: 'step1', status: 'success', value: 'demo', roll: 1});
		expect(data).to.be.eql({data: 'demo world!'});
		await taskStep1.cancel();
		expect(taskStep1.toJSON()).to.be.eql({key: 'step1', status: 'init', value: 'demo', roll: 0});
		const taskStepPromise = taskStep1.wait();
		expect(await taskStepPromise).to.be.eql({data: 'demo world!'});
	});
	it('should fail run action', async () => {
		const taskStep1 = new TaskStep1({value: 'error', roll: 0});
		expect(taskStep1.toJSON()).to.be.eql({key: 'step1', status: 'init', value: 'error', roll: 0});
		taskStep1.status('pending'); // we can only run pending task step
		expect(taskStep1.toJSON()).to.be.eql({key: 'step1', status: 'pending', value: 'error', roll: 0});
		try {
			await taskStep1.action();
			throw new Error('should not be here');
		} catch (err: any) {
			expect(err.message).to.be.eql('action error');
			expect(taskStep1.toJSON()).to.be.eql({key: 'step1', status: 'failure', value: 'error', roll: 0});
		}
		try {
			await taskStep1.cancel();
			throw new Error('should not be here');
		} catch (err: any) {
			expect(err.message).to.be.eql('TaskStep not in success state');
			expect(taskStep1.toJSON()).to.be.eql({key: 'step1', status: 'failure', value: 'error', roll: 0});
		}
	});
});
