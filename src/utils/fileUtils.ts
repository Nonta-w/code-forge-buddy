import { 
  UploadedFile, 
  FileType, 
  SystemFunction, 
  ClassInfo, 
  SequenceDiagram,
  ObjectNode,
  Message,
  Reference,
  MethodInfo,
  ParameterInfo
} from '@/types';
import { toast } from 'sonner';

// Generate unique ID
export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 15);
};

// Validate file extension
export const validateFileExtension = (file: File, expectedType: FileType): boolean => {
  const fileName = file.name.toLowerCase();
  
  switch (expectedType) {
    case 'rtm':
      return fileName.endsWith('.csv');
    case 'sequenceDiagram':
    case 'classDiagram':
      return fileName.endsWith('.xml');
    default:
      return false;
  }
};

// Read file as text
export const readFileAsText = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
};

// Process uploaded RTM file
export const processRTMFile = async (file: File): Promise<SystemFunction[]> => {
  try {
    const content = await readFileAsText(file);
    const lines = content.split('\n');
    
    if (lines.length < 2) {
      toast.error('RTM file is empty or has no data rows');
      return [];
    }
    
    // Skip header line and process each row
    const systemFunctions: SystemFunction[] = [];
    const header = lines[0].split(',').map(col => col.trim().toLowerCase());
    
    console.log('RTM file header:', header); // Debug the headers
    
    // Find column indices with flexible matching
    const possibleFnIdColumns = ['requirement id', 'req id', 'req_id', 'requirementid', 'id', 'requirement'];
    const possibleFnNameColumns = ['system function', 'function', 'function name', 'systemfunction', 'name', 'description'];
    const possibleSeqDiagramColumns = ['sequence diagram', 'seq diagram', 'sequencediagram', 'diagram', 'sequence'];
    const possibleRelatedSeqDiagramColumns = ['related sequence diagram', 'related diagram', 'relateddiagram', 'additional diagrams'];
    
    // Find best match for each required column
    const fnIdIndex = findBestColumnMatch(header, possibleFnIdColumns);
    const fnNameIndex = findBestColumnMatch(header, possibleFnNameColumns);
    const seqDiagramIndex = findBestColumnMatch(header, possibleSeqDiagramColumns);
    const relatedSeqDiagramIndex = findBestColumnMatch(header, possibleRelatedSeqDiagramColumns);
    
    console.log('Column indices:', { fnIdIndex, fnNameIndex, seqDiagramIndex, relatedSeqDiagramIndex });
    
    // Check if we found the minimum required columns
    if (fnIdIndex === -1 || fnNameIndex === -1) {
      toast.error('Required columns not found in RTM file. Please ensure your CSV has columns for Requirement ID and System Function.');
      return [];
    }
    
    // Even if sequence diagram column is missing, we can still process the file
    const hasSeqDiagram = seqDiagramIndex !== -1;
    if (!hasSeqDiagram) {
      toast.warning('Sequence diagram column not found. Some features may be limited.');
    }
    
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      const columns = lines[i].split(',').map(col => col.trim());
      
      if (columns.length < Math.max(fnIdIndex, fnNameIndex) + 1) {
        console.warn(`Line ${i} has fewer columns than expected`);
        continue;
      }
      
      const functionId = columns[fnIdIndex].trim();
      const functionName = columns[fnNameIndex].trim();
      
      if (!functionId || !functionName) {
        console.warn(`Line ${i} has empty required values`);
        continue;
      }
      
      // Get sequence diagram if column exists
      let sequenceDiagram = '';
      if (hasSeqDiagram && columns.length > seqDiagramIndex) {
        sequenceDiagram = columns[seqDiagramIndex].trim();
      }
      
      // Get related sequence diagrams if column exists
      let relatedDiagrams: string[] = [];
      if (relatedSeqDiagramIndex !== -1 && columns.length > relatedSeqDiagramIndex && columns[relatedSeqDiagramIndex]) {
        relatedDiagrams = columns[relatedSeqDiagramIndex].split(';').map(d => d.trim()).filter(d => d);
      }
      
      // Combine all sequence diagrams
      const allDiagrams = [sequenceDiagram, ...relatedDiagrams].filter(d => d);
      
      // Check if function already exists
      const existingFunction = systemFunctions.find(f => f.id === functionId);
      if (existingFunction) {
        // Add any new sequence diagrams
        existingFunction.sequenceDiagramNames = [
          ...new Set([...existingFunction.sequenceDiagramNames, ...allDiagrams])
        ];
      } else {
        systemFunctions.push({
          id: functionId,
          name: functionName,
          sequenceDiagramNames: allDiagrams
        });
      }
    }
    
    console.log('Processed system functions:', systemFunctions);
    
    if (systemFunctions.length === 0) {
      toast.warning('No valid system functions found in the RTM file');
    } else {
      toast.success(`Successfully processed ${systemFunctions.length} system functions`);
    }
    
    return systemFunctions;
  } catch (error) {
    console.error('Error processing RTM file:', error);
    toast.error('Failed to process RTM file. Please check file format.');
    return [];
  }
};

