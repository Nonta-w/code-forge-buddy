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
  // Enhanced generateCode function with ref box support
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

      // Helper function to process a diagram and its references recursively
      const processSequenceDiagramRecursively = (diagram: SequenceDiagram, visited: Set<string> = new Set()) => {
        // Prevent infinite recursion
        if (visited.has(diagram.name)) {
          return;
        }
        visited.add(diagram.name);

        console.log(`Processing diagram: ${diagram.name} for call graph`);

        // Process messages in current diagram
        diagram.messages.forEach(message => {
          console.log(`Processing message: ${message.name}, type: ${message.type}, from->to: ${message.from}->${message.to}`);

          const fromObj = diagram.objects.find(obj => obj.id === message.from);
          const toObj = diagram.objects.find(obj => obj.id === message.to);

          if (fromObj && toObj && fromObj.type && toObj.type) {
            console.log(`Message: ${fromObj.type} -> ${toObj.type} (${message.name})`);

            // Skip return messages, self-calls, and certain system messages
            if (message.name && (
              message.name.toLowerCase().includes('return') ||
              message.name.toLowerCase().includes('response') ||
              message.name.toLowerCase().includes('transaction') ||
              message.type === 'return' ||
              fromObj.type === toObj.type // Skip self-calls
            )) {
              console.log(`Skipping message: ${message.name} (${fromObj.type} -> ${toObj.type})`);
              return;
            }

            // Skip messages to/from actors and refs
            if (fromObj.type === 'ACTOR' || toObj.type === 'ACTOR' ||
              fromObj.type === 'REF' || toObj.type === 'REF') {
              console.log(`Skipping actor/ref message: ${message.name}`);
              return;
            }

            // Record that fromObj.type calls toObj.type
            if (!callGraph.has(fromObj.type)) {
              callGraph.set(fromObj.type, new Set<string>());
            }
            callGraph.get(fromObj.type)?.add(toObj.type);
            console.log(`Added to call graph: ${fromObj.type} calls ${toObj.type}`);
          }
        });

        // Process references to other diagrams - ENHANCED
        diagram.references.forEach(ref => {
          console.log(`Processing reference: ${ref.name} -> ${ref.diagramName}`);

          if (ref.diagramName) {
            // Find the referenced diagram
            let refDiagram = sequenceDiagrams.find(d => d.name === ref.diagramName);

            // Try fuzzy matching if exact match not found
            if (!refDiagram) {
              refDiagram = sequenceDiagrams.find(d =>
                d.name.toLowerCase().includes(ref.diagramName.toLowerCase()) ||
                ref.diagramName.toLowerCase().includes(d.name.toLowerCase())
              );
            }

            // Try normalized matching
            if (!refDiagram) {
              const normalizedRefName = ref.diagramName.toLowerCase()
                .replace(/^(ref\s+|sd\s+)/i, '')
                .replace(/[_\s-]+/g, '')
                .trim();

              refDiagram = sequenceDiagrams.find(d => {
                const normalizedDiagName = d.name.toLowerCase()
                  .replace(/[_\s-]+/g, '')
                  .trim();
                return normalizedDiagName.includes(normalizedRefName) ||
                  normalizedRefName.includes(normalizedDiagName);
              });
            }

            if (refDiagram) {
              console.log(`Found referenced diagram: ${refDiagram.name}, processing recursively...`);
              processSequenceDiagramRecursively(refDiagram, visited);
            } else {
              console.log(`Referenced diagram not found: ${ref.diagramName}`);
              console.log('Available diagrams:', sequenceDiagrams.map(d => d.name));
            }
          }
        });
      };

      // Build call graph from sequence diagrams (including referenced diagrams)
      sequenceDiagrams.forEach(diagram => {
        processSequenceDiagramRecursively(diagram);
      });

      console.log('Enhanced call graph (including refs):', callGraph);
      console.log('Selected classes for testing:', selectedClassNames);

      // For each selected class (class under test), generate needed stubs and drivers
      selectedClasses.forEach(classUnderTest => {
        console.log(`Generating stubs and drivers for class under test: ${classUnderTest.name}`);

        // 1. Generate STUBS for classes that are CALLED BY the class under test
        const calledClasses = callGraph.get(classUnderTest.name) || new Set<string>();
        console.log(`Classes called by ${classUnderTest.name}:`, Array.from(calledClasses));

        calledClasses.forEach(calledClassName => {
          // Only create stub if the called class is not also under test
          if (!selectedClassNames.has(calledClassName)) {
            const calledClass = classMap.get(calledClassName);
            if (calledClass) {
              const stubFileName = `${calledClassName}Stub.java`;
              if (!generatedFileNames.has(stubFileName)) {
                const stubCode = generateStubCode(calledClass);
                newGeneratedCodes.push({
                  id: generateId(),
                  fileName: stubFileName,
                  fileContent: stubCode,
                  type: 'stub',
                  timestamp: new Date(),
                  relatedClass: calledClassName
                });
                generatedFileNames.add(stubFileName);
                console.log(`Generated stub for ${calledClassName} (called by ${classUnderTest.name})`);
              }
            } else {
              console.log(`Class ${calledClassName} not found in class map, creating basic stub`);
              // Create a basic stub even if we don't have the class definition
              const stubFileName = `${calledClassName}Stub.java`;
              if (!generatedFileNames.has(stubFileName)) {
                const basicStubCode = generateBasicStubCode(calledClassName);
                newGeneratedCodes.push({
                  id: generateId(),
                  fileName: stubFileName,
                  fileContent: basicStubCode,
                  type: 'stub',
                  timestamp: new Date(),
                  relatedClass: calledClassName
                });
                generatedFileNames.add(stubFileName);
                console.log(`Generated basic stub for ${calledClassName} (class definition not found)`);
              }
            }
          }
        });

        // 2. Generate DRIVERS for classes that CALL the class under test
        callGraph.forEach((calledClasses, callerClassName) => {
          if (calledClasses.has(classUnderTest.name)) {
            // This caller class calls our class under test
            // Only create driver if the caller is not also under test
            if (!selectedClassNames.has(callerClassName)) {
              const driverFileName = `${callerClassName}Driver.java`;
              if (!generatedFileNames.has(driverFileName)) {
                // Find the caller class info to generate proper driver
                const callerClass = classMap.get(callerClassName);
                if (callerClass) {
                  const driverCode = generateDriverCode(callerClass);
                  newGeneratedCodes.push({
                    id: generateId(),
                    fileName: driverFileName,
                    fileContent: driverCode,
                    type: 'driver',
                    timestamp: new Date(),
                    relatedClass: callerClassName
                  });
                  generatedFileNames.add(driverFileName);
                  console.log(`Generated driver for ${callerClassName} (to call ${classUnderTest.name})`);
                } else {
                  console.log(`Class ${callerClassName} not found in class map, creating basic driver`);
                  // Create a basic driver even if we don't have the class definition
                  const basicDriverCode = generateBasicDriverCode(callerClassName, classUnderTest.name);
                  newGeneratedCodes.push({
                    id: generateId(),
                    fileName: driverFileName,
                    fileContent: basicDriverCode,
                    type: 'driver',
                    timestamp: new Date(),
                    relatedClass: callerClassName
                  });
                  generatedFileNames.add(driverFileName);
                  console.log(`Generated basic driver for ${callerClassName} (class definition not found)`);
                }
              }
            }
          }
        });
      });

      // Check if any stubs or drivers were generated
      if (newGeneratedCodes.length === 0) {
        // No stubs or drivers needed - inform the user
        const selectedClassNames = selectedClasses.map(cls => cls.name).join(', ');
        toast.success(`No stubs or drivers needed for ${selectedClassNames}. The selected classes can be tested independently without additional test infrastructure.`);

        // Create a summary file explaining why no files were generated
        const summaryContent = `Test Analysis Summary
Generated on: ${new Date().toISOString()}

Selected Classes for Testing: ${selectedClassNames}

Analysis Results:
- No external callers found that require drivers
- No dependencies found that require stubs
- The selected classes appear to be self-contained or only use standard library classes

Recommendation:
The selected classes can be tested directly using standard unit testing frameworks (JUnit, TestNG, etc.) without additional stub or driver infrastructure.

Call Graph Analysis:
${Array.from(callGraph.entries()).map(([caller, called]) =>
          `${caller} -> [${Array.from(called).join(', ')}]`
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
      setCurrentStep(4); // Move to code view

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