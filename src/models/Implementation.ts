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

export interface PositionPropertyParameter extends PositionParameter, PropertyParameter {
}

export interface Output extends PropertyParameter {
}

export class Implementation extends TermClass {
    protected callable: Function;
    private _positionPropertyParameters: PositionPropertyParameter[];
    private _positionParameters: PositionParameter[];
    private _propertyParameters: PropertyParameter[];
    private _outputs: Output[];

    constructor(iri,
                positionParameters: PositionParameter[] = [],
                propertyParameters: PropertyParameter[] = [],
                outputs: Output[] = []
        , positionPropertyParameters: PositionPropertyParameter[] = []) {
        super(iri);
        this.callable = () => {
            throw Error('Callable Not Implemented!');
        }
        this._positionParameters = positionParameters;
        this._positionParameters
            .sort((a: PositionParameter, b: PositionParameter) => a.position < b.position ? -1 : 1)
        this._propertyParameters = propertyParameters;
        this._outputs = outputs;
        this._positionPropertyParameters = positionPropertyParameters;
    }


    get positionParameters(): PositionParameter[] {
        return this._positionParameters;
    }

    get propertyParameters(): PropertyParameter[] {
        return this._propertyParameters;
    }

    get positionPropertyParameters(): PositionPropertyParameter[] {
        return this._positionPropertyParameters;
    }

    get outputs(): Output[] {
        return this._outputs;
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

export class JavaScriptExpression extends JavaScriptImplementation {
    private readonly _expression: string;

    constructor(iri, positionParameters: PositionParameter[], propertyParameters: PropertyParameter[], outputs: Output[], positionPropertyParameters: PositionPropertyParameter[], expression: string) {
        super(iri, positionParameters, propertyParameters, outputs, positionPropertyParameters);
        this._expression = expression;
    }

    get expression(): string {
        return this._expression;
    }

    /**
     * Wraps the expression inside a JS function, and executes it.
     * @param args
     */
    async execute(args?: any): Promise<any> {
        const propertyParameterValuePairs = Object.fromEntries(this.propertyParameters.map(p => [p.property, args[p.iri]]))

        const header = this.propertyParameters.map(x => x.property).join(', ');
        const strFunc = `function f(${header})
         {
            const ___out = ${this.expression};
            return ___out;
        }`

        const jsFunction = eval(`(${strFunc})`);
        const result = {};
        // TODO: the following DOES NOT assign the values to the function arguments by key (it is merely the order of propertyParameterValuePairs's values)
        const fnResult = jsFunction.apply(null, Object.values(propertyParameterValuePairs))
        // Assumption: there is only one output // TODO: generalize to multiple outputs
        if (this.outputs.length > 0) {
            result[this.outputs[0].iri] = fnResult;
        }
        return result;
    }
}

export class RuntimeProcess extends Implementation {
    private _baseCommand: string[];
    private _shell: string;


    constructor(iri, positionParameters: PositionParameter[], propertyParameters: PropertyParameter[], outputs: Output[],
                positionPropertyParameters: PositionPropertyParameter[],
                baseCommand: string[],
                shell: string
                ) {
        super(iri, positionParameters, propertyParameters, outputs, positionPropertyParameters);
        this._baseCommand = baseCommand;
        this._shell = shell;
    }

    private buildCommand(args?: any): string {
        const positionPropertyParameterValuePairs = this.positionPropertyParameters
            .filter(p => Object.keys(args).includes(p.iri)) // don't process parameters that are not in execution args
            .map(p => [
                p.property, args[p.iri]
            ].join(' '))
        const positionParameterValues = this.positionParameters
            .filter(p => Object.keys(args).includes(p.iri)) // don't process parameters that are not in execution args
            .map(p => args[p.iri])
        const propertyParameterValuePairs = this.propertyParameters
            .filter(p => Object.keys(args).includes(p.iri)) // don't process parameters that are not in execution args
            .map(p => [
                p.property, args[p.iri]
            ].join(' '))

        // Build command
        // <baseCommand> [positionPropertyParameter, ...] [propertyParameter, ...] [positionParameter, ...]
        const cmd_suffix =
            [positionPropertyParameterValuePairs, propertyParameterValuePairs, positionParameterValues]
                .flat()
                .map(x => x.trim())
                .join(' ');


        const cmd = `${this.baseCommand} ${cmd_suffix}`

        return cmd;
    }

    async execute(args?: any): Promise<any> {
        const cmd = this.buildCommand(args);
        const options = { shell: this.shell }
        const execPromise = new Promise((resolve, reject) => {
            exec(cmd, options, (error, stdout, stderr) => {
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


    get baseCommand(): string[] {
        return this._baseCommand;
    }

    get shell(): string {
        return this._shell;
    }
}
