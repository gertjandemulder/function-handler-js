import { expect } from 'chai';
import { FunctionHandler } from './FunctionHandler';
import { } from 'mocha';
import { JavaScriptHandler } from './handlers/JavaScriptHandler';
import {prefixes} from './prefixes';
import * as fs from 'fs';
import * as path from 'path';
import { RuntimeProcessHandler } from './handlers/RuntimeProcessHandler';
import exp from "constants";
import * as $rdf from 'rdflib';
import {
  JavaScriptExpression,
  PositionParameter,
  PositionPropertyParameter,
  PropertyParameter,
  RuntimeProcess
} from "./models/Implementation";
import {JavaScriptExpressionHandler} from "./handlers/JavaScriptExpressionHandler";
function readFile(path) {
  return fs.readFileSync(path, { encoding: 'utf-8' });
}

function writeFile(path, data) {
  return fs.writeFileSync(path, data,{ encoding: 'utf-8' });
}

function prefix(...args) {
  return args.join('');
}

const dirResources = path.resolve(__dirname, '../resources/fno-cwl');
const basenameConcreteWorkflowCWL = 'cwl2fno-expected-result-concrete-wf'
const basenameConcreteWorkflowTurtle = `${basenameConcreteWorkflowCWL}.ttl`

const ns = {
  gdm: "http://gddmulde.be#",
  wf: "http://gddmulde.be/concrete-wf.cwl#",
  t_echo: "http://gddmulde.be/echo.cwl#",
  t_uc: "http://gddmulde.be/uppercase.cwl#",
  t_ls: "http://gddmulde.be/commands/unix/ls#"
}

const testPositionParameter = (positionParameters: PositionParameter[], expectedParameterValue: PositionParameter) => {
  expect(positionParameters.map(p => p.iri)).to.contain(expectedParameterValue.iri);
  expect(positionParameters.filter(p=>p.iri===expectedParameterValue.iri)[0].position).to.equal(expectedParameterValue.position.toString());
  expect(positionParameters.filter(p=>p.iri===expectedParameterValue.iri)[0]._type).to.equal(expectedParameterValue._type);
}

const testPropertyParameter = (propertyParameters: PropertyParameter[], expectedParameterValue: PropertyParameter) => {
  expect(propertyParameters.map(p => p.iri)).to.contain(expectedParameterValue.iri);
  expect(propertyParameters.filter(p=>p.iri===expectedParameterValue.iri)[0].property).to.equal(expectedParameterValue.property);
  expect(propertyParameters.filter(p=>p.iri===expectedParameterValue.iri)[0]._type).to.equal(expectedParameterValue._type);
}

const testPositionPropertyParameter = (positionPropertyParameters: PositionPropertyParameter[], expectedParameterValue: PositionPropertyParameter) => {
  expect(positionPropertyParameters.map(p => p.iri)).to.contain(expectedParameterValue.iri);
  expect(positionPropertyParameters.filter(p=>p.iri===expectedParameterValue.iri)[0].position).to.equal(expectedParameterValue.position.toString());
  expect(positionPropertyParameters.filter(p=>p.iri===expectedParameterValue.iri)[0].property).to.equal(expectedParameterValue.property.toString());
  expect(positionPropertyParameters.filter(p=>p.iri===expectedParameterValue.iri)[0]._type).to.equal(expectedParameterValue._type);
}

