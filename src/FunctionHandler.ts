import { Composition, Function, Implementation, Mapping, Predicate } from './models';
import {GraphHandler, LocalValue} from './GraphHandler';
import { ArgumentMap, ReturnMap } from './handlers/Handler';
import * as $rdf from 'rdflib';
import { flat as flatten, resolve } from 'node-resolve-dependency-graph/lib';

import {namespaces, prefixes} from './prefixes';
import { Term } from 'rdf-js';
import { ImplementationHandler } from './handlers/ImplementationHandler';
import {JavaScriptHandler} from "./handlers/JavaScriptHandler";
import {
  JavaScriptExpression,
  JavaScriptFunction,
  Output,
  PositionParameter, PositionPropertyParameter,
  PropertyParameter,
  RuntimeProcess
} from "./models/Implementation";
import { Statement} from "rdflib";

import {RuntimeProcessHandler} from "./handlers/RuntimeProcessHandler";
import {NamedNode} from "rdflib/lib/tf-types";
import {JavaScriptExpressionHandler} from "./handlers/JavaScriptExpressionHandler";


type DependencyInputs = {
  type: "inputs",
}

type DependencyOutputs = {
  type: "outputs",
}

type DependencyFunction = {
  type: "function",
  fn: Function
  inputs: {
    [predicate: string]: string[]
  },
  outputs: {
    [predicate: string]: string[]
  }
}
export type ImplementationRecord = Record<string, Implementation>;

export class FunctionHandler {
  graphHandler: GraphHandler;
  implementationHandler: ImplementationHandler;

  constructor() {
    this.graphHandler = new GraphHandler();
    this.implementationHandler = new ImplementationHandler();
  }

  async addFunctionResource(iri: string, localValue: LocalValue | null = null, loadImplementations = true) {
    await this.graphHandler.addGraph(iri, localValue);
    if (loadImplementations)
      this.dynamicallyLoadImplementations();
  }

  async getFunction(iri: string): Promise<Function> {
    const term = this.graphHandler.getSubjectOfType(iri, `${prefixes.fno}Function`);
    if (!term) {
      throw new Error(`Cannot find function for iri: ${iri}`)
    }
    return new Function(term);
  }

  /** Example
   * fns:sumImplementation rdf:type fno:Implementation, fnoi:JavaScriptImplementation, fnoi:JavaScriptFunction ;
   *         doap:release fns:sumImplementationRelease .
   *
   * fns:sumImplementationRelease doap:file-release fns:sumImplementationReleaseFile .
   *
   * fns:sumImplementationReleaseFile ex:value " function sum(a, b) {   return a + b; } " .
   * @param s: subject of the fnoi:Implementation resource
   * @param gh: GraphHandler
   */
  parseJavaScriptFunctionImplementation(s: any, gh: GraphHandler): CallableFunction|null {
    let jsFunction: CallableFunction | null = null
    try {
      const [implementationReleaseFileResource,] = gh.match(s,$rdf.sym(`${prefixes.doap}release`),null)
      if(!implementationReleaseFileResource)
        // No implementation present in the functiongraph
        return null;
      const [doapReleaseFile, ] = gh.match(implementationReleaseFileResource.object, null, null);
      const [jsCodeResource, ] = gh.match(doapReleaseFile.object, $rdf.sym(`${prefixes.ex}value`),null);
      // Note: using eval() to load the plaintext function is dangerous! TODO: better approach for loading in plain text functions
      // ref: https://developer.mozilla.org/en-US/docs/web/javascript/reference/global_objects/eval#eval_as_a_string_defining_function_requires_and_as_prefix_and_suffix
      const plainTextJS = jsCodeResource.object.value;
      jsFunction = eval(`(${plainTextJS})`);
    }
    catch (error) {
      console.warn('Error while parsing JS Implementation: ' + error)
    }
    return jsFunction
  }

