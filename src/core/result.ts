/**
 * Result型: 成功または失敗を型安全に表現する。
 */

export type Result<T, E extends string> = Success<T> | Failure<E>;

export class Success<T> {
  readonly value: T;
  constructor(value: T) {
    this.value = value;
  }
  isSuccess(): this is Success<T> {
    return true;
  }
  isFailure(): this is Failure<string> {
    return false;
  }
}

export class Failure<E extends string> {
  readonly error: BaseError<E>;
  constructor(error: BaseError<E>) {
    this.error = error;
  }
  isSuccess(): this is Success<unknown> {
    return false;
  }
  isFailure(): this is Failure<E> {
    return true;
  }
}

export class BaseError<T extends string> extends Error {
  override name: T;
  constructor({
    name,
    message,
  }: {
    name: T;
    message: string;
    cause?: unknown;
  }) {
    super(message);
    this.name = name;
  }
}

/** @param value 成功値 */
export function success<T>(value: T): Success<T> {
  return new Success(value);
}

/** @param error エラーオブジェクト */
export function failure<E extends string>(error: BaseError<E>): Failure<E> {
  return new Failure(error);
}
