import {TaskError} from './error';
import {AnyTask, TaskPropsJson} from './task';

export class TaskManager {
	private tasks: Record<string, AnyTask> = {};
	public import(tasks: AnyTask[]) {
		this.tasks = tasks.reduce((acc, task) => {
			acc[task.uuid] = task;
			return acc;
		}, {});
	}
	public addTask(task: AnyTask): string {
		this.tasks[task.uuid] = task;
		if (!task.isReady()) {
			task.start();
		}
		return task.uuid;
	}
	public rollback(uuid: string) {
		if (!this.tasks[uuid]) {
			throw new TaskError(`task ${uuid} not found`);
		}
		this.tasks[uuid].rollback();
	}

	public toJSON(): TaskPropsJson<string>[] {
		return Object.values(this.tasks).map((task) => task.toJSON());
	}
}