  parseJavaScriptExpressionImplementationv1(s: any, gh: GraphHandler): CallableFunction|null {
    let jsFunction: CallableFunction | null = null
    try {
      const [implementationReleaseFileResource,] = gh.match(s,$rdf.sym(`${prefixes.doap}release`),null)
      if(!implementationReleaseFileResource)
          // No implementation present in the functiongraph
        return null;

      const { doap, ex } = namespaces;
      const [dfr,] = gh.filter.sp(implementationReleaseFileResource.object, doap('file-release'))
      const [expressionResource,] = gh.filter.sp(dfr.object, ex('value'))
      const expressionValue = expressionResource.object.value
      // Note: using eval() to load the plaintext function is dangerous! TODO: better approach for loading in plain text functions
      // ref: https://developer.mozilla.org/en-US/docs/web/javascript/reference/global_objects/eval#eval_as_a_string_defining_function_requires_and_as_prefix_and_suffix
      jsFunction = eval(`(${expressionValue})`);
    }
    catch (error) {
      console.warn('Error while parsing JS Implementation: ' + error)
    }
    return jsFunction
  }

  /**
   * Parses implementation description into a JavaScriptExpression
   * @param s: implementation resource
   * @param gh: GraphHandler
   */
  parseJavaScriptExpressionImplementation(s: any, gh: GraphHandler): JavaScriptExpression {
    const [mapping,] = gh.match(null,$rdf.sym(`${prefixes.fno}implementation`),s);
    const parameterMappings = gh.filter.sp(mapping.subject, $rdf.sym(`${prefixes.fno}parameterMapping`)).map(st=>st.object)
    const returnMappings = gh.match(mapping.subject,$rdf.sym(`${prefixes.fno}returnMapping`),null).map(st=>st.object)

    // JSExpression specific
    const [implementationReleaseFileResource,] = gh.match(s,$rdf.sym(`${prefixes.doap}release`),null)
    const { doap, ex } = namespaces;
    const [dfr,] = gh.filter.sp(implementationReleaseFileResource.object, doap('file-release'))
    const [expressionResource,] = gh.filter.sp(dfr.object, ex('value'))
    const expression = expressionResource.object.value

    // Position Parameter Mappings
    const positionParameterMappings = parameterMappings.filter(pm =>
        gh.match(pm,$rdf.sym(`${prefixes.rdf}type`),$rdf.sym(`${prefixes.fnom}PositionParameterMapping`))
            .length > 0
    )

    const positionParameters: PositionParameter[] = positionParameterMappings.map(ppm => {
      const [position] = gh.match(ppm,$rdf.sym(`${prefixes.fnom}implementationParameterPosition`),null).map(st=>st.object).map(o=>o.value);
      const [functionParameter] = gh.match(ppm,$rdf.sym(`${prefixes.fnom}functionParameter`),null).map(st=>st.object).map(o=>o.value);

      return {
        iri: functionParameter,
        position,
        _type: "TODO" // TODO: add fno:type
      }
    })

    // Property Parameter Mappings
    const propertyParameterMappings = gh.filter.po(
        $rdf.sym(`${prefixes.rdf}type`),
        $rdf.sym(`${prefixes.fnom}PropertyParameterMapping`)
    )

    // Property Parameters
    const propertyParameters: PropertyParameter[] = propertyParameterMappings.map(ppm => {
      const [property] = gh.filter.sp(ppm.subject, $rdf.sym(`${prefixes.fnom}implementationProperty`)).map(st => st.object).map(o => o.value)
      const [functionParameter] = gh.filter.sp(ppm.subject, $rdf.sym(`${prefixes.fnom}functionParameter`))
          .map(st => st.object).map(o => o.value)
      const [predicate] = gh.filter.sp($rdf.sym(functionParameter), $rdf.sym(`${prefixes.fno}predicate`))
          .map(st => st.object)
          .map(o => o.value)

      return {
        iri: predicate,
        property,
        _type: "TODO" // TODO: add fno:type
      }
    })

    // Outputs
    const outputs: Output[] = returnMappings.map(rm => {
      const [functionOutput] = gh.match(rm,$rdf.sym(`${prefixes.fnom}functionOutput`),null).map(st=>st.object).map(o=>o.value);
      const [predicate] = gh.filter.sp($rdf.sym(functionOutput), $rdf.sym(`${prefixes.fno}predicate`)).map(st => st.object).map(o=>o.value);

      // TODO: add fno:type
      return {
        iri: predicate,
        _type: "TODO" // TODO: add fno:type
      }
    })

    // Create (executable) JSExpression instance
    const jsExpressionInstance = new JavaScriptExpression(
        s.value,
        positionParameters,
        propertyParameters,
        outputs,
        [],
        expression
    )
    return jsExpressionInstance
  }


