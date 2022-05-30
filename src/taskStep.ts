import * as EventEmitter from 'events';
import TypedEmitter from 'typed-emitter';
import {TaskStepError} from './error';
import {Runnable} from './runnable';

export enum TaskStepStatus {
	init = 0,
	pending = 1,
	running = 2,
	rollback = 3,
	success = 4,
	failure = 5,
}

type TaskStepEvents<T = unknown> = {
	status: (self: TaskStep<string, any>) => void;
	action: (self: TaskStep<string, any>, data: T) => void;
};

export type InitialTaskStepProps<K, P, T> = P & {
	key?: K;
	status?: TaskStepStatus;
	data?: T;
};

export type TaskStepProps<P> = P & {
	status: TaskStepStatus;
};

export type TaskStepOptions = {
	continueOnFailure?: boolean;
	supportRollback?: boolean;
	emitData?: boolean;
	validate: 'pending' | 'failure'[];
};

export type TaskStepToJson<K extends string, P> = TaskStep<K, P>['props'] & {key: K};
export type TaskStepAsJson<T extends AnyTaskStep> = ReturnType<T['toJSON']>;

export type AnyTaskStep = TaskStep<string, any, any>;

export abstract class TaskStep<K extends string, P, T = unknown> extends (EventEmitter as new () => TypedEmitter<TaskStepEvents>) implements Runnable<T> {
	private waitPromise: Promise<T | undefined> | undefined;
	private waitResolve: ((value: T | undefined | PromiseLike<T | undefined>) => void) | undefined;
	private waitReject: ((reason?: any) => void) | undefined;
	private isResolved: boolean = false;
	private data: T | undefined;
	protected readonly props: TaskStepProps<P>;
	constructor({key, data, ...props}: InitialTaskStepProps<K, P, T>) {
		super();
		this.props = {status: 'init', ...props} as TaskStepProps<P>;
	}
	public async action(): Promise<T> {
		if (this.props.status !== TaskStepStatus.pending) {
			throw new TaskStepError('TaskStep not in pending state');
		}
		try {
			const preStatus = await this.handlePreValidation();
			// check if this step was already resolved
			if (preStatus === 'success') {
				this.status = TaskStepStatus.success;
				this.waitResolve?.(this.data);
				return this.data!;
			}
		} catch (err) {
			this.status = TaskStepStatus.failure;
			this.waitReject?.(err);
			throw err;
		}
		this.status = TaskStepStatus.running;
		try {
			this.data = await this.handleAction();
			if (this.getOptions()?.emitData) {
				this.emit('action', this as any, this.data);
			}
			this.isResolved = true;
			this.status = TaskStepStatus.success;
			this.waitResolve?.(this.data);
			return this.data;
		} catch (err) {
			this.status = TaskStepStatus.failure;
			this.waitReject?.(err);
			throw err;
		}
	}
	public isDone(): boolean {
		return this.props.status === TaskStepStatus.success || this.props.status === TaskStepStatus.failure;
	}
	public async cancel(): Promise<boolean> {
		if (this.props.status !== TaskStepStatus.success) {
			throw new TaskStepError('TaskStep not in success state');
		}
		if (!this.getOptions()?.supportRollback) {
			throw new TaskStepError('TaskStep does not support rollback');
		}
		try {
			this.status = TaskStepStatus.rollback;
			const state = await this.handleCancel();
			this.status = TaskStepStatus.init;
			return state;
		} catch (err) {
			this.status = TaskStepStatus.failure;
			throw err;
		}
	}
	/**
	 *
	 * @returns task data or undefined if was resolved earlier
	 */
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
	/**
	 * Pre-validation function to check if task was run before (i.e. restart while was running).
	 */
	protected abstract handlePreValidation(): Promise<'init' | 'success'>;
	protected abstract handleAction(): Promise<T>;
	protected abstract handleCancel(): Promise<boolean>;
	public abstract name(): Promise<string>;
	public abstract getKey(): K;
	public abstract getOptions(): TaskStepOptions;
	public get status() {
		return this.props.status;
	}
	public set status(status: TaskStepStatus) {
		this.props.status = status;
		this.emit('status', this as any);
	}
	public toJSON(): TaskStepToJson<K, P> {
		return {
			key: this.getKey(),
			...this.props,
		};
	}
}
