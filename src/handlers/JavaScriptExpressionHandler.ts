import { Handler } from './Handler';
import {prefixes} from '../prefixes';

export class JavaScriptExpressionHandler extends Handler {
    constructor() {
        super(`${prefixes.fnoi}JavaScriptExpressionHandler`);
    }
    async executeFunction(args: {[predicate: string]: any}, options: any): Promise<{ [key: string]: any }> {
        const result = await options.fn(args)
        return result;
    }
}