  createImplementationCallable(imp: Implementation): CallableFunction|null {
    if (
        imp instanceof RuntimeProcess
        || imp instanceof JavaScriptExpression
    )
      return (args?) => imp.execute(args)
    if(imp instanceof JavaScriptFunction)
      throw Error('Not Yet Implemented')

    return null;
  }

  /**
   * Parses implementation description into a RuntimeProcess
   * @param s: implementation resource
   * @param gh: GraphHandler
   */
  parseRuntimeProcessImplementation(s: any, gh: GraphHandler): RuntimeProcess {

    const fno_implementation = $rdf.sym(`${prefixes.fno}implementation`)
    const fno_parameterMapping = $rdf.sym(`${prefixes.fno}parameterMapping`)
    const fnom_PositionParameterMapping = $rdf.sym(`${prefixes.fnom}PositionParameterMapping`);
    const fnom_PropertyParameterMapping = $rdf.sym(`${prefixes.fnom}PropertyParameterMapping`);
    const rdf_type = $rdf.sym(`${prefixes.rdf}type`);


    const mappings = gh.filter.po(fno_implementation, s)
    const [m] = mappings;
    const m_parameterMappings = gh.filter.sp(m.subject, fno_parameterMapping).map(st=>st.object)
    // Filter out PositionPropertyParameterMappings
    const m_positionPropertyParameterMappings = m_parameterMappings.filter( x => {
      const A = gh.filter.spo(x,rdf_type, fnom_PositionParameterMapping);
      const B = gh.filter.spo(x,rdf_type, fnom_PropertyParameterMapping);
      return (A.length === 1) && (B.length === 1)
    })
    // Filter out PositionParameterMappings
    const m_positionParameterMappings = m_parameterMappings
        .filter((mpm) => !m_positionPropertyParameterMappings.includes(mpm)) // exclude PositionPropertyParameterMappings
        .filter((mpm)=>
        gh.filter.spo(
            mpm,
            rdf_type,
            fnom_PositionParameterMapping).length === 1
    )
    // Filter out PropertyParameterMappings
    const m_propertyParameterMappings = m_parameterMappings
        .filter((mpm) => !m_positionPropertyParameterMappings.includes(mpm)) // exclude PositionPropertyParameterMappings
        .filter((mpm)=>
        gh.filter.spo(
            mpm,
            rdf_type,
            fnom_PropertyParameterMapping).length === 1
    )

    if( (m_positionParameterMappings.length
        + m_propertyParameterMappings.length
        + m_positionPropertyParameterMappings.length) !== m_parameterMappings.length )
      throw Error('ParameterMappings are not correctly processed')

    const [mapping,] = gh.match(null,$rdf.sym(`${prefixes.fno}implementation`),s);
    const returnMappings = gh.match(mapping.subject,$rdf.sym(`${prefixes.fno}returnMapping`),null).map(st=>st.object)
    const [baseCommand, ] = gh.match(s,$rdf.sym(`${prefixes.fnoi}baseCommand`),null).map(st => st.object.value)
    const [shell, ] = gh.match(s,$rdf.sym(`${prefixes.fnoi}shell`),null).map(st => st.object.value)

    // Position Parameter Mappings
    const positionParameters: PositionParameter[] = m_positionParameterMappings.map(ppm => {
      const [position] = gh.match(ppm,$rdf.sym(`${prefixes.fnom}implementationParameterPosition`),null).map(st=>st.object).map(o=>o.value);
      const [functionParameter] = gh.match(ppm,$rdf.sym(`${prefixes.fnom}functionParameter`),null).map(st=>st.object).map(o=>o.value);
      const [predicate] = gh.filter.sp($rdf.sym(functionParameter), $rdf.sym(`${prefixes.fno}predicate`)).map(st => st.object).map(o=>o.value);
      return {
        iri: predicate,
        position,
        _type: "TODO" // TODO: add fno:type
      }
    })

    // Property Parameters
    const propertyParameters: PropertyParameter[] = m_propertyParameterMappings.map(ppm => {
      const [property] = gh.filter.sp(ppm.subject, $rdf.sym(`${prefixes.fnom}implementationProperty`)).map(st => st.object).map(o => o.value)

      const [functionParameter] = gh.filter.sp(ppm.subject, $rdf.sym(`${prefixes.fnom}functionParameter`)).map(st => st.object).map(o => o.value)
      const [predicate] = gh.filter.sp($rdf.sym(functionParameter), $rdf.sym(`${prefixes.fno}predicate`)).map(st => st.object).map(o=>o.value);

      // TODO: add fno:type
      return {
        iri: predicate,
        property,
        _type: "TODO" // TODO: add fno:type
      }
    })

    // PositionProperty Parameters
    const positionPropertyParameters: PositionPropertyParameter[] = m_positionPropertyParameterMappings.map(ppm => {
      const [property] = gh.filter.sp(ppm.subject, $rdf.sym(`${prefixes.fnom}implementationProperty`)).map(st => st.object).map(o => o.value)
      const [position] = gh.match(ppm,$rdf.sym(`${prefixes.fnom}implementationParameterPosition`),null).map(st=>st.object).map(o=>o.value);

      const [functionParameter] = gh.filter.sp(ppm.subject, $rdf.sym(`${prefixes.fnom}functionParameter`)).map(st => st.object).map(o => o.value)
      const [predicate] = gh.filter.sp($rdf.sym(functionParameter), $rdf.sym(`${prefixes.fno}predicate`)).map(st => st.object).map(o=>o.value);

      // TODO: add fno:type
      return {
        iri: predicate,
        position,
        property,
        _type: "TODO" // TODO: add fno:type
      }
    })

    // Outputs
    const outputs: Output[] = returnMappings.map(rm => {
      const [functionOutput] = gh.match(rm,$rdf.sym(`${prefixes.fnom}functionOutput`),null).map(st=>st.object).map(o=>o.value);
      const [predicate] = gh.filter.sp($rdf.sym(functionOutput), $rdf.sym(`${prefixes.fno}predicate`)).map(st => st.object).map(o=>o.value);

      // TODO: add fno:type
      return {
        iri: predicate,
        _type: "TODO" // TODO: add fno:type
      }
    })

    // Create (executable) RTP instance
    const rtpInstance = new RuntimeProcess(s.value,
        positionParameters,
        propertyParameters,
        outputs,
        positionPropertyParameters,
        [baseCommand],
        shell
        )
    return rtpInstance
  }

