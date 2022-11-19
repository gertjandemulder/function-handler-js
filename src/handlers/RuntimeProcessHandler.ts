import { Handler } from './Handler';
import {prefixes} from '../prefixes';

export class RuntimeProcessHandler extends Handler {
    constructor() {
        super(`${prefixes.fnoi}RuntimeProcessHandler`);
    }
    async executeFunction(args: {[predicate: string]: any}, options: any): Promise<{ [key: string]: any }> {
        const result = await options.fn(args)
        return result;
    }
}
