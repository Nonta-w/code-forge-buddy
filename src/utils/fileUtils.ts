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

// Helper function to clean and split sequence diagram names
const cleanAndSplitDiagramNames = (diagramString: string): string[] => {
  if (!diagramString) return [];
  
  // Split by comma and clean each diagram name
  return diagramString
    .split(',')
    .map(name => name.trim())
    .map(name => {
      // Remove leading and trailing quotes
      return name.replace(/^["']|["']$/g, '');
    })
    .filter(name => name.length > 0);
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
      
      // Get sequence diagram names and clean them
      let allDiagrams: string[] = [];
      
      if (hasSeqDiagram && columns.length > seqDiagramIndex && columns[seqDiagramIndex]) {
        const seqDiagramNames = cleanAndSplitDiagramNames(columns[seqDiagramIndex]);
        allDiagrams.push(...seqDiagramNames);
      }
      
      // Get related sequence diagrams if column exists
      if (relatedSeqDiagramIndex !== -1 && columns.length > relatedSeqDiagramIndex && columns[relatedSeqDiagramIndex]) {
        const relatedDiagramNames = cleanAndSplitDiagramNames(columns[relatedSeqDiagramIndex]);
        allDiagrams.push(...relatedDiagramNames);
      }
      
      // Remove duplicates
      allDiagrams = [...new Set(allDiagrams)];
      
      console.log(`Function ${functionId}: Found sequence diagrams:`, allDiagrams);
      
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
    
    console.log('Parsing Visual Paradigm sequence diagram XML...');
    
    // Check for Visual Paradigm structure
    const projectElement = xmlDoc.getElementsByTagName('Project')[0];
    if (!projectElement || projectElement.getAttribute('Xml_structure') !== 'simple') {
      console.error('Not a valid Visual Paradigm XML file');
      toast.error('Invalid Visual Paradigm XML format');
      return null;
    }
    
    // Extract diagram name
    const diagramName = file.name.replace('.xml', '');
    const diagramId = generateId();
    
    // Find the interaction diagram
    const diagramElements = xmlDoc.getElementsByTagName('InteractionDiagram');
    if (diagramElements.length === 0) {
      console.error('No InteractionDiagram found');
      toast.error('No sequence diagram found in XML');
      return null;
    }
    
    const diagram = diagramElements[0];
    const frameId = diagram.getAttribute('_rootFrame');
    
    console.log(`Processing diagram: ${diagramName}, frameId: ${frameId}`);
    
    // Find the frame in Models
    const frames = xmlDoc.getElementsByTagName('Frame');
    let frame = null;
    for (let i = 0; i < frames.length; i++) {
      if (frames[i].getAttribute('Id') === frameId) {
        frame = frames[i];
        break;
      }
    }
    
    if (!frame) {
      console.error('Frame not found in Models');
      toast.error('Invalid sequence diagram structure');
      return null;
    }
    
    // Extract objects from diagram shapes and map to model data
    const objects: ObjectNode[] = [];
    const objectIdMap = new Map<string, string>(); // modelId -> objectNodeId
    
    const shapes = diagram.getElementsByTagName('Shapes')[0];
    if (shapes) {
      // Process InteractionLifeLine (regular objects)
      const lifeLines = shapes.getElementsByTagName('InteractionLifeLine');
      for (let i = 0; i < lifeLines.length; i++) {
        const lifeLine = lifeLines[i];
        const objectName = lifeLine.getAttribute('Name') || `Object${i}`;
        const modelId = lifeLine.getAttribute('Model');
        
        if (modelId) {
          // Find the corresponding model in the frame
          const lifeLineModels = frame.getElementsByTagName('InteractionLifeLine');
          for (let j = 0; j < lifeLineModels.length; j++) {
            const lifeLineModel = lifeLineModels[j];
            if (lifeLineModel.getAttribute('Id') === modelId) {
              // Get the base classifier (class name)
              const baseClassifier = lifeLineModel.getElementsByTagName('BaseClassifier')[0];
              if (baseClassifier) {
                const classElement = baseClassifier.getElementsByTagName('Class')[0];
                const className = classElement ? classElement.getAttribute('Name') || 'unknown' : 'unknown';
                
                const objectNodeId = generateId();
                objects.push({
                  id: objectNodeId,
                  name: objectName,
                  type: className
                });
                objectIdMap.set(modelId, objectNodeId);
                console.log(`Added object: ${objectName} -> ${className}`);
              }
              break;
            }
          }
        }
      }
      
      // Process InteractionActor (actors)
      const actors = shapes.getElementsByTagName('InteractionActor');
      for (let i = 0; i < actors.length; i++) {
        const actor = actors[i];
        const actorName = actor.getAttribute('Name') || `Actor${i}`;
        const modelId = actor.getAttribute('Model');
        
        if (modelId) {
          const objectNodeId = generateId();
          objects.push({
            id: objectNodeId,
            name: actorName,
            type: 'ACTOR'
          });
          objectIdMap.set(modelId, objectNodeId);
          console.log(`Added actor: ${actorName}`);
        }
      }
      
      // Process InteractionOccurrence (REF objects)
      const occurrences = shapes.getElementsByTagName('InteractionOccurrence');
      for (let i = 0; i < occurrences.length; i++) {
        const occurrence = occurrences[i];
        const refName = occurrence.getAttribute('Name') || `Ref${i}`;
        const modelId = occurrence.getAttribute('Model');
        
        if (modelId) {
          const objectNodeId = generateId();
          objects.push({
            id: objectNodeId,
            name: refName,
            type: 'REF'
          });
          objectIdMap.set(modelId, objectNodeId);
          console.log(`Added reference: ${refName}`);
        }
      }
    }
    
    // Extract messages from ModelRelationshipContainer
    const messages: Message[] = [];
    const modelContainers = xmlDoc.getElementsByTagName('ModelRelationshipContainer');
    
    for (let i = 0; i < modelContainers.length; i++) {
      const container = modelContainers[i];
      const messageElements = container.getElementsByTagName('Message');
      
      for (let j = 0; j < messageElements.length; j++) {
        const messageElement = messageElements[j];
        const messageId = generateId();
        const messageName = messageElement.getAttribute('Name') || '';
        const messageType = messageElement.getAttribute('Type') || 'Message';
        
        const fromModelId = messageElement.getAttribute('EndRelationshipFromMetaModelElement');
        const toModelId = messageElement.getAttribute('EndRelationshipToMetaModelElement');
        
        const fromObjectId = objectIdMap.get(fromModelId || '') || '';
        const toObjectId = objectIdMap.get(toModelId || '') || '';
        
        if (fromObjectId && toObjectId) {
          // Try to get operation name from ActionType
          let operationName = messageName;
          const actionType = messageElement.getElementsByTagName('ActionType')[0];
          if (actionType) {
            const actionTypeCall = actionType.getElementsByTagName('ActionTypeCall')[0];
            if (actionTypeCall) {
              const operationId = actionTypeCall.getAttribute('Operation');
              if (operationId) {
                // Find the operation in the XML
                const operations = xmlDoc.getElementsByTagName('Operation');
                for (let k = 0; k < operations.length; k++) {
                  if (operations[k].getAttribute('Id') === operationId) {
                    operationName = operations[k].getAttribute('Name') || messageName;
                    break;
                  }
                }
              }
            }
          }
          
          messages.push({
            id: messageId,
            from: fromObjectId,
            to: toObjectId,
            name: operationName,
            type: messageType === 'Create Message' ? 'create' : 
                  messageType === 'Message' ? 'synchCall' : 'message'
          });
          
          console.log(`Added message: ${operationName} from ${fromObjectId} to ${toObjectId}`);
        }
      }
    }
    
    // Extract references (empty for now, can be enhanced later)
    const references: Reference[] = [];
    
    console.log('Processed sequence diagram:', { diagramId, diagramName, objects: objects.length, messages: messages.length });
    
    if (objects.length === 0) {
      toast.warning('No objects found in the sequence diagram');
    } else if (messages.length === 0) {
      toast.warning('No messages found in the sequence diagram');
    } else {
      toast.success(`Successfully processed sequence diagram with ${objects.length} objects and ${messages.length} messages`);
    }
    
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

// Process uploaded Class Diagram file with improved deduplication
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
    
    console.log('Parsing Visual Paradigm class diagram XML...');
    
    // Check for Visual Paradigm structure
    const projectElement = xmlDoc.getElementsByTagName('Project')[0];
    if (!projectElement || projectElement.getAttribute('Xml_structure') !== 'simple') {
      console.error('Not a valid Visual Paradigm XML file');
      toast.error('Invalid Visual Paradigm XML format');
      return null;
    }
    
    // Extract classes from Visual Paradigm format
    const modelsElement = xmlDoc.getElementsByTagName('Models')[0];
    if (!modelsElement) {
      console.error('No Models element found in XML');
      toast.error('Invalid Visual Paradigm XML format - no Models element');
      return null;
    }
    
    // Get all Class elements under Models (including nested in packages)
    const classElements = modelsElement.getElementsByTagName('Class');
    const classesMap = new Map<string, ClassInfo>(); // Use Map to track unique classes by ID
    
    console.log(`Found ${classElements.length} class elements`);
    
    for (let i = 0; i < classElements.length; i++) {
      const classElement = classElements[i];
      const id = classElement.getAttribute('Id') || generateId();
      const name = classElement.getAttribute('Name') || `Class${i}`;
      
      // Skip if we already processed this exact class ID
      if (classesMap.has(id)) {
        console.log(`Skipping duplicate class ID: ${id} (${name})`);
        continue;
      }
      
      // Extract package name - look for parent Package element
      let packageName = 'default';
      let parentElement = classElement.parentElement;
      while (parentElement && parentElement.tagName !== 'Models') {
        if (parentElement.tagName === 'Package') {
          packageName = parentElement.getAttribute('Name') || 'default';
          break;
        }
        parentElement = parentElement.parentElement;
      }
      
      console.log(`Processing class: ${name} (${id}) in package: ${packageName}`);
      
      // Extract operations (methods) from Visual Paradigm format
      const modelChildren = classElement.getElementsByTagName('ModelChildren')[0];
      const methods: MethodInfo[] = [];
      
      if (modelChildren) {
        const operationElements = modelChildren.getElementsByTagName('Operation');
        
        console.log(`Found ${operationElements.length} operations for class ${name}`);
        
        for (let j = 0; j < operationElements.length; j++) {
          const operationElement = operationElements[j];
          const methodId = operationElement.getAttribute('Id') || generateId();
          const methodName = operationElement.getAttribute('Name') || `method${j}`;
          const visibility = (operationElement.getAttribute('Visibility') || 'public').toLowerCase();
          
          console.log(`Processing operation: ${methodName} (${methodId})`);
          
          // Extract return type
          let returnType = 'void';
          const returnTypeElement = operationElement.getElementsByTagName('ReturnType')[0];
          if (returnTypeElement) {
            const dataType = returnTypeElement.getElementsByTagName('DataType')[0];
            const classType = returnTypeElement.getElementsByTagName('Class')[0];
            if (dataType) {
              returnType = dataType.getAttribute('Name') || 'void';
            } else if (classType) {
              returnType = classType.getAttribute('Name') || 'Object';
            }
          }
          
          // Extract parameters from Visual Paradigm format
          const parameters: ParameterInfo[] = [];
          const operationModelChildren = operationElement.getElementsByTagName('ModelChildren')[0];
          
          if (operationModelChildren) {
            const paramElements = operationModelChildren.getElementsByTagName('Parameter');
            
            for (let k = 0; k < paramElements.length; k++) {
              const paramElement = paramElements[k];
              const paramName = paramElement.getAttribute('Name') || `param${k}`;
              
              // Extract parameter type
              let paramType = 'Object';
              const paramTypeElement = paramElement.getElementsByTagName('Type')[0];
              if (paramTypeElement) {
                const dataType = paramTypeElement.getElementsByTagName('DataType')[0];
                const classType = paramTypeElement.getElementsByTagName('Class')[0];
                if (dataType) {
                  paramType = dataType.getAttribute('Name') || 'Object';
                } else if (classType) {
                  paramType = classType.getAttribute('Name') || 'Object';
                } else {
                  // Fallback: try direct Type attribute
                  paramType = paramElement.getAttribute('Type') || 'Object';
                }
              }
              
              parameters.push({
                name: paramName,
                type: paramType
              });
            }
          }
          
          methods.push({
            id: methodId,
            name: methodName,
            returnType,
            visibility,
            parameters
          });
        }
      }
      
      // Add the class using its unique ID
      classesMap.set(id, {
        id,
        name,
        packageName,
        methods,
        relatedFunctions: [] // Will be populated when RTM is processed
      });
      console.log(`Added class: ${name} (ID: ${id}) in package: ${packageName} with ${methods.length} methods`);
    }
    
    const classes = Array.from(classesMap.values());
    console.log('Processed class diagram after deduplication:', classes.length, 'unique classes');
    
    if (classes.length === 0) {
      toast.warning('No classes found in the Visual Paradigm XML file');
    } else {
      toast.success(`Successfully processed ${classes.length} unique classes`);
    }
    
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
  console.log('=== Function to Class Mapping Debug ===');
  console.log('Functions:', functions);
  console.log('Sequence Diagrams:', sequenceDiagrams);
  console.log('Classes:', classes.map(c => ({ name: c.name, id: c.id })));
  
  // Create a deep copy of classes to avoid mutating the original
  const updatedClasses = JSON.parse(JSON.stringify(classes));
  
  // Create a map of diagram names to diagrams for quick lookup
  const diagramMap = new Map<string, SequenceDiagram>();
  sequenceDiagrams.forEach(diagram => {
    diagramMap.set(diagram.name, diagram);
    console.log(`Mapped diagram: ${diagram.name} with ${diagram.objects.length} objects`);
  });
  
  // For each function, find related classes through sequence diagrams
  functions.forEach(func => {
    console.log(`\nProcessing function: ${func.name} (${func.id})`);
    console.log(`Function sequence diagrams: ${func.sequenceDiagramNames}`);
    
    const diagramNames = func.sequenceDiagramNames;
    
    // Get set of class names from the sequence diagrams
    const relatedClassNames = new Set<string>();
    
    diagramNames.forEach(diagramName => {
      console.log(`Looking for diagram: ${diagramName}`);
      const diagram = diagramMap.get(diagramName);
      if (diagram) {
        console.log(`Found diagram: ${diagramName} with objects:`, diagram.objects.map(o => ({ name: o.name, type: o.type })));
        
        // Add all object types as related classes
        diagram.objects.forEach(obj => {
          if (obj.type && obj.type !== 'unknown' && obj.type !== 'ACTOR' && obj.type !== 'REF') {
            relatedClassNames.add(obj.type);
            console.log(`Added class from object: ${obj.type} (from object: ${obj.name})`);
          }
        });
        
        // Process references to other diagrams
        diagram.references.forEach(ref => {
          if (ref.diagramName) {
            const refDiagram = diagramMap.get(ref.diagramName);
            if (refDiagram) {
              refDiagram.objects.forEach(obj => {
                if (obj.type && obj.type !== 'unknown' && obj.type !== 'ACTOR' && obj.type !== 'REF') {
                  relatedClassNames.add(obj.type);
                  console.log(`Added class from reference: ${obj.type}`);
                }
              });
            }
          }
        });
      } else {
        console.log(`Diagram not found: ${diagramName}`);
        // Try to find diagram with partial name matching
        const possibleDiagrams = sequenceDiagrams.filter(d => 
          d.name.includes(diagramName) || diagramName.includes(d.name)
        );
        if (possibleDiagrams.length > 0) {
          console.log(`Found possible matches:`, possibleDiagrams.map(d => d.name));
          possibleDiagrams.forEach(diagram => {
            diagram.objects.forEach(obj => {
              if (obj.type && obj.type !== 'unknown' && obj.type !== 'ACTOR' && obj.type !== 'REF') {
                relatedClassNames.add(obj.type);
                console.log(`Added class from partial match: ${obj.type}`);
              }
            });
          });
        }
      }
    });
    
    console.log(`Related class names for function ${func.name}:`, Array.from(relatedClassNames));
    
    // Update classes with related functions
    updatedClasses.forEach((cls: ClassInfo) => {
      if (relatedClassNames.has(cls.name)) {
        cls.relatedFunctions = [...new Set([...cls.relatedFunctions, func.id])];
        console.log(`Added function ${func.id} to class ${cls.name}`);
      }
    });
  });
  
  console.log('=== Final mapping results ===');
  updatedClasses.forEach((cls: ClassInfo) => {
    if (cls.relatedFunctions.length > 0) {
      console.log(`Class ${cls.name} related to functions: ${cls.relatedFunctions}`);
    }
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
  
  // Add stub methods - ensure we have methods to generate
  if (cls.methods && cls.methods.length > 0) {
    cls.methods.forEach(method => {
      // Generate method signature
      const paramsList = method.parameters.map(p => `${p.type} ${p.name}`).join(', ');
      code += `    ${method.visibility} ${method.returnType} ${method.name}(${paramsList}) {\n`;
      
      // Generate return statement based on return type with more realistic values
      if (method.returnType === 'void') {
        code += '        // Stub implementation\n        System.out.println("Stub method called: ' + method.name + '");\n';
      } else if (['int', 'Integer'].includes(method.returnType)) {
        code += '        return 42;\n';
      } else if (['byte', 'Byte'].includes(method.returnType)) {
        code += '        return (byte) 1;\n';
      } else if (['short', 'Short'].includes(method.returnType)) {
        code += '        return (short) 100;\n';
      } else if (['long', 'Long'].includes(method.returnType)) {
        code += '        return 1000L;\n';
      } else if (['float', 'Float'].includes(method.returnType)) {
        code += '        return 3.14f;\n';
      } else if (['double', 'Double'].includes(method.returnType)) {
        code += '        return 2.718;\n';
      } else if (['boolean', 'Boolean'].includes(method.returnType)) {
        code += '        return true;\n';
      } else if (['char', 'Character'].includes(method.returnType)) {
        code += "        return 'X';\n";
      } else if (method.returnType === 'String') {
        code += `        return "stub_${method.name.toLowerCase()}_result";\n`;
      } else {
        code += '        return null; // TODO: Return appropriate stub object\n';
      }
      
      code += '    }\n\n';
    });
  } else {
    // Add a default constructor if no methods are found
    code += `    public ${cls.name}Stub() {\n`;
    code += '        // Default stub constructor\n';
    code += '    }\n\n';
  }
  
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
  
  // Add test methods - ensure we have methods to test
  if (cls.methods && cls.methods.length > 0) {
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
          case 'Integer':
            value = `${(idx + 1) * 10}`;
            declaration = `${param.type} ${param.name} = ${value};`;
            break;
          case 'byte':
          case 'Byte':
            value = `(byte) ${idx + 1}`;
            declaration = `${param.type} ${param.name} = ${value};`;
            break;
          case 'short':
          case 'Short':
            value = `(short) ${(idx + 1) * 100}`;
            declaration = `${param.type} ${param.name} = ${value};`;
            break;
          case 'long':
          case 'Long':
            value = `${(idx + 1) * 1000}L`;
            declaration = `${param.type} ${param.name} = ${value};`;
            break;
          case 'float':
          case 'Float':
            value = `${(idx + 1) * 1.5}f`;
            declaration = `${param.type} ${param.name} = ${value};`;
            break;
          case 'double':
          case 'Double':
            value = `${(idx + 1) * 2.5}`;
            declaration = `${param.type} ${param.name} = ${value};`;
            break;
          case 'boolean':
          case 'Boolean':
            value = idx % 2 === 0 ? 'true' : 'false';
            declaration = `${param.type} ${param.name} = ${value};`;
            break;
          case 'char':
          case 'Character':
            value = `'${String.fromCharCode(65 + idx)}'`; // A, B, C, etc.
            declaration = `${param.type} ${param.name} = ${value};`;
            break;
          case 'String':
            value = `"testValue${idx + 1}"`;
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
        System.out.println("Method ${method.name} returned: " + result);
`;
      } else {
        code += `
        // Call the method
        testObject.${method.name}(${paramValues.join(', ')});
        
        // TODO: Add assertions if needed
        System.out.println("Method ${method.name} executed successfully");
`;
      }
      
      code += '    }\n\n';
    });
  } else {
    // Add a default test if no methods are found
    code += `    @Test\n    public void testDefaultConstructor() {\n`;
    code += `        // Test that the object can be created\n`;
    code += `        assertNotNull(testObject);\n`;
    code += `        System.out.println("${cls.name} object created successfully");\n`;
    code += '    }\n\n';
  }
  
  code += '}\n';
  return code;
};