// Helper function to find the best matching column
function findBestColumnMatch(headers: string[], possibleNames: string[]): number {
  // Try exact match first
  for (const name of possibleNames) {
    const index = headers.indexOf(name);
    if (index !== -1) return index;
  }
  
  // Try partial match
  for (const name of possibleNames) {
    for (let i = 0; i < headers.length; i++) {
      if (headers[i].includes(name) || name.includes(headers[i])) {
        return i;
      }
    }
  }
  
  return -1;
}

// Process uploaded Sequence Diagram file
export const processSequenceDiagramFile = async (file: File): Promise<SequenceDiagram | null> => {
  try {
    const content = await readFileAsText(file);
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(content, 'application/xml');
    
    // Basic validation
    if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
      console.error('XML parsing error');
      toast.error('Invalid XML format in sequence diagram');
      return null;
    }
    
    // Extract diagram name
    const diagramName = file.name.replace('.xml', '');
    const diagramId = generateId();
    
    // Extract object nodes (lifelines)
    const lifelines = xmlDoc.getElementsByTagName('lifeline');
    const objects: ObjectNode[] = [];
    
    for (let i = 0; i < lifelines.length; i++) {
      const lifeline = lifelines[i];
      const id = lifeline.getAttribute('id') || generateId();
      const name = lifeline.getAttribute('name') || `Object${i}`;
      const type = lifeline.getAttribute('type') || 'unknown';
      
      objects.push({
        id,
        name,
        type
      });
    }
    
    // Extract messages
    const messageElements = xmlDoc.getElementsByTagName('message');
    const messages: Message[] = [];
    
    for (let i = 0; i < messageElements.length; i++) {
      const message = messageElements[i];
      const id = message.getAttribute('id') || generateId();
      const from = message.getAttribute('source') || '';
      const to = message.getAttribute('target') || '';
      const name = message.getAttribute('name') || '';
      const type = message.getAttribute('messageSort') || 'synchCall';
      
      messages.push({
        id,
        from,
        to,
        name,
        type
      });
    }
    
    // Extract references (REF objects)
    const refElements = xmlDoc.getElementsByTagName('ref');
    const references: Reference[] = [];
    
    for (let i = 0; i < refElements.length; i++) {
      const ref = refElements[i];
      const id = ref.getAttribute('id') || generateId();
      const name = ref.getAttribute('name') || `Reference${i}`;
      const diagramName = ref.getAttribute('refdiagram') || undefined;
      
      references.push({
        id,
        name,
        diagramName
      });
    }
    
    console.log('Processed sequence diagram:', { diagramId, diagramName, objects, messages, references });
    return {
      id: diagramId,
      name: diagramName,
      objects,
      messages,
      references
    };
  } catch (error) {
    console.error('Error processing sequence diagram file:', error);
    toast.error('Failed to process sequence diagram. Please check file format.');
    return null;
  }
};

