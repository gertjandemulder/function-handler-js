import {TermClass} from "./TermClass";
import {ArgumentMap} from "../handlers/Handler";
import {exec} from "child_process";

export interface Parameter {
    iri: string,
    _type: string | null
}

export interface PositionParameter extends Parameter {
    position: Number
}

export interface PropertyParameter extends Parameter {
    property: string
}

export interface Output extends PropertyParameter {}

export class Implementation extends TermClass {
    protected callable: Function;
    protected positionParameters: PositionParameter[];
    protected propertyParameters: PropertyParameter[];
    protected outputs: Output[];

    constructor(iri,
                positionParameters: PositionParameter[] = [],
                propertyParameters: PropertyParameter[] = [],
                outputs: Output[] = []
    ) {
        super(iri);
        this.callable = () => {
            throw Error('Callable Not Implemented!');
        }
        this.positionParameters = positionParameters;
        this.positionParameters
            .sort((a: PositionParameter, b: PositionParameter) => a.position < b.position ? -1 : 1)
        this.propertyParameters = propertyParameters;
        this.outputs = outputs;
    }

    execute(args?: any): any {
        const output = this.callable(args);
        return output;
    }
}

// TODO: export class OpenRefineImplementation extends Implementation
// TODO: export class SPARQLImplementation extends Implementation {}
// TODO: export class XPATHImplementation extends Implementation {}
// TODO: export class SQLImplementation extends Implementation {}

// TODO: export class NpmPackage extends JavaScriptImplementation {}
// TODO: export class JavaImplementation extends Implementation {}
// TODO: export class JavaClass extends Implementation {}
// TODO: export class WebApi extends Implementation {}
// TODO: export class JsonAPI extends WebApi {}

export class JavaScriptImplementation extends Implementation {
}

export class JavaScriptFunction extends JavaScriptImplementation {
}

export class RuntimeProcess extends Implementation {
    protected baseCommand: string[];


    constructor(iri, positionParameters: PositionParameter[], propertyParameters: PropertyParameter[], outputs: Output[], baseCommand: string[]) {
        super(iri, positionParameters, propertyParameters, outputs);
        this.baseCommand = baseCommand;
    }

    async execute(args?: any): Promise<any> {
        const positionParameterValues = this.positionParameters.map(p => args[p.iri])

        // <baseCommand> [propertyParameter, ...] [positionParameter, ...]
        const cmd = `${this.baseCommand} ${positionParameterValues.join(' ')}` // TODO: add propertyparameter
        const execPromise = new Promise((resolve, reject) => {
            exec(cmd, (error, stdout, stderr) => {
                if (error) {
                    reject(error)
                    return;
                }
                if (stderr) {
                    reject(stderr);
                    return;
                }
                resolve(stdout)
            })
        })

        const fnResult = await execPromise;
        const result = {};

        // (tmp) Assumption: there is only one output
        if (this.outputs.length > 0) {
            result[this.outputs[0].iri] = fnResult;
        }

        return result;
    }
}
