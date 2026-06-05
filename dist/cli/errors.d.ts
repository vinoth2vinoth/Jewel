export declare class JewelError extends Error {
    readonly status: string;
    readonly nextAction: string;
    readonly debugDetails?: any | undefined;
    constructor(status: string, message: string, nextAction: string, debugDetails?: any | undefined);
}
export declare function isJewelError(error: any): error is JewelError;
export declare function toJewelError(err: any): JewelError;