// Process uploaded Class Diagram file
export const processClassDiagramFile = async (file: File): Promise<ClassInfo[] | null> => {
  try {
    const content = await readFileAsText(file);
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(content, 'application/xml');
    
    // Basic validation
    if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
      console.error('XML parsing error');
      toast.error('Invalid XML format in class diagram');
      return null;
    }
    
    // Extract classes
    const classElements = xmlDoc.getElementsByTagName('class');
    const classes: ClassInfo[] = [];
    
    for (let i = 0; i < classElements.length; i++) {
      const classElement = classElements[i];
      const id = classElement.getAttribute('id') || generateId();
      const name = classElement.getAttribute('name') || `Class${i}`;
      const packageName = classElement.getAttribute('package') || 'default';
      
      // Extract methods
      const methodElements = classElement.getElementsByTagName('method');
      const methods: MethodInfo[] = [];
      
      for (let j = 0; j < methodElements.length; j++) {
        const methodElement = methodElements[j];
        const methodId = methodElement.getAttribute('id') || generateId();
        const methodName = methodElement.getAttribute('name') || `method${j}`;
        const returnType = methodElement.getAttribute('returnType') || 'void';
        const visibility = methodElement.getAttribute('visibility') || 'public';
        
        // Extract parameters
        const paramElements = methodElement.getElementsByTagName('parameter');
        const parameters: ParameterInfo[] = [];
        
        for (let k = 0; k < paramElements.length; k++) {
          const paramElement = paramElements[k];
          const paramName = paramElement.getAttribute('name') || `param${k}`;
          const paramType = paramElement.getAttribute('type') || 'Object';
          
          parameters.push({
            name: paramName,
            type: paramType
          });
        }
        
        methods.push({
          id: methodId,
          name: methodName,
          returnType,
          visibility,
          parameters
        });
      }
      
      classes.push({
        id,
        name,
        packageName,
        methods,
        relatedFunctions: [] // Will be populated when RTM is processed
      });
    }
    
    console.log('Processed class diagram:', classes);
    return classes;
  } catch (error) {
    console.error('Error processing class diagram file:', error);
    toast.error('Failed to process class diagram. Please check file format.');
    return null;
  }
};

// Map functions to classes based on sequence diagrams
export const mapFunctionsToClasses = (
  functions: SystemFunction[],
  sequenceDiagrams: SequenceDiagram[],
  classes: ClassInfo[]
): ClassInfo[] => {
  // Create a deep copy of classes to avoid mutating the original
  const updatedClasses = JSON.parse(JSON.stringify(classes));
  
  // Create a map of diagram names to diagrams for quick lookup
  const diagramMap = new Map<string, SequenceDiagram>();
  sequenceDiagrams.forEach(diagram => {
    diagramMap.set(diagram.name, diagram);
  });
  
  // For each function, find related classes through sequence diagrams
  functions.forEach(func => {
    const diagramNames = func.sequenceDiagramNames;
    
    // Get set of class names from the sequence diagrams
    const relatedClassNames = new Set<string>();
    
    diagramNames.forEach(diagramName => {
      const diagram = diagramMap.get(diagramName);
      if (diagram) {
        // Add all object types as related classes
        diagram.objects.forEach(obj => {
          if (obj.type && obj.type !== 'unknown') {
            relatedClassNames.add(obj.type);
          }
        });
        
        // Process references to other diagrams
        diagram.references.forEach(ref => {
          if (ref.diagramName) {
            const refDiagram = diagramMap.get(ref.diagramName);
            if (refDiagram) {
              refDiagram.objects.forEach(obj => {
                if (obj.type && obj.type !== 'unknown') {
                  relatedClassNames.add(obj.type);
                }
              });
            }
          }
        });
      }
    });
    
    // Update classes with related functions
    updatedClasses.forEach((cls: ClassInfo) => {
      if (relatedClassNames.has(cls.name)) {
        cls.relatedFunctions = [...new Set([...cls.relatedFunctions, func.id])];
      }
    });
  });
  
  return updatedClasses;
};

