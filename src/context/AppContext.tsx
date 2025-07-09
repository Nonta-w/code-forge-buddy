import React, { createContext, useContext, useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  UploadedFile,
  SystemFunction,
  ClassInfo,
  SequenceDiagram,
  GeneratedCode,
  FileType,
  Message,
  ObjectNode
} from '@/types';
import {
  processRTMFile,
  processSequenceDiagramFile,
  processClassDiagramFile,
  mapFunctionsToClasses,
  generateStubCode,
  generateServiceStubCode,
  generateDriverCode,
  generateId
} from '@/utils/fileUtils';

// Add new interface for code generation sessions
interface CodeGenerationSession {
  id: string;
  name: string;
  selectedClasses: string[];
  codes: GeneratedCode[];
  timestamp: Date;
}

// Add local storage keys
const STORAGE_KEYS = {
  UPLOADED_FILES: 'stub_driver_uploaded_files',
  SYSTEM_FUNCTIONS: 'stub_driver_system_functions',
  SEQUENCE_DIAGRAMS: 'stub_driver_sequence_diagrams',
  ALL_CLASSES: 'stub_driver_all_classes',
  GENERATED_CODES: 'stub_driver_generated_codes',
  CODE_SESSIONS: 'stub_driver_code_sessions',
  CURRENT_STEP: 'stub_driver_current_step'
};

interface AppContextType {
  // Files
  uploadedFiles: UploadedFile[];
  addFile: (file: File, type: FileType) => Promise<void>;
  removeFile: (id: string) => void;
  resetAll: () => void;

  // RTM and Functions
  systemFunctions: SystemFunction[];
  selectedFunctionId: string | null;
  setSelectedFunctionId: (id: string | null) => void;

  // Classes
  allClasses: ClassInfo[];
  filteredClasses: ClassInfo[];
  selectedClassIds: string[];
  toggleClassSelection: (id: string) => void;

  // Sequence Diagrams
  sequenceDiagrams: SequenceDiagram[];

  // Code Generation
  generatedCodes: GeneratedCode[];
  codeSessions: CodeGenerationSession[];
  generateCode: () => void;

  // UI State
  currentStep: number;
  setCurrentStep: (step: number) => void;