  dynamicallyLoadImplementations() {

    // "Factory", containing a parser and handler class for each FnO Implementation subclass
    const implementationFactory = {
      JavaScriptFunction: {
        parser: this.parseJavaScriptFunctionImplementation,
        handlerClass: JavaScriptHandler
      },
      JavaScriptExpression: {
        parser: (s: any, gh: GraphHandler) => this.createImplementationCallable(this.parseJavaScriptExpressionImplementation(s, gh)),
        handlerClass: JavaScriptExpressionHandler
      },
      RuntimeProcess: {
        parser: (s: any, gh: GraphHandler) => this.createImplementationCallable(this.parseRuntimeProcessImplementation(s, gh)),
        handlerClass: RuntimeProcessHandler
      }
    }
    /**
     * Filters function graph for given Implementation class
     * @param ic: Implementation classname (e.g. JavaScriptFunction, RuntimeProcess, etc.)
     */
    const filterImplementationResources = (ic: string) =>
        this.graphHandler.match(null,$rdf.sym(`${prefixes.rdf}type`),$rdf.sym(`${prefixes.fnoi}${ic}`));

    /**
     * Extract subject property from given statement
     * @param s
     */
    const extractSubjectFromStatement = (s: Statement) => s.subject;

    // Load implementations into the implementation handler.
    Object.keys(implementationFactory)
        // For each implementation class (e.g. JavaScriptFunction, RuntimeProcess, etc.)
      .forEach((ic)=>{
        // Get the resource parser and handler for the current implementation class
        const  {parser, handlerClass} = implementationFactory[ic];
        // Filter the implementation resources for the current implementation class
        filterImplementationResources(ic)
            // Extract the subject term
            .map(extractSubjectFromStatement)
            .forEach(ir => {
              // Parse the implementation
              const irCallable = parser(ir,this.graphHandler);
              // Initialize the handler that will execute the parsed implementation
              const handler = new handlerClass();
              if(irCallable) {
                // If the implementation is successfully parsed, load it into the implementation handler
                this.implementationHandler.loadImplementation(
                    ir.value,
                    handler,
                    {fn: irCallable}
                )
              }
            });
      })
  }