describe('RuntimeProcess: lsl.fno.ttl', function () {
  let handler;
  before(async ()=>{
    handler = new FunctionHandler();
    // Load FnO descriptions
    const iriFunctionGraph = prefix(ns.gdm, 'commandGraph');
    await handler.addFunctionResource(
        iriFunctionGraph,
        {
          type: 'string',
          contents: readFile(path.resolve(dirResources, 'commands', 'lsl.fno.ttl')),
          contentType: 'text/turtle'
        },
        false
    );
  })
  it('Correctly parses a RuntimeProcess',async ()=>{

    const [imp] = handler.graphHandler.filter.s($rdf.sym(`${ns.t_ls}Implementation`))
    // Parse implementation into a RuntimeProcess
    const rtp: RuntimeProcess = handler.parseRuntimeProcessImplementation(imp.subject, handler.graphHandler);

    // Expected: t_ls:pathParameter - position: 0
    const expectedPathParameter: PositionParameter = {
      iri: `${ns.t_ls}path`,
      position: 0,
      _type: "TODO" // TODO!
    }

    // Expected: t_ls:sizeOptionParameter - property: -s
    const expectedSizeOptionParameter : PropertyParameter = {
      iri: `${ns.t_ls}sizeOption`,
      property: "-s",
      _type: "TODO" // TODO: fns:option
    }

    // Tests
    expect(rtp.positionParameters).to.have.length(1);
    expect(rtp.propertyParameters).to.have.length(1);
    testPositionParameter(rtp.positionParameters, expectedPathParameter);
    testPropertyParameter(rtp.propertyParameters, expectedSizeOptionParameter);
  });

  it('Correctly executes RuntimeProcess',async ()=>{

    handler.dynamicallyLoadImplementations();
    const [imp] = handler.graphHandler.filter.s($rdf.sym(`${ns.t_ls}Implementation`))
    // Parse implementation into a RuntimeProcess
    const rtp: RuntimeProcess = handler.parseRuntimeProcessImplementation(imp.subject, handler.graphHandler);

    // Expected: t_ls:pathParameter - position: 0
    const expectedPathParameter: PositionParameter = {
      iri: `${ns.t_ls}path`,
      position: 0,
      _type: "TODO" // TODO!
    }

    // Expected: t_ls:sizeOptionParameter - property: -s
    const expectedSizeOptionParameter : PropertyParameter = {
      iri: `${ns.t_ls}sizeOption`,
      property: "-s",
      _type: "TODO" // TODO: fns:option
    }

    // Tests
    expect(rtp.positionParameters).to.have.length(1);
    expect(rtp.propertyParameters).to.have.length(1);
    testPositionParameter(rtp.positionParameters, expectedPathParameter);
    testPropertyParameter(rtp.propertyParameters, expectedSizeOptionParameter);

    // Function resource
    const f = await handler.getFunction(prefix(ns.t_ls, 'Function'));
    expect(f).not.to.be.null;
    expect(f.id).not.to.be.null;

    // Execution
    const argMap = {
      [prefix(ns.t_ls, 'path')]:'./resources/fno-cwl/commands/ls_test_dir',
      [prefix(ns.t_ls, 'sizeOption')]: '',
    }

    //
    const functionOutput = await handler.executeFunction(f, argMap);
    expect(functionOutput).not.to.be.null;
    expect(functionOutput[prefix(ns.t_ls, 'out')]).not.to.be.null;

    expect(functionOutput[prefix(ns.t_ls, 'out')]).to.be.equal(
`total 24
8 a.txt
8 b.txt
8 c.txt
`
    )

  });
})

describe('RuntimeProcess', function () {
  it('Can dynamically load and execute an fnoi:RuntimeProcess (fno-cwl/commands/ls.fno.ttl))',async ()=>{
    const handler = new FunctionHandler();

    // Load FnO descriptions
    const iriFunctionGraph = prefix(ns.gdm, 'commandGraph');
    await handler.addFunctionResource(
        iriFunctionGraph,
        {
          type: 'string',
          contents: readFile(path.resolve(dirResources, 'commands', 'ls.fno.ttl')),
          contentType: 'text/turtle'
        }
    );

    // Function resource
    const f = await handler.getFunction(prefix(ns.t_ls, 'Function'));
    expect(f).not.to.be.null;
    expect(f.id).not.to.be.null;

    // Execution
    const argMap = {
      // TODO: change parameter iri with value for fno:predicate (NOT, the iri of the parameter resource, e.g t_ls:pathParameter)
      [prefix(ns.t_ls, 'path')]:'./resources/fno-cwl/commands/ls_test_dir'
    }

    // Test output
    const functionOutput = await handler.executeFunction(f, argMap);
    expect(functionOutput).not.to.be.null;
    expect(functionOutput[prefix(ns.t_ls, 'out')]).not.to.be.null;
    expect(functionOutput[prefix(ns.t_ls, 'out')]).to.be.equal(
        `a.txt
b.txt
c.txt
`
    )
  });
});



