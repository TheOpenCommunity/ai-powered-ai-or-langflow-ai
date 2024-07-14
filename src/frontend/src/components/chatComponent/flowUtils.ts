import { v4 as uuidv4 } from 'uuid';
import chatinputTemplate from './chatinput.json';
import chatoutputTemplate from './chatoutput.json';
import modelTemplate from './model.json';
import fullFlowTemplate from './fullflow.json';


export const generateUniqueId = (): string => {
  return uuidv4();
};

export const generatePosition = (index: number) => {
  return { x: index * 500, y: index * 200 };
};

export const addNodesToFlow = (flow: any, nodeTemplates: any, nodeTypes: string[]): any => {
  nodeTypes.forEach((nodeType, index) => {
    const template = nodeTemplates[nodeType];
    if (template) {
      const node = { ...template };
      // node.id = `${nodeType}-${generateUniqueId()}`;
      node.id = `${nodeType}`;
      node.position = generatePosition(index);
      node.data.id = node.id;
      flow.data.nodes.push(node);
    }
  });
  return flow;
};

export const addEdgeToFlow = (flow: any, source: string, target: string, sourceType: string, targetType: string): any => {
  const sourceHandle = `{œdataTypeœ:œ${sourceType}œ,œidœ:œ${source}œ,œnameœ:œ${source === "ChatInput" ? "message" : "text_output"}œ,œoutput_typesœ:[œMessageœ]}`;
  const targetHandle = `{œfieldNameœ:œinput_valueœ,œidœ:œ${target}œ,œinputTypesœ:[œMessageœ],œtypeœ:œstrœ}`;

  const edge = {
    source,
    sourceHandle,
    target,
    targetHandle,
    data: {
      targetHandle: {
        fieldName: "input_value",
        id: target,
        inputTypes: ["Message"],
        type: "str"
      },
      sourceHandle: {
        dataType: sourceType,
        id: source,
        name: source === "ChatInput" ? "message" : "text_output",
        output_types: ["Message"]
      }
    },
    id: `reactflow__edge-${source}${sourceHandle}-${target}${targetHandle}`
  };
  flow.data.edges.push(edge);
  return flow;
};

export const saveFullFlow = (flow: any, fileName: string = 'fullflow.json') => {
  const blob = new Blob([JSON.stringify(flow, null, 4)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