  // Status flags
  isLoading: boolean;
  isGenerating: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  // Files state
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.UPLOADED_FILES);
    return saved ? JSON.parse(saved) : [];
  });

  // RTM state
  const [systemFunctions, setSystemFunctions] = useState<SystemFunction[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SYSTEM_FUNCTIONS);
    return saved ? JSON.parse(saved) : [];
  });
  const [selectedFunctionId, setSelectedFunctionId] = useState<string | null>(null);

  // Classes state
  const [allClasses, setAllClasses] = useState<ClassInfo[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.ALL_CLASSES);
    const classes = saved ? JSON.parse(saved) : [];
    console.log('Loaded classes from localStorage:', classes.length);
    return classes;
  });
  const [filteredClasses, setFilteredClasses] = useState<ClassInfo[]>([]);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);

  // Sequence Diagrams state
  const [sequenceDiagrams, setSequenceDiagrams] = useState<SequenceDiagram[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SEQUENCE_DIAGRAMS);
    return saved ? JSON.parse(saved) : [];
  });

  // Generated Code state
  const [generatedCodes, setGeneratedCodes] = useState<GeneratedCode[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.GENERATED_CODES);
    return saved ? JSON.parse(saved) : [];
  });

  // Code Sessions state
  const [codeSessions, setCodeSessions] = useState<CodeGenerationSession[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CODE_SESSIONS);
    return saved ? JSON.parse(saved) : [];
  });

  // UI state - Load the current step from localStorage or default to 1
  const [currentStep, setCurrentStep] = useState<number>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CURRENT_STEP);
    return saved ? parseInt(saved, 10) : 1;
  });

  // Status flags
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  // Add file
  const addFile = async (file: File, type: FileType) => {
    try {
      setIsLoading(true);

      // Read file content
      const reader = new FileReader();
      const content = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
      });

      // Create uploaded file object
      const uploadedFile: UploadedFile = {
        id: generateId(),
        name: file.name,
        type,
        size: file.size,
        lastModified: file.lastModified,
        content,
        timestamp: new Date()
      };

      // Process file based on type
      if (type === 'rtm') {
        const functions = await processRTMFile(file);
        console.log('Setting system functions:', functions);
        setSystemFunctions(functions);
      } else if (type === 'sequenceDiagram') {
        const diagram = await processSequenceDiagramFile(file);
        if (diagram) {
          console.log('Adding sequence diagram to state:', diagram);
          setSequenceDiagrams(prev => {
            const updated = [...prev, diagram];
            console.log('Updated sequence diagrams state:', updated);
            return updated;
          });
        }
      } else if (type === 'classDiagram') {
        const classes = await processClassDiagramFile(file);
        if (classes && classes.length > 0) {
          console.log('Setting classes from class diagram:', classes.length, 'classes');
          console.log('Class names:', classes.map(c => c.name));
          setAllClasses(classes);
        } else {
          console.log('No classes extracted from class diagram');
        }
      }

      // Update uploaded files
      setUploadedFiles(prev => [...prev, uploadedFile]);
      toast.success(`File ${file.name} uploaded successfully`);
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error(`Failed to upload ${file.name}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Remove file
  const removeFile = (id: string) => {
    const fileToRemove = uploadedFiles.find(f => f.id === id);
    if (!fileToRemove) return;

    // Remove file and related data
    if (fileToRemove.type === 'rtm') {
      setSystemFunctions([]);
      setSelectedFunctionId(null);
    } else if (fileToRemove.type === 'sequenceDiagram') {
      setSequenceDiagrams(prev => prev.filter(d => d.name !== fileToRemove.name));
    } else if (fileToRemove.type === 'classDiagram') {
      setAllClasses([]);
      setFilteredClasses([]);
    }

    setUploadedFiles(prev => prev.filter(f => f.id !== id));
    toast.success(`File ${fileToRemove.name} removed`);
  };

  // Toggle class selection
  const toggleClassSelection = (id: string) => {
    setSelectedClassIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(classId => classId !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  // Generate code for both stub/driver
  const generateCode = () => {
    try {
      setIsGenerating(true);

      const selectedClasses = allClasses.filter(cls => selectedClassIds.includes(cls.id));
      const newGeneratedCodes: GeneratedCode[] = [];
      const generatedFileNames = new Set<string>(); // Track generated file names to prevent duplicates

      // Create a map of class names to class objects for quick lookup
      const classMap = new Map<string, ClassInfo>();
      allClasses.forEach(cls => {
        classMap.set(cls.name, cls);
      });

      // Find which classes need stubs and drivers based on interaction with selected classes
      const selectedClassNames = new Set(selectedClasses.map(cls => cls.name));
      const callGraph = new Map<string, Set<string>>(); // caller -> called classes

      // Helper function to map REF operations to likely class names
      const mapOperationToClassName = (operationName: string): string => {
        const lowerOp = operationName.toLowerCase();

        // Common patterns for operation-to-class mapping
        if (lowerOp.includes('deposit')) {
          return 'TransactionService';
        }
        if (lowerOp.includes('withdraw')) {
          return 'TransactionService';
        }
        if (lowerOp.includes('transfer')) {
          return 'TransactionService';
        }
        if (lowerOp.includes('process')) {
          return 'TransactionService';
        }
        if (lowerOp.includes('insert') || lowerOp.includes('save') || lowerOp.includes('store')) {
          return 'DataService';
        }
        if (lowerOp.includes('update') || lowerOp.includes('modify')) {
          return 'DataService';
        }
        if (lowerOp.includes('transform') || lowerOp.includes('convert')) {
          return 'TransformService';
        }
        if (lowerOp.includes('validate') || lowerOp.includes('check')) {
          return 'ValidationService';
        }
        if (lowerOp.includes('calculate') || lowerOp.includes('compute')) {
          return 'CalculationService';
        }
        if (lowerOp.includes('request') || lowerOp.includes('call')) {
          return 'RequestService';
        }
        if (lowerOp.includes('response') || lowerOp.includes('reply')) {
          return 'ResponseService';
        }

        // Default: try to derive from operation name
        const capitalized = operationName.charAt(0).toUpperCase() + operationName.slice(1);
        return capitalized + 'Service';
      };

      // Helper function to process a diagram and its references recursively
      const processSequenceDiagramRecursively = (diagram: SequenceDiagram, visited: Set<string> = new Set()) => {
        if (visited.has(diagram.name)) {
          return;
        }
        visited.add(diagram.name);

        console.log(`Processing diagram: ${diagram.name} for call graph`);

        // Process messages in current diagram
        diagram.messages.forEach(message => {
          const fromObj = diagram.objects.find(obj => obj.id === message.from);
          const toObj = diagram.objects.find(obj => obj.id === message.to);

          if (fromObj && toObj && fromObj.type && toObj.type) {
            console.log(`Analyzing message: "${message.name}" from ${fromObj.type} to ${toObj.type}, type: ${message.type}`);

            // FIXED: Better detection of call vs return messages
            const isReturnMessage = detectReturnMessage(message, fromObj, toObj);

            if (isReturnMessage) {
              console.log(`  → Skipping return message: ${message.name}`);
              return;
            }

            // Skip self-calls
            if (fromObj.type === toObj.type) {
              console.log(`  → Skipping self-call: ${fromObj.type} → ${toObj.type}`);
              return;
            }

            // Skip messages to/from actors and refs
            if (fromObj.type === 'ACTOR' || toObj.type === 'ACTOR' ||
              fromObj.type === 'REF' || toObj.type === 'REF') {
              console.log(`  → Skipping actor/ref message: ${fromObj.type} → ${toObj.type}`);
              return;
            }

            // This is a valid call message - record it
            if (!callGraph.has(fromObj.type)) {
              callGraph.set(fromObj.type, new Set<string>());
            }
            callGraph.get(fromObj.type)?.add(toObj.type);
            console.log(`  → Added call: ${fromObj.type} calls ${toObj.type}`);
          }
        });

        diagram.references.forEach(ref => {
          if (ref.diagramName) {
            let refDiagram = sequenceDiagrams.find(d => d.name === ref.diagramName);

            if (!refDiagram) {
              refDiagram = sequenceDiagrams.find(d =>
                d.name.toLowerCase().includes(ref.diagramName.toLowerCase()) ||
                ref.diagramName.toLowerCase().includes(d.name.toLowerCase())
              );
            }

            if (refDiagram) {
              processSequenceDiagramRecursively(refDiagram, visited);
            } else {
              const serviceClassName = mapOperationToClassName(ref.diagramName);
              const refObject = diagram.objects.find(obj => obj.name === ref.name || obj.type === 'REF');

              if (refObject) {
                diagram.messages.forEach(msg => {
                  const fromObj = diagram.objects.find(obj => obj.id === msg.from);
                  const toObj = diagram.objects.find(obj => obj.id === msg.to);

                  if (fromObj && toObj) {
                    if (msg.to === refObject.id && fromObj.type !== 'ACTOR' && fromObj.type !== 'REF') {
                      if (!callGraph.has(fromObj.type)) {
                        callGraph.set(fromObj.type, new Set<string>());
                      }
                      callGraph.get(fromObj.type)?.add(serviceClassName);
                    }
                    if (msg.from === refObject.id && toObj.type !== 'ACTOR' && toObj.type !== 'REF') {
                      if (!callGraph.has(serviceClassName)) {
                        callGraph.set(serviceClassName, new Set<string>());
                      }
                      callGraph.get(serviceClassName)?.add(toObj.type);
                    }
                  }
                });
              } else {
                selectedClasses.forEach(cls => {
                  if (!callGraph.has(cls.name)) {
                    callGraph.set(cls.name, new Set<string>());
                  }
                  callGraph.get(cls.name)?.add(serviceClassName);
                });
              }
            }
          }
        });
      };

      // Helper function to detect if a message is a return message
      const detectReturnMessage = (message: Message, fromObj: ObjectNode, toObj: ObjectNode): boolean => {
        const messageName = message.name?.toLowerCase() || '';
        const messageType = message.type?.toLowerCase() || '';

        console.log(`    Analyzing message: "${message.name}" - Type: ${messageType}`);

        // 1. Check message type explicitly
        if (messageType === 'return' || messageType === 'reply' || messageType === 'response') {
          console.log(`    → Return by type: ${messageType}`);
          return true;
        }

        // 2. Check for explicit return keywords
        const returnKeywords = [
          /^(return|reply|response)/i,
          /\breturn\b/i,
          /\breply\b/i,
          /\bresponse\b/i
        ];

        for (const pattern of returnKeywords) {
          if (pattern.test(messageName)) {
            console.log(`    → Return by keyword pattern`);
            return true;
          }
        }

        // 3. Data type and value patterns (returns)
        const returnDataPatterns = [
          /^(void|null|undefined)$/i,                    // void, null, undefined
          /^[A-Z][a-zA-Z]*\s+(object|instance|data)$/i, // "Account object", "User instance", "Transaction data"
          /^[A-Z][a-zA-Z]*\[\]$/i,                      // "String[]", "Account[]" - array returns
          /^List<[^>]+>$/i,                             // "List<Account>", "List<String>"
          /^Map<[^>]+>$/i,                              // "Map<String, Account>"
          /^Optional<[^>]+>$/i,                         // "Optional<Account>"
          /^\w+\s*[+\-*/=]\s*\w+/,                     // "balance += 100", "count = 5"
          /^(true|false)$/i,                           // boolean literals
          /^\d+(\.\d+)?$/,                             // number literals: "123", "45.67"
          /^"[^"]*"$/,                                 // string literals: "success", "error message"
          /^'[^']*'$/,                                 // single quote strings: 'completed'
          /^\{.*\}$/,                                  // JSON objects: "{id: 123, name: 'test'}"
          /^\[.*\]$/,                                  // Arrays: "[1, 2, 3]", "['a', 'b']"
        ];

        for (const pattern of returnDataPatterns) {
          if (pattern.test(messageName)) {
            console.log(`    → Return by data pattern: ${pattern}`);
            return true;
          }
        }

        // 4. Enhanced method call detection
        if (messageName.includes('(') && messageName.includes(')')) {
          console.log(`    → Has parentheses, analyzing...`);

          // 4a. FIXED: Specific return action patterns (only specific methods that are clearly return actions)
          const returnActionPatterns = [
            /\.(send|emit|publish|notify)\s*\(/i,                       // Communication methods
            /\.(log|trace|debug|info|warn|error|print|println)\s*\(/i, // Logging methods
            /\.(close|dispose|cleanup|finalize|shutdown)\s*\(/i,       // Cleanup methods
          ];

          for (const pattern of returnActionPatterns) {
            if (pattern.test(messageName)) {
              console.log(`    → Return action pattern matched: ${pattern}`);
              return true;
            }
          }

          // 4b. FIXED: State change methods - need context analysis
          // Only consider these as return actions if they're clearly side effects
          const contextualReturnPatterns = [
            /\.(update|set|put|add|remove|delete|clear|reset)\s*\(/i,   // State change methods
            /\.(save|persist|store|write|flush)\s*\(/i,                 // Persistence methods
          ];

          for (const pattern of contextualReturnPatterns) {
            if (pattern.test(messageName)) {
              // Additional context check: if it's a direct property access on an object name
              // that suggests it's a side effect return action
              const directPropertyPattern = /^[a-z]+\.[a-z]+\(/i;
              if (directPropertyPattern.test(messageName)) {
                // Check if the object name suggests it's a side effect
                const sideEffectObjects = ['cache', 'storage', 'log', 'logger', 'database', 'db', 'repo', 'repository'];
                const objectName = messageName.split('.')[0];
                if (sideEffectObjects.includes(objectName)) {
                  console.log(`    → Side effect return action: ${objectName}.${pattern}`);
                  return true;
                }
              }
            }
          }

          // 4c. Definite method call patterns (these are always calls, never returns)
          const definiteCallPatterns = [
            /^[a-z][a-zA-Z]*\s*\(/,                                     // methodName( - simple method calls
            /^[A-Z][a-zA-Z]*\s*\(/,                                     // ClassName( - constructors
            /\.(get|find|fetch|retrieve|load|read|query|search|select)\s*\(/i, // Data retrieval methods
            /\.(create|make|build|construct|new|generate)\s*\(/i,      // Creation methods
            /\.(process|execute|run|perform|handle|manage|do)\s*\(/i,  // Processing methods
            /\.(validate|verify|check|test|confirm|ensure)\s*\(/i,     // Validation methods
            /\.(calculate|compute|sum|count|total|aggregate)\s*\(/i,   // Calculation methods
            /\.(connect|disconnect|open|start|stop|begin|end|init)\s*\(/i, // Lifecycle methods
            /\.(deposit|withdraw|transfer|payment|transaction)\s*\(/i, // Business operations
            /^[a-z]+\.(get|find|query|select|retrieve)\s*\(/i,        // Specific: object.getXXX() calls
          ];

          for (const pattern of definiteCallPatterns) {
            if (pattern.test(messageName)) {
              console.log(`    → Definite call pattern: ${pattern}`);
              return false; // This is definitely a method call
            }
          }

          // 4d. Default for property.method() calls - assume they are method calls unless proven otherwise
          const propertyMethodPattern = /^[a-z][a-zA-Z]*\.[a-z][a-zA-Z]*\(/i;
          if (propertyMethodPattern.test(messageName)) {
            console.log(`    → Property method call - defaulting to CALL`);
            return false; // Default property.method() calls to be method calls
          }

          // Default for other parentheses: assume it's a call
          console.log(`    → Default: method with parentheses = call`);
          return false;
        }

        // 5. Single words or phrases without parentheses
        if (!messageName.includes('(')) {
          console.log(`    → No parentheses, checking for return data indicators...`);

          // Return data indicators
          const returnIndicators = [
            'object', 'instance', 'data', 'result', 'value', 'response',
            '=', '+=', '-=', '*=', '/=', '++', '--',
            'success', 'error', 'failed', 'completed', 'finished',
            'updated', 'saved', 'deleted', 'created'
          ];

          for (const indicator of returnIndicators) {
            if (messageName.includes(indicator)) {
              console.log(`    → Return indicator found: ${indicator}`);
              return true;
            }
          }

          // If it's a short simple word without indicators, could be either
          // Let's be conservative and assume it's return data if it's not obviously a command
          const commandWords = ['start', 'stop', 'begin', 'end', 'run', 'execute', 'process', 'handle'];
          const isCommand = commandWords.some(cmd => messageName.includes(cmd));

          if (!isCommand && messageName.length < 20) {
            console.log(`    → Short non-command word = likely return data`);
            return true;
          }
        }

        // Default: assume it's a call message
        console.log(`    → Default: call message`);
        return false;
      };

      // Build call graph from sequence diagrams
      sequenceDiagrams.forEach(diagram => {
        processSequenceDiagramRecursively(diagram);
      });

      console.log('Call graph:', callGraph);
      console.log('Selected classes for testing:', selectedClassNames);

      // FIXED: Collect all needed stubs and drivers FIRST, then generate them
      const neededStubs = new Set<string>();
      const neededDrivers = new Set<string>();

      // For each selected class, determine what stubs and drivers are needed
      selectedClasses.forEach(classUnderTest => {
        console.log(`Analyzing dependencies for class under test: ${classUnderTest.name}`);

        // 1. Collect STUBS for classes that are CALLED BY the class under test
        const calledClasses = callGraph.get(classUnderTest.name) || new Set<string>();
        calledClasses.forEach(calledClassName => {
          if (!selectedClassNames.has(calledClassName)) {
            neededStubs.add(calledClassName);
            console.log(`Need stub for: ${calledClassName} (called by ${classUnderTest.name})`);
          }
        });

        // 2. Collect DRIVERS for classes that CALL the class under test
        callGraph.forEach((calledClasses, callerClassName) => {
          if (calledClasses.has(classUnderTest.name)) {
            if (!selectedClassNames.has(callerClassName)) {
              neededDrivers.add(callerClassName);
              console.log(`Need driver for: ${callerClassName} (calls ${classUnderTest.name})`);
            }
          }
        });
      });

      console.log('All needed stubs:', Array.from(neededStubs));
      console.log('All needed drivers:', Array.from(neededDrivers));

      // Now generate stubs - only once per class
      neededStubs.forEach(stubClassName => {
        const stubFileName = `${stubClassName}Stub.java`;

        if (!generatedFileNames.has(stubFileName)) {
          const stubClass = classMap.get(stubClassName);
          let stubCode: string;

          if (stubClass) {
            // We have the class definition, generate detailed stub
            stubCode = generateStubCode(stubClass);
            console.log(`Generated detailed stub for ${stubClassName}`);
          } else {
            // No class definition, generate service stub
            stubCode = generateServiceStubCode(stubClassName);
            console.log(`Generated service stub for ${stubClassName}`);
          }

          newGeneratedCodes.push({
            id: generateId(),
            fileName: stubFileName,
            fileContent: stubCode,
            type: 'stub',
            timestamp: new Date(),
            relatedClass: stubClassName
          });
          generatedFileNames.add(stubFileName);
        }
      });

      // Generate drivers
      neededDrivers.forEach(driverClassName => {
        const driverFileName = `${driverClassName}Driver.java`;

        if (!generatedFileNames.has(driverFileName)) {
          const driverClass = classMap.get(driverClassName);

          // Find which selected class this driver should test
          const targetClasses = selectedClasses.filter(cls =>
            callGraph.get(driverClassName)?.has(cls.name)
          );

          // Use the first target class (in case there are multiple)
          const targetClassName = targetClasses.length > 0 ? targetClasses[0].name : 'UnknownTarget';

          let driverCode: string;

          if (driverClass) {
            // UPDATED: Pass both driverClass and targetClassName
            driverCode = generateDriverCode(driverClass, targetClassName);
            console.log(`Generated detailed driver for ${driverClassName} -> ${targetClassName}`);
          } else {
            // Keep the basic driver as fallback
            driverCode = generateBasicDriverCode(driverClassName, targetClassName);
            console.log(`Generated basic driver for ${driverClassName} -> ${targetClassName}`);
          }

          newGeneratedCodes.push({
            id: generateId(),
            fileName: driverFileName,
            fileContent: driverCode,
            type: 'driver',
            timestamp: new Date(),
            relatedClass: driverClassName
          });
          generatedFileNames.add(driverFileName);
        }
      });

      // Check if any stubs or drivers were generated
      if (newGeneratedCodes.length === 0) {
        const selectedClassNames = selectedClasses.map(cls => cls.name).join(', ');
        toast.success(`${selectedClassNames} can be tested independently - no additional stubs/drivers needed.`);

        // Create a brief summary file
        const summaryContent = `Test Analysis Summary
  Generated: ${new Date().toLocaleString()}

  Selected Classes: ${selectedClassNames}

  Result: No stubs or drivers required.
  These classes can be tested directly with JUnit/TestNG.

  Call Graph Analysis:
  ${Array.from(callGraph.entries()).map(([caller, called]) =>
          `${caller} → [${Array.from(called).join(', ')}]`
        ).join('\n')}
  `;

        const summaryCode: GeneratedCode = {
          id: generateId(),
          fileName: 'TestAnalysisSummary.txt',
          fileContent: summaryContent,
          type: 'driver',
          timestamp: new Date(),
          relatedClass: 'Analysis'
        };

        newGeneratedCodes.push(summaryCode);
      }

      // Create new session
      const sessionName = selectedClasses.map(cls => cls.name).join(', ');
      const newSession: CodeGenerationSession = {
        id: generateId(),
        name: sessionName,
        selectedClasses: selectedClasses.map(cls => cls.name),
        codes: newGeneratedCodes,
        timestamp: new Date()
      };

      setGeneratedCodes(prev => [...prev, ...newGeneratedCodes]);
      setCodeSessions(prev => [...prev, newSession]);
      setCurrentStep(4);

      const fileCount = newGeneratedCodes.filter(code => code.fileName !== 'TestAnalysisSummary.txt').length;

      if (fileCount > 0) {
        toast.success(`Generated ${fileCount} code files for testing: ${sessionName}`);
      }
    } catch (error) {
      console.error('Error generating code:', error);
      toast.error('Failed to generate code');
    } finally {
      setIsGenerating(false);
    }
  };


  // Helper function to generate basic stub when class definition is not available
  const generateBasicStubCode = (className: string): string => {
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
  const generateBasicDriverCode = (driverClassName: string, targetClassName: string): string => {
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

  // Reset all state
  const resetAll = () => {
    setUploadedFiles([]);
    setSystemFunctions([]);
    setSelectedFunctionId(null);
    setAllClasses([]);
    setFilteredClasses([]);
    setSelectedClassIds([]);
    setSequenceDiagrams([]);
    setGeneratedCodes([]);
    setCodeSessions([]);
    setCurrentStep(1);
    setIsLoading(false);
    setIsGenerating(false);
  };

  // Update filtered classes when selected function changes (remove auto step progression)
  useEffect(() => {
    if (selectedFunctionId) {
      console.log('=== Filtering classes for function ===');
      console.log('Selected function ID:', selectedFunctionId);
      console.log('All classes:', allClasses.map(c => ({ name: c.name, relatedFunctions: c.relatedFunctions })));

      // Filter classes related to the selected function
      const filtered = allClasses.filter(
        cls => cls.relatedFunctions.includes(selectedFunctionId)
      );

      console.log('Filtered classes:', filtered.map(c => c.name));
      setFilteredClasses(filtered);
      // Clear selected class ids
      setSelectedClassIds([]);

      // Don't automatically move to step 3 - let user click button
    } else {
      setFilteredClasses([]);
    }
  }, [selectedFunctionId, allClasses]);

  // Update class relationships when all required data is available
  useEffect(() => {
    console.log('=== Checking for mapping update ===');
    console.log('System functions:', systemFunctions.length);
    console.log('All classes:', allClasses.length);
    console.log('Sequence diagrams:', sequenceDiagrams.length);

    if (
      systemFunctions.length > 0 &&
      allClasses.length > 0 &&
      sequenceDiagrams.length > 0
    ) {
      console.log('=== Starting class relationship mapping ===');
      const updatedClasses = mapFunctionsToClasses(
        systemFunctions,
        sequenceDiagrams,
        allClasses
      );
      console.log('=== Mapping complete, updating classes ===');
      console.log('Classes with relationships:', updatedClasses.filter(c => c.relatedFunctions.length > 0).map(c => ({ name: c.name, functions: c.relatedFunctions })));
      setAllClasses(updatedClasses);
    }
  }, [systemFunctions, sequenceDiagrams, allClasses.length]); // Changed: added allClasses.length as dependency

  // Save to localStorage whenever state changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.UPLOADED_FILES, JSON.stringify(uploadedFiles));
  }, [uploadedFiles]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SYSTEM_FUNCTIONS, JSON.stringify(systemFunctions));
  }, [systemFunctions]);

  useEffect(() => {
    console.log('Saving classes to localStorage:', allClasses.length);
    localStorage.setItem(STORAGE_KEYS.ALL_CLASSES, JSON.stringify(allClasses));
  }, [allClasses]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SEQUENCE_DIAGRAMS, JSON.stringify(sequenceDiagrams));
  }, [sequenceDiagrams]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.GENERATED_CODES, JSON.stringify(generatedCodes));
  }, [generatedCodes]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CODE_SESSIONS, JSON.stringify(codeSessions));
  }, [codeSessions]);

  // Save current step to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CURRENT_STEP, currentStep.toString());
  }, [currentStep]);

  const value = {
    uploadedFiles,
    addFile,
    removeFile,
    resetAll,
    systemFunctions,
    selectedFunctionId,
    setSelectedFunctionId,
    allClasses,
    filteredClasses,
    selectedClassIds,
    toggleClassSelection,
    sequenceDiagrams,
    generatedCodes,
    codeSessions,
    generateCode,
    currentStep,
    setCurrentStep,
    isLoading,
    isGenerating
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