describe('JavaScriptExpressions in cwl2fno-expected-result-concrete-wf.ttl', () => {
  const dirContainerResources = path.resolve(dirResources, 'example01');
  let handler: FunctionHandler;
  before(async ()=>{
    handler = new FunctionHandler();
    // Load FnO descriptions
    const iriFunctionGraph = prefix(ns.gdm, 'commandGraph');
    await handler.addFunctionResource(
        iriFunctionGraph,
        {
          type: 'string',
          contents: readFile(path.resolve(dirContainerResources, 'cwl2fno-expected-result-concrete-wf.ttl')),
          contentType: 'text/turtle'
        },
        false
    );
  })

  it('Correctly parses: uppercase',async () => {
    const [imp] = handler.graphHandler.filter.s($rdf.sym(`${ns.t_uc}JSExpressionImplementation`))
    expect(imp).not.to.be.null;
    expect(imp.subject).not.to.be.null;

    // Parse implementation into a JavaScriptExpression
    const jse: JavaScriptExpression = handler.parseJavaScriptExpressionImplementation(imp.subject, handler.graphHandler);

    // Test parameters
    expect(jse.positionParameters).to.be.empty;
    expect(jse.propertyParameters).to.be.have.length(1)
    expect(jse.positionPropertyParameters).to.be.empty;

    // Test JSE specific members
    expect(jse.expression).to.equal('message.toUpperCase()')

    // Expected: t_uc:message - property: message
    const expectedMessageParameter : PropertyParameter = {
      iri: `${ns.t_uc}message`,
      property: "message",
      _type: "TODO" // TODO: fns:option
    }
    testPropertyParameter(jse.propertyParameters, expectedMessageParameter)
  });

  it('Correctly executes: uppercase',async () => {
    // IRIs
    const iriUppercase = prefix(ns.t_uc, 'Function');
    handler.dynamicallyLoadImplementations();
    // FnO Function objects
    const fUppercase = await handler.getFunction(iriUppercase);
    // Argument values
    const argMap = {
      [prefix(ns.t_uc, 'message')]: 'abc'
    }
    // Execute
    const fnOutput = await handler.executeFunction(fUppercase, argMap);
    // Test output
    expect(fnOutput).not.to.be.null;
    expect(fnOutput[prefix(ns.t_uc, 'uppercase_message')]).not.to.be.null;
    expect(fnOutput[prefix(ns.t_uc, 'uppercase_message')]).to.equal('ABC');
  });
});

describe('RuntimeProcess test (echo): fno-cwl/example01/cwl2fno-expected-result-concrete-wf.ttl', function () {
  let handler;
  before(async ()=>{
    handler = new FunctionHandler();
    // Load FnO descriptions
    const iriFunctionGraph = prefix(ns.gdm, 'commandGraph');
    await handler.addFunctionResource(
        iriFunctionGraph,
        {
          type: 'string',
          contents: readFile(path.resolve(dirResources,'example01', 'cwl2fno-expected-result-concrete-wf.ttl')),
          contentType: 'text/turtle'
        },
        false
    );
  })

  it('Correctly parses: echo -n',async ()=>{

    const [imp] = handler.graphHandler.filter.s($rdf.sym(`${ns.t_echo}Implementation`))
    expect(imp).not.to.be.null;
    expect(imp.subject).not.to.be.null;
    // Parse implementation into a RuntimeProcess
    const rtp: RuntimeProcess = handler.parseRuntimeProcessImplementation(imp.subject, handler.graphHandler);

    // Expected: t_echo:message - position: 0
    const expectedNoTrailingNewLineParameter: PositionPropertyParameter = {
      iri: `${ns.t_echo}noTrailingNewLine`,
      position: 0,
      property: "-n",
      _type: "TODO" // TODO!
    }

    // Expected: t_echo:message - position: 1
    const expectedMessageParameter: PositionParameter = {
      iri: `${ns.t_echo}message`,
      position: 1,
      _type: "TODO" // TODO!
    }

    // Test: Parameters
    expect(rtp.positionParameters).to.have.length(1);
    expect(rtp.propertyParameters).to.have.length(0);
    expect(rtp.positionPropertyParameters).to.have.length(1);
    testPositionParameter(rtp.positionParameters, expectedMessageParameter);
    testPositionPropertyParameter(rtp.positionPropertyParameters, expectedNoTrailingNewLineParameter);

    // Test: RuntimeProcess specific members
    expect(rtp.baseCommand)
        .to.be.an('array')
        .to.contain('echo')
        .to.have.length(1)

    expect(rtp.shell)
        .to.be.a('string')
        .to.equal('/bin/bash')
  });

  it('Correctly executes echo [message]',async ()=>{
    handler.dynamicallyLoadImplementations();
    const [imp] = handler.graphHandler.filter.s($rdf.sym(`${ns.t_echo}Implementation`))
    expect(imp).not.to.be.null;
    expect(imp.subject).not.to.be.null;
    // Parse implementation into a RuntimeProcess
    const rtp: RuntimeProcess = handler.parseRuntimeProcessImplementation(imp.subject, handler.graphHandler);

    // Function resource
    const f = await handler.getFunction(prefix(ns.t_echo, 'Function'));

    // Execution
    const argMap = {
      [prefix(ns.t_echo, 'message')]:'abc',
    }

    //
    const functionOutput = await handler.executeFunction(f, argMap);
    expect(functionOutput).not.to.be.null;
    expect(functionOutput[prefix(ns.t_echo, 'out')]).not.to.be.null;
    expect(functionOutput[prefix(ns.t_echo, 'out')]).to.be.equal('abc\n')
  });

  it('Correctly executes RuntimeProcess: echo -n [message]',async ()=>{
    handler.dynamicallyLoadImplementations();
    const [imp] = handler.graphHandler.filter.s($rdf.sym(`${ns.t_echo}Implementation`))
    expect(imp).not.to.be.null;
    expect(imp.subject).not.to.be.null;
    // Parse implementation into a RuntimeProcess
    const rtp: RuntimeProcess = handler.parseRuntimeProcessImplementation(imp.subject, handler.graphHandler);

    // Function resource
    const f = await handler.getFunction(prefix(ns.t_echo, 'Function'));

    // Execution
    const argMap = {
      [prefix(ns.t_echo, 'message')]:'abc',
      [prefix(ns.t_echo, 'noTrailingNewLine')]:'',
    }

    //
    const functionOutput = await handler.executeFunction(f, argMap);
    expect(functionOutput).not.to.be.null;
    expect(functionOutput[prefix(ns.t_echo, 'out')]).not.to.be.null;
    expect(functionOutput[prefix(ns.t_echo, 'out')]).to.be.equal('abc')
  });
})