  async executeFunction(fn: Function, args: ArgumentMap) {
    let handler: Composition | null = this.getImplementationViaMappings(fn);
    if (handler) {
      return this.implementationHandler.executeImplementation(handler.id, args);
    }
    handler = this.getHandlerViaCompositions(fn);
    if (handler) {
      return this.implementationHandler.executeImplementation(handler.id, args);
    }

    throw new Error(`Could not find any relevant implementation or composition to execute ${fn.id}`);
  }

  private linkMappedImplementations(fn: Function) {
    const mappings: Mapping[] = this.getMappingsFromFunction(fn);
    if (mappings.length === 0) {
      console.warn(`Could not find any relevant mapping for function ${fn.id}`);
    }
    const loaded = {};
    for (const mapping of mappings) {
      const implementations = this.getImplementationsFromMapping(mapping);
      const loadedImplementations = implementations.filter((implementation) => {
        const implementationLinked = this.implementationHandler.linkImplementationToFunction(implementation.id, fn.id);
        const optionsAreSet = this.implementationHandler.setOptions(implementation.id, {
          args: this.getArgsFromMapping(mapping),
          returns: this.getReturnsFromMapping(mapping),
        });
        return implementationLinked && optionsAreSet;
      });
      if (loadedImplementations.length > 0) {
        loaded[mapping.id] = {
          mapping,
          loadedImplementations,
        };
      }
    }
    return loaded;
  }

  private getImplementationViaMappings(fn: Function): Implementation | null {
    const mappedImplementations = this.linkMappedImplementations(fn);
    if (Object.keys(mappedImplementations).length === 0) {
      console.warn(`Could not find any relevant mapping for function ${fn.id}`);
    }
    for (const mappingId in mappedImplementations) {
      return mappedImplementations[mappingId].loadedImplementations[0];
    }
    return null;
  }

  getHandlerViaCompositions(fn: Function): Composition | null {
    const compositions: Composition[] = this.getCompositionsFromFunction(fn);
    if (compositions.length === 0) {
      console.warn(`Could not find any relevant composition for function ${fn.id}`);
    }
    for (const composition of compositions) {
      if (this.tryToLoadComposition(composition)) {
        return composition;
      }
    }
    return null;
  }

  private getObjects(subject, predicate) {
    return this.graphHandler.match(subject, predicate, null).map(s => s.object);
  }

  private getSingleObject(subject, predicate) {
    const objects = this.getObjects(subject, predicate);
    if (objects.length === 0) {
      throw Error(`Subject ${subject.value} without ${predicate.value} defined!`);
    }
    if (objects.length > 1) {
      console.warn(`Too many objects for ${predicate.value} found for ${subject.value}, just picking one at random`);
    }
    return objects[0];
  }

  private exists(subject, predicate, object) {
    return this.graphHandler.match(subject, predicate, object).length > 0;
  }

  private getMappingsFromFunction(fn: Function) {
    const mappings = this.graphHandler.match(null, $rdf.sym(`${prefixes.fno}function`), fn.term);
    if (mappings.length === 0) {
      return [];
    }
    return mappings.map(m => new Mapping(m.subject));
  }

