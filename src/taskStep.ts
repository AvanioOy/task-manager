import * as EventEmitter from 'events';
import TypedEmitter from 'typed-emitter';
import {TaskStepError} from './error';

export type TaskStepStatus = 'init' | 'pending' | 'running' | 'rollback' | 'success' | 'failure';

type TaskStepEvents<T = unknown> = {
	status: (self: TaskStep<string, any>) => void;
	action: (self: TaskStep<string, any>, data: T) => void;
};

export type InitialTaskStepProps<K, P> = P & {
	key?: K;
	status?: TaskStepStatus;
};

export type TaskStepProps<P> = P & {
	status: TaskStepStatus;
};

export type TaskStepOptions = {
	continueOnFailure?: boolean;
	supportRollback?: boolean;
	emitData?: boolean;
};

export type TaskStepToJson<K extends string, P> = TaskStep<K, P>['props'] & {key: K};
export type TaskStepAsJson<T extends AnyTaskStep> = ReturnType<T['toJSON']>;


export type AnyTaskStep = TaskStep<string, any, any>;

export abstract class TaskStep<K extends string, P, T = unknown> extends (EventEmitter as new () => TypedEmitter<TaskStepEvents>) {
	private waitPromise: Promise<T | undefined> | undefined;
	private waitResolve: ((value: T | undefined | PromiseLike<T | undefined>) => void) | undefined;
	private waitReject: ((reason?: any) => void) | undefined;
	private isResolved: boolean = false;
	private data: T | undefined;
	protected readonly props: TaskStepProps<P>;
	constructor({key, ...props}: InitialTaskStepProps<K, P>) {
		super();
		this.props = {status: 'init', ...props} as TaskStepProps<P>;
	}
	public async action(): Promise<T> {
		if (this.props.status !== 'pending') {
			throw new TaskStepError('TaskStep not in pending state');
		}
		try {
			const preStatus = await this.handlePreValidation();
			// check if this step was already resolved
			if (preStatus === 'success') {
				this.status('success');
				this.waitResolve?.(this.data);
				return this.data!;
			}
		} catch (err) {
			this.status('failure');
			this.waitReject?.(err);
			throw err;
		}
		this.status('running');
		try {
			this.data = await this.handleAction();
			if (this.getOptions()?.emitData) {
				this.emit('action', this as any, this.data);
			}
			this.isResolved = true;
			this.status('success');
			this.waitResolve?.(this.data);
			return this.data;
		} catch (err) {
			this.status('failure');
			this.waitReject?.(err);
			throw err;
		}
	}
	public isDone(): boolean {
		return this.props.status === 'success' || this.props.status === 'failure';
	}
	public async cancel(): Promise<boolean> {
		if (this.props.status !== 'success') {
			throw new TaskStepError('TaskStep not in success state');
		}
		if (!this.getOptions()?.supportRollback) {
			throw new TaskStepError('TaskStep does not support rollback');
		}
		try {
			this.status('rollback');
			const state = await this.handleCancel();
			this.status('init');
			return state;
		} catch (err) {
			this.status('failure');
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
	public status(status?: TaskStepStatus): TaskStepStatus {
		if (status) {
			this.props.status = status;
			this.emit('status', this as any);
		}
		return this.props.status;
	}
	public toJSON(): TaskStepToJson<K, P> {
		return {
			key: this.getKey(),
			...this.props,
		};
	}
}
