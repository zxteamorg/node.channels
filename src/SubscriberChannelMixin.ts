import { SubscriberChannel } from "@zxteam/contract";
import { CancelledError, AggregateError, InvalidOperationError } from "@zxteam/errors";

export class SubscriberChannelMixin<T> implements SubscriberChannel<T> {
	private __callbacks?: Array<SubscriberChannel.Callback<T>>;
	private __broken?: boolean;

	public static applyMixin(targetClass: any): void {
		Object.getOwnPropertyNames(SubscriberChannelMixin.prototype).forEach(name => {
			const propertyDescr = Object.getOwnPropertyDescriptor(SubscriberChannelMixin.prototype, name);

			if (name === "constructor") {
				// Skip constructor
				return;
			}
			if (name === "onAddFirstHandler" || name === "onRemoveLastHandler") {
				// Add NOP methods into mixed only if it not implements its
				if (propertyDescr !== undefined) {
					const existingPropertyDescr = Object.getOwnPropertyDescriptor(targetClass.prototype, name);
					if (existingPropertyDescr === undefined) {
						Object.defineProperty(targetClass.prototype, name, propertyDescr);
					}
				}
				return;
			}

			if (propertyDescr !== undefined) {
				Object.defineProperty(targetClass.prototype, name, propertyDescr);
			}
		});
	}

	public addHandler(cb: SubscriberChannel.Callback<T>): void {
		this.verifyBrokenChannel();

		this._callbacks.push(cb);
		if (this._callbacks.length === 1) {
			this.onAddFirstHandler();
		}
	}

	public removeHandler(cb: SubscriberChannel.Callback<T>): void {
		const index = this._callbacks.indexOf(cb);
		if (index !== -1) {
			this._callbacks.splice(index, 1);
			if (this._callbacks.length === 0) {
				this.onRemoveLastHandler();
			}
		}
	}

	protected get isBroken(): boolean { return this._broken; }
	protected verifyBrokenChannel(): void {
		if (this.isBroken) {
			throw new InvalidOperationError("Wrong operation on broken channel");
		}
	}

	protected notify(event: SubscriberChannel.Event<T> | Error): void | Promise<void> {
		if (this._callbacks.length === 0) {
			return;
		}
		const callbacks = this._callbacks.slice();
		if (event instanceof Error) {
			this._broken = true;
			this._callbacks.splice(0, this._callbacks.length);
		}
		if (callbacks.length === 1) {
			return callbacks[0](event);
		}
		const promises: Array<Promise<void>> = [];
		const errors: Array<Error> = [];
		for (const callback of callbacks) {
			try {
				const result = callback(event);
				if (result instanceof Promise) {
					promises.push(result);
				}
			} catch (e) {
				errors.push(e);
			}
		}

		if (promises.length === 1 && errors.length === 0) {
			return promises[0];
		} else if (promises.length > 0) {
			return Promise
				.all(promises.map(function (p) {
					return p.catch(function (e) {
						errors.push(e);
					});
				}))
				.then(function () {
					if (errors.length > 0) {
						for (const error of errors) {
							if (!(error instanceof CancelledError)) {
								throw new AggregateError(errors);
							}
						}
						// So, all errors are CancelledError instances, throw first
						throw errors[0];
					}
				});
		} else {
			if (errors.length > 0) {
				for (const error of errors) {
					if (!(error instanceof CancelledError)) {
						throw new AggregateError(errors);
					}
				}
				// So, all errors are CancelledError instances, throw first
				throw errors[0];
			}
		}
	}

	protected get hasSubscribers(): boolean { return this._callbacks.length > 0; }
	protected onAddFirstHandler(): void { /* NOP */ }
	protected onRemoveLastHandler(): void { /* NOP */ }

	private get _callbacks(): Array<SubscriberChannel.Callback<T>> {
		if (this.__callbacks === undefined) { this.__callbacks = []; }
		return this.__callbacks;
	}
	private get _broken(): boolean {
		if (this.__broken === undefined) { this.__broken = false; }
		return this.__broken;
	}
	private set _broken(value: boolean) {
		this.__broken = value;
	}

	private constructor() {
		// Never called, due mixin
		// Private constructor has two kinds of responsibility
		// 1) Restrict to extends the mixin
		// 2) Restrict to make instances of the mixin
	}
}
