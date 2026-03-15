/**
 * アプリケーション用カスタム例外。
 * （フロントでは statusCode は API レスポンス用、ここでは errorCode で識別）
 */

export class AppException extends Error {
  readonly errorCode: string;

  constructor({
    message,
    errorCode = 'DEFAULT',
  }: {
    message: string;
    errorCode?: string;
  }) {
    super(message);
    this.name = 'AppException';
    this.errorCode = errorCode;
  }
}

/**
 * @param message エラーメッセージ
 * @param errorCode エラーコード（デフォルト: 'INVALID_INPUT'）
 */
export const InvalidInputException = (message: string, errorCode?: string) =>
  new AppException({ message, errorCode: errorCode ?? 'INVALID_INPUT' });

/**
 * @param message エラーメッセージ
 * @param errorCode エラーコード（デフォルト: 'FILE_READ_ERROR'）
 */
export const FileReadException = (message: string, errorCode?: string) =>
  new AppException({ message, errorCode: errorCode ?? 'FILE_READ_ERROR' });

/**
 * @param message エラーメッセージ
 * @param errorCode エラーコード（デフォルト: 'CANVAS_ERROR'）
 */
export const CanvasException = (message: string, errorCode?: string) =>
  new AppException({ message, errorCode: errorCode ?? 'CANVAS_ERROR' });
