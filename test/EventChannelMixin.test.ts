import { EventChannel } from "@zxteam/contract";

import { assert } from "chai";
import { EventChannelMixin } from "../src";
import { AggregateError } from "@zxteam/errors";

describe("EventChannelMixin tests", function () {
	class MyNotifier implements EventChannel<string> {
		public test(data: string) {
			return this.notify({ data });
		}
	}
	interface MyNotifier extends EventChannelMixin<string> { }
	EventChannelMixin.applyMixin(MyNotifier);


	it("Positive test", async function () {
		const instance = new MyNotifier();

		let callCount = 0;
		let eventData: Array<string> = [];

		async function handler(event: EventChannel.Event<string>) {
			await new Promise(wakeup => setTimeout(wakeup, 50));
			++callCount;
			eventData.push(event.data);
		}
		instance.addHandler(handler);
		instance.addHandler(handler);
		await instance.test("one");
		await instance.test("two");
		instance.removeHandler(handler);
		await instance.test("three");
		instance.removeHandler(handler);
		await instance.test("four");

		assert.equal(callCount, 5);
		assert.equal(eventData.length, 5);
		assert.equal(eventData[0], "one");
		assert.equal(eventData[1], "one");
		assert.equal(eventData[2], "two");
		assert.equal(eventData[3], "two");
		assert.equal(eventData[4], "three");
	});

	it("Negative test", async function () {
		const instance = new MyNotifier();

		let callCount = 0;

		class MyTestError extends Error { }

		async function handler(event: EventChannel.Event<string>) {
			await new Promise(wakeup => setTimeout(wakeup, 50));
			++callCount;
			throw new MyTestError(event.data);
		}
		instance.addHandler(handler);
		instance.addHandler(handler);

		let expectedError!: AggregateError;
		try {
			await instance.test("nonce");
		} catch (e) {
			expectedError = e;
		}

		assert.equal(callCount, 2);
		assert.isDefined(expectedError);
		assert.instanceOf(expectedError, AggregateError);
		assert.equal(expectedError.innerErrors.length, 2);
		assert.instanceOf(expectedError.innerErrors[0], MyTestError);
		assert.instanceOf(expectedError.innerErrors[1], MyTestError);
		assert.equal(expectedError.innerErrors[0].message, "nonce");
		assert.equal(expectedError.innerErrors[1].message, "nonce");
	});
});
