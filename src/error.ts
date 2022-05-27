export class TaskStepError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'TaskStepError';
		Error.captureStackTrace(this, this.constructor);
	}
}

export class TaskError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'TaskError';
		Error.captureStackTrace(this, this.constructor);
	}
}

export interface TaskDateError {
	date: Date;
	error: Error;
}

export class TaskAggregateError extends AggregateError {
	constructor(errors: TaskDateError[], message?: string) {
		super(errors, message);
		this.name = 'TaskAggregateError';
		Error.captureStackTrace(this, this.constructor);
	}
}
export function isTaskAggrefateError(err: Error): err is TaskAggregateError {
	return err.name === 'TaskAggregateError';
}

export function getError(error: unknown): Error {
	return error instanceof Error ? error : new TypeError('unknown error type');
}