  private getImplementationsFromMapping(mapping: Mapping): Implementation[] {
    const implementations = this.getObjects(mapping.term, $rdf.sym(`${prefixes.fno}implementation`));
    if (implementations.length === 0) {
      return [];
    }
    return implementations.map(o => new Implementation(o));
  }

  private getArgsFromMapping(mapping: Mapping): ArgumentMap {
    const parameterMappings = this.getObjects(mapping.term, $rdf.sym(`${prefixes.fno}parameterMapping`));
    const positionArgs = {};
    const propertyArgs = {};

    parameterMappings.forEach((pMapping) => {
      let parameter = this.getObjects(pMapping, $rdf.sym(`${prefixes.fnom}functionParameter`));
      if (parameter.length === 0) {
        console.warn(`Could not find parameter assigned to ${pMapping.value}`);
        return;
      }
      if (parameter.length > 1) {
        throw Error(`An FnO ParameterMapping can be linked to only 1 parameter (${pMapping.value} has ${parameter.length})!`)
      }
      parameter = parameter[0];
      let type = this.getObjects(parameter, $rdf.sym(`${prefixes.fno}type`));
      const predicate = this.getSingleObject(parameter, $rdf.sym(`${prefixes.fno}predicate`));
      if (type.length === 0) {
        console.warn(`No type information for parameter ${parameter.value} found`);
      }
      if (type.length > 1) {
        console.warn(`More types for ${parameter.value} than expected (1). Picking one at random.`);
      }
      type = type[0] || null;

      // Process Property Parameters
      if (this.graphHandler.isA(pMapping, namespaces.fnom('PropertyParameterMapping'))){
        const properties = this.graphHandler.filter.sp(pMapping, namespaces.fnom('implementationProperty'))
            .map((st: Statement) => st.object)
            .map((o) => o.value);
        properties.forEach((property)=>{
          addToResult(propertyArgs, property, predicate.value, type);
        })

        // throw new Error('Unsupported if not positionparametermapping');

      }

      // Process Position Parameters
      if (this.graphHandler.match(pMapping, $rdf.sym(`${prefixes.rdf}type`), $rdf.sym(`${prefixes.fnom}PositionParameterMapping`)).length > 0) {
        const positions = this.getObjects(pMapping, $rdf.sym(`${prefixes.fnom}implementationParameterPosition`)).map(o => o.value);
        positions.forEach((position) => {
          addToResult(positionArgs, position, predicate.value, type);
        });
      }
    });

    return {
      positionArgs,
      propertyArgs
    };

    function addToResult(result, key, value, type) {
      if (type?.value === `${prefixes.rdf}List`) {
        if (!result[key]) {
          result[key] = [];
        }
        result[key].push(value);
      } else {
        if (!result[key]) {
          result[key] = value;
        } else {
          console.warn(`Multiple values found for argument ${key}. Keeping a random one.`);
        }
      }
    }
  }

  private getReturnsFromMapping(mapping: Mapping): ReturnMap {
    const result = {};
    const returnMappings = this.getObjects(mapping.term, $rdf.sym(`${prefixes.fno}returnMapping`));
    returnMappings.forEach((rMapping) => {
      let output = this.getObjects(rMapping, $rdf.sym(`${prefixes.fnom}functionOutput`));
      if (output.length === 0) {
        console.warn(`Could not find output assigned to ${rMapping.value}`);
        return;
      }
      if (output.length > 1) {
        console.warn(`More outputs for ${rMapping.value} than expected (1).
         Picking one at random.`);
      }
      output = output[0];
      let predicate = this.getObjects(output, $rdf.sym(`${prefixes.fno}predicate`));
      if (predicate.length === 0) {
        console.warn(`Could not find predicate of ${output.value}`);
        return;
      }
      if (output.length > 1) {
        console.warn(`More predicates for ${output.value} than expected (1).
         Picking one at random.`);
      }
      predicate = predicate[0];

      let type = this.getObjects(output, $rdf.sym(`${prefixes.fno}type`));
      if (type.length === 0) {
        console.warn(`No type information for parameter ${output.value} found`);
      }
      if (type.length > 1) {
        console.warn(`More types for ${output.value} than expected (1). Picking one at random.`);
      }
      type = type[0] || null;
      if (this.graphHandler.match(rMapping, $rdf.sym(`${prefixes.rdf}type`), $rdf.sym(`${prefixes.fnom}DefaultReturnMapping`)).length > 0) {
        addToResult('_default', predicate.value, type);
      } else {
        throw new Error('Unsupported if not defaultReturnMapping');
      }
    });

    return result;

    function addToResult(key, value, type) {
      if (type?.value === `${prefixes.rdf}List`) {
        if (!result[key]) {
          result[key] = [];
        }
        result[key].push(value);
      } else {
        if (!result[key]) {
          result[key] = value;
        } else {
          console.warn(`Multiple values found for argument ${key}. Keeping a random one.`);
        }
      }
    }
  }

