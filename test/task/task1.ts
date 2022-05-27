import {Task} from '../../src/task';
import {InitialTaskStepProps, TaskStep} from '../../src/taskStep';

export class TaskStep1 extends TaskStep<{value: string; roll: number}, {data: string}> {
	public name() {
		return Promise.resolve('TaskStep1');
	}
	public getOptions() {
		return {supportRollback: true, emitData: true};
	}
	protected handleAction() {
		if (this.props.value === 'error') {
			return Promise.reject(new Error('action error'));
		}
		this.props.roll++;
		return Promise.resolve({data: `${this.props.value} world!`});
	}
	protected handleCancel() {
		if (this.props.value === 'cancel_error') {
			throw new Error('cancel error');
		}
		this.props.roll--;
		return Promise.resolve(true);
	}
	protected handlePreValidation(): Promise<'init' | 'success'> {
		if (this.status() === 'running' && this.props.roll > 0) {
			return Promise.resolve('success');
		}
		return Promise.resolve('init');
	}
}

export class Task1 extends Task<'task1'> {
	constructor(props: InitialTaskStepProps<any>) {
		super(props);
	}
}