describe('Workflow test: fno-cwl/example01/cwl2fno-expected-result-concrete-wf.ttl', () => {

  const dirContainerResources = path.resolve(dirResources, 'example01');
  let handler: FunctionHandler;
  before(async ()=>{
    handler = new FunctionHandler();
    // Load FnO descriptions
    const iriFunctionGraph = prefix(ns.gdm, 'commandGraph');
    await handler.addFunctionResource(
        iriFunctionGraph,
        {
          type: 'string',
          contents: readFile(path.resolve(dirContainerResources, 'cwl2fno-expected-result-concrete-wf.ttl')),
          contentType: 'text/turtle'
        },
        false
    );
  })

  /**
   * Tests loading of functions within the composition (echo, uppercase)
   * Tests results from executing echo and uppercase
   * Test execution result of the function composition (i.e. the workflow)
   */
  it('Correctly parses the concrete workflow',async () => {

    // IRIs
    const iriWf = prefix(ns.wf, 'Function');
    const iriEcho = prefix(ns.t_echo, 'Function');
    const iriUppercase = prefix(ns.t_uc, 'Function');

    // FnO Function objects
    const fWf = await handler.getFunction(iriWf);
    const fEcho = await handler.getFunction(iriEcho);
    const fUppercase = await handler.getFunction(iriUppercase);

    // Test loaded function objects
    expect(fWf).not.to.be.null;
    expect(fWf.id).not.to.be.null;

    expect(fEcho).not.to.be.null;
    expect(fEcho.id).not.to.be.null;

    expect(fUppercase).not.to.be.null;
    expect(fUppercase.id).not.be.null;
  });

  it('Correctly loads the concrete workflow',async () => {
    // Load implementations
    handler.dynamicallyLoadImplementations();

    // Test loaded implementations
    const loadedImplementations = handler.implementationHandler.getLoadedImplementations();

    expect(loadedImplementations).not.to.be.empty;

    expect(Object.keys(loadedImplementations))
        .to.contain(prefix(ns.t_echo, 'Implementation'))
        .to.contain(prefix(ns.t_uc, 'JSExpressionImplementation'));

    expect(Object.values(loadedImplementations).map(li => li.handler.constructor.name))
        .to.contain('JavaScriptExpressionHandler')
        .to.contain('RuntimeProcessHandler')
  });

  it('Correctly executes the echo function', async ()=>{
    handler.dynamicallyLoadImplementations();
    const fEcho = await handler.getFunction(prefix(ns.t_echo, 'Function'));
    expect(fEcho).not.to.be.null;

    const argMap = {
      [prefix(ns.t_echo, 'message')]: 'abc'
    }
    const functionOutput = await handler.executeFunction(fEcho, argMap)
    expect(functionOutput)
        .not.to.be.undefined
        .not.to.be.null;
    expect(functionOutput[prefix(ns.t_echo,'out')]).to.equal('abc\n')

  });

  it('Correclty executes the concrete workflow', async ()=>{

    handler.dynamicallyLoadImplementations();
    const fWf = await handler.getFunction(prefix(ns.wf, 'Function'));
    expect(fWf).not.to.be.null;

    // Test result of execution the function composition
    const wfArgMap = {
      [prefix(ns.wf, 'message')]: 'abc'
    }
    const wfResult = await handler.executeFunction(fWf, wfArgMap);
    expect(wfResult[prefix(ns.wf, 'wf_output')]).to.equal('ABC\n');

  });


});

