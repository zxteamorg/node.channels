import { SubscriberChannel } from "@zxteam/contract";

import { assert } from "chai";
import { SubscriberChannelMixin } from "../src";

describe("SubscriberChannelMixin tests", function () {
	class MyNotifier implements SubscriberChannel<string> {
		public crash(err: Error) {
			return this.notify(err);
		}
		public test(data: string) {
			return this.notify({ data });
		}
	}
	interface MyNotifier extends SubscriberChannelMixin<string> { }
	SubscriberChannelMixin.applyMixin(MyNotifier);


	it("Positive test", async function () {
		const instance = new MyNotifier();

		let callCount = 0;
		let eventData: Array<string> = [];

		function handler(event: SubscriberChannel.Event<string> | Error) {
			++callCount;

			if (event instanceof Error) { return; }

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

		let errors: Array<Error> = [];

		function handler(event: SubscriberChannel.Event<string> | Error) {
			++callCount;

			if (event instanceof Error) {
				errors.push(event);
			}
		}
		instance.addHandler(handler);
		instance.addHandler(handler);
		await instance.crash(new Error("one"));
		instance.removeHandler(handler);
		await instance.crash(new Error("two"));
		instance.removeHandler(handler);
		await instance.crash(new Error("three"));

		assert.equal(callCount, 2);
		assert.equal(errors.length, 2);
		assert.equal(errors[0].message, "one");
		assert.equal(errors[1].message, "one");
	});
});
