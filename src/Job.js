//@ts-check
const parser = require("cron-parser");
const events = require("events");
const { Mutex } = require("async-mutex");

const E_RUNNING = require("./E_RUNNING");

/**
 * @template {import("./types").AnyFunc} T
 */
class Job extends events.EventEmitter {
	/** 
	 * @type {T}
	*/
	fn;
	#iterator;
	#timer;
	#running = false;
	#mutex;

	/**
	 * 
	 * @param {object} args
	 * @param {string} args.schedule - Schedule in cron-parser syntax
	 * @param {T} fn - Function to execute when the schedule fires.
	 */
	constructor({ schedule }, fn) {
		super();

		this.args = {
			schedule
		}
		this.fn = fn;

		this.#mutex = new Mutex();
	}
	// PUBLIC METHODS
	/**
	 * Start the job running in the background
	 * @returns {void}
	 */
	start() {
		this.#iterator = parser.parseExpression(this.args.schedule);

		this.#running = true;

		this.#loop();
	}
	/**
	 * Stops the job from running again
	 * @returns {void}
	 */
	stop() {
		this.#running = false;
		clearTimeout(this.#timer);
	}
	/**
	 * Check whether the function is currently running
	 * @returns {boolean}
	 */
	isRunning() {
		return this.#mutex.isLocked();
	}
	/**
	 * Triggers the job to run manually
	 * @type {import("./types").JobInterface<T>}
	 */
	async run(...args) {
		if (this.#mutex.isLocked()) {
			const e = new Error("Job is already running.");
			// @ts-ignore: VSCode complains about error not having code despite it being a common practice.
			e.code = E_RUNNING;
			throw e;
		}

		const result = await this.#mutex.runExclusive(() => this.fn(...args));

		return result;
	}
	// PRIVATE METHODS
	// @ts-ignore: VSCode complains about private methods which are valid in Node 14 but not in TS embedded in VSCode.
	async #loop() {
		while(true) {
			if (this.#running === false) {
				break;
			}

			const date = this.#iterator.next();
			const fromNow = date.getTime() - Date.now();

			if (fromNow < 0) {
				// if the date we received is in the past, kick us forward another instance
				continue;
			}

			await new Promise((resolve) => {
				this.#timer = setTimeout(function() {
					resolve();
				}, fromNow);
			});

			try {
				const result = await this.run();
				this.emit("result", result);
			} catch(e) {
				if (this.listenerCount("error") > 0) {
					this.emit("error", e);
				}
			}
		}
	}
}

module.exports = Job;