  private getCompositionsFromFunction(fn: Function): Composition[] {
    const outputArray = this.getSingleObject(fn.term, $rdf.sym(`${prefixes.fno}returns`)).elements;
    const outHash = outputArray.map(o => o.value).sort().join('_');
    return this.graphHandler.match(null, $rdf.sym(`${prefixes.rdf}type`), $rdf.sym(`${prefixes.fnoc}Composition`)).map(s => s.subject).filter((composition) => {
      const outputs: Term[] = [];
      this.getObjects(composition, $rdf.sym(`${prefixes.fnoc}composedOf`)).forEach((compositionMapping) => {
        const mapTos = this.getSingleObject(compositionMapping,
          $rdf.sym(`${prefixes.fnoc}mapTo`));
        if (this.exists(mapTos,
          $rdf.sym(`${prefixes.fnoc}constituentFunction`), fn.term)) {
          outputs.push(this.getSingleObject(mapTos,
            $rdf.sym(`${prefixes.fnoc}functionOutput`)));
        }
      });
      return outputs.map(o => o.value).sort().join('_') === outHash;
    }).map(c => new Composition(c));
  }

  private tryToLoadComposition(composition: Composition) {
    const addFullFunctionToDependency = (compositionMap: Term, composedOfTerm: Term) => {
      const fn = this.getSingleObject(compositionMap,
        $rdf.sym(`${prefixes.fnoc}constituentFunction`));
      let rootFn = fn;
      try {
        rootFn = this.getSingleObject(fn, $rdf.sym(`${prefixes.fnoc}applies`));
      } catch (e) {
        // no problem
      }
      tryAddFunctionToDependency(fn, rootFn);
      try {
        const param = this.getSingleObject(compositionMap,
          $rdf.sym(`${prefixes.fnoc}functionParameter`));
        const predicate = this.getSingleObject(param, $rdf.sym(`${prefixes.fno}predicate`));
        addFunctionParameterToDependency(dependencyMeta[fn.value] as DependencyFunction, predicate, composedOfTerm);
        return `${fn.value}_inputs`;
      } catch (e) {
        // no problem
      }
      try {
        const output = this.getSingleObject(compositionMap,
          $rdf.sym(`${prefixes.fnoc}functionOutput`));
        const predicate = this.getSingleObject(output, $rdf.sym(`${prefixes.fno}predicate`));
        addFunctionOutputToDependency(dependencyMeta[fn.value] as DependencyFunction, predicate, composedOfTerm);
        return `${fn.value}_outputs`;
      } catch (e) {
        // no problem
      }
      return fn.value;
    };
    const composedOfValueMap = {};
    const dependencyMeta: {
      [key: string]: DependencyInputs | DependencyOutputs | DependencyFunction
    } = {};
    const dependencyMap = {};
    const composedOfTerms = this.getObjects(composition.term,
      $rdf.sym(`${prefixes.fnoc}composedOf`));
    composedOfTerms.forEach((composedOfTerm) => {
      // - make composedOfMap
      // composedOf1: a
      // composedOf2: b
      // composedOf3: null
      // composedOf4: c
      // composedOf5: null
      composedOfValueMap[composedOfTerm.value] = null;
      // sum31:
      //   inputs:
      //     a: [composedOf1]
      //     b: [composedOf2]
      //   outputs:
      //     o: [composedOf3]
      // sum32:
      //   inputs:
      //     a: [composedOf3]
      //     b: [composedOf4]
      //   outputs:
      //     o: [composedOf5]
      const mapFrom = this.getSingleObject(composedOfTerm,
        $rdf.sym(`${prefixes.fnoc}mapFrom`));
      // - make functionMaps for all functions
      const depFrom = addFullFunctionToDependency(mapFrom, composedOfTerm);
      const mapTo = this.getSingleObject(composedOfTerm, $rdf.sym(`${prefixes.fnoc}mapTo`));
      const depTo = addFullFunctionToDependency(mapTo, composedOfTerm);
      // - make full dependency graph
      // let dependencyMap = {
      //     sum3i: [],
      //     sum3: ['sum3i'],
      //     sum3o: ['sum3', 'sum32o'],
      //     sum31i: ['sum3i'],
      //     sum31: ['sum31i'],
      //     sum31o: ['sum31'],
      //     sum32i: ['sum31o', 'sum3i'],
      //     sum32: ['sum32i'],
      //     sum32o: ['sum32'],
      // }
      dependencyMap[depTo].push(depFrom);
    });
    const dependencyList = flatten(resolve(dependencyMap));
    // - first and last must refer to same function === composed function
    const compositionFn = dependencyList[0].slice(0, -7);
    if (dependencyList[0].slice(0, -7) !== dependencyList[dependencyList.length - 1].slice(0, -8)) {
      throw new Error(`No unique composed function detected: found ${dependencyList[0]} and ${dependencyList[dependencyList.length - 1]}`);
    }
    if (this.implementationHandler.hasImplementation(compositionFn)) {
      return true;
    }

    const otherFn = dependencyList.filter(resolvedId => dependencyMeta[resolvedId].type === 'function' && resolvedId !== compositionFn);
    for (const fnId of otherFn) {
      const mappedImplementations = this.linkMappedImplementations((dependencyMeta[fnId] as DependencyFunction).fn);
      if (Object.keys(mappedImplementations).length === 0) {
        console.warn(`Couldn't link implementation of ${(dependencyMeta[fnId] as DependencyFunction).fn.id}`);
        return false;
      }
    }
    const implementationOptions = {
      compositionFn,
      composedOfValueMap,
      dependencyMeta,
      dependencyList,
      implementationHandler: this.implementationHandler,
    };
    this.implementationHandler.loadComposition(composition.id, implementationOptions);

    return true;

    function addFunctionParameterToDependency(dependencyFunction: DependencyFunction, predicate: Term, composedOf: Term) {
      if (!dependencyFunction.inputs[predicate.value]) {
        dependencyFunction.inputs[predicate.value] = [];
      }
      dependencyFunction.inputs[predicate.value].push(composedOf.value);
    }

    function addFunctionOutputToDependency(dependencyFunction: DependencyFunction, predicate: Term, composedOf: Term,) {
      if (!dependencyFunction.outputs[predicate.value]) {
        dependencyFunction.outputs[predicate.value] = [];
      }
      dependencyFunction.outputs[predicate.value].push(composedOf.value);
    }

    function tryAddFunctionToDependency(fn: Term, rootFn: Term) {
      if (!dependencyMap[fn.value]) {
        dependencyMap[`${fn.value}_inputs`] = [];
        dependencyMeta[`${fn.value}_inputs`] = {
          type: 'inputs',
        };
        dependencyMap[fn.value] = [`${fn.value}_inputs`];
        dependencyMeta[fn.value] = {
          type: 'function',
          fn: new Function(rootFn),
          inputs: {},
          outputs: {},
        };
        dependencyMap[`${fn.value}_outputs`] = [fn.value];
        dependencyMeta[`${fn.value}_outputs`] = {
          type: 'outputs',
        };
      }
    }
  }
}
