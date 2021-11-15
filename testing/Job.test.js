const { Job, E_RUNNING } = require("../");
const sinon = require("sinon");
const assert = require("assert");
const util = require("util");

const setTimeoutP = util.promisify(setTimeout);

describe(__filename, function() {
	this.timeout(5000);
	
	const everySecond = "* * * * * *";

	it("should schedule a job and run it on schedule", async function() {
		const cb = sinon.fake();
		
		const job = new Job({
			schedule : everySecond
		}, cb);

		job.start();

		await setTimeoutP(3000);

		job.stop();

		assert.strictEqual(cb.callCount, 3);
	});

	it("should ignore errors with no handler", async function() {
		const cb = sinon.fake.throws("dead");
		
		const job = new Job({
			schedule : everySecond
		}, cb);

		job.start();

		await setTimeoutP(3000);

		job.stop();

		assert.strictEqual(cb.callCount, 3);
	});

	it("should report errors to error handler and keep running", async function() {
		const cb = sinon.fake.throws("dead");
		const job = new Job({
			schedule : everySecond
		}, cb);

		const errorCb = function(e) {
			assert.strictEqual(e instanceof Error, true);
			assert.strictEqual(e.message, "dead");
		}

		const errorCbWrapped = sinon.fake(errorCb);

		job.on("error", errorCbWrapped);

		job.start();

		await setTimeoutP(3000);

		job.stop();

		assert.strictEqual(cb.callCount, 3);
		assert.strictEqual(errorCbWrapped.callCount, 3);
	});

	it("start should return undefined", function() {
		const cb = sinon.fake();
		const job = new Job({
			schedule : everySecond,
		}, cb);

		const result = job.start();
		const result2 = job.stop();

		assert.strictEqual(result, undefined);
		assert.strictEqual(result2, undefined);
	});

	it("should disallow multiple runs at once", async function() {
		const job = new Job({
			schedule : everySecond
		}, async function() {
			await assert.rejects(
				async () => job.run(),
				{
					code : E_RUNNING,
					message : "Job is already running."
				}
			);

			return "done";
		});

		const result = await job.run();
		assert.strictEqual(result, "done");
	});

	it("should disallow manual during automatic", async function() {
		const handler = async function() {
			await assert.rejects(
				async () => job.run(),
				{
					code : E_RUNNING,
					message : "Job is already running."
				}
			);

			return "done";
		}

		const cb = sinon.fake(handler);

		const job = new Job({
			schedule : everySecond
		}, cb);

		job.start();

		await setTimeoutP(3000);

		job.stop();

		assert.strictEqual(cb.callCount, 3);
	});

	it("should report back results", async function() {
		const resultSpy = sinon.fake();
		
		let count = 0;
		const job = new Job({
			schedule : everySecond
		}, async function() {
			return count++;
		});

		job.on("result", resultSpy);

		job.start();

		await setTimeoutP(3000);

		job.stop();

		const args = resultSpy.getCalls().map(val => val.firstArg);

		assert.deepStrictEqual(args, [
			0,
			1,
			2
		]);
	});

	it("should manually running should return results", async function() {
		const job = new Job({
			schedule : everySecond
		}, async function() {
			return "foo";
		});

		const results = await job.run();
		assert.strictEqual(results, "foo");
		assert.strictEqual(job.isRunning(), false);
	});

	it("should throw error on run if error is thrown", async function() {
		const job = new Job({
			schedule : everySecond
		}, async function() {
			throw new Error("dead");
		});

		await assert.rejects(
			async () => job.run(),
			{
				message : "dead"
			}
		);

		assert.strictEqual(job.isRunning(), false);
	});

	it("two different jobs should be able to run simultaneously", async function() {
		const job = new Job({
			schedule : everySecond
		}, async function() {
			await setTimeoutP(1000);
			return "done";
		});

		const job2 = new Job({
			schedule : everySecond
		}, async function() {
			await setTimeoutP(1000);
			return "done2";
		});

		const now = Date.now();
		const results = await Promise.all([
			job.run(),
			job2.run()
		]);

		assert.deepStrictEqual(results, ["done", "done2"]);

		const now2 = Date.now();
		assert.strictEqual(now2 - now >= 1000 && now2 - now <= 2000, true);
	});

	it("should pass along arguments to the function - single", async function() {
		const job = new Job({
			schedule : everySecond
		}, async function(arg1) {
			return arg1;
		});

		const result1 = await job.run();
		assert.strictEqual(result1, undefined);

		const result2 = await job.run("foo");
		assert.strictEqual(result2, "foo");
	});

	it("should pass along arguments to the function - multiple", async function() {
		const job = new Job({
			schedule : everySecond
		}, async function(arg1 = "default", arg2 = "second") {
			return arg1 + arg2;
		});

		const result1 = await job.run();
		assert.strictEqual(result1, "defaultsecond");

		const result2 = await job.run("foo");
		assert.strictEqual(result2, "foosecond");

		const result3 = await job.run("foo", "bar");
		assert.strictEqual(result3, "foobar");
	});
});