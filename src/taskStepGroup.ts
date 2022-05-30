import {Runnable} from './runnable';
import {AnyTaskStep, TaskStepStatus, TaskStepToJson} from './taskStep';

interface InitialTaskGroupProps<TS = AnyTaskStep> {
	steps: TS[];
}

export interface TaskStepGroupProps<TS = AnyTaskStep> {
	type: 'TaskStepGroup';
	steps: TS[];
}

export type AnyTaskStepGroup = TaskStepGroup<any>;

export type TaskStepGroupAsJson<T extends AnyTaskStep> = ReturnType<T['toJSON']>;

export interface TaskStepGroupPropsJson<TSJ = TaskStepToJson<string, any>[]> {
	type: 'TaskStepGroup';
	steps: TSJ[];
}

export class TaskStepGroup<TS extends AnyTaskStep, TSJ = TaskStepGroupAsJson<TS>> implements Runnable {
	private waitPromise: Promise<T | undefined> | undefined;
	private waitResolve: ((value: T | undefined | PromiseLike<T | undefined>) => void) | undefined;
	private waitReject: ((reason?: any) => void) | undefined;
	private isResolved: boolean = false;
	private data: T | undefined;
	public readonly props: TaskStepGroupProps<TS>;
	constructor(props: InitialTaskGroupProps<TS>) {
		this.props = {...props, type: 'TaskStepGroup'};
	}
	public async action(): Promise<ReturnType<typeof this.props.steps[number]['action']>> {
		const data: unknown[] = [];
		for (const step of this.props.steps) {
			data.push(await step.action());
		}
		return data;
	}
	public isDone(): boolean {
		return this.props.steps.every((step) => step.isDone());
	}
	public async cancel(): Promise<boolean> {
		let cancelBool = true;
		for (const step of [...this.props.steps].reverse()) {
			const cancel = await step.cancel();
			if (!cancel) {
				cancelBool = false;
			}
		}
		return cancelBool;
	}
	public wait(): Promise<T | undefined> {
		if (!this.waitPromise) {
			this.waitPromise = new Promise((resolve, reject) => {
				this.waitResolve = resolve;
				this.waitReject = reject;
				if (this.isResolved) {
					this.waitResolve(this.data!);
				}
			});
		}
		return this.waitPromise;
	}
	public get status(): TaskStepStatus {
		return this.props.steps.reduce<TaskStepStatus>((acc, step) => (step.status > acc ? step.status : acc), TaskStepStatus.init);
	}
	public set status(status: TaskStepStatus) {
		this.props.steps.forEach((step) => (step.status = status));
	}
	public toJSON(): TaskStepGroupPropsJson<TSJ> {
		return {
			...this.props,
			steps: this.props.steps.map((step) => step.toJSON()),
		};
	}
}
