import {AnyTaskStep, TaskStepToJson} from './taskStep';

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

export class TaskStepGroup<TS extends AnyTaskStep, TSJ = TaskStepGroupAsJson<TS>> {
	public readonly props: TaskStepGroupProps<TS>;
	constructor(props: InitialTaskGroupProps<TS>) {
		this.props = {...props, type: 'TaskStepGroup'};
	}
	public toJSON(): TaskStepGroupPropsJson<TSJ> {
		return {
			...this.props,
			steps: this.props.steps.map((step) => step.toJSON()),
		};
	}
}