// Generate stub code for a class
export const generateStubCode = (cls: ClassInfo): string => {
  const packageLine = cls.packageName ? `package ${cls.packageName};\n\n` : '';
  
  let code = `${packageLine}/**
 * Stub for ${cls.name}
 * Generated on ${new Date().toISOString()}
 */
public class ${cls.name}Stub {\n`;
  
  // Add stub methods
  cls.methods.forEach(method => {
    // Generate method signature
    const paramsList = method.parameters.map(p => `${p.type} ${p.name}`).join(', ');
    code += `    ${method.visibility} ${method.returnType} ${method.name}(${paramsList}) {\n`;
    
    // Generate return statement based on return type
    if (method.returnType === 'void') {
      code += '        // Stub implementation\n';
    } else if (['int', 'byte', 'short', 'long'].includes(method.returnType)) {
      code += '        return 0;\n';
    } else if (['float', 'double'].includes(method.returnType)) {
      code += '        return 0.0;\n';
    } else if (method.returnType === 'boolean') {
      code += '        return false;\n';
    } else if (method.returnType === 'char') {
      code += "        return '0';\n";
    } else if (method.returnType === 'String') {
      code += '        return "stub";\n';
    } else {
      code += '        return null;\n';
    }
    
    code += '    }\n\n';
  });
  
  code += '}\n';
  return code;
};

// Generate driver code for a class
export const generateDriverCode = (cls: ClassInfo): string => {
  const packageLine = cls.packageName ? `package ${cls.packageName};\n\n` : '';
  
  let code = `${packageLine}import org.junit.Test;\n
/**
 * Test Driver for ${cls.name}
 * Generated on ${new Date().toISOString()}
 */
public class ${cls.name}Driver {\n
    private ${cls.name} testObject = new ${cls.name}();
\n`;
  
  // Add test methods
  cls.methods.forEach(method => {
    const methodName = method.name.charAt(0).toUpperCase() + method.name.slice(1);
    code += `    @Test\n    public void test${methodName}() {\n`;
    
    // Generate parameter values
    const paramValues: string[] = [];
    const paramDeclarations: string[] = [];
    
    method.parameters.forEach((param, idx) => {
      let declaration: string;
      let value: string;
      
      switch (param.type) {
        case 'int':
        case 'byte':
        case 'short':
        case 'long':
          value = `${idx + 1}`;
          declaration = `${param.type} ${param.name} = ${value};`;
          break;
        case 'float':
        case 'double':
          value = `${idx + 1}.0`;
          declaration = `${param.type} ${param.name} = ${value}${param.type === 'float' ? 'f' : ''};`;
          break;
        case 'boolean':
          value = 'true';
          declaration = `boolean ${param.name} = ${value};`;
          break;
        case 'char':
          value = `'A'`;
          declaration = `char ${param.name} = ${value};`;
          break;
        case 'String':
          value = `"testValue${idx}"`;
          declaration = `String ${param.name} = ${value};`;
          break;
        default:
          value = 'null';
          declaration = `${param.type} ${param.name} = null; // TODO: Initialize with appropriate test data`;
      }
      
      paramValues.push(param.name);
      paramDeclarations.push(declaration);
    });
    
    // Add parameter declarations to code
    paramDeclarations.forEach(decl => {
      code += `        ${decl}\n`;
    });
    
    // Call the method
    if (method.returnType !== 'void') {
      code += `
        // Call the method and store the result
        ${method.returnType} result = testObject.${method.name}(${paramValues.join(', ')});
        
        // TODO: Add assertions for the result
        // assertEquals(expectedValue, result);
`;
    } else {
      code += `
        // Call the method
        testObject.${method.name}(${paramValues.join(', ')});
        
        // TODO: Add assertions if needed
`;
    }
    
    code += '    }\n\n';
  });
  
  code += '}\n';
  return code;
};
