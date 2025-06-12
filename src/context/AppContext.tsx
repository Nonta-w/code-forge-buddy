import React, { createContext, useContext, useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  UploadedFile,
  SystemFunction,
  ClassInfo,
  SequenceDiagram,
  GeneratedCode,
  FileType
} from '@/types';
import {
  processRTMFile,
  processSequenceDiagramFile,
  processClassDiagramFile,
  mapFunctionsToClasses,
  generateStubCode,
  generateDriverCode,
  generateServiceStubCode,
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

  // Generate code
  const generateCode = () => {
    try {
      setIsGenerating(true);

      const selectedClasses = allClasses.filter(cls => selectedClassIds.includes(cls.id));
      const newGeneratedCodes: GeneratedCode[] = [];
      const generatedFileNames = new Set<string>();

      console.log("=== STARTING GENERATECODE DEBUG ===");
      console.log("Selected classes:", selectedClasses.map(c => c.name));
      console.log("Available sequence diagrams:", sequenceDiagrams.map(d => d.name));

      // Simple approach: Force create service stubs for all REF operations found
      const foundRefOperations = new Set<string>();

      sequenceDiagrams.forEach(diagram => {
        console.log(`\n--- Processing diagram: ${diagram.name} ---`);
        console.log("References found:", diagram.references);

        diagram.references.forEach(ref => {
          console.log(`REF: ${ref.name} -> ${ref.diagramName}`);
          foundRefOperations.add(ref.diagramName);
        });
      });

      console.log("\n=== ALL REF OPERATIONS FOUND ===");
      console.log(Array.from(foundRefOperations));

      // Helper function to map operations to service classes
      const mapOperationToClassName = (operationName: string): string => {
        const lowerOp = operationName.toLowerCase();

        if (lowerOp.includes('deposit') || lowerOp.includes('withdraw') || lowerOp.includes('transfer') || lowerOp.includes('process')) {
          return 'TransactionService';
        }
        if (lowerOp.includes('insert') || lowerOp.includes('update') || lowerOp.includes('save') || lowerOp.includes('store')) {
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

        // Default: operation name + Service
        const capitalized = operationName.charAt(0).toUpperCase() + operationName.slice(1);
        return capitalized + 'Service';
      };

      // Create service stubs for all found REF operations
      const serviceClasses = new Set<string>();
      foundRefOperations.forEach(operation => {
        const serviceClassName = mapOperationToClassName(operation);
        serviceClasses.add(serviceClassName);
        console.log(`Operation "${operation}" -> Service "${serviceClassName}"`);
      });

      console.log("\n=== SERVICE CLASSES TO CREATE ===");
      console.log(Array.from(serviceClasses));

      // Generate the original stubs and drivers first
      const classMap = new Map<string, ClassInfo>();
      allClasses.forEach(cls => {
        classMap.set(cls.name, cls);
      });

      const selectedClassNames = new Set(selectedClasses.map(cls => cls.name));
      const callGraph = new Map<string, Set<string>>();

      // Simple call graph building (without REF processing for now)
      sequenceDiagrams.forEach(diagram => {
        diagram.messages.forEach(message => {
          const fromObj = diagram.objects.find(obj => obj.id === message.from);
          const toObj = diagram.objects.find(obj => obj.id === message.to);

          if (fromObj && toObj && fromObj.type && toObj.type &&
            fromObj.type !== toObj.type &&
            fromObj.type !== 'ACTOR' && toObj.type !== 'ACTOR' &&
            fromObj.type !== 'REF' && toObj.type !== 'REF') {

            if (!callGraph.has(fromObj.type)) {
              callGraph.set(fromObj.type, new Set<string>());
            }
            callGraph.get(fromObj.type)?.add(toObj.type);
          }
        });
      });

      // Add service classes to call graph for selected classes
      selectedClasses.forEach(cls => {
        serviceClasses.forEach(serviceClass => {
          if (!callGraph.has(cls.name)) {
            callGraph.set(cls.name, new Set<string>());
          }
          callGraph.get(cls.name)?.add(serviceClass);
          console.log(`FORCE ADDED: ${cls.name} -> ${serviceClass}`);
        });
      });

      console.log("\n=== FINAL CALL GRAPH ===");
      callGraph.forEach((called, caller) => {
        console.log(`${caller} -> [${Array.from(called).join(', ')}]`);
      });

      // Generate stubs and drivers
      selectedClasses.forEach(classUnderTest => {
        console.log(`\n--- Generating for class under test: ${classUnderTest.name} ---`);

        // 1. Generate STUBS for classes called by the class under test
        const calledClasses = callGraph.get(classUnderTest.name) || new Set<string>();
        console.log(`Classes called by ${classUnderTest.name}:`, Array.from(calledClasses));

        calledClasses.forEach(calledClassName => {
          if (!selectedClassNames.has(calledClassName)) {
            const stubFileName = `${calledClassName}Stub.java`;
            if (!generatedFileNames.has(stubFileName)) {
              const calledClass = classMap.get(calledClassName);
              let stubCode = '';

              if (calledClass) {
                // Use existing class definition
                stubCode = generateStubCode(calledClass);
                console.log(`Generated detailed stub for ${calledClassName}`);
              } else {
                // Generate service stub
                stubCode = generateServiceStubCode(calledClassName);
                console.log(`Generated SERVICE stub for ${calledClassName} (no class definition)`);
              }

              newGeneratedCodes.push({
                id: generateId(),
                fileName: stubFileName,
                fileContent: stubCode,
                type: 'stub',
                timestamp: new Date(),
                relatedClass: calledClassName
              });
              generatedFileNames.add(stubFileName);
            }
          }
        });

        // 2. Generate DRIVERS for classes that call the class under test
        callGraph.forEach((calledClasses, callerClassName) => {
          if (calledClasses.has(classUnderTest.name) && !selectedClassNames.has(callerClassName)) {
            const driverFileName = `${callerClassName}Driver.java`;
            if (!generatedFileNames.has(driverFileName)) {
              const callerClass = classMap.get(callerClassName);
              let driverCode = '';

              if (callerClass) {
                driverCode = generateDriverCode(callerClass);
              } else {
                driverCode = generateBasicDriverCode(callerClassName, classUnderTest.name);
              }

              newGeneratedCodes.push({
                id: generateId(),
                fileName: driverFileName,
                fileContent: driverCode,
                type: 'driver',
                timestamp: new Date(),
                relatedClass: callerClassName
              });
              generatedFileNames.add(driverFileName);
              console.log(`Generated driver for ${callerClassName}`);
            }
          }
        });
      });

      console.log("\n=== GENERATED FILES ===");
      newGeneratedCodes.forEach(code => {
        console.log(`${code.type.toUpperCase()}: ${code.fileName}`);
      });

      if (newGeneratedCodes.length === 0) {
        const selectedClassNames = selectedClasses.map(cls => cls.name).join(', ');
        toast.success(`${selectedClassNames} can be tested independently - no additional stubs/drivers needed.`);

        const summaryContent = `Test Analysis Summary
Generated: ${new Date().toLocaleString()}

Selected: ${selectedClassNames}
REF Operations Found: ${Array.from(foundRefOperations).join(', ')}
Service Classes Mapped: ${Array.from(serviceClasses).join(', ')}

Result: No stubs or drivers required.
These classes can be tested directly with JUnit/TestNG.

Call Graph:
${Array.from(callGraph.entries()).map(([caller, called]) =>
          `${caller} → [${Array.from(called).join(', ')}]`
        ).join('\n')}
`;

        newGeneratedCodes.push({
          id: generateId(),
          fileName: 'TestSummary.txt',
          fileContent: summaryContent,
          type: 'driver',
          timestamp: new Date(),
          relatedClass: 'Analysis'
        });
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

      const fileCount = newGeneratedCodes.filter(code => code.fileName !== 'TestSummary.txt').length;
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

