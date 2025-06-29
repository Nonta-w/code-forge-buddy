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

// Enhanced CSV parser to handle special characters, quotes, and commas
const parseCSVLine = (line: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i += 2;
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
        i++;
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator
      result.push(current.trim());
      current = '';
      i++;
    } else {
      current += char;
      i++;
    }
  }

  // Add the last field
  result.push(current.trim());
  return result;
};

// Enhanced CSV parser for the entire content
const parseCSVContent = (content: string): string[][] => {
  const lines = content.split(/\r?\n/);
  const result: string[][] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line) {
      try {
        const fields = parseCSVLine(line);
        result.push(fields);
      } catch (error) {
        console.warn(`Error parsing CSV line ${i + 1}: ${line}`, error);
        // Fallback to simple split for malformed lines
        result.push(line.split(',').map(field => field.trim().replace(/^["']|["']$/g, '')));
      }
    }
  }

  return result;
};

// Helper function to clean and split sequence diagram names
const cleanAndSplitDiagramNames = (diagramString: string): string[] => {
  if (!diagramString) return [];

  console.log('Processing diagram string:', diagramString);

  // Handle various separators: comma, semicolon, pipe
  const separators = [',', ';', '|'];
  let separator = ',';
  
  for (const sep of separators) {
    if (diagramString.includes(sep)) {
      separator = sep;
      break;
    }
  }

  // Split by separator and clean each diagram name
  const diagrams = diagramString
    .split(separator)
    .map(name => {
      // Remove leading and trailing whitespace
      let cleaned = name.trim();
      // Remove leading and trailing quotes (both single and double)
      cleaned = cleaned.replace(/^["']|["']$/g, '');
      // Remove any remaining whitespace
      cleaned = cleaned.trim();
      // Remove special characters that might interfere with file matching
      cleaned = cleaned.replace(/[^\w\s\-\.]/g, '');
      return cleaned;
    })
    .filter(name => name.length > 0);

  console.log('Cleaned diagrams:', diagrams);
  return diagrams;
};

// Enhanced column matching with your specific requirements
const findBestColumnMatch = (headers: string[], possibleNames: string[]): number => {
  console.log('Finding column match for:', possibleNames);
  console.log('Available headers:', headers);

  // Normalize headers for matching
  const normalizedHeaders = headers.map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
  
  // Try exact match first
  for (const name of possibleNames) {
    const normalizedName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const exactIndex = normalizedHeaders.indexOf(normalizedName);
    if (exactIndex !== -1) {
      console.log(`Found exact match: "${headers[exactIndex]}" for "${name}"`);
      return exactIndex;
    }
  }

  // Try partial match - check if any possible name is contained in headers
  for (const name of possibleNames) {
    const normalizedName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (let i = 0; i < normalizedHeaders.length; i++) {
      if (normalizedHeaders[i].includes(normalizedName) || normalizedName.includes(normalizedHeaders[i])) {
        console.log(`Found partial match: "${headers[i]}" contains "${name}"`);
        return i;
      }
    }
  }

  // Try fuzzy match - check if headers contain any of the possible names
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i].toLowerCase();
    for (const name of possibleNames) {
      if (header.includes(name.toLowerCase()) || name.toLowerCase().includes(header)) {
        console.log(`Found fuzzy match: "${headers[i]}" matches "${name}"`);
        return i;
      }
    }
  }

  console.log('No match found for:', possibleNames);
  return -1;
};

// Process uploaded RTM file with enhanced CSV parsing
export const processRTMFile = async (file: File): Promise<SystemFunction[]> => {
  try {
    const content = await readFileAsText(file);
    const csvData = parseCSVContent(content);

    if (csvData.length < 2) {
      toast.error('RTM file is empty or has no data rows');
      return [];
    }

    const header = csvData[0];
    console.log('RTM file header:', header);

    // Enhanced column name matching with your requirements
    const possibleFnIdColumns = ['functional requirement', 'requirement id', 'req id', 'req_id', 'requirementid', 'id', 'requirement', 'function', 'functional', 'fr'];
    const possibleFnNameColumns = ['functional requirement', 'system function', 'function', 'function name', 'systemfunction', 'name', 'description', 'functional'];
    const possibleSeqDiagramColumns = ['sequence', 'sequencediagram', 'sequence diagram', 'seq diagram', 'diagram', 'sd'];
    const possibleRelatedSeqDiagramColumns = ['related sequence diagram', 'related diagram', 'relateddiagram', 'additional diagrams'];

    // Find best match for each column
    const fnIdIndex = findBestColumnMatch(header, possibleFnIdColumns);
    const fnNameIndex = findBestColumnMatch(header, possibleFnNameColumns);
    const seqDiagramIndex = findBestColumnMatch(header, possibleSeqDiagramColumns);
    const relatedSeqDiagramIndex = findBestColumnMatch(header, possibleRelatedSeqDiagramColumns);

    console.log('Column indices:', { fnIdIndex, fnNameIndex, seqDiagramIndex, relatedSeqDiagramIndex });

    // Handle case where ID and function name might be in the same column
    let effectiveFnIdIndex = fnIdIndex;
    let effectiveFnNameIndex = fnNameIndex;

    if (fnIdIndex === -1 && fnNameIndex !== -1) {
      // Use function name column for both ID and name
      effectiveFnIdIndex = fnNameIndex;
      console.log('Using function name column for both ID and name');
    } else if (fnNameIndex === -1 && fnIdIndex !== -1) {
      // Use ID column for both ID and name
      effectiveFnNameIndex = fnIdIndex;
      console.log('Using ID column for both ID and name');
    }

    // Check if we found at least one required column
    if (effectiveFnIdIndex === -1 && effectiveFnNameIndex === -1) {
      toast.error('Required columns not found in RTM file. Please ensure your CSV has columns containing "function", "functional", "FR", or "requirement".');
      return [];
    }

    // Even if sequence diagram column is missing, we can still process the file
    const hasSeqDiagram = seqDiagramIndex !== -1;
    if (!hasSeqDiagram) {
      toast.warning('Sequence diagram column not found. Looking for columns containing "sequence", "SD", or "diagram".');
    }

    const systemFunctions: SystemFunction[] = [];

    // Process each data row
    for (let i = 1; i < csvData.length; i++) {
      const columns = csvData[i];

      if (columns.length === 0) continue;

      // Get function ID and name with fallback logic
      let functionId = '';
      let functionName = '';

      if (effectiveFnIdIndex !== -1 && columns.length > effectiveFnIdIndex) {
        functionId = columns[effectiveFnIdIndex].trim();
      }

      if (effectiveFnNameIndex !== -1 && columns.length > effectiveFnNameIndex) {
        functionName = columns[effectiveFnNameIndex].trim();
      }

      // If we only have one column, use it for both ID and name
      if (!functionId && !functionName) {
        if (columns.length > 0) {
          const combined = columns[0].trim();
          functionId = combined;
          functionName = combined;
        }
      } else if (!functionId) {
        functionId = functionName;
      } else if (!functionName) {
        functionName = functionId;
      }

      if (!functionId || !functionName) {
        console.warn(`Row ${i + 1} has empty required values`);
        continue;
      }

      // Get sequence diagram names and clean them
      let allDiagrams: string[] = [];

      if (hasSeqDiagram && columns.length > seqDiagramIndex && columns[seqDiagramIndex]) {
        const seqDiagramNames = cleanAndSplitDiagramNames(columns[seqDiagramIndex]);
        allDiagrams.push(...seqDiagramNames);
        console.log(`Function ${functionId}: Found primary sequence diagrams:`, seqDiagramNames);
      }

      // Get related sequence diagrams if column exists
      if (relatedSeqDiagramIndex !== -1 && columns.length > relatedSeqDiagramIndex && columns[relatedSeqDiagramIndex]) {
        const relatedDiagramNames = cleanAndSplitDiagramNames(columns[relatedSeqDiagramIndex]);
        allDiagrams.push(...relatedDiagramNames);
        console.log(`Function ${functionId}: Found related sequence diagrams:`, relatedDiagramNames);
      }

      // Remove duplicates
      allDiagrams = [...new Set(allDiagrams)];

      console.log(`Function ${functionId}: Total sequence diagrams:`, allDiagrams);

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
    toast.error('Failed to process RTM file. Please check file format and try again.');
    return [];
  }
};

// Enhanced REF name matching patterns
const enhanceRefNameMatching = (refName: string): string[] => {
  if (!refName) return [];

  const variations: string[] = [];
  const cleaned = refName.trim();

  // Add original name
  variations.push(cleaned);

  // Remove common prefixes
  const withoutPrefixes = cleaned
    .replace(/^(ref\s+|sd\s+|sequence\s+|diagram\s+)/i, '')
    .trim();
  if (withoutPrefixes !== cleaned) {
    variations.push(withoutPrefixes);
  }

  // Handle camelCase to space separated
  const spacesSeparated = cleaned.replace(/([a-z])([A-Z])/g, '$1 $2');
  if (spacesSeparated !== cleaned) {
    variations.push(spacesSeparated);
  }

  // Handle underscores and dashes
  const normalized = cleaned.replace(/[_\-]/g, ' ');
  if (normalized !== cleaned) {
    variations.push(normalized);
  }

  // Handle common patterns like "ProcessDeposit" -> "Process Deposit"
  const withSpaces = cleaned.replace(/([a-z])([A-Z])/g, '$1 $2');
  if (withSpaces !== cleaned) {
    variations.push(withSpaces);
  }

  // Handle operation name patterns - convert camelCase operations to potential diagram names
  // processDeposit -> ProcessDeposit, Process Deposit, process-deposit
  if (cleaned.match(/^[a-z]/)) {
    // Capitalize first letter for potential class/diagram name
    const capitalized = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    variations.push(capitalized);

    // Add space-separated version of capitalized
    const capitalizedWithSpaces = capitalized.replace(/([a-z])([A-Z])/g, '$1 $2');
    variations.push(capitalizedWithSpaces);
  }

  // Add lowercase version
  variations.push(cleaned.toLowerCase());

  // Add potential diagram names by adding common suffixes
  variations.push(cleaned + 'Diagram');
  variations.push(cleaned + ' Diagram');

  console.log(`REF name variations for "${refName}":`, variations);
  return [...new Set(variations)]; // Remove duplicates
};

// Enhanced diagram matching function
const findMatchingDiagram = (refName: string, diagrams: Map<string, SequenceDiagram>): SequenceDiagram | null => {
  const variations = enhanceRefNameMatching(refName);

  // Try exact matches first
  for (const variation of variations) {
    if (diagrams.has(variation)) {
      console.log(`Found exact match for "${refName}" -> "${variation}"`);
      return diagrams.get(variation)!;
    }
  }

  // Try case-insensitive matches
  for (const variation of variations) {
    for (const [diagName, diagram] of diagrams.entries()) {
      if (diagName.toLowerCase() === variation.toLowerCase()) {
        console.log(`Found case-insensitive match for "${refName}" -> "${diagName}"`);
        return diagram;
      }
    }
  }

  // Try partial matches
  for (const variation of variations) {
    for (const [diagName, diagram] of diagrams.entries()) {
      if (diagName.toLowerCase().includes(variation.toLowerCase()) ||
        variation.toLowerCase().includes(diagName.toLowerCase())) {
        console.log(`Found partial match for "${refName}" -> "${diagName}"`);
        return diagram;
      }
    }
  }

  console.log(`No match found for REF: "${refName}"`);
  return null;
};

// REPLACE the entire processSequenceDiagramFile function with this complete version:
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

    // Enhanced references extraction with better ref box detection
    const references: Reference[] = [];

    // Method 1: Extract from InteractionOccurrence models in the frame
    const occurrenceModels = frame.getElementsByTagName('InteractionOccurrence');
    console.log(`Found ${occurrenceModels.length} InteractionOccurrence models for REF processing`);

    for (let i = 0; i < occurrenceModels.length; i++) {
      const occurrenceModel = occurrenceModels[i];
      const refId = occurrenceModel.getAttribute('Id') || generateId();
      const refName = occurrenceModel.getAttribute('Name') || `Ref${i}`;

      console.log(`Processing REF occurrence: ${refName} (ID: ${refId})`);

      let referencedDiagramName = null;

      // Enhanced Method: Check for TransitFrom -> Operation pattern (like your example)
      const transitFrom = occurrenceModel.getElementsByTagName('TransitFrom')[0];
      if (transitFrom) {
        const operation = transitFrom.getElementsByTagName('Operation')[0];
        if (operation) {
          // Get operation name from Name attribute
          const operationName = operation.getAttribute('Name');
          if (operationName) {
            referencedDiagramName = operationName;
            console.log(`Found referenced diagram via TransitFrom->Operation: ${referencedDiagramName}`);
          }

          // Also try Idref attribute as fallback
          if (!referencedDiagramName) {
            const operationIdref = operation.getAttribute('Idref');
            if (operationIdref) {
              // Try to find the operation definition by Idref
              const allOperations = xmlDoc.getElementsByTagName('Operation');
              for (let k = 0; k < allOperations.length; k++) {
                if (allOperations[k].getAttribute('Id') === operationIdref) {
                  referencedDiagramName = allOperations[k].getAttribute('Name');
                  console.log(`Found referenced diagram via Idref lookup: ${referencedDiagramName}`);
                  break;
                }
              }
            }
          }
        }
      }

      // Method 2: Check for CoveredInteraction (fallback)
      if (!referencedDiagramName) {
        const coveredInteraction = occurrenceModel.getElementsByTagName('CoveredInteraction')[0];
        if (coveredInteraction) {
          const interactionRef = coveredInteraction.getElementsByTagName('Interaction')[0];
          if (interactionRef) {
            referencedDiagramName = interactionRef.getAttribute('Name');
            console.log(`Found referenced diagram via CoveredInteraction: ${referencedDiagramName}`);
          }
        }
      }

      // Method 3: Extract from Messages that reference this occurrence
      if (!referencedDiagramName) {
        // Look for messages in ModelRelationshipContainer that might reference this occurrence
        const allMessages = xmlDoc.getElementsByTagName('Message');
        for (let j = 0; j < allMessages.length; j++) {
          const msg = allMessages[j];
          const transitFromMsg = msg.getElementsByTagName('TransitFrom')[0];
          if (transitFromMsg) {
            const operationInMsg = transitFromMsg.getElementsByTagName('Operation')[0];
            if (operationInMsg) {
              const msgOpName = operationInMsg.getAttribute('Name');
              if (msgOpName && (msgOpName.toLowerCase().includes(refName.toLowerCase()) ||
                refName.toLowerCase().includes(msgOpName.toLowerCase()))) {
                referencedDiagramName = msgOpName;
                console.log(`Found referenced diagram via Message operation: ${referencedDiagramName}`);
                break;
              }
            }
          }
        }
      }

      // Method 4: Parse from the ref name itself if it looks like a diagram reference
      if (!referencedDiagramName && refName) {
        // Enhanced pattern matching for REF names
        const variations = enhanceRefNameMatching(refName);
        referencedDiagramName = variations[0]; // Use the first (cleaned) variation
        console.log(`Using parsed REF name: ${referencedDiagramName}`);
      }

      references.push({
        id: refId,
        name: refName,
        diagramName: referencedDiagramName || undefined
      });

      console.log(`Added reference: ${refName} -> ${referencedDiagramName || 'unknown'}`);
    }

    // Method 2: Also check messages directly for operation calls that might be REF boxes
    const allMessages = xmlDoc.getElementsByTagName('Message');
    console.log(`Checking ${allMessages.length} messages for additional REF operations`);

    for (let i = 0; i < allMessages.length; i++) {
      const message = allMessages[i];
      const transitFrom = message.getElementsByTagName('TransitFrom')[0];

      if (transitFrom) {
        const operation = transitFrom.getElementsByTagName('Operation')[0];
        if (operation) {
          const operationName = operation.getAttribute('Name');
          const operationIdref = operation.getAttribute('Idref');

          // Check if this operation might be a reference to another diagram
          if (operationName && !references.some(ref => ref.diagramName === operationName)) {
            // This looks like it might be a referenced operation/diagram
            const refId = generateId();

            references.push({
              id: refId,
              name: `REF_${operationName}`,
              diagramName: operationName
            });

            console.log(`Added operation-based reference: REF_${operationName} -> ${operationName}`);
          }
        }
      }
    }

    console.log('Processed sequence diagram:', {
      diagramId,
      diagramName,
      objects: objects.length,
      messages: messages.length,
      references: references.length
    });

    if (objects.length === 0) {
      toast.warning('No objects found in the sequence diagram');
    } else if (messages.length === 0) {
      toast.warning('No messages found in the sequence diagram');
    } else {
      const refInfo = references.length > 0 ? ` and ${references.length} references` : '';
      toast.success(`Successfully processed sequence diagram with ${objects.length} objects, ${messages.length} messages${refInfo}`);
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

// Process uploaded Class Diagram file with improved handling for your XML format
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

    console.log('Parsing class diagram XML...');

    // Check for Project element (your XML structure)
    const projectElement = xmlDoc.getElementsByTagName('Project')[0];
    if (!projectElement) {
      console.error('Not a valid XML file - no Project element');
      toast.error('Invalid XML format - no Project element found');
      return null;
    }

    // Extract classes from your XML format
    const modelsElement = xmlDoc.getElementsByTagName('Models')[0];
    if (!modelsElement) {
      console.error('No Models element found in XML');
      toast.error('Invalid XML format - no Models element');
      return null;
    }

    console.log('Found Models element, processing classes...');

    // Create a map to resolve DataType references
    const dataTypeMap = new Map<string, string>();
    const dataTypes = modelsElement.getElementsByTagName('DataType');
    for (let i = 0; i < dataTypes.length; i++) {
      const dataType = dataTypes[i];
      const id = dataType.getAttribute('Id');
      const name = dataType.getAttribute('Name');
      if (id && name) {
        dataTypeMap.set(id, name);
      }
    }
    console.log(`Found ${dataTypeMap.size} data type mappings`);

    // Helper function to resolve data type references
    const resolveDataType = (element: Element): string => {
      if (!element) return 'Object';
      
      // Check for direct DataType with Idref
      const dataTypeElement = element.getElementsByTagName('DataType')[0];
      if (dataTypeElement) {
        const idref = dataTypeElement.getAttribute('Idref');
        const name = dataTypeElement.getAttribute('Name');
        
        if (idref && dataTypeMap.has(idref)) {
          return dataTypeMap.get(idref)!;
        } else if (name) {
          return name;
        }
      }
      
      return 'Object';
    };

    const classesMap = new Map<string, ClassInfo>();

    // Process packages and their classes
    const packages = modelsElement.getElementsByTagName('Package');
    console.log(`Found ${packages.length} packages`);

    for (let i = 0; i < packages.length; i++) {
      const packageElement = packages[i];
      const packageName = packageElement.getAttribute('Name') || 'default';
      
      console.log(`Processing package: ${packageName}`);

      const modelChildren = packageElement.getElementsByTagName('ModelChildren')[0];
      if (!modelChildren) continue;

      const classElements = modelChildren.getElementsByTagName('Class');
      console.log(`Found ${classElements.length} classes in package ${packageName}`);

      for (let j = 0; j < classElements.length; j++) {
        const classElement = classElements[j];
        const className = classElement.getAttribute('Name');
        const classId = classElement.getAttribute('Id') || generateId();

        if (!className || className.trim() === '') {
          console.log('Skipping class with empty name');
          continue;
        }

        console.log(`Processing class: ${className} in package: ${packageName}`);

        const methods: MethodInfo[] = [];
        const classModelChildren = classElement.getElementsByTagName('ModelChildren')[0];

        if (classModelChildren) {
          const operations = classModelChildren.getElementsByTagName('Operation');
          console.log(`Found ${operations.length} operations for class ${className}`);

          for (let k = 0; k < operations.length; k++) {
            const operation = operations[k];
            const methodName = operation.getAttribute('Name');
            const visibility = operation.getAttribute('Visibility') || 'public';

            if (!methodName || methodName.trim() === '') {
              continue;
            }

            console.log(`Processing operation: ${methodName}`);

            // Get return type
            let returnType = 'void';
            const returnTypeElement = operation.getElementsByTagName('ReturnType')[0];
            if (returnTypeElement) {
              returnType = resolveDataType(returnTypeElement);
            }

            // Get parameters
            const parameters: ParameterInfo[] = [];
            const operationModelChildren = operation.getElementsByTagName('ModelChildren')[0];
            
            if (operationModelChildren) {
              const paramElements = operationModelChildren.getElementsByTagName('Parameter');
              
              for (let l = 0; l < paramElements.length; l++) {
                const paramElement = paramElements[l];
                const paramName = paramElement.getAttribute('Name');
                
                if (!paramName) continue;

                // Get parameter type
                let paramType = 'Object';
                const typeElement = paramElement.getElementsByTagName('Type')[0];
                if (typeElement) {
                  paramType = resolveDataType(typeElement);
                }

                parameters.push({
                  name: paramName,
                  type: paramType
                });
              }
            }

            methods.push({
              id: generateId(),
              name: methodName,
              returnType,
              visibility: visibility.toLowerCase(),
              parameters
            });
          }
        }

        // Create composite key for deduplication
        const compositeKey = `${packageName}.${className}`;

        // Check for duplicates
        if (classesMap.has(compositeKey)) {
          const existingClass = classesMap.get(compositeKey)!;
          console.log(`Duplicate found for ${compositeKey}, merging methods`);
          
          // Merge methods
          const methodMap = new Map<string, MethodInfo>();
          
          // Add existing methods
          existingClass.methods.forEach(method => {
            const methodKey = `${method.name}(${method.parameters.map(p => p.type).join(',')})`;
            methodMap.set(methodKey, method);
          });
          
          // Add new methods
          methods.forEach(method => {
            const methodKey = `${method.name}(${method.parameters.map(p => p.type).join(',')})`;
            methodMap.set(methodKey, method);
          });
          
          existingClass.methods = Array.from(methodMap.values());
        } else {
          // New class
          classesMap.set(compositeKey, {
            id: generateId(),
            name: className,
            packageName,
            methods,
            relatedFunctions: []
          });
        }

        console.log(`Added class: ${compositeKey} with ${methods.length} methods`);
      }
    }

    // Also check for classes directly under Models (not in packages)
    const directClasses = modelsElement.getElementsByTagName('Class');
    for (let i = 0; i < directClasses.length; i++) {
      const classElement = directClasses[i];
      
      // Skip if this class is already processed (inside a package)
      let isInPackage = false;
      let parent = classElement.parentElement;
      while (parent && parent !== modelsElement) {
        if (parent.tagName === 'Package') {
          isInPackage = true;
          break;
        }
        parent = parent.parentElement;
      }
      
      if (isInPackage) continue;

      const className = classElement.getAttribute('Name');
      if (!className || className.trim() === '') continue;

      console.log(`Processing direct class: ${className}`);

      const methods: MethodInfo[] = [];
      const classModelChildren = classElement.getElementsByTagName('ModelChildren')[0];

      if (classModelChildren) {
        const operations = classModelChildren.getElementsByTagName('Operation');
        
        for (let j = 0; j < operations.length; j++) {
          const operation = operations[j];
          const methodName = operation.getAttribute('Name');
          const visibility = operation.getAttribute('Visibility') || 'public';

          if (!methodName) continue;

          let returnType = 'void';
          const returnTypeElement = operation.getElementsByTagName('ReturnType')[0];
          if (returnTypeElement) {
            returnType = resolveDataType(returnTypeElement);
          }

          const parameters: ParameterInfo[] = [];
          const operationModelChildren = operation.getElementsByTagName('ModelChildren')[0];
          
          if (operationModelChildren) {
            const paramElements = operationModelChildren.getElementsByTagName('Parameter');
            
            for (let k = 0; k < paramElements.length; k++) {
              const paramElement = paramElements[k];
              const paramName = paramElement.getAttribute('Name');
              
              if (!paramName) continue;

              let paramType = 'Object';
              const typeElement = paramElement.getElementsByTagName('Type')[0];
              if (typeElement) {
                paramType = resolveDataType(typeElement);
              }

              parameters.push({
                name: paramName,
                type: paramType
              });
            }
          }

          methods.push({
            id: generateId(),
            name: methodName,
            returnType,
            visibility: visibility.toLowerCase(),
            parameters
          });
        }
      }

      const compositeKey = `default.${className}`;
      classesMap.set(compositeKey, {
        id: generateId(),
        name: className,
        packageName: 'default',
        methods,
        relatedFunctions: []
      });

      console.log(`Added direct class: ${compositeKey} with ${methods.length} methods`);
    }

    const classes = Array.from(classesMap.values());
    
    console.log('=== CLASS PROCESSING SUMMARY ===');
    console.log(`Total classes processed: ${classes.length}`);
    classes.forEach(cls => {
      console.log(`  ${cls.packageName}.${cls.name} - ${cls.methods.length} methods`);
    });

    if (classes.length === 0) {
      toast.warning('No classes found in the XML file');
    } else {
      toast.success(`Successfully processed ${classes.length} classes from class diagram`);
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
  console.log('=== Enhanced Function to Class Mapping Debug ===');
  console.log('Functions:', functions);
  console.log('Sequence Diagrams:', sequenceDiagrams);
  console.log('Classes:', classes.map(c => ({ name: c.name, id: c.id })));

  // Create a deep copy of classes to avoid mutating the original
  const updatedClasses = JSON.parse(JSON.stringify(classes));

  // Create a map of diagram names to diagrams for quick lookup
  const diagramMap = new Map<string, SequenceDiagram>();
  sequenceDiagrams.forEach(diagram => {
    diagramMap.set(diagram.name, diagram);
    console.log(`Mapped diagram: ${diagram.name} with ${diagram.objects.length} objects and ${diagram.references.length} references`);
  });

  // Helper function to get all related class names from a diagram (including referenced diagrams)
  const getRelatedClassNamesFromDiagram = (diagram: SequenceDiagram, visited: Set<string> = new Set()): Set<string> => {
    const relatedClassNames = new Set<string>();

    // Prevent infinite recursion
    if (visited.has(diagram.name)) {
      return relatedClassNames;
    }
    visited.add(diagram.name);

    console.log(`Getting class names from diagram: ${diagram.name}`);

    // Add all object types as related classes
    diagram.objects.forEach(obj => {
      if (obj.type && obj.type !== 'unknown' && obj.type !== 'ACTOR' && obj.type !== 'REF') {
        relatedClassNames.add(obj.type);
        console.log(`Added class from object: ${obj.type} (from object: ${obj.name})`);
      }
    });

    // Process references to other diagrams
    diagram.references.forEach(ref => {
      console.log(`Processing reference: ${ref.name} -> ${ref.diagramName}`);

      if (ref.diagramName) {
        // Try exact match first
        let refDiagram = diagramMap.get(ref.diagramName);

        // If not found, try fuzzy matching
        if (!refDiagram) {
          console.log(`Exact match not found for ${ref.diagramName}, trying fuzzy matching...`);

          // Try case-insensitive matching
          for (const [diagName, diag] of diagramMap.entries()) {
            if (diagName.toLowerCase() === ref.diagramName.toLowerCase()) {
              refDiagram = diag;
              console.log(`Found case-insensitive match: ${diagName}`);
              break;
            }
          }

          // Try partial matching
          if (!refDiagram) {
            for (const [diagName, diag] of diagramMap.entries()) {
              if (diagName.includes(ref.diagramName) || ref.diagramName.includes(diagName)) {
                refDiagram = diag;
                console.log(`Found partial match: ${diagName} for ${ref.diagramName}`);
                break;
              }
            }
          }

          // Try matching against common patterns
          if (!refDiagram) {
            const normalizedRefName = ref.diagramName.toLowerCase()
              .replace(/^(ref\s+|sd\s+)/i, '')
              .replace(/[_\s-]+/g, '')
              .trim();

            for (const [diagName, diag] of diagramMap.entries()) {
              const normalizedDiagName = diagName.toLowerCase()
                .replace(/[_\s-]+/g, '')
                .trim();

              if (normalizedDiagName.includes(normalizedRefName) ||
                normalizedRefName.includes(normalizedDiagName)) {
                refDiagram = diag;
                console.log(`Found normalized match: ${diagName} for ${ref.diagramName}`);
                break;
              }
            }
          }
        }

        if (refDiagram) {
          console.log(`Found referenced diagram: ${refDiagram.name}`);
          // Recursively get classes from referenced diagram
          const referencedClasses = getRelatedClassNamesFromDiagram(refDiagram, visited);
          referencedClasses.forEach(className => {
            relatedClassNames.add(className);
            console.log(`Added class from reference ${ref.diagramName}: ${className}`);
          });
        } else {
          console.log(`Referenced diagram not found: ${ref.diagramName}`);
          // Log available diagrams for debugging
          console.log('Available diagrams:', Array.from(diagramMap.keys()));
        }
      } else {
        console.log(`Reference ${ref.name} has no diagram name specified`);
      }
    });

    return relatedClassNames;
  };

  // For each function, find related classes through sequence diagrams
  functions.forEach(func => {
    console.log(`\nProcessing function: ${func.name} (${func.id})`);
    console.log(`Function sequence diagrams: ${func.sequenceDiagramNames}`);

    const diagramNames = func.sequenceDiagramNames;

    // Get set of class names from the sequence diagrams (including referenced diagrams)
    const allRelatedClassNames = new Set<string>();

    diagramNames.forEach(diagramName => {
      console.log(`Looking for diagram: ${diagramName}`);
      const diagram = diagramMap.get(diagramName);
      if (diagram) {
        console.log(`Found diagram: ${diagramName}`);
        const classNamesFromDiagram = getRelatedClassNamesFromDiagram(diagram);
        classNamesFromDiagram.forEach(className => allRelatedClassNames.add(className));
      } else {
        console.log(`Diagram not found: ${diagramName}`);
        // Try to find diagram with partial name matching
        const possibleDiagrams = sequenceDiagrams.filter(d =>
          d.name.toLowerCase().includes(diagramName.toLowerCase()) ||
          diagramName.toLowerCase().includes(d.name.toLowerCase())
        );
        if (possibleDiagrams.length > 0) {
          console.log(`Found possible matches:`, possibleDiagrams.map(d => d.name));
          possibleDiagrams.forEach(diagram => {
            const classNamesFromDiagram = getRelatedClassNamesFromDiagram(diagram);
            classNamesFromDiagram.forEach(className => allRelatedClassNames.add(className));
          });
        }
      }
    });

    console.log(`All related class names for function ${func.name} (including refs):`, Array.from(allRelatedClassNames));

    // Update classes with related functions
    updatedClasses.forEach((cls: ClassInfo) => {
      if (allRelatedClassNames.has(cls.name)) {
        cls.relatedFunctions = [...new Set([...cls.relatedFunctions, func.id])];
        console.log(`Added function ${func.id} to class ${cls.name}`);
      }
    });
  });

  console.log('=== Final enhanced mapping results ===');
  updatedClasses.forEach((cls: ClassInfo) => {
    if (cls.relatedFunctions.length > 0) {
      console.log(`Class ${cls.name} related to functions: ${cls.relatedFunctions}`);
    }
  });

  return updatedClasses;
};

// Generate stub code for a class with enhanced return values
export const generateStubCode = (cls: ClassInfo): string => {
  const packageLine = cls.packageName && cls.packageName !== 'default' ? `package ${cls.packageName};\n\n` : '';

  let code = `${packageLine}/**
   * Enhanced Stub for ${cls.name}
   * Generated on ${new Date().toISOString()}
   * Features: Enhanced return values and console logging
   */
  public class ${cls.name}Stub {\n`;

  // Add stub methods with enhanced return value generation
  if (cls.methods && cls.methods.length > 0) {
    cls.methods.forEach(method => {
      // Generate method signature
      const paramsList = method.parameters.map(p => `${p.type} ${p.name}`).join(', ');
      code += `    ${method.visibility} ${method.returnType} ${method.name}(${paramsList}) {\n`;

      // Add console logging with parameter info
      const paramNames = method.parameters.map(p => p.name).join(', ');
      if (paramNames) {
        code += `        System.out.println("${cls.name}Stub.${method.name}() called with: ${method.parameters.map(p => p.name + '=" + ' + p.name + ' + "').join(', ')}");\n`;
      } else {
        code += `        System.out.println("${cls.name}Stub.${method.name}() called");\n`;
      }

      // Enhanced return value generation based on method type and context
      if (method.returnType === 'void') {
        code += '        // Stub implementation - no return value\n';
      } else {
        const returnValue = generateEnhancedReturnValue(method.returnType, method.name, cls.name);
        code += `        ${method.returnType} result = ${returnValue};\n`;
        code += '        System.out.println("Returning: " + result);\n';
        code += '        return result;\n';
      }

      code += '    }\n\n';
    });
  } else {
    // Add a default constructor if no methods are found
    code += `    public ${cls.name}Stub() {\n`;
    code += `        System.out.println("${cls.name}Stub constructor called");\n`;
    code += '    }\n\n';
  }

  code += '}\n';
  return code;
};

// Enhanced return value generator based on method type and context
const generateEnhancedReturnValue = (returnType: string, methodName: string, className: string): string => {
  const lowerMethodName = methodName.toLowerCase();
  const lowerClassName = className.toLowerCase();

  // Context-aware return values based on method name patterns
  if (returnType === 'boolean' || returnType === 'Boolean') {
    if (lowerMethodName.startsWith('is') || lowerMethodName.startsWith('has') || lowerMethodName.startsWith('can')) {
      return 'true';
    } else if (lowerMethodName.includes('valid') || lowerMethodName.includes('exist')) {
      return 'true';
    } else if (lowerMethodName.includes('delete') || lowerMethodName.includes('save')) {
      return 'true'; // Success operations
    }
    return 'true';
  }

  if (returnType === 'String') {
    if (lowerMethodName.includes('id') || lowerMethodName.includes('key')) {
      return `"stub_${methodName.toLowerCase()}_12345"`;
    } else if (lowerMethodName.includes('name')) {
      return `"Stub${className}Name"`;
    } else if (lowerMethodName.includes('status')) {
      return '"ACTIVE"';
    } else if (lowerMethodName.includes('message') || lowerMethodName.includes('error')) {
      return `"Stub message from ${methodName}"`;
    } else if (lowerMethodName.includes('process') || lowerMethodName.includes('execute')) {
      return '"SUCCESS"';
    }
    return `"stub_${methodName.toLowerCase()}_result"`;
  }

  // Numeric types with context awareness
  if (['int', 'Integer'].includes(returnType)) {
    if (lowerMethodName.includes('count') || lowerMethodName.includes('size')) {
      return '5';
    } else if (lowerMethodName.includes('id')) {
      return '12345';
    } else if (lowerMethodName.includes('amount') || lowerMethodName.includes('total')) {
      return '1000';
    }
    return '42';
  }

  if (['long', 'Long'].includes(returnType)) {
    if (lowerMethodName.includes('time') || lowerMethodName.includes('timestamp')) {
      return 'System.currentTimeMillis()';
    } else if (lowerMethodName.includes('id')) {
      return '123456789L';
    }
    return '1000L';
  }

  if (['double', 'Double'].includes(returnType)) {
    if (lowerMethodName.includes('amount') || lowerMethodName.includes('price') || lowerMethodName.includes('total')) {
      return '99.99';
    } else if (lowerMethodName.includes('rate') || lowerMethodName.includes('percent')) {
      return '0.05';
    }
    return '2.718';
  }

  if (['float', 'Float'].includes(returnType)) {
    if (lowerMethodName.includes('rate') || lowerMethodName.includes('percent')) {
      return '0.15f';
    }
    return '3.14f';
  }

  // Handle other primitive types
  if (['byte', 'Byte'].includes(returnType)) return '(byte) 1';
  if (['short', 'Short'].includes(returnType)) return '(short) 100';
  if (['char', 'Character'].includes(returnType)) return "'X'";

  // Handle collection types
  if (returnType.includes('List') || returnType.includes('ArrayList')) {
    return 'new java.util.ArrayList<>()';
  }
  if (returnType.includes('Set') || returnType.includes('HashSet')) {
    return 'new java.util.HashSet<>()';
  }
  if (returnType.includes('Map') || returnType.includes('HashMap')) {
    return 'new java.util.HashMap<>()';
  }

  // Handle common object types
  if (returnType.includes('Date')) {
    return 'new java.util.Date()';
  }
  if (returnType.includes('BigDecimal')) {
    return 'new java.math.BigDecimal("100.00")';
  }

  // Default for unknown object types
  return 'null // TODO: Return appropriate stub object';
};

// Generate driver code for a class
export const generateDriverCode = (cls: ClassInfo): string => {
  const packageLine = cls.packageName ? `package ${cls.packageName};\n\n` : '';

  let code = `${packageLine}import org.junit.Test;
  import static org.junit.Assert.*;

  /**
   * Test Driver for ${cls.name}
   * Generated on ${new Date().toISOString()}
   */
  public class ${cls.name}Driver {
      private ${cls.name} testObject = new ${cls.name}();

  `;

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
    code += `        System.out.println("${cls.name}Driver successfully created ${cls.name} object");\n`;
    code += '    }\n\n';
  }

  code += '}\n';
  return code;
};

// Helper function to generate basic stub when class definition is not available
export const generateBasicStubCode = (className: string): string => {
  return `/**
   * Basic Stub for ${className}
   * Generated on ${new Date().toISOString()}
   * Note: Class definition not found, this is a minimal stub
   */
  public class ${className}Stub {
      
      public ${className}Stub() {
          // Default constructor
          System.out.println("${className}Stub created");
      }
      
      // Add commonly expected methods based on class name
      ${generateCommonMethodsForClass(className)}
      
      // Generic method to handle any calls
      public Object handleCall(String methodName, Object... args) {
          System.out.println("Stub method called: " + methodName + " on ${className}Stub");
          return null;
      }
  }
  `;
};

// Helper function to generate basic driver when class definition is not available
export const generateBasicDriverCode = (driverClassName: string, targetClassName: string): string => {
  return `import org.junit.Test;
  import static org.junit.Assert.*;

  /**
   * Basic Driver for ${driverClassName}
   * Generated on ${new Date().toISOString()}
   * Note: Class definition not found, this is a minimal driver
   */
  public class ${driverClassName}Driver {
      
      private ${targetClassName} targetObject;
      
      public void setUp() {
          targetObject = new ${targetClassName}();
      }
      
      @Test
      public void testBasicInteraction() {
          setUp();
          
          // Basic test to verify the target object can be created and interacted with
          assertNotNull(targetObject);
          System.out.println("${driverClassName}Driver successfully created ${targetClassName} object");
          
          // TODO: Add specific test methods based on your requirements
          // This driver was generated because ${driverClassName} calls ${targetClassName}
      }
      
      @Test
      public void testDriverFunctionality() {
          setUp();
          
          // Test that demonstrates ${driverClassName} can drive ${targetClassName}
          try {
              // TODO: Implement specific driver logic here
              System.out.println("Driver test completed successfully");
          } catch (Exception e) {
              fail("Driver test failed: " + e.getMessage());
          }
      }
  }
  `;
};

// Helper function to generate common methods based on class name patterns
const generateCommonMethodsForClass = (className: string): string => {
  const lowerClassName = className.toLowerCase();
  let methods = '';

  if (lowerClassName.includes('service')) {
    methods += `
    public String processRequest(String request) {
        System.out.println("${className}Stub processing request: " + request);
        return "processed_" + request;
    }
    
    public boolean isAvailable() {
        return true;
    }`;
  }

  if (lowerClassName.includes('dao') || lowerClassName.includes('repository')) {
    methods += `
    public Object save(Object entity) {
        System.out.println("${className}Stub saving entity");
        return entity;
    }
    
    public Object findById(String id) {
        System.out.println("${className}Stub finding by id: " + id);
        return new Object(); // Mock entity
    }
    
    public boolean delete(String id) {
        System.out.println("${className}Stub deleting id: " + id);
        return true;
    }`;
  }

  if (lowerClassName.includes('controller')) {
    methods += `
    public String handleRequest(String action, Object data) {
        System.out.println("${className}Stub handling request: " + action);
        return "success";
    }`;
  }

  if (lowerClassName.includes('manager') || lowerClassName.includes('handler')) {
    methods += `
    public void execute() {
        System.out.println("${className}Stub executing");
    }
    
    public String getStatus() {
        return "ready";
    }`;
  }

  return methods;
};

// Generate service stub code for REF operations
export const generateServiceStubCode = (serviceClassName: string): string => {
  // Extract likely operations from the service name and common patterns
  const generateServiceMethods = (className: string): string => {
    const lowerClassName = className.toLowerCase();
    let methods = '';

    if (lowerClassName.includes('transaction')) {
      methods += `
    public String processDeposit(String accountId, double amount) {
        System.out.println("${className}Stub.processDeposit() called with: accountId=" + accountId + ", amount=" + amount);
        return "DEPOSIT_SUCCESS_" + System.currentTimeMillis();
    }
    
    public String processWithdraw(String accountId, double amount) {
        System.out.println("${className}Stub.processWithdraw() called with: accountId=" + accountId + ", amount=" + amount);
        return "WITHDRAW_SUCCESS_" + System.currentTimeMillis();
    }
    
    public String processTransfer(String fromAccount, String toAccount, double amount) {
        System.out.println("${className}Stub.processTransfer() called");
        return "TRANSFER_SUCCESS_" + System.currentTimeMillis();
    }`;
    }

    if (lowerClassName.includes('data')) {
      methods += `
    public String insertDeposit(Object depositData) {
        System.out.println("${className}Stub.insertDeposit() called");
        return "INSERT_SUCCESS_" + System.currentTimeMillis();
    }
    
    public boolean updateNetAmount(String accountId, double amount) {
        System.out.println("${className}Stub.updateNetAmount() called with: accountId=" + accountId + ", amount=" + amount);
        return true;
    }
    
    public Object findById(String id) {
        System.out.println("${className}Stub.findById() called with: id=" + id);
        return new Object(); // Mock data object
    }`;
    }

    if (lowerClassName.includes('transform')) {
      methods += `
    public Object transformRequest(Object request) {
        System.out.println("${className}Stub.transformRequest() called");
        return request; // Echo back transformed
    }
    
    public Object transformResponse(Object response) {
        System.out.println("${className}Stub.transformResponse() called");
        return response; // Echo back transformed
    }`;
    }

    if (lowerClassName.includes('validation')) {
      methods += `
    public boolean validateRequest(Object request) {
        System.out.println("${className}Stub.validateRequest() called");
        return true; // Always valid in stub
    }
    
    public boolean checkBalance(String accountId, double amount) {
        System.out.println("${className}Stub.checkBalance() called");
        return true; // Sufficient balance in stub
    }`;
    }

    if (lowerClassName.includes('calculation')) {
      methods += `
    public double calculateFee(double amount) {
        System.out.println("${className}Stub.calculateFee() called with amount: " + amount);
        return amount * 0.01; // 1% fee
    }
    
    public double computeTotal(double amount, double fee) {
        System.out.println("${className}Stub.computeTotal() called");
        return amount + fee;
    }`;
    }

    // Add generic service methods
    methods += `
    public String execute(String operation, Object... params) {
        System.out.println("${className}Stub.execute() called with operation: " + operation);
        return "SUCCESS";
    }
    
    public boolean isAvailable() {
        System.out.println("${className}Stub.isAvailable() called");
        return true;
    }
    
    public String getStatus() {
        System.out.println("${className}Stub.getStatus() called");
        return "ACTIVE";
    }`;

    return methods;
  };

  return `/**
   * Service Stub for ${serviceClassName}
   * Generated on ${new Date().toISOString()}
   * This stub was created based on REF box operations in sequence diagrams
   */
  public class ${serviceClassName}Stub {
      
      public ${serviceClassName}Stub() {
          System.out.println("${serviceClassName}Stub created");
      }
      
      ${generateServiceMethods(serviceClassName)}
  }
  `;
};
