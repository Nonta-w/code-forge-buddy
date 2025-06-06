
export type FileType = 'rtm' | 'sequenceDiagram' | 'classDiagram';

export interface UploadedFile {
  id: string;
  name: string;
  type: FileType;
  size: number;
  lastModified: number;
  content: string;
  timestamp: Date;
}

export interface SystemFunction {
  id: string;
  name: string;
  sequenceDiagramNames: string[];
}

export interface ClassInfo {
  id: string;
  name: string;
  packageName: string;
  methods: MethodInfo[];
  relatedFunctions: string[];
}

export interface MethodInfo {
  id: string;
  name: string;
  returnType: string;
  visibility: string;
  parameters: ParameterInfo[];
}

export interface ParameterInfo {
  name: string;
  type: string;
}

export interface SequenceDiagram {
  id: string;
  name: string;
  objects: ObjectNode[];
  messages: Message[];
  references: Reference[];
}

export interface ObjectNode {
  id: string;
  name: string;
  type: string;
}

export interface Message {
  id: string;
  from: string;
  to: string;
  name: string;
  type: string;
  parameters?: ParameterInfo[];
}

export interface Reference {
  id: string;
  name: string;
  diagramName?: string;
}

export interface GeneratedCode {
  id: string;
  fileName: string;
  fileContent: string;
  type: 'stub' | 'driver';
  timestamp: Date;
  relatedClass: string;
}
