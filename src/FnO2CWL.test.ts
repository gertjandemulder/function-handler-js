import { expect } from 'chai';
import { FunctionHandler } from './FunctionHandler';
import { } from 'mocha';
import { JavaScriptHandler } from './handlers/JavaScriptHandler';
import prefixes from './prefixes';
import * as fs from 'fs';
import * as path from 'path';
import { RuntimeProcessHandler } from './handlers/RuntimeProcessHandler';
import exp from "constants";
import * as $rdf from 'rdflib';
import {PositionParameter, PropertyParameter, RuntimeProcess} from "./models/Implementation";
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
      [prefix(ns.t_ls, 'pathParameter')]:'./resources/fno-cwl/commands/ls_test_dir'
    }

    // TODO: dynamically load implementation (this should include loading the basecommand)

    //
    const functionOutput = await handler.executeFunction(f, argMap);
    expect(functionOutput).not.to.be.null;
    expect(functionOutput[prefix(ns.t_ls, 'returnOutput')]).not.to.be.null;


    expect(functionOutput[prefix(ns.t_ls, 'returnOutput')]).to.be.equal(
        `a.txt
b.txt
c.txt
`
    )
  });

});
describe('Tests for example01', () => { // the tests container

  const dirContainerResources = path.resolve(dirResources, 'example01');
  const pathConcreteWorkflow = path.resolve(dirContainerResources, basenameConcreteWorkflowTurtle);

  const jsFunctionImplementations = {

    echo: function(message:string) {
      console.log(`echo(${message})`)
      return message;
    },

    uppercase: function(message:string) {
      return message.toUpperCase();
    }

  }


  it('Contains FnO document of the concrete workflow',async () => {
    expect(fs.existsSync(pathConcreteWorkflow));
  });

  it.skip('Contains FnO document of the abstract workflow',async () => {
    throw Error('Not Yet Implemented');
  });


  /**
   * Tests loading of functions within the composition (echo, uppercase)
   * Tests results from executing echo and uppercase
   * Test execution result of the function composition (i.e. the workflow)
   */
  it.skip('Correctly executes the concrete workflow',async () => {
    const handler = new FunctionHandler();
    const rtpHandler = new RuntimeProcessHandler();
    const jsHandler = new JavaScriptHandler();

    // Load FnO descriptions
    const iriConcreteWorkflow = prefix(ns.gdm, 'workflowGraph');
    await handler.addFunctionResource(
      iriConcreteWorkflow,
      {
        type: 'string',
        contents: readFile(pathConcreteWorkflow),
        contentType: 'text/turtle'
      }
    );

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

    // Instantiate implementation handlers
    const iriEchoImplementation = prefix(ns.t_echo, 'Implementation');
    const iriUppercaseImplementation = prefix(ns.t_uc, 'Implementation');

    // Implementation by RuntimeProcessHandler
    handler.implementationHandler.loadImplementation(
      iriEchoImplementation,
      rtpHandler,
      { baseCommand: ["echo"] }
    );

    // Implementation by JavascriptHandler
    handler.implementationHandler.loadImplementation(
      iriUppercaseImplementation,
      jsHandler,
      { fn: jsFunctionImplementations.uppercase }
    );

    // Test echo output
    const fnEchoArgMap = {
      [prefix(ns.t_echo, 'message')]: 'abc'
    }
    const fnEchoResult = await handler.executeFunction(fEcho, fnEchoArgMap);
    expect(fnEchoResult[prefix(ns.t_echo, 'out')]).to.equal('abc\n');

    // Test uppercase output
    const fnUppercaseArgMap = {
      [prefix(ns.t_uc, 'message')]: 'abc'
    }
    const fnUppercaseResult = await handler.executeFunction(fUppercase, fnUppercaseArgMap)
    expect(fnUppercaseResult[prefix(ns.t_uc, 'uppercase_message')]).to.equal('ABC');

    // Test result of execution the function composition
    const wfArgMap = {
      [prefix(ns.wf, 'message')]: 'abc'
    }
    const wfResult = await handler.executeFunction(fWf, wfArgMap);
    expect(wfResult[prefix(ns.wf, 'wf_output')]).to.equal('ABC\n');

  });


});

