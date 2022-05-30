import {TaskStepStatus} from './taskStep';

export interface Runnable<T = unknown> {
	action: () => Promise<T>;
	isDone: () => boolean;
	cancel: () => Promise<boolean>;
	wait: () => Promise<T | undefined>;
	status: TaskStepStatus;
	toJSON: () => any;
}
