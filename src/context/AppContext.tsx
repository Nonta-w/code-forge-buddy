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
  
  // Enhanced generate code function with REF diagram support
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
      const refDiagramClasses = new Set<string>(); // Classes found in referenced diagrams
      
      // Build call graph from sequence diagrams and process REF boxes
      sequenceDiagrams.forEach(diagram => {
        console.log(`Processing diagram: ${diagram.name}`);
        
        // Process regular messages
        diagram.messages.forEach(message => {
          const fromObj = diagram.objects.find(obj => obj.id === message.from);
          const toObj = diagram.objects.find(obj => obj.id === message.to);
          
          if (fromObj && toObj && fromObj.type && toObj.type) {
            // Record that fromObj.type calls toObj.type
            if (!callGraph.has(fromObj.type)) {
              callGraph.set(fromObj.type, new Set<string>());
            }
            callGraph.get(fromObj.type)?.add(toObj.type);
          }
        });
        
        // Process REF objects to find referenced diagrams
        diagram.objects.forEach(obj => {
          if (obj.type === 'REF') {
            console.log(`Found REF object: ${obj.name}`);
            // Find the referenced diagram
            const referencedDiagram = sequenceDiagrams.find(d => d.name === obj.name);
            if (referencedDiagram) {
              console.log(`Processing referenced diagram: ${referencedDiagram.name}`);
              // Add classes from referenced diagram that should have drivers
              referencedDiagram.objects.forEach(refObj => {
                if (refObj.type && refObj.type !== 'unknown' && refObj.type !== 'ACTOR' && refObj.type !== 'REF') {
                  refDiagramClasses.add(refObj.type);
                  console.log(`Added class from referenced diagram: ${refObj.type}`);
                }
              });
              
              // Also process messages in referenced diagram
              referencedDiagram.messages.forEach(message => {
                const fromObj = referencedDiagram.objects.find(o => o.id === message.from);
                const toObj = referencedDiagram.objects.find(o => o.id === message.to);
                
                if (fromObj && toObj && fromObj.type && toObj.type) {
                  if (!callGraph.has(fromObj.type)) {
                    callGraph.set(fromObj.type, new Set<string>());
                  }
                  callGraph.get(fromObj.type)?.add(toObj.type);
                }
              });
            }
          }
        });
      });
      
      console.log('Call graph:', callGraph);
      console.log('Selected classes for testing:', selectedClassNames);
      console.log('Classes from referenced diagrams:', refDiagramClasses);
      
      // For each selected class (class under test), generate needed stubs and drivers
      selectedClasses.forEach(classUnderTest => {
        console.log(`Generating stubs and drivers for class under test: ${classUnderTest.name}`);
        
        // 1. Generate STUBS for classes that are CALLED BY the class under test
        const calledClasses = callGraph.get(classUnderTest.name) || new Set<string>();
        calledClasses.forEach(calledClassName => {
          // Only create stub if the called class is not also under test
          if (!selectedClassNames.has(calledClassName)) {
            const calledClass = classMap.get(calledClassName);
            if (calledClass) {
              const stubFileName = `${calledClassName}Stub.java`;
              if (!generatedFileNames.has(stubFileName)) {
                const stubCode = generateStubCode(calledClass, sequenceDiagrams);
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
            }
          }
        });
        
        // 2. Generate DRIVERS for classes that CALL the class under test
        callGraph.forEach((calledClasses, callerClassName) => {
          if (calledClasses.has(classUnderTest.name)) {
            // This caller class calls our class under test
            // Only create driver if the caller is not also under test
            if (!selectedClassNames.has(callerClassName)) {
              const driverFileName = `${classUnderTest.name}Driver.java`;
              if (!generatedFileNames.has(driverFileName)) {
                const driverCode = generateDriverCode(classUnderTest);
                newGeneratedCodes.push({
                  id: generateId(),
                  fileName: driverFileName,
                  fileContent: driverCode,
                  type: 'driver',
                  timestamp: new Date(),
                  relatedClass: classUnderTest.name
                });
                generatedFileNames.add(driverFileName);
                console.log(`Generated driver for ${classUnderTest.name} (called by ${callerClassName})`);
              }
            }
          }
        });
      });
      
      // 3. Generate DRIVERS for classes found in referenced diagrams (REF boxes)
      refDiagramClasses.forEach(refClassName => {
        if (!selectedClassNames.has(refClassName)) {
          const refClass = classMap.get(refClassName);
          if (refClass) {
            const driverFileName = `${refClassName}Driver.java`;
            if (!generatedFileNames.has(driverFileName)) {
              const driverCode = generateDriverCode(refClass);
              newGeneratedCodes.push({
                id: generateId(),
                fileName: driverFileName,
                fileContent: driverCode,
                type: 'driver',
                timestamp: new Date(),
                relatedClass: refClassName
              });
              generatedFileNames.add(driverFileName);
              console.log(`Generated driver for ${refClassName} (from referenced diagram)`);
            }
          }
        }
      });
      
      // If no stubs or drivers were generated, create at least a basic driver for each selected class
      if (newGeneratedCodes.length === 0) {
        selectedClasses.forEach(selectedClass => {
          const driverFileName = `${selectedClass.name}Driver.java`;
          if (!generatedFileNames.has(driverFileName)) {
            const driverCode = generateDriverCode(selectedClass);
            newGeneratedCodes.push({
              id: generateId(),
              fileName: driverFileName,
              fileContent: driverCode,
              type: 'driver',
              timestamp: new Date(),
              relatedClass: selectedClass.name
            });
            generatedFileNames.add(driverFileName);
            console.log(`Generated default driver for ${selectedClass.name}`);
          }
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
      setCurrentStep(4); // Move to code view
      toast.success(`Generated ${newGeneratedCodes.length} code files for testing: ${sessionName}`);
    } catch (error) {
      console.error('Error generating code:', error);
      toast.error('Failed to generate code');
    } finally {
      setIsGenerating(false);
    }
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

}
