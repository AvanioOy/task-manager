import * as EventEmitter from 'events';
import TypedEmitter from 'typed-emitter';
import {AnyTaskStep, TaskStep, TaskStepAsJson, TaskStepToJson} from './taskStep';
import {v4 as uuidV4} from 'uuid';
import {getError, TaskAggregateError, TaskDateError, TaskError} from './error';

type TaskEvents = {
	stepStatus: (self: TaskStep<string, any>) => void;
	stepAction: (self: TaskStep<string, any>, data: unknown) => void;
};

interface InitialTaskProps<T extends string, TS = AnyTaskStep> {
	type: T;
	uuid?: string;
	steps: TS[];
}

export interface TaskProps<T extends string, TS = AnyTaskStep> {
	type: T;
	uuid: string;
	steps: TS[];
}

export interface TaskPropsJson<T extends string, TSJ = TaskStepToJson<string, any>[]> {
	type: T;
	uuid: string;
	steps: TSJ[];
}

function isTaskProps<T extends string>(props: any): props is TaskProps<T> {
	return props.type !== undefined && props.uuid !== undefined && Array.isArray(props.steps);
}

export type AnyTask = Task<string, AnyTaskStep>;

export abstract class Task<T extends string, TS extends AnyTaskStep, TSJ = TaskStepAsJson<TS>> extends (EventEmitter as new () => TypedEmitter<TaskEvents>) {
	public readonly uuid: string;
	protected readonly props: TaskProps<T>;
	constructor(props: InitialTaskProps<T>) {
		super();
		if (isTaskProps(props)) {
			this.props = props;
		} else {
			this.props = {uuid: uuidV4(), ...props};
		}
		this.uuid = this.props.uuid;
		this.props.steps.forEach((s) => s.on('status', (taskStep) => this.emit('stepStatus', taskStep)));
		this.props.steps.forEach((s) => s.on('action', (taskStep, data) => this.emit('stepAction', taskStep, data)));
	}
	public async start(): Promise<void> {
		this.props.steps.filter((step) => step.status() === 'init').forEach((step) => step.status('pending'));
		const errorList: TaskDateError[] = [];
		for (const step of this.props.steps.filter((step) => {
			const status = step.status();
			return status === 'pending' || status === 'running';
		})) {
			try {
				await step.action();
			} catch (err) {
				errorList.push({date: new Date(), error: getError(err)});
				if (!step.getOptions()?.continueOnFailure) {
					break;
				}
			}
		}
		if (errorList.length > 0) {
			throw new TaskAggregateError(errorList, 'Task run error');
		}
	}
	public async runNext(): Promise<{step: AnyTaskStep; data: unknown} | undefined> {
		const step = this.props.steps.find((s) => s.status() === 'init');
		if (!step) {
			return;
		}
		step.status('pending');
		return {step, data: await step.action()};
	}
	public async rollback({force}: {force?: boolean} = {force: false}): Promise<void> {
		if (!force) {
			const supportRollback = this.props.steps.reduce((acc, step) => acc || step.getOptions()?.supportRollback || false, false);
			if (!supportRollback) {
				throw new TaskError('not all task steps support rollback');
			}
		}
		const errorList: TaskDateError[] = [];
		for (const step of [...this.props.steps].reverse()) {
			try {
				await step.cancel();
			} catch (err) {
				errorList.push({date: new Date(), error: getError(err)});
			}
		}
		if (errorList.length > 0) {
			throw new TaskAggregateError(errorList, 'Task rollback error');
		}
	}
	public isReady(): boolean {
		return this.props.steps.every((step) => step.isDone());
	}
	public toJSON(): TaskPropsJson<T, TSJ> {
		return {
			...this.props,
			steps: this.props.steps.map((step) => step.toJSON()),
		};
	}
}
