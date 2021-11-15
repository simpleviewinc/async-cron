export type AnyFunc = (...any: any[]) => any;

export interface JobInterface<T extends AnyFunc> {
	(...args: Parameters<T>): Promise<ReturnType<T>>
}