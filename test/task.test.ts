process.env.NODE_ENV = 'test';
import {expect} from 'chai';
import 'mocha';
import * as sinon from 'sinon';
import {TaskDateError} from '../src/error';
import {TaskStep, TaskStepStatus} from '../src/taskStep';
import {Task1, TaskStep1} from './task/task1';

const spyStepStatus = ({init, pending, running, success, rollback, failure}: Record<TaskStepStatus, {value: string; roll: number}>) =>
	sinon.spy((ts: TaskStep<any, unknown>) => {
		const status = ts.status();
		switch (status) {
			case 'init':
				expect(ts.toJSON()).to.be.eql({...init, status: 'init', key: 'step1'});
				break;
			case 'pending':
				expect(ts.toJSON()).to.be.eql({...pending, status: 'pending', key: 'step1'});
				break;
			case 'running':
				expect(ts.toJSON()).to.be.eql({...running, status: 'running', key: 'step1'});
				break;
			case 'success':
				expect(ts.toJSON()).to.be.eql({...success, status: 'success', key: 'step1'});
				break;
			case 'rollback':
				expect(ts.toJSON()).to.be.eql({...rollback, status: 'rollback', key: 'step1'});
				break;
			case 'failure':
				expect(ts.toJSON()).to.be.eql({...failure, status: 'failure', key: 'step1'});
				break;
			default:
				throw new Error(`unexpected status: ${ts.status()}`);
		}
	});
const spyStepAction = (props: {value: string; roll: number}) =>
	sinon.spy((ts: TaskStep<any, unknown>, data: unknown) => {
		expect(data).to.be.eql({data: `${props.value} world!`});
	});

let stepStatus: ReturnType<typeof spyStepStatus>;

describe('task', () => {
	it('should run and rollback task', async () => {
		const initialData = {value: 'demo', roll: 0};
		stepStatus = spyStepStatus({
			init: initialData,
			pending: initialData,
			running: initialData,
			success: {...initialData, roll: 1},
			rollback: {...initialData, roll: 1},
			failure: initialData,
		});
		const taskStep1 = new TaskStep1(initialData);
		const task = new Task1({type: 'task1', steps: [taskStep1]});
		task.on('stepStatus', stepStatus);
		task.on('stepAction', spyStepAction(initialData));
		const {uuid, ...data} = task.toJSON();
		expect(uuid).to.be.a('string');
		expect(data).to.be.eql({type: 'task1', steps: [taskStep1.toJSON()]});
		expect(taskStep1.toJSON()).to.be.eql({key: 'step1', status: 'init', value: 'demo', roll: 0});
		await task.start();
		expect(taskStep1.toJSON()).to.be.eql({key: 'step1', status: 'success', value: 'demo', roll: 1});
		await task.rollback();
		expect(taskStep1.toJSON()).to.be.eql({key: 'step1', status: 'init', value: 'demo', roll: 0});
		expect(stepStatus.callCount).to.be.eq(5); // init, pending, success, rollback
	});
	it('should fail on taskstep error', async () => {
		const initialData = {value: 'error', roll: 0};
		stepStatus = spyStepStatus({
			init: initialData,
			pending: initialData,
			running: initialData,
			success: {...initialData, roll: 1},
			rollback: {...initialData, roll: 1},
			failure: initialData,
		});
		const taskStep1 = new TaskStep1(initialData);
		const task = new Task1({type: 'task1', steps: [taskStep1]});
		task.on('stepStatus', stepStatus);
		task.on('stepAction', spyStepAction(initialData));
		const {uuid, ...data} = task.toJSON();
		expect(uuid).to.be.a('string');
		expect(data).to.be.eql({type: 'task1', steps: [taskStep1.toJSON()]});
		expect(taskStep1.toJSON()).to.be.eql({key: 'step1', status: 'init', value: 'error', roll: 0});
		try {
			await task.start();
			throw new Error('should not be here');
		} catch (err: any) {
			expect(err.name).to.be.eq('TaskAggregateError');
			expect(err.message).to.equal('Task run error');
			expect(err.errors.map((e: TaskDateError) => e.error.message)).to.be.eql(['action error']);
		}
		expect(taskStep1.toJSON()).to.be.eql({key: 'step1', status: 'failure', value: 'error', roll: 0});
		try {
			await task.rollback();
			throw new Error('should not be here');
		} catch (err: any) {
			expect(err.name).to.be.eq('TaskAggregateError');
			expect(err.message).to.equal('Task rollback error');
			expect(err.errors.map((e: TaskDateError) => e.error.message)).to.be.eql(['TaskStep not in success state']);
		}
		expect(stepStatus.callCount).to.be.eq(3); // init, pending, failure
	});
	it('should fail on rollback error', async () => {
		const initialData = {value: 'cancel_error', roll: 0};
		stepStatus = spyStepStatus({
			init: initialData,
			pending: initialData,
			running: initialData,
			success: {...initialData, roll: 1},
			rollback: {...initialData, roll: 1},
			failure: {...initialData, roll: 1},
		});
		const taskStep1 = new TaskStep1(initialData);
		const task = new Task1({type: 'task1', steps: [taskStep1]});
		task.on('stepStatus', stepStatus);
		task.on('stepAction', spyStepAction(initialData));
		const {uuid, ...data} = task.toJSON();
		expect(uuid).to.be.a('string');
		expect(data).to.be.eql({type: 'task1', steps: [taskStep1.toJSON()]});
		expect(taskStep1.toJSON()).to.be.eql({key: 'step1', status: 'init', value: 'cancel_error', roll: 0});
		await task.start();
		expect(taskStep1.toJSON()).to.be.eql({key: 'step1', status: 'success', value: 'cancel_error', roll: 1});
		try {
			await task.rollback();
			throw new Error('should not be here');
		} catch (err: any) {
			expect(err.name).to.be.eq('TaskAggregateError');
			expect(err.message).to.equal('Task rollback error');
			expect(err.errors.map((e: TaskDateError) => e.error.message)).to.be.eql(['cancel error']);
		}
		expect(stepStatus.callCount).to.be.eq(5); // init, pending, success, rollback, failure
	});
	it('should export and import task steps', async () => {
		const initialData = {value: 'demo', roll: 0};
		const taskStep1 = new TaskStep1(initialData);
		const task = new Task1({type: 'task1', steps: [taskStep1]});
		const {steps} = task.toJSON();
		const task2 = new Task1({
			type: 'task1',
			steps: steps.map((s) => {
				switch (s.key) {
					case 'step1':
						return new TaskStep1(s);
					default:
						throw new Error('unknown step');
				}
			}),
		});
		await task2.start();
	});
});
